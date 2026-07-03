const { createHash, randomBytes } = require("node:crypto");
const { getPool, query } = require("../src/lib/db");
const { ADMIN_AUTH_COOKIE_NAME } = require("../src/config/env");

const apiBaseUrl =
  process.env.PERMISSIONS_TEST_API_URL || "http://127.0.0.1:3101";

function hashToken(value) {
  return createHash("sha256").update(value).digest();
}

async function request(path, options, token, csrfToken) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Cookie: `${ADMIN_AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(options?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);

  return { status: response.status, body };
}

function assertStatus(result, expectedStatus, label) {
  if (result.status !== expectedStatus) {
    throw new Error(
      `${label}: esperado HTTP ${expectedStatus}, recebido ${result.status}.`,
    );
  }

  if (
    expectedStatus === 403 &&
    result.body?.code !== "PERMISSION_DENIED"
  ) {
    throw new Error(`${label}: bloqueio não foi causado por permissão.`);
  }
}

async function main() {
  const userResult = await query(
    `
      SELECT id::text AS id, username
      FROM socialbot_users
      WHERE role = 'operator'
        AND active = TRUE
        AND deleted_at IS NULL
      ORDER BY created_at
      LIMIT 1
    `,
  );
  const operator = userResult.rows[0];

  if (!operator) {
    throw new Error("Nenhum operador ativo encontrado para o teste.");
  }

  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");
  let sessionId = null;

  try {
    const sessionResult = await query(
      `
        INSERT INTO socialbot_sessions (
          user_id,
          token_hash,
          csrf_token_hash,
          expires_at,
          user_agent
        )
        VALUES (
          $1::uuid,
          $2,
          $3,
          NOW() + INTERVAL '15 minutes',
          'operator-permissions-test'
        )
        RETURNING id::text AS id
      `,
      [operator.id, hashToken(token), hashToken(csrfToken)],
    );
    sessionId = sessionResult.rows[0].id;

    const checks = [
      [
        "posts.view",
        await request("/api/internal/posts?limit=1", {}, token),
        200,
      ],
      [
        "metrics.view",
        await request("/api/internal/metrics/overview", {}, token),
        403,
      ],
      [
        "post.events",
        await request("/api/internal/posts/events?limit=1", {}, token),
        403,
      ],
      [
        "inbox.reply.health",
        await request("/api/inbox/send-message/health", {}, token),
        403,
      ],
      [
        "inbox.reply",
        await request(
          "/api/internal/messages/send",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
          token,
          csrfToken,
        ),
        403,
      ],
      [
        "inbox.manage_testers",
        await request("/api/internal/testers-dm/conversations", {}, token),
        403,
      ],
      [
        "schedule_slots.manage",
        await request("/api/internal/scheduler/slots", {}, token),
        403,
      ],
      [
        "accounts.manage",
        await request("/api/internal/accounts", {}, token),
        403,
      ],
      [
        "users.manage",
        await request("/api/internal/users", {}, token),
        403,
      ],
    ];

    for (const [label, result, expectedStatus] of checks) {
      assertStatus(result, expectedStatus, label);
    }

    console.log("Permissões do operador validadas:", {
      username: operator.username,
      checks: checks.map(([label, result]) => ({
        permission: label,
        status: result.status,
      })),
    });
  } finally {
    if (sessionId) {
      await query("DELETE FROM socialbot_sessions WHERE id = $1::uuid", [
        sessionId,
      ]);
    }
  }
}

main()
  .catch((error) => {
    console.error("Falha no teste de permissões:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => null);
  });
