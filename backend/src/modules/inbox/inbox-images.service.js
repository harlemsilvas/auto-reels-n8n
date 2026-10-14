const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID, randomBytes } = require("node:crypto");
const sharp = require("sharp");
const { query } = require("../../lib/db");
const { INBOX_MEDIA_DIR, INBOX_PUBLIC_BASE_URL } = require("../../config/env");
const instagram = require("../instagram/instagram-send.service");

const MAX_IMAGE_BYTES = 8_000_000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const capabilities = new Map();

function failure(status, message) {
  return Object.assign(new Error(message), { status });
}

async function normalizeImage(file) {
  if (!file?.buffer?.length) throw failure(400, "Selecione uma imagem JPG ou PNG.");
  if (file.buffer.length > MAX_IMAGE_BYTES) throw failure(413, "A imagem deve ter ate 8 MB.");
  if (!["image/jpeg", "image/png"].includes(file.mimetype)) throw failure(400, "Use apenas JPG ou PNG.");
  try {
    const image = sharp(file.buffer, { limitInputPixels: 20_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (!["jpeg", "png"].includes(metadata.format) || (metadata.pages ?? 1) > 1 ||
        file.mimetype !== (metadata.format === "jpeg" ? "image/jpeg" : "image/png")) {
      throw Error("Formato invalido");
    }
    // Decode/re-encode untrusted pixels and strip metadata; never serve the original upload.
    const buffer = await image.rotate().toFormat(metadata.format).toBuffer();
    if (buffer.length > MAX_IMAGE_BYTES) throw failure(413, "A imagem processada excede 8 MB.");
    return { buffer, mimeType: file.mimetype, extension: metadata.format === "jpeg" ? ".jpg" : ".png" };
  } catch (error) {
    if (error.status) throw error;
    throw failure(400, "Imagem invalida, corrompida ou com dimensoes excessivas.");
  }
}

function deliveryBase() {
  let url;
  try { url = new URL(INBOX_PUBLIC_BASE_URL); } catch { throw failure(503, "URL publica do Inbox nao configurada."); }
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && local && process.env.NODE_ENV !== "production"))) {
    throw failure(503, "Configure uma URL HTTPS publica para o Inbox.");
  }
  return url.href.replace(/\/$/, "");
}

function grantDelivery(filename, scope) {
  const token = randomBytes(32).toString("hex");
  const entry = { filename, ...scope, expiresAt: Date.now() + 15 * 60 * 1000 };
  capabilities.set(token, entry);
  setTimeout(() => capabilities.delete(token), 15 * 60 * 1000).unref();
  return token;
}

function resolveDelivery(token) {
  const entry = /^[a-f0-9]{64}$/.test(token) ? capabilities.get(token) : undefined;
  if (!entry || entry.expiresAt <= Date.now()) throw failure(404, "Imagem indisponivel.");
  return imagePath(entry.filename);
}

function imagePath(filename) {
  if (typeof filename !== "string" || !/^[a-f0-9-]{36}\.(jpg|png)$/.test(filename) || !uuid.test(filename.slice(0, 36))) {
    throw failure(404, "Imagem indisponivel.");
  }
  return path.resolve(INBOX_MEDIA_DIR, filename);
}

async function sendConversationImage(conversationId, file) {
  if (!uuid.test(conversationId)) throw failure(400, "Conversa invalida.");
  const conversation = await query(`SELECT account_id AS "accountId", instagram_user_id AS "recipientId"
    FROM instagram_conversations WHERE id = $1::uuid AND deleted_at IS NULL`, [conversationId]);
  if (!conversation.rowCount) throw failure(404, "Conversa nao encontrada.");
  const base = deliveryBase();
  const image = await normalizeImage(file);
  const filename = randomUUID() + image.extension;
  return require("../privacy/scope-gate").outbound({accountId:conversation.rows[0].accountId,
    instagramUserId:conversation.rows[0].recipientId},"image",async()=>{
  await fs.mkdir(INBOX_MEDIA_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(imagePath(filename), image.buffer, { flag: "wx", mode: 0o600 });
  const token = grantDelivery(filename, { accountId: conversation.rows[0].accountId,
    instagramUserId: conversation.rows[0].recipientId });
  try {
    return await instagram.sendImageMessage({ ...conversation.rows[0], conversationId,
      imageUrl: `${base}/api/inbox/media/${token}`,
      imageMetadata: { filename, mimeType: image.mimeType },
    });
  } catch (error) {
    if (!error.deliveryMayHaveSucceeded) {
      capabilities.delete(token);
      await fs.unlink(imagePath(filename)).catch(() => {});
    }
    throw error;
  }
  },filename);
}

async function resolveConversationImage(conversationId, messageId) {
  if (!uuid.test(conversationId) || !uuid.test(messageId)) throw failure(400, "Identificador invalido.");
  const result = await query(`SELECT COALESCE(to_jsonb(m)->'payload', to_jsonb(m)->'raw_payload') AS payload
    FROM instagram_messages m JOIN instagram_conversations c ON c.id = m.conversation_id
    WHERE m.id = $1::uuid AND c.id = $2::uuid AND c.deleted_at IS NULL`, [messageId, conversationId]);
  return imagePath(result.rows[0]?.payload?.inboxImage?.filename);
}

function revokeScope({ accountId, instagramUserId }) {
  let removed = 0, legacyUnscoped = 0;
  for (const [token, entry] of capabilities) {
    if (!entry.accountId || !entry.instagramUserId) { legacyUnscoped++; continue; }
    if (entry.accountId === accountId && entry.instagramUserId === instagramUserId) {
      capabilities.delete(token); removed++;
    }
  }
  return { removed, legacyUnscoped };
}

async function guardedSend(conversationId,file) {
  if(!uuid.test(conversationId))throw failure(400,"Conversa invalida.");
  const row=(await query("SELECT account_id,instagram_user_id FROM instagram_conversations WHERE id=$1 AND deleted_at IS NULL",[conversationId])).rows[0];
  if(!row)throw failure(404,"Conversa nao encontrada.");
  return require("../privacy/scope-gate").withScope({accountId:row.account_id,instagramUserId:row.instagram_user_id},
    ()=>sendConversationImage(conversationId,file));
}
async function withDelivery(token,callback) {
  const entry=capabilities.get(token);
  resolveDelivery(token);
  if(!entry?.accountId||!entry.instagramUserId)throw failure(404,"Imagem indisponivel.");
  try {return await require("../privacy/scope-gate").withScope(entry,callback);}
  catch(error){if(error.code==='PRIVACY_SCOPE_BLOCKED')revokeScope(entry);throw error;}
}
async function withConversation(conversationId,callback) {
  if(!uuid.test(conversationId))throw failure(400,"Conversa invalida.");
  const row=(await query("SELECT account_id,instagram_user_id FROM instagram_conversations WHERE id=$1 AND deleted_at IS NULL",[conversationId])).rows[0];
  if(!row)throw failure(404,"Conversa nao encontrada.");
  return require("../privacy/scope-gate").withScope({accountId:row.account_id,instagramUserId:row.instagram_user_id},callback);
}
function cachedScopes() {
  return [...capabilities.values()].filter(entry=>entry.accountId&&entry.instagramUserId)
    .map(({accountId,instagramUserId})=>({accountId,instagramUserId}));
}
module.exports = { MAX_IMAGE_BYTES, normalizeImage, resolveDelivery, resolveConversationImage,
  sendConversationImage:guardedSend, revokeScope, withDelivery, withConversation, cachedScopes };
