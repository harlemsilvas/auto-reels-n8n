const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { buildReport, inventoryImages } = require("../src/modules/privacy/retention-report");

const now = new Date("2026-10-13T20:00:00Z");
const old = new Date("2025-01-01T00:00:00Z");
const name = "12345678-1234-1234-1234-123456789abc.jpg";
function fixture() {
  return { messages: [{ id: "m", conversation_id: "c", created_at: old,
    filename: name, meta_message_id: "meta-demo", has_attachments: true }],
    attempts: [], shared: [], conversations: [{ id: "c" }], webhook: { total: 3 },
    foreignKeys: [{ source: "instagram_send_attempts", target: "instagram_messages",
      definition: "FOREIGN KEY (message_id) REFERENCES instagram_messages(id) ON DELETE SET NULL" }] };
}
function inventory() { return { exists: true, files: [{ filename: name, mtime: old, bytes: 123 }] }; }
function attempt(state) { return { id: "a", conversation_id: "c", state,
  updated_at: old, created_at: old, message_id: "m", meta_message_id: "meta-demo" }; }

test("Old unlinked content is a review candidate; output contains only aggregate metadata", () => {
  const report = buildReport(fixture(), inventory(), now);
  assert.equal(report.messages.rowReviewCandidates, 1);
  assert.equal(report.images.reviewCandidates, 1);
  assert.equal(report.images.candidateBytes, 123);
  assert.equal(report.webhook.reviewCandidates, 0);
  assert.equal(report.actionableDeletionList, false);
  assert.doesNotMatch(JSON.stringify(report), /meta-demo|12345678|"conversation_id"|"filename"|"c"/);
});

for (const state of ["sending", "uncertain", "unknown"]) {
  test(`${state} holds the whole conversation, ledger and image regardless of age`, () => {
    const data = fixture(); data.attempts.push(attempt(state));
    const report = buildReport(data, inventory(), now);
    assert.equal(report.messages.contentReviewCandidates, 0);
    assert.equal(report.messages.protectedExpiredContent, 1);
    assert.equal(report.ledger.protected, 1);
    assert.equal(report.ledger.rowReviewCandidates, 0);
    assert.equal(report.images.reviewCandidates, 0);
  });
}

test("Confirmed ledger preserves linked row/image while allowing content minimization review", () => {
  const data = fixture(); data.attempts.push(attempt("sent"));
  const report = buildReport(data, inventory(), now);
  assert.equal(report.messages.contentReviewCandidates, 1);
  assert.equal(report.messages.rowReviewCandidates, 0);
  assert.equal(report.messages.ledgerLinkedRowsPreserved, 1);
  assert.equal(report.images.reviewCandidates, 0);
  assert.equal(report.ledger.contentMinimizationReviewCandidates, 1);
  assert.equal(report.ledger.rowReviewCandidates, 1);
});

test("Unreconciled sent, contradictory dismissed/rejected or cross-conversation receipts are protected", () => {
  for (const change of [{ message_id: null }, { meta_message_id: null },
    { meta_message_id: "different" }, { state: "dismissed" }, { state: "rejected" },
    { conversation_id: "other" }]) {
    const data = fixture(); data.attempts.push({ ...attempt("sent"), ...change });
    const report = buildReport(data, inventory(), now);
    assert.equal(report.ledger.protected, 1);
    assert.equal(report.images.reviewCandidates, 0);
  }
});

test("Missing conversations and additional foreign keys withhold candidates", () => {
  for (const extraFK of [false, true]) {
    const data = fixture();
    if (extraFK) data.foreignKeys.push({ source: "other_table", target: "instagram_messages" });
    else data.conversations = [];
    const report = buildReport(data, inventory(), now);
    assert.equal(report.messages.rowReviewCandidates, 0);
    assert.equal(report.images.reviewCandidates, 0);
  }
});

test("Posts, models, uploads and multiple messages preserve a shared image, including deleted references", () => {
  for (const ref of [name, `/media/pending/${name}`, `C:\\media\\${name}`]) {
    const data = fixture(); data.shared.push({ filename: ref });
    const report = buildReport(data, inventory(), now);
    assert.equal(report.images.preservedShared, 1);
    assert.equal(report.images.reviewCandidates, 0);
  }
  const data = fixture(); data.messages.push({ ...data.messages[0], id: "other-message" });
  assert.equal(buildReport(data, inventory(), now).images.preservedShared, 1);
});

test("Unreferenced, fresh, unsafe and path-shaped image metadata are withheld", () => {
  const data = fixture(); data.messages = [];
  assert.equal(buildReport(data, inventory(), now).images.unreferencedManualReview, 1);
  for (const date of [now, null, "invalid", new Date(now.getTime() - 30 * 86400000)]) {
    const fresh = fixture(); fresh.messages[0].created_at = date;
    assert.equal(buildReport(fresh, inventory(), now).images.reviewCandidates, 0);
  }
  const freshFile = inventory(); freshFile.files[0].mtime = now;
  assert.equal(buildReport(fixture(), freshFile, now).images.reviewCandidates, 0);
  const unsafe = fixture(); unsafe.messages[0].filename = `../${name}`;
  assert.equal(buildReport(unsafe, inventory(), now).images.reviewCandidates, 0);
});

test("Ledger age starts at last update; null dates do not become deletion candidates", () => {
  for (const date of [now, null, "invalid"]) {
    const data = fixture(); data.attempts.push({ ...attempt("sent"), updated_at: date });
    const report = buildReport(data, inventory(), now);
    assert.equal(report.ledger.rowReviewCandidates, 0);
    assert.equal(report.ledger.contentMinimizationReviewCandidates, 0);
  }
});

test("Filesystem inventory never follows symlinks or traverses subdirectories", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "retention-report-"));
  try {
    await fs.writeFile(path.join(directory, name), "demo");
    await fs.symlink(path.join(directory, name), path.join(directory, "87654321-1234-1234-1234-123456789abc.jpg"));
    await fs.mkdir(path.join(directory, "nested"));
    const result = await inventoryImages(directory);
    assert.equal(result.files.length, 3);
    assert.equal(result.files.filter(file => file.unsafe).length, 2);
    assert.equal(result.files.find(file => !file.unsafe).bytes, 4);
    assert.deepEqual(await inventoryImages(path.join(directory, "missing")), { exists: false, files: [] });
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
