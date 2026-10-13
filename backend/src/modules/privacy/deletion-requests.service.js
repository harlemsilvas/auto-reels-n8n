const { getPool } = require("../../lib/db");
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const IMAGE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png)$/i;
function fail(status, code) { return Object.assign(new Error(code), { status, code }); }
function uuid(value) { if (typeof value !== "string" || !UUID.test(value)) throw fail(400, "INVALID_REQUEST"); return value.toLowerCase(); }
function only(input, keys) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
    Object.keys(input).some(key => !keys.includes(key))) throw fail(400, "INVALID_REQUEST");
}
async function transaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SET LOCAL lock_timeout = '3s'");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
async function result(client, row) {
  const tasks = (await client.query(`SELECT kind,state,details->>'reason' AS reason,
    details->>'candidateCount' AS "candidateCount",details->>'sharedCount' AS "sharedCount",
    updated_at AS "updatedAt" FROM socialbot_deletion_tasks WHERE request_id=$1 ORDER BY kind`, [row.id])).rows;
  return { id: row.id, state: row.state, createdAt: row.created_at, verifiedAt: row.verified_at,
    tasks, deletionComplete: row.state === "completed" && tasks.length === 4 &&
      tasks.every(task => task.state === "completed") };
}
async function create(input, actor) {
  only(input, ["requestId", "conversationId"]);
  const requestId = uuid(input.requestId), conversationId = uuid(input.conversationId);
  const actorId = uuid(actor.userId);
  return transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["privacy-request:" + requestId]);
    const existing = (await client.query("SELECT * FROM socialbot_deletion_requests WHERE id=$1", [requestId])).rows[0];
    if (existing) {
      if (existing.conversation_id !== conversationId) throw fail(409, "REQUEST_SCOPE_CONFLICT");
      return result(client, existing);
    }
    const scope = (await client.query(`SELECT account_id,instagram_user_id FROM instagram_conversations
      WHERE id=$1 FOR SHARE`, [conversationId])).rows[0];
    if (!scope) throw fail(404, "CONVERSATION_NOT_FOUND");
    const row = (await client.query(`INSERT INTO socialbot_deletion_requests
      (id,conversation_id,account_id,instagram_user_id,created_by_user_id) VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [requestId, conversationId, scope.account_id, scope.instagram_user_id, actorId])).rows[0];
    return result(client, row);
  });
}
async function get(id) {
  return transaction(async client => {
    const row = (await client.query("SELECT * FROM socialbot_deletion_requests WHERE id=$1", [uuid(id)])).rows[0];
    if (!row) throw fail(404, "REQUEST_NOT_FOUND");
    return result(client, row);
  });
}
async function verify(id, input, actor) {
  only(input, ["identityReviewed", "scopeReviewed", "method", "reference"]);
  if (input.identityReviewed !== true || input.scopeReviewed !== true ||
      !["instagram_confirmation","verified_email","documented_review"].includes(input.method) ||
      typeof input.reference !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(input.reference)) throw fail(400, "VERIFICATION_REQUIRED");
  return transaction(async client => {
    const row = (await client.query("SELECT * FROM socialbot_deletion_requests WHERE id=$1 FOR UPDATE", [uuid(id)])).rows[0];
    if (!row) throw fail(404, "REQUEST_NOT_FOUND");
    if (row.state === "verified") return result(client, row);
    if (row.state !== "pending_verification") throw fail(409, "REQUEST_STATE_CONFLICT");
    const scope = (await client.query(`SELECT id FROM instagram_conversations
      WHERE id=$1 AND account_id=$2 AND instagram_user_id=$3 FOR SHARE`,
      [row.conversation_id, row.account_id, row.instagram_user_id])).rows[0];
    if (!scope) throw fail(409, "REQUEST_SCOPE_CONFLICT");
    const messages = (await client.query(`SELECT m.id,
      COALESCE(to_jsonb(m)->'payload',to_jsonb(m)->'raw_payload')->'inboxImage'->>'filename' AS filename
      FROM instagram_messages m JOIN instagram_conversations c ON c.id=m.conversation_id
      WHERE c.account_id=$1 AND c.instagram_user_id=$2`, [row.account_id, row.instagram_user_id])).rows;
    const references = (await client.query(`SELECT stored_filename AS filename FROM post_media_items
      UNION ALL SELECT stored_filename FROM media_template_items UNION ALL SELECT stored_filename FROM uploads
      UNION ALL SELECT video_filename FROM posts UNION ALL SELECT cover_image_filename FROM posts
      UNION ALL SELECT media_file_path FROM posts UNION ALL SELECT storage_path FROM post_media_items
      UNION ALL SELECT storage_path FROM media_template_items UNION ALL SELECT storage_path FROM uploads
      UNION ALL SELECT COALESCE(to_jsonb(m)->'payload',to_jsonb(m)->'raw_payload')->'inboxImage'->>'filename'
      FROM instagram_messages m WHERE NOT EXISTS(SELECT 1 FROM instagram_conversations c
        WHERE c.id=m.conversation_id AND c.account_id=$1 AND c.instagram_user_id=$2)`, [row.account_id,row.instagram_user_id])).rows;
    const path = require("node:path");
    const names = new Set(references.filter(ref => typeof ref.filename === "string")
      .map(ref => path.basename(ref.filename.replaceAll("\\", "/"))));
    const files = [...new Set(messages.map(m => m.filename).filter(Boolean))];
    const shared = files.filter(name => names.has(name));
    const candidates = files.filter(name => IMAGE.test(name) && !names.has(name));
    const unsafe = files.length - shared.length - candidates.length;
    const tasks = {
      database: { state: "blocked", details: { reason: "SCOPED_EXECUTOR_AND_INGRESS_GUARD_REQUIRED" } },
      files: { state: "blocked", details: { reason: unsafe ? "UNSAFE_OR_AMBIGUOUS_FILE_REFERENCE" : "QUARANTINE_AND_REVALIDATION_REQUIRED",
        candidateCount: candidates.length, sharedCount: shared.length, candidateFiles: candidates } },
      cache: { state: "blocked", details: { reason: "ALL_INSTANCES_AND_CAPABILITIES_REVIEW_REQUIRED" } },
      backups: { state: "blocked", details: { reason: "COPY_INVENTORY_AND_RESTORE_FILTER_REQUIRED" } },
    };
    for (const [kind, task] of Object.entries(tasks)) await client.query(`INSERT INTO socialbot_deletion_tasks
      (request_id,kind,state,details) VALUES($1,$2,$3,$4::jsonb)`, [row.id,kind,task.state,JSON.stringify(task.details)]);
    const verified = (await client.query(`UPDATE socialbot_deletion_requests SET state='verified',
      verified_by_user_id=$2,verification_method=$3,verification_reference=$4,verified_at=NOW()
      WHERE id=$1 RETURNING *`, [row.id,uuid(actor.userId),input.method,input.reference])).rows[0];
    return result(client, verified);
  });
}
async function invalidateCache(id, input) {
  only(input, []);
  return transaction(async client => {
    const row = (await client.query("SELECT * FROM socialbot_deletion_requests WHERE id=$1 FOR UPDATE", [uuid(id)])).rows[0];
    if (!row) throw fail(404, "REQUEST_NOT_FOUND");
    if (row.state !== "verified") throw fail(409, "REQUEST_STATE_CONFLICT");
    const scope = { accountId: row.account_id, instagramUserId: row.instagram_user_id };
    const profiles = require("../conversations/instagram-profile-cache").forgetScope(scope);
    const images = require("../inbox/inbox-images.service").revokeScope(scope);
    const details = { reason: "OTHER_INSTANCES_AND_INGRESS_GUARD_REQUIRED", currentProcessInvalidatedAt: new Date().toISOString(),
      removedProfileEntries: profiles, removedCapabilities: images.removed, legacyCapabilitiesRequireReview: images.legacyUnscoped };
    await client.query(`UPDATE socialbot_deletion_tasks SET details=$2::jsonb,updated_at=NOW()
      WHERE request_id=$1 AND kind='cache'`, [row.id,JSON.stringify(details)]);
    return result(client,row);
  });
}
async function reviewBackups(id, input, actor) {
  only(input, ["inventoryReviewed", "restoreSafeguardsReviewed", "inventoryReference", "restoreReference"]);
  if (input.inventoryReviewed !== true || input.restoreSafeguardsReviewed !== true ||
      [input.inventoryReference,input.restoreReference].some(value => typeof value !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(value)))
    throw fail(400,"VERIFICATION_REQUIRED");
  return transaction(async client => {
    const row=(await client.query("SELECT * FROM socialbot_deletion_requests WHERE id=$1 FOR UPDATE",[uuid(id)])).rows[0];
    if (!row) throw fail(404,"REQUEST_NOT_FOUND");
    if (row.state !== "verified") throw fail(409,"REQUEST_STATE_CONFLICT");
    const details={reason:"COPY_EXPIRY_AND_RESTORE_TEST_REQUIRED", reviewedByUserId:uuid(actor.userId),
      reviewedAt:new Date().toISOString(),inventoryReference:input.inventoryReference,restoreReference:input.restoreReference};
    await client.query(`UPDATE socialbot_deletion_tasks SET details=$2::jsonb,updated_at=NOW()
      WHERE request_id=$1 AND kind='backups'`,[row.id,JSON.stringify(details)]);
    return result(client,row);
  });
}
module.exports = { create, get, verify, invalidateCache, reviewBackups };
