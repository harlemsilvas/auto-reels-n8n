const path=require('node:path');
const {digest,inspect}=require('./restore-guard');
const gate=require('./scope-gate');
const {createExecutor}=require('./deletion-executor');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const IMAGE=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png)$/;
async function exportReceipt(client){
  const {rows}=await client.query(`SELECT r.*,b.scope_key FROM socialbot_privacy_scope_blocks b
    JOIN socialbot_deletion_requests r ON r.id=b.request_id ORDER BY b.scope_key`);
  const scopes=[];
  for(const r of rows){
    if(!['verified','completed'].includes(r.state)||!r.verified_at)throw Error('UNVERIFIED_RECEIPT');
    const tasks=await client.query("SELECT kind,state FROM socialbot_deletion_tasks WHERE request_id=$1 AND kind IN ('database','files')",[r.id]);
    if(tasks.rows.length!==2||tasks.rows.some(task=>task.state!=='completed'))throw Error('UNFINISHED_RESTORE_RECEIPT');
    const files=await client.query("SELECT filename FROM socialbot_deletion_files WHERE request_id=$1 AND state <> 'shared' ORDER BY filename",[r.id]);
    scopes.push({scopeKey:r.scope_key,id:r.id,conversationId:r.conversation_id,accountId:r.account_id,
      instagramUserId:r.instagram_user_id,createdBy:r.created_by_user_id,verifiedBy:r.verified_by_user_id,
      method:r.verification_method,reference:r.verification_reference,verifiedAt:r.verified_at,
      privateFiles:files.rows.map(f=>f.filename)});
  }
  return {version:2,exportedAt:new Date().toISOString(),scopes};
}
function parseReceipt(bytes,expectedDigest){
  if(!/^[a-f0-9]{64}$/.test(expectedDigest)||digest(bytes)!==expectedDigest)throw Error('RECEIPT_DIGEST_MISMATCH');
  const receipt=JSON.parse(bytes);
  if(receipt.version!==2||!Number.isFinite(Date.parse(receipt.exportedAt))||!Array.isArray(receipt.scopes))throw Error('INVALID_RESTORE_RECEIPT');
  const seen=new Set();
  for(const r of receipt.scopes){
    if(![r.id,r.conversationId,r.accountId,r.createdBy,r.verifiedBy].every(v=>typeof v==='string'&&UUID.test(v))||
      typeof r.instagramUserId!=='string'||r.instagramUserId.length>100||
      gate.key(r)!==r.scopeKey||seen.has(r.scopeKey)||
      !['instagram_confirmation','verified_email','documented_review'].includes(r.method)||
      typeof r.reference!=='string'||!/^[A-Za-z0-9._-]{1,64}$/.test(r.reference)||
      !Number.isFinite(Date.parse(r.verifiedAt))||!Array.isArray(r.privateFiles)||r.privateFiles.some(f=>typeof f!=='string'||!IMAGE.test(f)))
      throw Error('INVALID_RESTORE_RECEIPT');
    seen.add(r.scopeKey);
  }
  return receipt;
}
async function reapply({db,fs,mediaDir,bytes,expectedDigest,actor,acknowledged=false}){
  if(!acknowledged)throw Error('RESTORE_ACK_REQUIRED');
  if(!UUID.test(actor?.userId))throw Error('RESTORE_ACTOR_REQUIRED');
  const receipt=parseReceipt(bytes,expectedDigest),pool=db.getPool();
  // No production entry point: only an explicitly named disposable local database.
  if(!['localhost','127.0.0.1'].includes(pool.options.host)||process.env.NODE_ENV==='production')throw Error('ISOLATED_RESTORE_REQUIRED');
  const location=(await pool.query('SELECT current_database() AS db,current_schema() AS schema')).rows[0];
  if(!/^mr05_restore_[a-f0-9]{32}$/.test(location.db)||location.schema!=='public')throw Error('ISOLATED_RESTORE_REQUIRED');
  if(!(await pool.query('SELECT 1 FROM socialbot_users WHERE id=$1',[actor.userId])).rowCount)throw Error('RESTORE_ACTOR_REQUIRED');
  const directory=path.resolve(mediaDir),s=await fs.lstat(directory);
  if(!s.isDirectory()||s.isSymbolicLink()||await fs.realpath(directory)!==directory||
    path.basename(directory)!==location.db)throw Error('ISOLATED_MEDIA_REQUIRED');
  let handled=0;
  for(const r of receipt.scopes){
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout='3s'");
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[r.scopeKey]);
      const old=(await client.query('SELECT * FROM socialbot_deletion_requests WHERE id=$1 FOR UPDATE',[r.id])).rows[0];
      if(old&&(old.account_id!==r.accountId||old.instagram_user_id!==r.instagramUserId||old.conversation_id!==r.conversationId))throw Error('RESTORE_SCOPE_CONFLICT');
      await client.query(`INSERT INTO socialbot_deletion_requests(id,conversation_id,account_id,instagram_user_id,state,
        created_by_user_id,verified_by_user_id,verification_method,verification_reference,verified_at)
        VALUES($1,$2,$3,$4,'verified',$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET state='verified',
        verified_by_user_id=EXCLUDED.verified_by_user_id,verification_method=EXCLUDED.verification_method,
        verification_reference=EXCLUDED.verification_reference,verified_at=EXCLUDED.verified_at`,
        [r.id,r.conversationId,r.accountId,r.instagramUserId,r.createdBy,r.verifiedBy,r.method,r.reference,r.verifiedAt]);
      const marker=(await client.query("SELECT details->>'restoreReceiptDigest' AS digest FROM socialbot_deletion_tasks WHERE request_id=$1 AND kind='backups'",[r.id])).rows[0];
      if(marker?.digest===expectedDigest){
        const done=(await client.query("SELECT state FROM socialbot_deletion_tasks WHERE request_id=$1 AND kind='database'",[r.id])).rows[0];
        if(done?.state==='completed'&&(await client.query('SELECT 1 FROM instagram_conversations WHERE account_id=$1 AND instagram_user_id=$2',[r.accountId,r.instagramUserId])).rowCount)
          throw Error('RESTORE_REINTRODUCTION_REVIEW_REQUIRED');
        const removed=await client.query("SELECT filename FROM socialbot_deletion_files WHERE request_id=$1 AND state='removed'",[r.id]);
        for(const file of removed.rows){
          try{await fs.lstat(path.join(directory,file.filename));throw Error('RESTORE_REINTRODUCTION_REVIEW_REQUIRED');}
          catch(error){if(error.code!=='ENOENT')throw error;}
        }
      }
      if(marker?.digest!==expectedDigest){
        // A fresh filesystem copy has new inodes; rebuild its plan, never trust the dump's file states.
        const unsettled=await client.query("SELECT 1 FROM socialbot_deletion_files WHERE request_id=$1 AND state='quarantined'",[r.id]);
        if(unsettled.rowCount)throw Error('RESTORE_QUARANTINE_REVIEW_REQUIRED');
        await client.query('DELETE FROM socialbot_deletion_files WHERE request_id=$1',[r.id]);
        for(const kind of ['database','files','cache','backups'])await client.query(`INSERT INTO socialbot_deletion_tasks(request_id,kind,state,details)
          VALUES($1,$2,'blocked',$3::jsonb) ON CONFLICT(request_id,kind) DO UPDATE SET state='blocked',details=EXCLUDED.details,updated_at=NOW()`,
          [r.id,kind,JSON.stringify({reason:'RESTORE_REPLAY_PENDING',restoreReceiptDigest:expectedDigest,replayedByUserId:actor.userId})]);
      }
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    const additionalFiles=[];
    for(const name of r.privateFiles){
      try{const file=await fs.lstat(path.join(directory,name));if(!file.isFile()||file.isSymbolicLink())throw Error('RESTORE_FILE_REVIEW_REQUIRED');additionalFiles.push(name);}
      catch(error){if(error.code!=='ENOENT')throw error;}
    }
    const executor=createExecutor({db,fs,mediaDir:directory,additionalFiles});
    const ack={acknowledged:true};
    await executor.blockScope(r.id,ack,actor);
    await executor.executeDatabase(r.id,ack,actor);
    await executor.processFiles(r.id,ack,actor);handled++;
  }
  const manifest={version:1,exportedAt:receipt.exportedAt,scopeKeys:receipt.scopes.map(r=>r.scopeKey),
    fileHashes:receipt.scopes.flatMap(r=>r.privateFiles.map(digest))};
  const verification=await inspect(pool,manifest);
  if(!verification.databaseClear)throw Error('RESTORE_DATABASE_REVIEW_REQUIRED');
  return {reappliedScopes:handled,databaseClear:true,activationAllowed:false,deletionComplete:false};
}
module.exports={exportReceipt,parseReceipt,reapply};
