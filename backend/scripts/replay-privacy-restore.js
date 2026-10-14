process.env.DOTENV_CONFIG_QUIET='true';
const fs=require('node:fs/promises'),path=require('node:path');
async function main(){
  process.chdir(path.resolve(__dirname,'..'));
  const env=require('../src/config/env'),{Pool}=require('pg');
  if(!['localhost','127.0.0.1'].includes(env.DB_HOST)||env.DB_CONNECTION_STRING||process.env.NODE_ENV==='production')throw Error('LOCAL_ONLY');
  const args=process.argv.slice(2),options={};
  const keys=['database','media','receipt','sha256','actor','acknowledged'];
  if(args.length!==keys.length*2)throw Error('INVALID_ARGUMENTS');
  for(let i=0;i<args.length;i+=2){const key=args[i].slice(2);if(!args[i].startsWith('--')||!keys.includes(key)||options[key])throw Error('INVALID_ARGUMENTS');options[key]=args[i+1];}
  if(!/^mr05_restore_[a-f0-9]{32}$/.test(options.database)||options.acknowledged!=='true')throw Error('ISOLATED_RESTORE_REQUIRED');
  const file=path.resolve(options.receipt),s=await fs.lstat(file);
  if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o077)!==0||s.size>2_000_000||await fs.realpath(file)!==file)throw Error('UNSAFE_RECEIPT');
  const bytes=await fs.readFile(file,'utf8'),replay=require('../src/modules/privacy/restore-replay');
  replay.parseReceipt(bytes,options.sha256);
  const pool=new Pool({host:env.DB_HOST,port:env.DB_PORT,user:env.DB_USER,password:env.DB_PASSWORD,database:options.database});
  try{
    const db={getPool:()=>pool,query:(...args)=>pool.query(...args)};
    const result=await replay.reapply({db,fs,mediaDir:path.resolve(options.media),bytes,expectedDigest:options.sha256,
      actor:{userId:options.actor},acknowledged:true});
    console.log(JSON.stringify(result));
    process.exitCode=2; // Replay success does not authorize application activation.
  }finally{await pool.end();}
}
main().catch(()=>{console.error('PRIVACY_REPLAY_FAILED: verify isolated target, trusted receipt and pending reviews.');process.exitCode=1;});
