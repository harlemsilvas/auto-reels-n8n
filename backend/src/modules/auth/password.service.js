const {
  randomBytes,
  scrypt: scryptCallback,
  scryptSync,
  timingSafeEqual,
} = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
};
const DUMMY_SALT = Buffer.alloc(16, 7);
const DUMMY_HASH = scryptSync(
  "socialbot-invalid-password",
  DUMMY_SALT,
  KEY_LENGTH,
  SCRYPT_OPTIONS,
);

function validatePassword(password) {
  const value = String(password ?? "");

  if (value.length < 12) {
    const error = new Error("A senha deve ter pelo menos 12 caracteres.");
    error.status = 400;
    throw error;
  }

  if (value.length > 256) {
    const error = new Error("A senha excede o tamanho permitido.");
    error.status = 400;
    throw error;
  }

  return value;
}

async function hashPassword(password) {
  const value = validatePassword(password);
  const salt = randomBytes(16);
  const derived = await scrypt(value, salt, KEY_LENGTH, SCRYPT_OPTIONS);

  return [
    "scrypt",
    SCRYPT_OPTIONS.N,
    SCRYPT_OPTIONS.r,
    SCRYPT_OPTIONS.p,
    salt.toString("base64url"),
    Buffer.from(derived).toString("base64url"),
  ].join("$");
}

async function verifyPassword(password, encodedHash) {
  const value = String(password ?? "");
  const parts = String(encodedHash ?? "").split("$");

  if (parts.length !== 6 || parts[0] !== "scrypt") {
    const derived = await scrypt(
      value,
      DUMMY_SALT,
      KEY_LENGTH,
      SCRYPT_OPTIONS,
    );
    timingSafeEqual(Buffer.from(derived), DUMMY_HASH);
    return false;
  }

  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  const options = {
    N: Number(nRaw),
    r: Number(rRaw),
    p: Number(pRaw),
    maxmem: SCRYPT_OPTIONS.maxmem,
  };
  const salt = Buffer.from(saltRaw, "base64url");
  const expected = Buffer.from(hashRaw, "base64url");

  if (
    !Number.isInteger(options.N) ||
    !Number.isInteger(options.r) ||
    !Number.isInteger(options.p) ||
    salt.length < 16 ||
    expected.length !== KEY_LENGTH
  ) {
    return false;
  }

  const derived = await scrypt(value, salt, expected.length, options);
  return timingSafeEqual(Buffer.from(derived), expected);
}

module.exports = {
  hashPassword,
  validatePassword,
  verifyPassword,
};
