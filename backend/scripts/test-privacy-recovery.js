process.env.DOTENV_CONFIG_QUIET='true';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createSweeper}=require('../src/modules/privacy/cache-sweep');
const {key}=require('../src/modules/privacy/scope-gate');
const {validate,digest}=require('../src/modules/privacy/restore-guard');
const {inventory}=require('../src/modules/privacy/backup-inventory');
async function main(){
  const a={accountId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',instagramUserId:'123'};
  const b={...a,instagramUserId:'456'};
  function provider(){let values=[a,b];return {cachedScopes:()=>values,forgetScope(scope){values=values.filter(s=>key(s)!==key(scope));}};}
  const processes=[[provider(),provider()],[provider(),provider()]];
  let calls=0,release;
  const blockedDb={async query(_sql,params){calls++;assert.deepEqual(new Set(params[0]),new Set([key(a),key(b)]));await new Promise(r=>{release=r;});return {rows:[{scope_key:key(a)}]};}};
  const sweep=createSweeper({db:blockedDb,providers:processes[0]}).sweep;
  const first=sweep();assert.equal(first,sweep());assert.equal(calls,1);release();await first;
  for(const p of processes[0])assert.deepEqual(p.cachedScopes(),[b]);
  for(const p of processes[1])assert.deepEqual(p.cachedScopes(),[a,b]);
  await createSweeper({db:{async query(){return {rows:[{scope_key:key(a)}]};}},providers:processes[1]}).sweep();
  for(const p of processes[1])assert.deepEqual(p.cachedScopes(),[b]);
  const retained=provider();await assert.rejects(createSweeper({db:{async query(){throw Error('Unavailable');}},providers:[retained]}).sweep());
  assert.deepEqual(retained.cachedScopes(),[a,b]);
  assert.throws(()=>validate({version:1,exportedAt:new Date().toISOString(),scopeKeys:['invalid'],fileHashes:[]}));
  assert.notEqual(digest('manifest'),digest('tampered manifest'));
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'privacy-inventory-'));
  try{
    const dump=path.join(root,'private-example.dump');await fs.writeFile(dump,'Synthetic backup');
    await fs.utimes(dump,new Date('2026-01-01'),new Date('2026-01-01'));
    await fs.symlink(dump,path.join(root,'link.dump'));
    const report=await inventory(fs,root,new Date('2026-02-01'));
    assert.equal(report.automaticDeletion,false);assert.equal(report.files.length,2);
    assert.equal(report.files.find(f=>f.kind==='database').retentionReview,true);
    assert.equal(report.files.find(f=>f.kind==='symlink').reviewRequired,true);
    assert.doesNotMatch(JSON.stringify(report),/private-example|Synthetic backup/);
    assert.equal(await fs.readFile(dump,'utf8'),'Synthetic backup');
    await assert.rejects(inventory(fs,path.join(root,'link.dump')),/UNSAFE_BACKUP_DIRECTORY/);
    console.log('Approved: per-process cache sweep, shared polling, other scopes preserved, unavailable database, manifest validation and read-only backup inventory without symlink traversal or private names.');
  }finally{await fs.rm(root,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
