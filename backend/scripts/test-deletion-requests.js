const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { Script } = require("node:vm");
const express = require("express");

function load(file, dependencies) {
  const filename = path.resolve(__dirname, "../src", file), module = { exports: {} };
  new Script(`(function(require,module){${fs.readFileSync(filename,"utf8")}\n})`, {filename})
    .runInThisContext()(name => {
      assert.ok(Object.hasOwn(dependencies,name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    },module);
  return module.exports;
}
async function main() {
  process.chdir(path.resolve(__dirname,".."));
  process.env.DOTENV_CONFIG_QUIET = "true";
  const env = require("../src/config/env");
  assert.ok(["127.0.0.1","localhost"].includes(env.DB_HOST) && !env.DB_CONNECTION_STRING && process.env.NODE_ENV !== "production");
  const { Pool } = require("pg");
  const config = {host:env.DB_HOST,port:env.DB_PORT,database:env.DB_NAME,user:env.DB_USER,password:env.DB_PASSWORD};
  const admin = new Pool(config);
  const schema = "privacy_request_test_" + randomUUID().replaceAll("-", "");
  const pool = new Pool({...config, options:`-c search_path=${schema},public`});
  const db = { getPool: () => pool };
  const cacheCalls=[];
  const dependencies={"../../lib/db":db,"node:path":path,
    "../conversations/instagram-profile-cache":{forgetScope(scope){cacheCalls.push(scope);return 2;}},
    "../inbox/inbox-images.service":{revokeScope(scope){cacheCalls.push(scope);return {removed:1,legacyUnscoped:0};}},
  };
  const service = load("modules/privacy/deletion-requests.service.js", dependencies);
  const sql = name => fs.readFileSync(path.resolve(__dirname,"../sql",name),"utf8")
    .split("\n").filter(line => !line.startsWith("\\")).join("\n")
    .replaceAll("public.",schema+".").replaceAll("'public'",`'${schema}'`);
  const actor = {userId:randomUUID(),role:"admin"};
  const accountId = randomUUID(), conversationId = randomUUID(), other = randomUUID();
  const requestId = randomUUID(), fileA = randomUUID()+".jpg", fileB=randomUUID()+".png";
  const proof = {identityReviewed:true,scopeReviewed:true,method:"instagram_confirmation",reference:"case-demo-01"};
  let server, created=false;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`); created=true;
    await pool.query(`CREATE TABLE ${schema}.socialbot_users(id uuid PRIMARY KEY);
      CREATE TABLE ${schema}.instagram_conversations(id uuid PRIMARY KEY,account_id uuid,instagram_user_id text);
      CREATE TABLE ${schema}.instagram_messages(id uuid PRIMARY KEY,conversation_id uuid,payload jsonb);
      CREATE TABLE ${schema}.post_media_items(stored_filename text,storage_path text);
      CREATE TABLE ${schema}.media_template_items(stored_filename text,storage_path text);
      CREATE TABLE ${schema}.uploads(stored_filename text,storage_path text);
      CREATE TABLE ${schema}.posts(video_filename text,cover_image_filename text,media_file_path text)`);
    const migration=sql("016-privacy-deletion-requests.sql"), verify=sql("016-privacy-deletion-requests-verify.sql");
    // First exercise the migration under rollback.
    const rollback=await pool.connect();
    try {
      await rollback.query(migration.replace(/COMMIT;\s*$/, "ROLLBACK;"));
      assert.equal((await rollback.query("SELECT to_regclass($1) AS table",[schema+".socialbot_deletion_requests"])).rows[0].table,null);
    } finally {rollback.release();}
    await pool.query(migration); await pool.query(migration); await pool.query(verify);
    await pool.query(`INSERT INTO socialbot_users VALUES($1)`,[actor.userId]);
    await pool.query(`INSERT INTO instagram_conversations VALUES($1,$3,'demo-subject'),($2,$3,'demo-other')`,[conversationId,other,accountId]);
    await pool.query(`INSERT INTO instagram_messages VALUES($1,$2,$3),($4,$2,$5)`,[randomUUID(),conversationId,
      JSON.stringify({inboxImage:{filename:fileA}}),randomUUID(),JSON.stringify({inboxImage:{filename:fileB}})]);
    await pool.query(`INSERT INTO media_template_items VALUES($1,NULL)`,[fileB]);
    await assert.rejects(service.create({requestId,conversationId,subjectId:"free-id"},actor),e=>e.code==="INVALID_REQUEST");
    const pending=await service.create({requestId,conversationId},actor);
    assert.equal(pending.state,"pending_verification"); assert.deepEqual(pending.tasks,[]);
    await assert.rejects(service.invalidateCache(requestId,{}),e=>e.code==="REQUEST_STATE_CONFLICT");
    assert.equal((await service.create({requestId,conversationId},actor)).id,requestId);
    await assert.rejects(service.create({requestId,conversationId:other},actor),e=>e.code==="REQUEST_SCOPE_CONFLICT");
    await assert.rejects(service.create({requestId:randomUUID(),conversationId},actor),e=>e.code==="23505");
    await assert.rejects(service.verify(requestId,{...proof,identityReviewed:false},actor),e=>e.code==="VERIFICATION_REQUIRED");
    await assert.rejects(service.verify(requestId,{...proof,reference:"someone@example.test"},actor),e=>e.code==="VERIFICATION_REQUIRED");
    const verified = await service.verify(requestId,proof,actor);
    assert.equal(verified.state,"verified"); assert.equal(verified.deletionComplete,false);
    assert.equal(verified.tasks.length,4);
    assert.ok(verified.tasks.every(task=>task.state==="blocked"));
    assert.equal(verified.tasks.find(task=>task.kind==="files").candidateCount,"1");
    assert.equal(verified.tasks.find(task=>task.kind==="files").sharedCount,"1");
    assert.doesNotMatch(JSON.stringify(verified),new RegExp(fileA+"|"+fileB+"|demo-subject|case-demo-01"));
    assert.equal((await service.verify(requestId,proof,actor)).tasks.length,4);
    assert.equal((await service.get(requestId)).state,"verified");
    // Reload the service to prove request/task state lives in PostgreSQL, not a module map.
    assert.equal((await load("modules/privacy/deletion-requests.service.js",dependencies).get(requestId)).state,"verified");
    const invalidated=await service.invalidateCache(requestId,{});
    assert.equal(invalidated.tasks.find(task=>task.kind==="cache").state,"blocked");
    assert.equal(invalidated.deletionComplete,false);
    assert.deepEqual(cacheCalls,[{accountId,instagramUserId:"demo-subject"},{accountId,instagramUserId:"demo-subject"}]);
    const backupProof={inventoryReviewed:true,restoreSafeguardsReviewed:true,inventoryReference:"inventory-demo",restoreReference:"restore-plan-demo"};
    await assert.rejects(service.reviewBackups(requestId,{...backupProof,inventoryReviewed:false},actor),e=>e.code==="VERIFICATION_REQUIRED");
    const backups=await service.reviewBackups(requestId,backupProof,actor);
    assert.equal(backups.tasks.find(task=>task.kind==="backups").state,"blocked");
    assert.equal(backups.deletionComplete,false);
    const otherRequest=randomUUID();
    await service.create({requestId:otherRequest,conversationId:other},actor);
    await pool.query(`UPDATE instagram_conversations SET instagram_user_id='changed' WHERE id=$1`,[other]);
    await assert.rejects(service.verify(otherRequest,proof,actor),e=>e.code==="REQUEST_SCOPE_CONFLICT");
    assert.equal((await service.get(otherRequest)).tasks.length,0);
    const middleware=load("modules/auth/admin-auth.middleware.js", {
      "../../config/env":{ADMIN_AUTH_COOKIE_NAME:"demo",ADMIN_AUTH_ENABLED:false},
      "./admin-auth.service":{
        async authenticateToken(token){return token==="admin"?actor:token==="operator"?{...actor,role:"operator"}:null;},
        validateCsrf(_actor,token){return token==="demo-csrf";},
      },"./permissions.service":{hasPermission:()=>true},
    });
    const router=load("modules/privacy/deletion-requests.routes.js",{
      express,"../auth/admin-auth.middleware":middleware,"./deletion-requests.service":service,
    });
    const app=express(); app.use("/requests",router);
    server=await new Promise((resolve,reject)=>{const s=app.listen(0,"127.0.0.1",error=>error?reject(error):resolve(s));s.on("error",reject);});
    const base=`http://127.0.0.1:${server.address().port}`;
    async function call(method,url,body,token,csrf){return fetch(base+url,{method,
      headers:{"content-type":"application/json",...(token?{cookie:`demo=${token}`} : {}),...(csrf?{"x-csrf-token":csrf}:{})},
      ...(body?{body:JSON.stringify(body)}:{})});}
    assert.equal((await call("GET",`/requests/${requestId}`)).status,401);
    assert.equal((await call("GET",`/requests/${requestId}`,null,"operator")).status,403);
    assert.equal((await call("GET",`/requests/${requestId}`,null,"admin")).status,200);
    assert.equal((await call("POST",`/requests/${requestId}/verify`,proof,"admin")).status,403);
    assert.equal((await call("POST",`/requests/${requestId}/verify`,proof,"admin","demo-csrf")).status,200);
    assert.equal((await call("POST",`/requests/${requestId}/invalidate-cache`,{},"admin")).status,403);
    assert.equal((await call("POST",`/requests/${requestId}/invalidate-cache`,{},"admin","demo-csrf")).status,200);
    assert.equal((await call("POST",`/requests/${requestId}/review-backups`,backupProof,"admin")).status,403);
    assert.equal((await call("POST",`/requests/${requestId}/review-backups`,backupProof,"admin","demo-csrf")).status,200);
    assert.equal((await call("POST",`/requests/${requestId}/verify`,{...proof,scopeReviewed:false},"admin","demo-csrf")).status,400);
    assert.equal((await call("GET","/requests/not-a-uuid",null,"admin")).status,400);
    const malformed=await fetch(base+"/requests",{method:"POST",headers:{"content-type":"application/json",cookie:"demo=admin","x-csrf-token":"demo-csrf"},body:'{"private-demo-secret":'});
    assert.equal(malformed.status,400);
    assert.doesNotMatch(await malformed.text(),/private-demo-secret|stack/);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM instagram_messages")).rows[0].n,2);
    console.log("Approved: migration rollback/idempotence/verifier, durable create/replay/scope/duplicate, verification gates, tasks/files shared protection, safe output, and HTTP session/admin/CSRF with auth flag disabled. Temporary schema only; no cleanup.");
  } finally {
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    await pool.end();
    if(created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
}
main().catch(()=>{console.error("DELETION_REQUEST_TEST_FAILED: temporary schema validation failed; no public cleanup requested.");process.exitCode=1;});
