const { createHash, randomUUID } = require("node:crypto");
const { AsyncLocalStorage } = require("node:async_hooks");
const { Pool } = require("pg");
const db = require("../../lib/db");
const context = new AsyncLocalStorage();
const operationContext = new AsyncLocalStorage();
let leases;
function key({accountId,instagramUserId}) {
  if (typeof accountId !== "string" || typeof instagramUserId !== "string" || !instagramUserId || instagramUserId.includes("\n"))
    throw Object.assign(new Error("INVALID_PRIVACY_SCOPE"),{status:400});
  return createHash("sha256").update(accountId.toLowerCase()+"\n"+instagramUserId).digest("hex");
}
function blocked() { return Object.assign(new Error("PRIVACY_SCOPE_BLOCKED"),{code:"PRIVACY_SCOPE_BLOCKED",status:409}); }
async function assertAllowed(client,scope) {
  const scopeKey=key(scope);
  await client.query("SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))",[scopeKey]);
  if ((await client.query("SELECT 1 FROM socialbot_privacy_scope_blocks WHERE scope_key=$1",[scopeKey])).rowCount) throw blocked();
}
async function withScope(scope,callback) {
  const scopeKey=key(scope);
  if (context.getStore()===scopeKey) return callback();
  if (!leases) {
    const options=db.getPool().options;
    // pg deliberately makes password/connectionString non-enumerable.
    leases=new Pool({...options,password:options.password,connectionString:options.connectionString,max:5,idleTimeoutMillis:1000});
  }
  const client=await leases.connect(); let locked=false, broken=false;
  try {
    await client.query("SET lock_timeout='3s'");
    await client.query("SELECT pg_advisory_lock_shared(hashtextextended($1,0))",[scopeKey]); locked=true;
    if ((await client.query("SELECT 1 FROM socialbot_privacy_scope_blocks WHERE scope_key=$1",[scopeKey])).rowCount) throw blocked();
    return await context.run(scopeKey,()=>db.runWithClient(client,callback));
  } finally {
    try {
      await client.query("ROLLBACK");
      if (locked) await client.query("SELECT pg_advisory_unlock_shared(hashtextextended($1,0))",[scopeKey]);
      await client.query("RESET lock_timeout");
    } catch {broken=true;}
    client.release(broken);
  }
}
async function close() {if(leases){await leases.end();leases=null;}}
async function outbound(scope,kind,callback,filename=null) {
  return withScope(scope,async()=>{
    const current=operationContext.getStore();
    // Upload and send share the same image journal; create it before disk I/O.
    if(filename&&current?.scopeKey===key(scope)&&current.kind===kind&&current.filename===filename)return callback();
    const id=randomUUID();
    await db.query("INSERT INTO socialbot_privacy_operations(id,scope_key,kind,state,filename) VALUES($1,$2,$3,'sending',$4)",[id,key(scope),kind,filename]);
    let delivered=false;
    try {
      const result=await operationContext.run({scopeKey:key(scope),kind,filename},callback);
      delivered=true;
      await db.query("UPDATE socialbot_privacy_operations SET state='succeeded' WHERE id=$1",[id]);
      return result;
    } catch(error) {
      if(delivered)error.deliveryMayHaveSucceeded=true;
      await db.query("UPDATE socialbot_privacy_operations SET state=$2 WHERE id=$1",[id,error.deliveryMayHaveSucceeded?'uncertain':'rejected']).catch(()=>{});
      throw error;
    }
  });
}
module.exports={key,assertAllowed,withScope,outbound,blocked,close};
