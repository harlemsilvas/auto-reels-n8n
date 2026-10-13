const path = require("node:path");
const fs = require("node:fs/promises");
const { readSnapshot, inventoryImages, buildReport } = require("../src/modules/privacy/retention-report");

async function main() {
  if (process.argv.slice(2).some(arg => arg !== "--save-local")) throw Error("UNSUPPORTED_ARGUMENT");
  process.chdir(path.resolve(__dirname, ".."));
  process.env.DOTENV_CONFIG_QUIET = "true";
  const env = require("../src/config/env");
  if (!["localhost", "127.0.0.1"].includes(env.DB_HOST) || env.DB_CONNECTION_STRING ||
      process.env.NODE_ENV === "production") throw Error("LOCAL_DATABASE_REQUIRED");
  const root = path.resolve(__dirname, "../..");
  const directory = path.resolve(env.INBOX_MEDIA_DIR);
  if (!directory.startsWith(root + path.sep)) throw Error("LOCAL_INBOX_DIRECTORY_REQUIRED");
  // realpath rejects symlinked storage pointing outside this workspace.
  try {
    if (!(await fs.realpath(directory)).startsWith(root + path.sep)) throw Error("LOCAL_INBOX_DIRECTORY_REQUIRED");
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const { getPool } = require("../src/lib/db");
  const pool = getPool();
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = '15s'");
    const now = (await client.query("SELECT CURRENT_TIMESTAMP AS now")).rows[0].now;
    const snapshot = await readSnapshot(client);
    const inventory = await inventoryImages(directory);
    const report = buildReport(snapshot, inventory, now);
    await client.query("ROLLBACK");
    const output = JSON.stringify(report, null, 2) + "\n";
    if (process.argv.includes("--save-local")) {
      const target = path.join(root, ".dev-run", "retention-reports");
      await fs.mkdir(target, { recursive: true, mode: 0o700 });
      if (!(await fs.realpath(target)).startsWith(root + path.sep)) throw Error("LOCAL_OUTPUT_REQUIRED");
      await fs.writeFile(path.join(target, `report-${now.toISOString().replaceAll(":", "-")}.json`),
        output, { mode: 0o600, flag: "wx" });
    }
    process.stdout.write(output);
  } finally {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
    await pool.end();
  }
}

main().catch(() => { console.error("RETENTION_REPORT_FAILED: no cleanup performed; check local schema/configuration/connectivity."); process.exitCode = 1; });
