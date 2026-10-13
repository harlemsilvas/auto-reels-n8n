const path = require("node:path");
const fs = require("node:fs/promises");

const DAY = 86400000;
const IMAGE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png)$/i;

function older(value, cutoff) {
  return value != null && Number.isFinite(new Date(value).getTime()) && new Date(value) < cutoff;
}

// One metadata-only snapshot. No DM text, URLs, tokens or provider response leaves SQL.
async function readSnapshot(client) {
  const messages = (await client.query(`SELECT m.id, m.conversation_id, m.created_at,
    m.meta_message_id,
    COALESCE(to_jsonb(m)->'payload', to_jsonb(m)->'raw_payload')->'inboxImage'->>'filename' AS filename,
    COALESCE(to_jsonb(m)->'payload', to_jsonb(m)->'raw_payload')->'message'->'attachments' IS NOT NULL AS has_attachments
    FROM public.instagram_messages m`)).rows;
  const attempts = (await client.query(`SELECT id, conversation_id, state, message_id,
    meta_message_id, created_at, updated_at, sent_at FROM public.instagram_send_attempts`)).rows;
  const shared = (await client.query(`SELECT stored_filename AS filename FROM public.post_media_items
    UNION ALL SELECT stored_filename FROM public.media_template_items
    UNION ALL SELECT stored_filename FROM public.uploads
    UNION ALL SELECT video_filename FROM public.posts
    UNION ALL SELECT cover_image_filename FROM public.posts
    UNION ALL SELECT media_file_path FROM public.posts
    UNION ALL SELECT storage_path FROM public.post_media_items
    UNION ALL SELECT storage_path FROM public.media_template_items
    UNION ALL SELECT storage_path FROM public.uploads`)).rows;
  const conversations = (await client.query("SELECT id FROM public.instagram_conversations")).rows;
  const webhook = (await client.query("SELECT count(*)::int AS total FROM public.webhook_events")).rows[0];
  const foreignKeys = (await client.query(`SELECT conrelid::regclass::text AS source,
    confrelid::regclass::text AS target, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE contype='f'
    AND confrelid IN ('public.instagram_messages'::regclass,
      'public.instagram_send_attempts'::regclass)`)).rows;
  return { messages, attempts, shared, conversations, webhook, foreignKeys };
}

async function inventoryImages(directory) {
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return { exists: false, files: [] }; throw error; }
  const files = [];
  for (const entry of entries) {
    // Never follow links or traverse directories; never read image contents.
    if (!entry.isFile() || !IMAGE.test(entry.name)) {
      files.push({ unsafe: true });
      continue;
    }
    const stat = await fs.lstat(path.join(directory, entry.name));
    files.push(stat.isFile() && !stat.isSymbolicLink()
      ? { filename: entry.name, mtime: stat.mtime, bytes: stat.size } : { unsafe: true });
  }
  return { exists: true, files };
}

