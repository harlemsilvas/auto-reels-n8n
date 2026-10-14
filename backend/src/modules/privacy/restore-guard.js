const {createHash}=require('node:crypto');
const gate=require('./scope-gate');
const HASH=/^[a-f0-9]{64}$/;
function digest(value){return createHash('sha256').update(value).digest('hex');}
function validate(manifest) {
  if(!manifest||manifest.version!==1||!Number.isFinite(Date.parse(manifest.exportedAt))||
    !Array.isArray(manifest.scopeKeys)||!Array.isArray(manifest.fileHashes)||
    [...manifest.scopeKeys,...manifest.fileHashes].some(value=>typeof value!=='string'||!HASH.test(value)))
    throw Error('INVALID_RESTORE_MANIFEST');
  return manifest;
}
async function snapshot(client) {
  const {rows}=await client.query('SELECT scope_key FROM socialbot_privacy_scope_blocks ORDER BY scope_key');
  const files=await client.query(`SELECT DISTINCT f.filename FROM socialbot_deletion_files f
    JOIN socialbot_privacy_scope_blocks b ON b.request_id=f.request_id
    WHERE f.state <> 'shared' ORDER BY f.filename`);
  return {version:1,exportedAt:new Date().toISOString(),scopeKeys:rows.map(r=>r.scope_key),
    fileHashes:[...new Set(files.rows.map(r=>digest(r.filename)))].sort()};
}
async function inspect(client,manifest) {
  validate(manifest);
  const scopes=new Set(manifest.scopeKeys);
  const blocks=await client.query('SELECT scope_key FROM socialbot_privacy_scope_blocks');
  const available=new Set(blocks.rows.map(r=>r.scope_key));
  const missingBlocks=[...scopes].filter(key=>!available.has(key)).length;
  const conversations=await client.query('SELECT account_id,instagram_user_id FROM instagram_conversations');
  const retainedConversations=conversations.rows.filter(row=>scopes.has(gate.key({accountId:row.account_id,instagramUserId:row.instagram_user_id}))).length;
  const operations=await client.query('SELECT count(*)::int AS n FROM socialbot_privacy_operations WHERE scope_key=ANY($1::text[])',[manifest.scopeKeys]);
  const orphanMessages=await client.query('SELECT count(*)::int AS n FROM instagram_messages m WHERE NOT EXISTS(SELECT 1 FROM instagram_conversations c WHERE c.id=m.conversation_id)');
  const orphanAttempts=await client.query('SELECT count(*)::int AS n FROM instagram_send_attempts a WHERE NOT EXISTS(SELECT 1 FROM instagram_conversations c WHERE c.id=a.conversation_id)');
  const accounts=await client.query('SELECT id,instagram_id FROM instagram_accounts');
  const ids=new Map();
  for(const account of accounts.rows){
    if(!account.instagram_id)continue;
    const values=ids.get(account.instagram_id)||[];values.push(account.id);ids.set(account.instagram_id,values);
  }
  let retainedWebhookItems=0,unknownWebhookItems=0;
  function event(item) {
    const sender=item?.sender?.id,recipient=item?.recipient?.id;
    if(typeof sender!=='string'||typeof recipient!=='string'){unknownWebhookItems++;return;}
    let correlated=false;
    for(const [account,subject] of [[recipient,sender],[sender,recipient]]){
      const accountIds=ids.get(account);
      if(accountIds){
        correlated=true;
        if(accountIds.some(accountId=>scopes.has(gate.key({accountId,instagramUserId:subject})))){retainedWebhookItems++;return;}
      }
    }
    if(!correlated)unknownWebhookItems++;
  }
  const events=await client.query('SELECT payload FROM webhook_events');
  for(const {payload} of events.rows){
    if(payload?.object!=='instagram'||!Array.isArray(payload.entry)){unknownWebhookItems++;continue;}
    if(Object.keys(payload).some(k=>!['object','entry'].includes(k)))unknownWebhookItems++;
    for(const entry of payload.entry){
      if(!entry||typeof entry!=='object'){unknownWebhookItems++;continue;}
      if(Object.keys(entry).some(k=>!['messaging','changes'].includes(k)))unknownWebhookItems++;
      if(entry.messaging!==undefined&&!Array.isArray(entry.messaging))unknownWebhookItems++;
      for(const item of Array.isArray(entry.messaging)?entry.messaging:[])event(item);
      if(entry.changes!==undefined&&!Array.isArray(entry.changes))unknownWebhookItems++;
      for(const change of Array.isArray(entry.changes)?entry.changes:[]){
        if(change?.field!=='messages'){unknownWebhookItems++;continue;}
        if(Array.isArray(change.value?.messaging))for(const item of change.value.messaging)event(item);
        else event(change.value);
      }
    }
  }
  const report={missingBlocks,retainedConversations,retainedOperations:operations.rows[0].n,
    orphanMessages:orphanMessages.rows[0].n,orphanAttempts:orphanAttempts.rows[0].n,
    retainedWebhookItems,unknownWebhookItems};
  return {...report,databaseClear:Object.values(report).every(n=>n===0),activationAllowed:false};
}
module.exports={digest,validate,snapshot,inspect};
