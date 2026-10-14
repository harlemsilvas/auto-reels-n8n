const gate=require("./scope-gate");
async function filter(client,body) {
  const output={object:"instagram",entry:[]};
  const candidates=[];
  if(body?.object!=="instagram" || !Array.isArray(body.entry)) return output;
  for(const entry of body.entry) {
    for(const event of Array.isArray(entry?.messaging)?entry.messaging:[]) candidates.push(event);
    for(const change of Array.isArray(entry?.changes)?entry.changes:[]) {
      if(change?.field!=="messages")continue;
      if(Array.isArray(change.value?.messaging))candidates.push(...change.value.messaging);
      else candidates.push(change.value);
    }
  }
  const ids=[...new Set(candidates.map(e=>e?.message?.is_echo?e?.sender?.id:e?.recipient?.id).filter(id=>typeof id==="string"))];
  const accounts=(await client.query("SELECT id,instagram_id FROM instagram_accounts WHERE instagram_id=ANY($1::text[]) AND ativo=true AND deleted_at IS NULL",[ids])).rows;
  const byId=new Map(accounts.map(a=>[a.instagram_id,a.id]));
  const scopes=new Map(),eventKeys=new Map();
  for(const event of candidates) {
    const echo=Boolean(event?.message?.is_echo);
    const accountId=byId.get(echo?event?.sender?.id:event?.recipient?.id);
    const instagramUserId=echo?event?.recipient?.id:event?.sender?.id;
    if(!accountId||typeof instagramUserId!=="string"||!instagramUserId)continue;
    const scope={accountId,instagramUserId},key=gate.key(scope);
    scopes.set(key,scope);eventKeys.set(event,key);
  }
  const allowed=new Set();
  for(const key of [...scopes.keys()].sort()) {
    await client.query("SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))",[key]);
    if(!(await client.query("SELECT 1 FROM socialbot_privacy_scope_blocks WHERE scope_key=$1",[key])).rowCount) allowed.add(key);
  }
  const retain=e=>allowed.has(eventKeys.get(e));
  for(const entry of body.entry) {
    const messaging=(Array.isArray(entry?.messaging)?entry.messaging:[]).filter(retain),changes=[];
    for(const change of Array.isArray(entry?.changes)?entry.changes:[]) {
      if(change?.field!=="messages")continue;
      if(Array.isArray(change.value?.messaging)) {
        const events=change.value.messaging.filter(retain);
        if(events.length)changes.push({field:"messages",value:{messaging:events}});
      } else if(retain(change.value)) changes.push(change);
    }
    if(messaging.length||changes.length)output.entry.push({messaging,changes});
  }
  return output;
}
module.exports={filter};