function buildReport(snapshot, inventory, now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw Error("INVALID_REPORT_DATE");
  const cutoff = days => new Date(now.getTime() - days * DAY);
  const year = new Date(now);
  year.setUTCFullYear(year.getUTCFullYear() - 1);
  const messagesById = new Map(snapshot.messages.map(m => [m.id, m]));
  const conversations = new Set(snapshot.conversations.map(c => c.id));
  const protectedConversations = new Set();
  const linkedMessages = new Set();
  const protectedAttempts = new Set();
  for (const attempt of snapshot.attempts) {
    if (attempt.message_id) linkedMessages.add(attempt.message_id);
    const linked = messagesById.get(attempt.message_id);
    const inconsistent = !conversations.has(attempt.conversation_id) ||
      (attempt.state === "sent" && (!attempt.meta_message_id || !linked ||
        linked.conversation_id !== attempt.conversation_id || linked.meta_message_id !== attempt.meta_message_id)) ||
      (["rejected", "dismissed"].includes(attempt.state) && Boolean(attempt.meta_message_id || attempt.message_id));
    if (!["sent", "rejected", "dismissed"].includes(attempt.state) || inconsistent) {
      protectedAttempts.add(attempt.id);
      protectedConversations.add(attempt.conversation_id);
      if (linked) protectedConversations.add(linked.conversation_id);
    }
  }
  const unknownForeignKeys = snapshot.foreignKeys.filter(fk =>
    !(fk.source.replace(/^public\./, "") === "instagram_send_attempts" &&
      fk.target.replace(/^public\./, "") === "instagram_messages" &&
      /^FOREIGN KEY \(message_id\) REFERENCES (public\.)?instagram_messages\(id\) ON DELETE SET NULL$/.test(fk.definition)));
  const messageReport = { total: snapshot.messages.length, expiredContent: 0,
    protectedExpiredContent: 0, contentReviewCandidates: 0,
    rowReviewCandidates: 0, ledgerLinkedRowsPreserved: 0, attachmentMetadataReviewCandidates: 0 };
  for (const message of snapshot.messages) {
    const held = protectedConversations.has(message.conversation_id) ||
      !conversations.has(message.conversation_id) || unknownForeignKeys.length > 0;
    if (older(message.created_at, cutoff(90))) {
      messageReport.expiredContent++;
      if (held) messageReport.protectedExpiredContent++;
      else {
        messageReport.contentReviewCandidates++;
        if (linkedMessages.has(message.id)) messageReport.ledgerLinkedRowsPreserved++;
        else messageReport.rowReviewCandidates++;
      }
    }
    if (message.has_attachments && older(message.created_at, cutoff(30)) && !held)
      messageReport.attachmentMetadataReviewCandidates++;
  }
  const ledger = { total: snapshot.attempts.length, protected: 0,
    contentMinimizationReviewCandidates: 0, rowReviewCandidates: 0 };
  for (const attempt of snapshot.attempts) {
    if (protectedAttempts.has(attempt.id) || protectedConversations.has(attempt.conversation_id) ||
      unknownForeignKeys.length > 0) { ledger.protected++; continue; }
    // updated_at is conservative: completion date is not explicit for every state.
    if (older(attempt.updated_at, cutoff(90))) ledger.contentMinimizationReviewCandidates++;
    if (older(attempt.updated_at, year)) ledger.rowReviewCandidates++;
  }
  const sharedNames = new Set(snapshot.shared.filter(r => typeof r.filename === "string")
    .map(r => path.basename(r.filename.replaceAll("\\", "/"))));
  const references = new Map();
  for (const message of snapshot.messages) {
    if (typeof message.filename !== "string") continue;
    const name = path.basename(message.filename.replaceAll("\\", "/"));
    if (!references.has(name)) references.set(name, []);
    references.get(name).push(message);
  }
  const images = { directoryExists: inventory.exists, totalEntries: inventory.files.length,
    reviewCandidates: 0, candidateBytes: 0, preservedShared: 0,
    preservedUncertainOrRecent: 0, unreferencedManualReview: 0, unsafeEntries: 0 };
  for (const file of inventory.files) {
    if (file.unsafe) { images.unsafeEntries++; continue; }
    const refs = references.get(file.filename) || [];
    if (sharedNames.has(file.filename) || refs.length > 1) { images.preservedShared++; continue; }
    if (!refs.length) { images.unreferencedManualReview++; continue; }
    const ref = refs[0];
    if (unknownForeignKeys.length || !conversations.has(ref.conversation_id) ||
      protectedConversations.has(ref.conversation_id) || linkedMessages.has(ref.id) ||
      ref.filename !== file.filename || !older(ref.created_at, cutoff(30)) ||
      !older(file.mtime, cutoff(30))) { images.preservedUncertainOrRecent++; continue; }
    images.reviewCandidates++;
    images.candidateBytes += file.bytes;
  }
  return {
    generatedAt: now.toISOString(), mode: "read-only-local", actionableDeletionList: false,
    cutoffs: { messageBefore: cutoff(90).toISOString(), imageBefore: cutoff(30).toISOString(),
      ledgerBefore: year.toISOString() },
    retentionBasis: { messageDays: 90, imageDays: 30, ledgerYears: 1, operationalLogDays: 14,
      accessLogCalendarMonths: 6, dailyBackupDays: 30 },
    protectedConversations: protectedConversations.size, unknownForeignKeys: unknownForeignKeys.length,
    productMediaReferenceNamesPreserved: sharedNames.size,
    messages: messageReport, ledger, images,
    webhook: { total: snapshot.webhook.total, reviewCandidates: 0,
      reason: "Requires scope/linkage review and confirmation of timestamp-without-timezone semantics" },
    excludedFromSelection: ["Reels, posts, models and uploads (references only)",
      "Conversation summaries/profiles (separate dependency review)",
      "Logs and backups (inventory and lifecycle not verified)",
      "In-memory capabilities/cache (not observed by this process)"],
    limitations: ["Counts are review candidates, not authorization to delete",
      "Candidate categories overlap and must not be summed; content minimization is separate from deleting rows/files",
      "Database snapshot and filesystem inventory are not atomic; revalidate references and locks before any future mutation",
      "Shared references include soft-deleted records; no media outside the private Inbox directory is selected",
      "Unreferenced images may have been delivered without persistence and are always withheld",
      "No content, IDs, filenames, paths, URLs or tokens included in output"],
  };
}

module.exports = { readSnapshot, inventoryImages, buildReport };
