const { getPool, query } = require("../src/lib/db");
const { hashPassword } = require("../src/modules/auth/password.service");

function requiredEnv(name) {
  const value = String(process.env[name] ?? "").trim();

  if (!value) {
    throw new Error(`Variável obrigatória ausente: ${name}`);
  }

  return value;
}

async function main() {
  const username = requiredEnv("ADMIN_BOOTSTRAP_USERNAME").toLowerCase();
  const password = requiredEnv("ADMIN_BOOTSTRAP_PASSWORD");
  const displayName =
    String(process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME ?? "").trim() || username;
  const email = String(process.env.ADMIN_BOOTSTRAP_EMAIL ?? "").trim() || null;
  const passwordHash = await hashPassword(password);

  const result = await query(
    `
      INSERT INTO socialbot_users (
        username,
        email,
        display_name,
        password_hash,
        role,
        active,
        force_password_change
      )
      VALUES ($1, $2, $3, $4, 'admin', TRUE, TRUE)
      ON CONFLICT (LOWER(username)) WHERE deleted_at IS NULL
      DO UPDATE SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        password_hash = EXCLUDED.password_hash,
        role = 'admin',
        active = TRUE,
        force_password_change = TRUE,
        failed_login_attempts = 0,
        locked_until = NULL,
        password_changed_at = NOW()
      RETURNING id::text AS id, username, display_name AS "displayName", role
    `,
    [username, email, displayName, passwordHash],
  );

  console.log("Administrador criado ou atualizado:", result.rows[0]);
}

main()
  .catch((error) => {
    console.error("Falha ao criar administrador:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => null);
  });
