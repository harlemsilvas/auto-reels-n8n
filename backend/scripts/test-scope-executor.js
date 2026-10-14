const assert=require("node:assert/strict");
const fs=require("node:fs"),fsp=require("node:fs/promises"),path=require("node:path"),os=require("node:os");
const {randomUUID}=require("node:crypto"),{Script}=require("node:vm");
function load(file,deps){const module={exports:{}},filename=path.resolve(__dirname,"../src",file);
  new Script(`(function(require,module){${fs.readFileSync(filename,'utf8')}\n})`,{filename}).runInThisContext()(name=>{
    assert.ok(Object.hasOwn(deps,name),name);return deps[name];},module);return module.exports;}
async function main(){
  process.chdir(path.resolve(__dirname,".."));process.env.DOTENV_CONFIG_QUIET="true";
  const env=require("../src/config/env");
  assert.ok(['localhost','127.0.0.1'].includes(env.DB_HOST)&&!env.DB_CONNECTION_STRING&&process.env.NODE_ENV!=="production");
  const {Pool}=require("pg");
  const settings={host:env.DB_HOST,port:env.DB_PORT,database:env.DB_NAME,user:env.DB_USER,password:env.DB_PASSWORD};
  const admin=new Pool(settings),schema='scope_executor_test_'+randomUUID().replaceAll('-','');
  const restoreSchema='privacy_restore_test_'+randomUUID().replaceAll('-','');
  const restored=new Pool({...settings,options:`-c search_path=${restoreSchema},public`});
  class TestPool extends Pool{constructor(options){super({...options,options:`-c search_path=${schema},public`});}}
  const db=load('lib/db.js',{'pg':{Pool:TestPool},'node:async_hooks':require('node:async_hooks'),'../config/env':{
    DB_HOST:env.DB_HOST,DB_PORT:env.DB_PORT,DB_NAME:env.DB_NAME,DB_USER:env.DB_USER,DB_PASSWORD:env.DB_PASSWORD}});
  const pool=db.getPool();
  const gate=load('modules/privacy/scope-gate.js',{'node:crypto':require('node:crypto'),'node:async_hooks':require('node:async_hooks'),'pg':{Pool},'../../lib/db':db});
  const webhook=load('modules/privacy/webhook-scope.js',{'./scope-gate':gate});
  const repo=load('modules/webhooks/instagram-messages.repository.js',{'../../lib/db':db,'../privacy/webhook-scope':webhook});
  const requests=load('modules/privacy/deletion-requests.service.js',{'../../lib/db':db,'node:path':path});
  const executorModule=load('modules/privacy/deletion-executor.js',{'node:path':path,'./scope-gate':gate,
    './webhook-redaction':require('../src/modules/privacy/webhook-redaction')});
  const recovery=load('modules/privacy/restore-guard.js',{'node:crypto':require('node:crypto'),'./scope-gate':gate});
  const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'mr05-executor-'));
  const actor={userId:randomUUID()},accountId=randomUUID(),c1=randomUUID(),c2=randomUUID(),r1=randomUUID(),r2=randomUUID();
  const imageA=randomUUID()+'.jpg',imageB=randomUUID()+'.png';
  const scope={accountId,instagramUserId:'123'};
  const proof={identityReviewed:true,scopeReviewed:true,method:'instagram_confirmation',reference:'demo-proof'};
  const ack={acknowledged:true};let created=false,restoreCreated=false,renameFailure=true,unlinkFailure=true,commitFailure=true;
  const executor=executorModule.createExecutor({db,fs:fsp,mediaDir:directory,hooks:{
    beforeDatabaseCommit(){if(commitFailure){commitFailure=false;throw Error('DEMO_COMMIT_FAILURE');}},
    afterQuarantineRename(){if(renameFailure){renameFailure=false;throw Error('DEMO_RENAME_CRASH');}},
    afterUnlink(){if(unlinkFailure){unlinkFailure=false;throw Error('DEMO_UNLINK_CRASH');}},
  }});
  const sql=name=>fs.readFileSync(path.resolve(__dirname,'../sql',name),'utf8').split('\n').filter(l=>!l.startsWith('\\')).join('\n')
    .replaceAll('public.',schema+'.').replaceAll("'public'",`'${schema}'`);
  try{
    await admin.query(`CREATE SCHEMA ${schema}`);created=true;
    await pool.query(`CREATE TABLE socialbot_users(id uuid PRIMARY KEY);
      CREATE TABLE instagram_accounts(id uuid PRIMARY KEY,instagram_id text,ativo boolean DEFAULT true,deleted_at timestamptz);
      CREATE TABLE instagram_conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL,instagram_user_id text NOT NULL,
        instagram_username text,last_message_at timestamptz,unread_count int DEFAULT 0,updated_at timestamptz DEFAULT now(),deleted_at timestamptz);
      CREATE TABLE instagram_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid NOT NULL,sender_id text,recipient_id text,
        sender_type text,message_text text,meta_message_id text,payload jsonb,created_at timestamptz DEFAULT now(),inbox_unread boolean DEFAULT false);
      CREATE TABLE webhook_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),provider text,event_type text,payload jsonb);
      CREATE TABLE posts(video_filename text,cover_image_filename text,media_file_path text);
      CREATE TABLE post_media_items(stored_filename text,storage_path text);
      CREATE TABLE media_template_items(stored_filename text,storage_path text);
      CREATE TABLE uploads(stored_filename text,storage_path text);`);
    await pool.query(sql('015-inbox-send-attempts.sql'));await pool.query(sql('016-privacy-deletion-requests.sql'));
    const migration=sql('017-privacy-scope-executor.sql');
    await pool.query(migration.replace(/COMMIT;\s*$/,'ROLLBACK;'));
    assert.equal((await pool.query('SELECT to_regclass($1) AS t',[schema+'.socialbot_privacy_scope_blocks'])).rows[0].t,null);
    await pool.query(migration);await pool.query(migration);await pool.query(sql('017-privacy-scope-executor-verify.sql'));
    await pool.query('INSERT INTO socialbot_users VALUES($1)',[actor.userId]);
    await pool.query("INSERT INTO instagram_accounts(id,instagram_id) VALUES($1,'demo-account')",[accountId]);
    await pool.query("INSERT INTO instagram_conversations(id,account_id,instagram_user_id) VALUES($1,$3,'123'),($2,$3,'456')",[c1,c2,accountId]);
    for(const [c,file] of [[c1,imageA],[c1,imageB],[c2,null]])await repo.saveMessage({conversationId:c,senderId:c===c1?'123':'456',
      recipientId:'demo-account',messageText:'Demo',metaMessageId:randomUUID(),payload:file?{inboxImage:{filename:file}}:{}});
    await fsp.writeFile(path.join(directory,imageA),'private demo data');await fsp.writeFile(path.join(directory,imageB),'shared demo data');
    await pool.query('INSERT INTO media_template_items(stored_filename) VALUES($1)',[imageB]);
    await requests.create({requestId:r1,conversationId:c1},actor);await requests.verify(r1,proof,actor);
    await requests.create({requestId:r2,conversationId:c2},actor);await requests.verify(r2,proof,actor);
    const scope2={accountId,instagramUserId:'456'},uncertainId=randomUUID();
    const journalFile=randomUUID()+'.jpg';
    await assert.rejects(gate.outbound(scope2,'image',async()=>{
      assert.equal((await db.query("SELECT count(*)::int AS n FROM socialbot_privacy_operations WHERE filename=$1 AND state='sending'",[journalFile])).rows[0].n,1);
      await gate.outbound(scope2,'image',async()=>{
        assert.equal((await db.query("SELECT count(*)::int AS n FROM socialbot_privacy_operations WHERE filename=$1",[journalFile])).rows[0].n,1);
      },journalFile);
      throw Object.assign(Error('DEMO_UNCERTAIN'),{deliveryMayHaveSucceeded:true});
    },journalFile),/DEMO_UNCERTAIN/);
    assert.equal((await pool.query("SELECT state FROM socialbot_privacy_operations WHERE filename=$1",[journalFile])).rows[0].state,'uncertain');
    await pool.query("INSERT INTO socialbot_privacy_operations(id,scope_key,kind,state) VALUES($1,$2,'image','uncertain')",[uncertainId,gate.key(scope2)]);
    await assert.rejects(executor.blockScope(r2,ack,actor),e=>e.code==='DELIVERY_REQUIRES_REVIEW');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM socialbot_privacy_scope_blocks')).rows[0].n,0);
    const event=user=>({sender:{id:user},recipient:{id:'demo-account'},message:{mid:'demo-'+user,text:'Demo'}});
    await repo.saveWebhookEvent({object:'instagram',entry:[{messaging:[event('123'),event('456')]}]});
    let release,entered,failed;
    const ready=new Promise((resolve,reject)=>{entered=resolve;failed=reject;});
    const send=gate.withScope(scope,async()=>{
      const pid1=(await db.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const nested=await db.getPool().connect();assert.equal((await nested.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,pid1);nested.release();
      await repo.saveMessage({conversationId:c1,senderId:'123',recipientId:'demo-account',messageText:'Leased',metaMessageId:randomUUID(),payload:{}});
      entered();await new Promise(resolve=>{release=resolve;});
    });
    send.catch(failed);
    await ready;
    let blocked=false;
    const block=executor.blockScope(r1,ack,actor).then(value=>{blocked=true;return value;});
    await new Promise(resolve=>setTimeout(resolve,80));assert.equal(blocked,false);
    await gate.withScope(scope2,async()=>{});
    release();await send;await block;
    assert.equal(db.getPool(),pool);
    const manifest=await recovery.snapshot(pool);
    assert.deepEqual(manifest.scopeKeys,[gate.key(scope)]);
    assert.doesNotMatch(JSON.stringify(manifest),new RegExp(accountId+'|demo-account'));
    const oldCopy=await recovery.inspect(pool,manifest);
    assert.equal(oldCopy.databaseClear,false);assert.equal(oldCopy.retainedConversations,1);
    assert.equal(oldCopy.retainedWebhookItems,1);
    await admin.query(`CREATE SCHEMA ${restoreSchema}`);restoreCreated=true;
    for(const table of ['socialbot_privacy_scope_blocks','socialbot_privacy_operations','instagram_conversations',
      'instagram_messages','instagram_send_attempts','instagram_accounts','webhook_events']){
      await admin.query(`CREATE TABLE ${restoreSchema}.${table} AS SELECT * FROM ${schema}.${table}`);
    }
    // Older backups can lack the latest block even though messages are present.
    await restored.query('DELETE FROM socialbot_privacy_scope_blocks');
    assert.equal((await recovery.inspect(pool,{...manifest,scopeKeys:[gate.key(scope2)]})).missingBlocks,1);
    let called=false;await assert.rejects(gate.withScope(scope,async()=>{called=true;}),e=>e.code==='PRIVACY_SCOPE_BLOCKED');assert.equal(called,false);
    await assert.rejects(pool.query("INSERT INTO instagram_conversations(account_id,instagram_user_id) VALUES($1,'123')",[accountId]),/PRIVACY_SCOPE_BLOCKED/);
    await assert.rejects(pool.query("UPDATE instagram_conversations SET instagram_user_id='999' WHERE id=$1",[c1]),/PRIVACY_SCOPE_BLOCKED/);
    await repo.saveWebhookEvent({object:'instagram',entry:[{messaging:[event('123'),event('456')]}]});
    const latest=(await pool.query('SELECT payload FROM webhook_events ORDER BY id')).rows;
    assert.ok(latest.some(row=>row.payload.entry[0].messaging.length===1&&row.payload.entry[0].messaging[0].sender.id==='456'));
    await assert.rejects(executor.executeDatabase(r1,ack,actor),/DEMO_COMMIT_FAILURE/);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM instagram_messages WHERE conversation_id=$1',[c1])).rows[0].n,3);
    await executor.executeDatabase(r1,ack,actor);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM instagram_messages WHERE conversation_id=$1',[c1])).rows[0].n,0);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM instagram_messages WHERE conversation_id=$1',[c2])).rows[0].n,1);
    const original=path.join(directory,imageA),saved=path.join(directory,'saved-original');
    await fsp.rename(original,saved);await fsp.writeFile(original,'replacement must survive');
    await assert.rejects(executor.processFiles(r1,ack,actor),e=>e.code==='FILE_IDENTITY_CHANGED');
    assert.equal(await fsp.readFile(original,'utf8'),'replacement must survive');
    await fsp.unlink(original);await fsp.rename(saved,original);
    await assert.rejects(executor.processFiles(r1,ack,actor),/DEMO_RENAME_CRASH/);
    await assert.rejects(executor.processFiles(r1,ack,actor),/DEMO_UNLINK_CRASH/);
    const finished=await executor.processFiles(r1,ack,actor);assert.equal(finished.filesHandled,true);assert.equal(finished.deletionComplete,false);
    const cleanManifest=await recovery.snapshot(pool);
    assert.deepEqual(cleanManifest.fileHashes,[recovery.digest(imageA)]);
    const cleanCopy=await recovery.inspect(pool,cleanManifest);
    assert.equal(cleanCopy.databaseClear,true);assert.equal(cleanCopy.activationAllowed,false);
    const restoredCopy=await recovery.inspect(restored,cleanManifest);
    assert.equal(restoredCopy.databaseClear,false);assert.equal(restoredCopy.missingBlocks,1);
    assert.equal(restoredCopy.retainedConversations,1);assert.equal(restoredCopy.retainedWebhookItems,1);
    assert.equal(restoredCopy.activationAllowed,false);
    await pool.query("INSERT INTO webhook_events(provider,payload) VALUES('legacy','{}'::jsonb)");
    const legacyCopy=await recovery.inspect(pool,cleanManifest);
    assert.equal(legacyCopy.databaseClear,false);assert.equal(legacyCopy.unknownWebhookItems,1);
    await assert.rejects(fsp.stat(path.join(directory,imageA)),e=>e.code==='ENOENT');
    assert.equal(await fsp.readFile(path.join(directory,imageB),'utf8'),'shared demo data');
    assert.equal((await requests.get(r1)).tasks.find(t=>t.kind==='backups').state,'blocked');
    await assert.rejects(gate.outbound(scope,'text',async()=>{throw Error('MUST_NOT_SEND');}),e=>e.code==='PRIVACY_SCOPE_BLOCKED');
    assert.equal((await executor.executeDatabase(r1,ack,actor)).replay,true);
    console.log('Approved: 017 rollback/idempotence/triggers, scoped leases/concurrency, uncertain images preserved, blocked writes/outbound/webhooks, transactional deletion/rollback, quarantine/unlink recovery, shared media, and restore inspection rejecting an old isolated copy, missing blocks and unknown webhooks. Backups remain pending; isolated schemas/files only.');
  }finally{
    await gate.close();await pool.end();await restored.end();
    if(restoreCreated)await admin.query(`DROP SCHEMA ${restoreSchema} CASCADE`);
    if(created)await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();
    await fsp.rm(directory,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error('SCOPE_EXECUTOR_TEST_FAILED:',error.code||error.message);process.exitCode=1;});
