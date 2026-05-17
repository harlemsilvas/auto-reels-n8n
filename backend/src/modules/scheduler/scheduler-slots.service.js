const { query } = require("../../lib/db");

let ensured = false;

async function ensureSlotsTable() {
  if (ensured) {
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS schedule_time_slots (
      id BIGSERIAL PRIMARY KEY,
      label TEXT NOT NULL,
      time_value TIME NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (time_value)
    )
  `);

  await query(`
    INSERT INTO schedule_time_slots (label, time_value, enabled, sort_order)
    VALUES
      ('08:00', '08:00', true, 10),
      ('10:30', '10:30', true, 20),
      ('12:00', '12:00', true, 30),
      ('14:30', '14:30', true, 40),
      ('17:00', '17:00', true, 50),
      ('19:30', '19:30', true, 60),
      ('21:00', '21:00', true, 70)
    ON CONFLICT (time_value) DO NOTHING
  `);

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_schedule_time_slots_updated_at'
      ) THEN
        CREATE TRIGGER trg_schedule_time_slots_updated_at
        BEFORE UPDATE ON schedule_time_slots
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
      END IF;
    END $$;
  `).catch(() => null);

  ensured = true;
}

function normalizeText(value) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

async function listSlots(filters = {}) {
  await ensureSlotsTable();

  const values = [];
  const where = ["1 = 1"];
  let param = 1;

  if (filters.onlyEnabled) {
    where.push("enabled = true");
  }

  const result = await query(
    `
      SELECT
        id,
        label,
        to_char(time_value, 'HH24:MI') AS "timeValue",
        enabled,
        sort_order AS "sortOrder",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM schedule_time_slots
      WHERE ${where.join(" AND ")}
      ORDER BY sort_order ASC, time_value ASC
    `,
    values,
  );

  return {
    items: result.rows,
    total: result.rows.length,
  };
}

async function createSlot(input = {}) {
  await ensureSlotsTable();

  const timeValue = normalizeText(input.timeValue);
  const label = normalizeText(input.label) || timeValue;
  const enabled =
    typeof input.enabled === "boolean"
      ? input.enabled
      : String(input.enabled ?? "true").toLowerCase() === "true";
  const sortOrder = Number.isFinite(Number(input.sortOrder))
    ? Math.trunc(Number(input.sortOrder))
    : 0;

  if (!timeValue) {
    const error = new Error("timeValue e obrigatorio.");
    error.status = 400;
    throw error;
  }

  const result = await query(
    `
      INSERT INTO schedule_time_slots (label, time_value, enabled, sort_order)
      VALUES ($1, $2::time, $3, $4)
      ON CONFLICT (time_value)
      DO UPDATE SET
        label = EXCLUDED.label,
        enabled = EXCLUDED.enabled,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
      RETURNING
        id,
        label,
        to_char(time_value, 'HH24:MI') AS "timeValue",
        enabled,
        sort_order AS "sortOrder",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
    [label, timeValue, enabled, sortOrder],
  );

  return result.rows[0];
}

async function updateSlot(id, input = {}) {
  await ensureSlotsTable();

  const fields = ["updated_at = NOW()"];
  const values = [id];
  let idx = 2;

  if (Object.prototype.hasOwnProperty.call(input, "label")) {
    fields.push(`label = $${idx++}`);
    values.push(normalizeText(input.label) || "Horario");
  }

  if (Object.prototype.hasOwnProperty.call(input, "enabled")) {
    const enabled =
      typeof input.enabled === "boolean"
        ? input.enabled
        : String(input.enabled ?? "false").toLowerCase() === "true";
    fields.push(`enabled = $${idx++}`);
    values.push(enabled);
  }

  if (Object.prototype.hasOwnProperty.call(input, "sortOrder")) {
    const sortOrder = Number.isFinite(Number(input.sortOrder))
      ? Math.trunc(Number(input.sortOrder))
      : 0;
    fields.push(`sort_order = $${idx++}`);
    values.push(sortOrder);
  }

  if (Object.prototype.hasOwnProperty.call(input, "timeValue")) {
    const timeValue = normalizeText(input.timeValue);
    if (!timeValue) {
      const error = new Error("timeValue invalido.");
      error.status = 400;
      throw error;
    }

    fields.push(`time_value = $${idx++}::time`);
    values.push(timeValue);
  }

  const result = await query(
    `
      UPDATE schedule_time_slots
      SET ${fields.join(", ")}
      WHERE id = $1
      RETURNING
        id,
        label,
        to_char(time_value, 'HH24:MI') AS "timeValue",
        enabled,
        sort_order AS "sortOrder",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
    values,
  );

  if (result.rowCount === 0) {
    const error = new Error("Horario nao encontrado.");
    error.status = 404;
    throw error;
  }

  return result.rows[0];
}

async function deleteSlot(id) {
  await ensureSlotsTable();

  const result = await query(
    `
      DELETE FROM schedule_time_slots
      WHERE id = $1
      RETURNING id
    `,
    [id],
  );

  if (result.rowCount === 0) {
    const error = new Error("Horario nao encontrado.");
    error.status = 404;
    throw error;
  }

  return { success: true };
}

module.exports = {
  listSlots,
  createSlot,
  updateSlot,
  deleteSlot,
};
