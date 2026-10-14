const path=require("node:path");
const gate=require("./scope-gate");
const {redactWebhook}=require("./webhook-redaction");
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const IMAGE=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png)$/;
const failure=code=>Object.assign(new Error(code),{code,status:409});
function createExecutor({db,fs,mediaDir,hooks={},additionalFiles=[]}) {
  async function transaction(callback) {
    const client=await db.getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout='3s'");
      await client.query("SET LOCAL statement_timeout='15s'");
      const output=await callback(client);await client.query("COMMIT");return output;
    } catch(error) {await client.query("ROLLBACK");throw error;}
    finally{client.release();}
  }
  async function request(client,id,input,actor) {
    if(!UUID.test(id)||!UUID.test(actor?.userId)||input?.acknowledged!==true||Object.keys(input).length!==1)
      throw Object.assign(failure("EXECUTION_ACK_REQUIRED"),{status:400});
    const row=(await client.query("SELECT * FROM socialbot_deletion_requests WHERE id=$1 FOR UPDATE",[id])).rows[0];
    if(!row||row.state!=="verified")throw failure("REQUEST_STATE_CONFLICT");
    const scope={accountId:row.account_id,instagramUserId:row.instagram_user_id};
    const key=gate.key(scope);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[key]);
    return {...row,scope,key};
  }
  async function requireBlock(client,row) {
    const block=(await client.query("SELECT request_id FROM socialbot_privacy_scope_blocks WHERE scope_key=$1",[row.key])).rows[0];
    if(block?.request_id!==row.id)throw failure("SCOPE_BLOCK_REQUIRED");
  }
  async function conversations(client,row) {
    return (await client.query("SELECT id FROM instagram_conversations WHERE account_id=$1 AND instagram_user_id=$2 FOR UPDATE",
      [row.account_id,row.instagram_user_id])).rows.map(c=>c.id);
  }
  async function assertSettled(client,row,ids) {
    const ledger=(await client.query(`SELECT a.*,m.meta_message_id AS linked_meta,m.conversation_id AS linked_conversation
      FROM instagram_send_attempts a LEFT JOIN instagram_messages m ON m.id=a.message_id
      WHERE a.conversation_id=ANY($1::uuid[]) FOR UPDATE OF a`,[ids])).rows;
    if(ledger.some(a=>!["sent","rejected","dismissed"].includes(a.state)||
      (a.state==="sent"&&(!a.meta_message_id||a.linked_meta!==a.meta_message_id||a.linked_conversation!==a.conversation_id))||
      (a.state!=="sent"&&(a.meta_message_id||a.message_id))))throw failure("DELIVERY_REQUIRES_REVIEW");
    const unresolved=await client.query("SELECT id FROM socialbot_privacy_operations WHERE scope_key=$1 AND state IN ('sending','uncertain') FOR UPDATE",[row.key]);
    if(unresolved.rowCount)throw failure("DELIVERY_REQUIRES_REVIEW");
    return ledger;
  }
  async function task(client,id,kind,state,details) {
    await client.query("UPDATE socialbot_deletion_tasks SET state=$3,details=$4::jsonb,updated_at=NOW() WHERE request_id=$1 AND kind=$2",
      [id,kind,state,JSON.stringify(details)]);
  }
  async function blockScope(id,input,actor) {
    return transaction(async client=>{
      const row=await request(client,id,input,actor);
      const ids=await conversations(client,row);
      await assertSettled(client,row,ids);
      await client.query("INSERT INTO socialbot_privacy_scope_blocks(scope_key,request_id) VALUES($1,$2) ON CONFLICT(scope_key) DO NOTHING",[row.key,id]);
      await requireBlock(client,row);
      return {id,scopeBlocked:true,deletionComplete:false};
    });
  }
  async function lockReferences(client) {
    // Brief write barrier across every reference source while evaluating physical file changes.
    await client.query("LOCK TABLE instagram_messages,posts,post_media_items,media_template_items,uploads IN SHARE MODE");
  }
  async function referenceNames(client,exclude=[]) {
    const rows=(await client.query(`SELECT stored_filename AS filename FROM post_media_items
      UNION ALL SELECT storage_path FROM post_media_items UNION ALL SELECT stored_filename FROM media_template_items
      UNION ALL SELECT storage_path FROM media_template_items UNION ALL SELECT stored_filename FROM uploads
      UNION ALL SELECT storage_path FROM uploads UNION ALL SELECT video_filename FROM posts
      UNION ALL SELECT cover_image_filename FROM posts UNION ALL SELECT media_file_path FROM posts
      UNION ALL SELECT COALESCE(to_jsonb(m)->'payload',to_jsonb(m)->'raw_payload')->'inboxImage'->>'filename'
      FROM instagram_messages m WHERE NOT (conversation_id=ANY($1::uuid[]))`,[exclude])).rows;
    return new Set(rows.filter(r=>typeof r.filename==="string").map(r=>path.basename(r.filename.replaceAll("\\","/"))));
  }
  async function stat(file) {try{return await fs.lstat(file);}catch(e){if(e.code==="ENOENT")return null;throw e;}}
  async function root() {
    const directory=path.resolve(mediaDir),s=await stat(directory);
    if(!s?.isDirectory()||s.isSymbolicLink()||await fs.realpath(directory)!==directory)throw failure("UNSAFE_MEDIA_DIRECTORY");
    return directory;
  }
  function matches(s,job) {return s?.isFile()&&!s.isSymbolicLink()&&String(s.dev)===job.device&&String(s.ino)===job.inode;}
  async function executeDatabase(id,input,actor) {
    return transaction(async client=>{
      const row=await request(client,id,input,actor);await requireBlock(client,row);
      const done=(await client.query("SELECT state,details FROM socialbot_deletion_tasks WHERE request_id=$1 AND kind='database'",[id])).rows[0];
      if(done?.state==="completed"||done?.details?.reason==='UNCORRELATED_WEBHOOKS_REQUIRE_REVIEW')
        return {id,databaseRemoved:true,replay:true,webhookReviewRequired:done.state!=='completed',deletionComplete:false};
      const ids=await conversations(client,row),attempts=await assertSettled(client,row,ids);
      await lockReferences(client);
      const messages=(await client.query(`SELECT id,COALESCE(to_jsonb(m)->'payload',to_jsonb(m)->'raw_payload')->'inboxImage'->>'filename' AS filename
        FROM instagram_messages m WHERE conversation_id=ANY($1::uuid[]) FOR UPDATE`,[ids])).rows;
      const foreign=await client.query("SELECT id FROM instagram_send_attempts WHERE message_id=ANY($1::uuid[]) AND NOT (conversation_id=ANY($2::uuid[])) FOR UPDATE",
        [messages.map(m=>m.id),ids]);
      if(foreign.rowCount)throw failure("CROSS_CONVERSATION_REFERENCE");
      const operations=(await client.query("SELECT filename FROM socialbot_privacy_operations WHERE scope_key=$1",[row.key])).rows;
      const files=[...new Set([...messages,...operations].map(m=>m.filename).filter(Boolean).concat(additionalFiles))];
      const refs=await referenceNames(client,ids);
      for(const filename of files) {
        if(!IMAGE.test(filename))throw failure("UNSAFE_FILE_REFERENCE");
        const shared=refs.has(filename);
        const s=shared?null:await stat(path.join(await root(),filename));
        if(!shared&&(!s?.isFile()||s.isSymbolicLink()))throw failure("FILE_REVIEW_REQUIRED");
        await client.query("INSERT INTO socialbot_deletion_files(request_id,filename,state,device,inode) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
          [id,filename,shared?'shared':'pending',s?String(s.dev):null,s?String(s.ino):null]);
      }
      let removed=0,unknown=0;
      const account=(await client.query("SELECT instagram_id FROM instagram_accounts WHERE id=$1",[row.account_id])).rows[0];
      if(!account?.instagram_id)throw failure("ACCOUNT_SCOPE_UNAVAILABLE");
      const events=(await client.query("SELECT id,payload FROM webhook_events FOR UPDATE")).rows;
      for(const event of events) {
        if(!Array.isArray(event.payload?.entry))unknown++;
        const filtered=redactWebhook(event.payload,account.instagram_id,row.instagram_user_id);
        if(filtered.removed){await client.query("UPDATE webhook_events SET payload=$2::jsonb WHERE id=$1",[event.id,JSON.stringify(filtered.body)]);removed+=filtered.removed;}
      }
      await client.query("DELETE FROM instagram_send_attempts WHERE conversation_id=ANY($1::uuid[])",[ids]);
      await client.query("DELETE FROM instagram_messages WHERE conversation_id=ANY($1::uuid[])",[ids]);
      await client.query("DELETE FROM instagram_conversations WHERE id=ANY($1::uuid[])",[ids]);
      await client.query("DELETE FROM socialbot_privacy_operations WHERE scope_key=$1",[row.key]);
      await task(client,id,"database",unknown?'blocked':'completed',{reason:unknown?'UNCORRELATED_WEBHOOKS_REQUIRE_REVIEW':'SCOPED_DATA_REMOVED',
        messages:messages.length,conversations:ids.length,attempts:attempts.length,webhookItemsRemoved:removed,unknownEvents:unknown,actedByUserId:actor.userId});
      await task(client,id,"files","pending",{reason:"QUARANTINE_PENDING",candidateCount:files.length});
      await hooks.beforeDatabaseCommit?.();
      return {id,databaseRemoved:true,webhookReviewRequired:unknown>0,deletionComplete:false};
    });
  }
  async function quarantineDirectory(directory,id) {
    let current=directory;
    for(const segment of ['.quarantine',id]) {
      current=path.join(current,segment);let s=await stat(current);
      if(!s){await fs.mkdir(current,{mode:0o700});s=await stat(current);}
      if(!s.isDirectory()||s.isSymbolicLink()||await fs.realpath(current)!==current)throw failure("UNSAFE_MEDIA_DIRECTORY");
    }
    return current;
  }
  async function filePhase(id,input,actor,filename,remove) {
    return transaction(async client=>{
      const row=await request(client,id,input,actor);await requireBlock(client,row);await lockReferences(client);
      const job=(await client.query("SELECT * FROM socialbot_deletion_files WHERE request_id=$1 AND filename=$2 FOR UPDATE",[id,filename])).rows[0];
      if(!job||['removed','shared'].includes(job.state))return;
      if(!remove&&job.state==='quarantined')return;
      const directory=await root(),source=path.join(directory,filename),destination=path.join(await quarantineDirectory(directory,id),filename);
      const refs=await referenceNames(client);
      if(refs.has(filename)) {
        const from=await stat(source),to=await stat(destination);
        if(!from&&matches(to,job))await fs.rename(destination,source);
        else if(!from||!matches(from,job))throw failure("FILE_REVIEW_REQUIRED");
        await client.query("UPDATE socialbot_deletion_files SET state='shared' WHERE request_id=$1 AND filename=$2",[id,filename]);return;
      }
      if(!remove) {
        const from=await stat(source),to=await stat(destination);
        if(matches(from,job)&&!to)await fs.rename(source,destination);
        else if(from||!matches(to,job))throw failure("FILE_IDENTITY_CHANGED");
        await hooks.afterQuarantineRename?.();
        await client.query("UPDATE socialbot_deletion_files SET state='quarantined' WHERE request_id=$1 AND filename=$2",[id,filename]);
      } else {
        if(job.state!=='quarantined')throw failure("QUARANTINE_REQUIRED");
        const to=await stat(destination);
        if(to&&!matches(to,job))throw failure("FILE_IDENTITY_CHANGED");
        if(to)await fs.unlink(destination);
        await hooks.afterUnlink?.();
        await client.query("UPDATE socialbot_deletion_files SET state='removed' WHERE request_id=$1 AND filename=$2",[id,filename]);
      }
    });
  }
  async function processFiles(id,input,actor) {
    const jobs=await transaction(async client=>{
      const row=await request(client,id,input,actor);await requireBlock(client,row);
      const state=(await client.query("SELECT details FROM socialbot_deletion_tasks WHERE request_id=$1 AND kind='database'",[id])).rows[0];
      if(!['SCOPED_DATA_REMOVED','UNCORRELATED_WEBHOOKS_REQUIRE_REVIEW'].includes(state?.details?.reason))throw failure("DATABASE_EXECUTION_REQUIRED");
      return (await client.query("SELECT filename FROM socialbot_deletion_files WHERE request_id=$1 ORDER BY filename",[id])).rows;
    });
    for(const job of jobs){await filePhase(id,input,actor,job.filename,false);await filePhase(id,input,actor,job.filename,true);}
    return transaction(async client=>{
      const row=await request(client,id,input,actor);await requireBlock(client,row);
      const remaining=(await client.query("SELECT count(*)::int AS count FROM socialbot_deletion_files WHERE request_id=$1 AND state IN ('pending','quarantined')",[id])).rows[0].count;
      await task(client,id,"files",remaining?'pending':'completed',{reason:remaining?'QUARANTINE_PENDING':'FILES_HANDLED_SHARED_PRESERVED',actedByUserId:actor.userId});
      return {id,filesHandled:remaining===0,deletionComplete:false};
    });
  }
  return {blockScope,executeDatabase,processFiles};
}
let executor;
function defaults(){return executor??=createExecutor({db:require("../../lib/db"),fs:require("node:fs/promises"),mediaDir:require("../../config/env").INBOX_MEDIA_DIR});}
module.exports={createExecutor,blockScope:(...args)=>defaults().blockScope(...args),executeDatabase:(...args)=>defaults().executeDatabase(...args),processFiles:(...args)=>defaults().processFiles(...args)};
