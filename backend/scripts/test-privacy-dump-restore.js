process.env.DOTENV_CONFIG_QUIET='true';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),read=require('node:fs').readFileSync;
const path=require('node:path'),os=require('node:os'),{randomUUID}=require('node:crypto'),{Script}=require('node:vm'),{spawn}=require('node:child_process');
function load(file,deps){const module={exports:{}},filename=path.resolve(__dirname,'../src',file);
  new Script(`(function(require,module){${read(filename,'utf8')}\n})`,{filename}).runInThisContext()(name=>{assert.ok(Object.hasOwn(deps,name),name);return deps[name];},module);
  return module.exports;}
async function main(){
  process.chdir(path.resolve(__dirname,'..'));
  const env=require('../src/config/env');
  assert.ok(['127.0.0.1','localhost'].includes(env.DB_HOST)&&!env.DB_CONNECTION_STRING&&process.env.NODE_ENV!=='production');
  const {Pool}=require('pg'),settings={host:env.DB_HOST,port:env.DB_PORT,user:env.DB_USER,password:env.DB_PASSWORD};
  const suffix=randomUUID().replaceAll('-',''),sourceName='mr05_source_'+suffix,restoreName='mr05_restore_'+suffix;
  const admin=new Pool({...settings,database:env.DB_NAME}),source=new Pool({...settings,database:sourceName}),restored=new Pool({...settings,database:restoreName});
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'mr05-dump-restore-'));
  const originalMedia=path.join(directory,'source-media'),restoredMedia=path.join(directory,restoreName);
  const dump=path.join(directory,'before-deletion.dump');
  const sourceDb={getPool:()=>source,query:(...args)=>source.query(...args)},restoreDb={getPool:()=>restored,query:(...args)=>restored.query(...args)};
  const requests=load('modules/privacy/deletion-requests.service.js',{'../../lib/db':sourceDb,'node:path':path});
  const {createExecutor}=require('../src/modules/privacy/deletion-executor');
  const replay=require('../src/modules/privacy/restore-replay'),guard=require('../src/modules/privacy/restore-guard');
  let sourceCreated=false,restoreCreated=false;
  const id=randomUUID(),account=randomUUID(),actor={userId:randomUUID()},c1=randomUUID(),c2=randomUUID();
  const privateImage=randomUUID()+'.jpg',sharedImage=randomUUID()+'.png';
  async function dockerFile(args,file,write){
    const handle=await fs.open(file,write?'wx':'r',0o600);
    try{await new Promise((resolve,reject)=>{
      const child=spawn('docker',['exec','-i','socialbot_postgres',...args],{stdio:[write?'ignore':handle.fd,write?handle.fd:'ignore','pipe']});
      child.stderr.resume();child.on('error',()=>reject(Error('DOCKER_TOOL_UNAVAILABLE')));
      child.on('exit',code=>code===0?resolve():reject(Error('PG_DUMP_RESTORE_FAILED')));
    });}finally{await handle.close();}
  }
  try{
    // Every mutation and dump below targets these disposable databases, never env.DB_NAME.
    await admin.query(`CREATE DATABASE ${sourceName} TEMPLATE template0`);sourceCreated=true;
    await source.query(`CREATE EXTENSION pgcrypto;
      CREATE TABLE socialbot_users(id uuid PRIMARY KEY);
      CREATE TABLE instagram_accounts(id uuid PRIMARY KEY,instagram_id text,ativo boolean DEFAULT true,deleted_at timestamptz);
      CREATE TABLE instagram_conversations(id uuid PRIMARY KEY,account_id uuid NOT NULL,instagram_user_id text NOT NULL,deleted_at timestamptz);
      CREATE TABLE instagram_messages(id uuid PRIMARY KEY,conversation_id uuid NOT NULL REFERENCES instagram_conversations(id),meta_message_id text,payload jsonb);
      CREATE TABLE webhook_events(id uuid PRIMARY KEY,payload jsonb);
      CREATE TABLE posts(video_filename text,cover_image_filename text,media_file_path text);
      CREATE TABLE post_media_items(stored_filename text,storage_path text);
      CREATE TABLE media_template_items(stored_filename text,storage_path text);
      CREATE TABLE uploads(stored_filename text,storage_path text);`);
    for(const name of ['015-inbox-send-attempts.sql','016-privacy-deletion-requests.sql','017-privacy-scope-executor.sql'])
      await source.query(read(path.resolve(__dirname,'../sql',name),'utf8').split('\n').filter(l=>!l.startsWith('\\')).join('\n'));
    await source.query('INSERT INTO socialbot_users VALUES($1)',[actor.userId]);
    await source.query("INSERT INTO instagram_accounts(id,instagram_id) VALUES($1,'demo-account')",[account]);
    await source.query("INSERT INTO instagram_conversations(id,account_id,instagram_user_id) VALUES($1,$3,'123'),($2,$3,'456')",[c1,c2,account]);
    for(const [conversation,file] of [[c1,privateImage],[c1,sharedImage],[c2,null]])await source.query('INSERT INTO instagram_messages VALUES($1,$2,$3,$4::jsonb)',
      [randomUUID(),conversation,randomUUID(),JSON.stringify(file?{inboxImage:{filename:file}}:{})]);
    const event=user=>({sender:{id:user},recipient:{id:'demo-account'},message:{text:'Synthetic message'}});
    await source.query('INSERT INTO webhook_events VALUES($1,$2::jsonb)',[randomUUID(),JSON.stringify({object:'instagram',entry:[{messaging:[event('123'),event('456')]}]})]);
    await source.query('INSERT INTO media_template_items(stored_filename) VALUES($1)',[sharedImage]);
    await source.query("INSERT INTO posts(video_filename) VALUES('preserved-reel.mp4')");
    await fs.mkdir(originalMedia,{mode:0o700});await fs.mkdir(restoredMedia,{mode:0o700});
    for(const file of [privateImage,sharedImage]){
      await fs.writeFile(path.join(originalMedia,file),'Synthetic image '+file,{mode:0o600});
      await fs.copyFile(path.join(originalMedia,file),path.join(restoredMedia,file));
    }
    await dockerFile(['pg_dump','-U',env.DB_USER,'-d',sourceName,'-Fc','--no-owner','--no-privileges'],dump,true);
    assert.equal((await fs.stat(dump)).mode&0o777,0o600);assert.ok((await fs.stat(dump)).size>0);
    await requests.create({requestId:id,conversationId:c1},actor);
    await requests.verify(id,{identityReviewed:true,scopeReviewed:true,method:'documented_review',reference:'synthetic-proof'},actor);
    const executor=createExecutor({db:sourceDb,fs,mediaDir:originalMedia}),ack={acknowledged:true};
    await executor.blockScope(id,ack,actor);
    await assert.rejects(replay.exportReceipt(source),/UNFINISHED_RESTORE_RECEIPT/);
    await executor.executeDatabase(id,ack,actor);await executor.processFiles(id,ack,actor);
    const receipt=await replay.exportReceipt(source),bytes=JSON.stringify(receipt),hash=guard.digest(bytes);
    await fs.writeFile(path.join(directory,'receipt.json'),bytes,{mode:0o600,flag:'wx'});
    assert.equal(receipt.scopes.length,1);assert.deepEqual(receipt.scopes[0].privateFiles,[privateImage]);
    assert.throws(()=>replay.parseReceipt(bytes+' ',hash),/DIGEST_MISMATCH/);
    const altered=structuredClone(receipt);altered.scopes[0].instagramUserId='456';
    assert.throws(()=>replay.parseReceipt(JSON.stringify(altered),guard.digest(JSON.stringify(altered))),/INVALID_RESTORE_RECEIPT/);
    await admin.query(`CREATE DATABASE ${restoreName} TEMPLATE template0`);restoreCreated=true;
    await dockerFile(['pg_restore','-U',env.DB_USER,'-d',restoreName,'--exit-on-error','--single-transaction','--no-owner','--no-privileges'],dump,false);
    const manifest=await guard.snapshot(source);
    assert.equal((await guard.inspect(restored,manifest)).databaseClear,false);
    assert.equal((await restored.query('SELECT count(*)::int AS n FROM socialbot_deletion_requests')).rows[0].n,0);
    const params={db:restoreDb,fs,mediaDir:restoredMedia,bytes,expectedDigest:hash,actor,acknowledged:true};
    await assert.rejects(replay.reapply({...params,acknowledged:false}),/ACK_REQUIRED/);
    await assert.rejects(replay.reapply({...params,db:sourceDb}),/ISOLATED_RESTORE_REQUIRED/);
    const uncertainId=randomUUID(),scopeKey=receipt.scopes[0].scopeKey;
    await restored.query("INSERT INTO socialbot_privacy_operations VALUES($1,$2,'image','uncertain',$3,NOW())",[uncertainId,scopeKey,privateImage]);
    await assert.rejects(replay.reapply(params),e=>e.code==='DELIVERY_REQUIRES_REVIEW');
    assert.equal((await restored.query('SELECT count(*)::int AS n FROM instagram_messages')).rows[0].n,3);
    await fs.stat(path.join(restoredMedia,privateImage));
    await restored.query('DELETE FROM socialbot_privacy_operations WHERE id=$1',[uncertainId]);
    const message=(await restored.query('SELECT id FROM instagram_messages WHERE conversation_id=$1 LIMIT 1',[c1])).rows[0].id;
    await restored.query('CREATE TABLE review_fk(message_id uuid REFERENCES instagram_messages(id))');
    await restored.query('INSERT INTO review_fk VALUES($1)',[message]);
    await assert.rejects(replay.reapply(params),e=>e.code==='23503');
    assert.equal((await restored.query('SELECT count(*)::int AS n FROM instagram_messages')).rows[0].n,3);
    await restored.query('DROP TABLE review_fk');
    const outcome=await replay.reapply(params);assert.equal(outcome.reappliedScopes,1);assert.equal(outcome.activationAllowed,false);
    assert.equal((await guard.inspect(restored,manifest)).databaseClear,true);
    await assert.rejects(fs.stat(path.join(restoredMedia,privateImage)),e=>e.code==='ENOENT');
    assert.equal(await fs.readFile(path.join(restoredMedia,sharedImage),'utf8'),'Synthetic image '+sharedImage);
    assert.equal((await restored.query('SELECT count(*)::int AS n FROM instagram_messages WHERE conversation_id=$1',[c2])).rows[0].n,1);
    assert.equal((await restored.query('SELECT count(*)::int AS n FROM posts')).rows[0].n,1);
    await assert.rejects(restored.query("INSERT INTO instagram_conversations VALUES($1,$2,'123',NULL)",[randomUUID(),account]),/PRIVACY_SCOPE_BLOCKED/);
    assert.equal((await replay.reapply(params)).reappliedScopes,1);
    assert.equal((await guard.inspect(restored,manifest)).databaseClear,true);
    const legacy=randomUUID();await restored.query("INSERT INTO webhook_events VALUES($1,'{}'::jsonb)",[legacy]);
    await assert.rejects(replay.reapply(params),/RESTORE_DATABASE_REVIEW_REQUIRED/);
    assert.equal((await restored.query('SELECT count(*)::int AS n FROM webhook_events WHERE id=$1',[legacy])).rows[0].n,1);
    await restored.query('DELETE FROM webhook_events WHERE id=$1',[legacy]);
    await fs.writeFile(path.join(restoredMedia,privateImage),'Reintroduced fixture');
    await assert.rejects(replay.reapply(params),/RESTORE_REINTRODUCTION_REVIEW_REQUIRED/);
    assert.equal(await fs.readFile(path.join(restoredMedia,privateImage),'utf8'),'Reintroduced fixture');
    console.log('Approved: actual custom pg_dump/pg_restore cycle in disposable local databases, external receipt/digest/scope validation, isolated-target guard, uncertain delivery preserved, FK rollback and retry, scoped replay, shared images/Reels/other messages preserved, durable block and repeat replay. No main database restore, Meta or VPS.');
  }finally{
    await source.end();await restored.end();
    if(restoreCreated)await admin.query(`DROP DATABASE ${restoreName}`);
    if(sourceCreated)await admin.query(`DROP DATABASE ${sourceName}`);
    await admin.end();await fs.rm(directory,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error('PRIVACY_DUMP_RESTORE_FAILED:',error.code||error.message);process.exitCode=1;});
