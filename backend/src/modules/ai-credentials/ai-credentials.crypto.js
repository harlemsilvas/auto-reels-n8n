const crypto = require("node:crypto");
const { AI_CREDENTIALS_ENCRYPTION_KEY } = require("../../config/env");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKeyBuffer() {
  const rawKey = String(AI_CREDENTIALS_ENCRYPTION_KEY ?? "").trim();

  if (!rawKey) {
    const error = new Error(
      "AI_CREDENTIALS_ENCRYPTION_KEY não configurada. Gere uma chave segura antes de salvar credenciais de IA.",
    );
    error.status = 500;
    throw error;
  }

  const candidates = [];
  try {
    candidates.push(Buffer.from(rawKey, "base64"));
  } catch {
    // Ignora formatos inválidos.
  }

  if (/^[a-f0-9]{64}$/i.test(rawKey)) {
    candidates.push(Buffer.from(rawKey, "hex"));
  }

  candidates.push(Buffer.from(rawKey, "utf8"));

  const key = candidates.find((item) => item.length === 32);

  if (!key) {
    const error = new Error(
      "AI_CREDENTIALS_ENCRYPTION_KEY inválida. Use 32 bytes em base64 ou hexadecimal.",
    );
    error.status = 500;
    throw error;
  }

  return key;
}

function encryptSecret(secret) {
  const value = String(secret ?? "");

  if (!value.trim()) {
    const error = new Error("Informe a chave de API.");
    error.status = 400;
    throw error;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKeyBuffer(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

function decryptSecret(encryptedValue) {
  const [version, ivBase64, tagBase64, encryptedBase64] = String(
    encryptedValue ?? "",
  ).split(":");

  if (version !== "v1" || !ivBase64 || !tagBase64 || !encryptedBase64) {
    const error = new Error("Credencial de IA criptografada em formato inválido.");
    error.status = 500;
    throw error;
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKeyBuffer(),
    Buffer.from(ivBase64, "base64"),
    { authTagLength: AUTH_TAG_LENGTH },
  );
  decipher.setAuthTag(Buffer.from(tagBase64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function buildSecretHint(secret) {
  const normalized = String(secret ?? "").trim();
  if (!normalized) return null;

  const suffix = normalized.slice(-4);
  return `${"•".repeat(Math.min(8, Math.max(4, normalized.length - 4)))}${suffix}`;
}

module.exports = {
  decryptSecret,
  encryptSecret,
  buildSecretHint,
};
