const gate = require('./scope-gate');

// Each API process inspects its own memory against the durable block registry.
function createSweeper({db,providers}) {
  let pending;
  function sweep() {
    if(pending)return pending;
    pending=(async()=>{
      const scopes=new Map();
      for(const provider of providers)for(const scope of provider.cachedScopes())scopes.set(gate.key(scope),scope);
      if(!scopes.size)return {blockedScopes:0};
      const {rows}=await db.query('SELECT scope_key FROM socialbot_privacy_scope_blocks WHERE scope_key=ANY($1::text[])',[[...scopes.keys()]]);
      for(const row of rows)for(const provider of providers)provider.forgetScope(scopes.get(row.scope_key));
      return {blockedScopes:rows.length};
    })().finally(()=>{pending=null;});
    return pending;
  }
  return {sweep};
}
let stop;
function startCacheSweep() {
  if(stop)return stop;
  const profiles=require('../conversations/instagram-profile-cache');
  const images=require('../inbox/inbox-images.service');
  const {sweep}=createSweeper({db:require('../../lib/db'),providers:[profiles,
    {cachedScopes:images.cachedScopes,forgetScope:images.revokeScope}]});
  // No personal identifiers or provider errors in logs. Gate checks still fail closed.
  const run=()=>sweep().catch(()=>console.warn('PRIVACY_CACHE_SWEEP_UNAVAILABLE'));
  run();
  const timer=setInterval(run,30000);timer.unref();
  stop=()=>{clearInterval(timer);stop=null;};
  return stop;
}
module.exports={createSweeper,startCacheSweep};
