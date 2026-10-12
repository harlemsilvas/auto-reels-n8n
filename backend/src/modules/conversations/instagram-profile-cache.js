const { createHash } = require("node:crypto");
const { getUserProfile } = require("../instagram/instagram-api.client");

const entries = new Map();
const MAX_ENTRIES = 500;
const SUCCESS_TTL = 60 * 60 * 1000;
const FAILURE_TTL = 5 * 60 * 1000;
let active = 0;
let windowStart = 0;
let callsInWindow = 0;

function field(value, maxLength) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}

async function lookupProfile({ accountId, instagramUserId, accessToken }) {
  if (!accountId || !/^\d+$/.test(instagramUserId ?? "") || !accessToken) return null;
  const credential = createHash("sha256").update(accessToken).digest("hex");
  const key = JSON.stringify([accountId, instagramUserId, credential]);
  const previous = entries.get(key);
  if (previous?.pending) return previous.pending;
  const now = Date.now();
  if (previous && now < previous.expiresAt) return previous.profile;
  if (now - windowStart >= 60000) { windowStart = now; callsInWindow = 0; }
  // Bound simultaneous calls and starts per minute across all Inbox requests.
  if (active >= 5 || callsInWindow >= 10) return previous?.profile ?? null;
  if (!previous && entries.size >= MAX_ENTRIES) {
    const removable = [...entries].find(([, entry]) => !entry.pending);
    if (!removable) return null;
    entries.delete(removable[0]);
  }
  active++;
  callsInWindow++;
  const entry = { profile: previous?.profile ?? null, expiresAt: 0, pending: null };
  entries.set(key, entry);
  entry.pending = Promise.resolve().then(async () => {
    try {
      const result = await getUserProfile({ accessToken, instagramUserId });
      const profile = { name: field(result?.name, 150), username: field(result?.username, 100) };
      if (profile.name || profile.username) {
        entry.profile = profile;
        entry.expiresAt = Date.now() + SUCCESS_TTL;
      } else {
        entry.expiresAt = Date.now() + FAILURE_TTL;
      }
    } catch {
      // Never retain provider errors/tokens; keep last known profile on transient failure.
      entry.expiresAt = Date.now() + FAILURE_TTL;
    } finally {
      active--;
      entry.pending = null;
    }
    return entry.profile;
  });
  return entry.pending;
}

module.exports = { lookupProfile };
