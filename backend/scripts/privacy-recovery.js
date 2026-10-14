process.env.DOTENV_CONFIG_QUIET='true';
const fs=require('node:fs/promises'),path=require('node:path');
const guard=require('../src/modules/privacy/restore-guard');
const {inventory}=require('../src/modules/privacy/backup-inventory');

async function protectedRead(file){
  const s=await fs.lstat(file);
  if(!s.isFile()||s.isSymbolicLink()||s.size>2_000_000||await fs.realpath(file)!==file)throw Error('UNSAFE_MANIFEST');
  return fs.readFile(file,'utf8');
}
async function main(){
  process.chdir(path.resolve(__dirname,'..'));process.env.DOTENV_CONFIG_QUIET='true';
  const env=require('../src/config/env');
  if(!['localhost','127.0.0.1'].includes(env.DB_HOST)||env.DB_CONNECTION_STRING||process.env.NODE_ENV==='production')throw Error('LOCAL_ONLY');
  const [command,...args]=process.argv.slice(2),options={};
  if(!['export','export-receipt','check','inventory'].includes(command)||args.length%2)throw Error('INVALID_ARGUMENTS');
  for(let i=0;i<args.length;i+=2){if(!args[i].startsWith('--')||options[args[i].slice(2)])throw Error('INVALID_ARGUMENTS');options[args[i].slice(2)]=args[i+1];}
  const allowed={export:['output'],'export-receipt':['output'],check:['manifest','sha256'],inventory:['root','output']}[command];
  if(Object.keys(options).some(k=>!allowed.includes(k))||allowed.some(k=>!options[k]))throw Error('INVALID_ARGUMENTS');
  let report;
  if(command==='inventory'){
    const root=path.resolve(options.root),repository=path.resolve(__dirname,'../..');
    if(!root.startsWith(repository+path.sep)||!['backups','.dev-run'].includes(path.relative(repository,root).split(path.sep)[0]))throw Error('LOCAL_BACKUP_ROOT_REQUIRED');
    report=await inventory(fs,root);
  }else{
    let manifest;
    if(command==='check'){
      const bytes=await protectedRead(path.resolve(options.manifest));
      if(!/^[a-f0-9]{64}$/.test(options.sha256)||guard.digest(bytes)!==options.sha256)throw Error('MANIFEST_DIGEST_MISMATCH');
      manifest=guard.validate(JSON.parse(bytes));
    }
    const db=require('../src/lib/db'),pool=db.getPool(),client=await pool.connect();
    try{
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await client.query("SET LOCAL statement_timeout='15s'");
      report=command==='export'?await guard.snapshot(client):command==='export-receipt'?
        await require('../src/modules/privacy/restore-replay').exportReceipt(client):await guard.inspect(client,manifest);
      await client.query('ROLLBACK');
    }finally{client.release();await pool.end();}
  }
  if(command==='check'){
    // Database inspection cannot certify files, logs, caches or backup expiry.
    console.log(JSON.stringify(report));process.exitCode=report.activationAllowed?0:2;return;
  }
  const target=path.resolve(options.output),directory=path.resolve(__dirname,'../../.dev-run/privacy-recovery');
  if(path.dirname(target)!==directory)throw Error('PROTECTED_OUTPUT_DIRECTORY_REQUIRED');
  await fs.mkdir(directory,{recursive:true,mode:0o700});
  if(await fs.realpath(directory)!==directory)throw Error('UNSAFE_OUTPUT_DIRECTORY');
  const bytes=JSON.stringify(report,null,2)+'\n';
  await fs.writeFile(target,bytes,{flag:'wx',mode:0o600});
  console.log(JSON.stringify({written:true,sha256:guard.digest(bytes),automaticDeletion:false}));
}
main().catch(()=>{console.error('PRIVACY_RECOVERY_FAILED: verify local schema, arguments and protected files.');process.exitCode=1;});
