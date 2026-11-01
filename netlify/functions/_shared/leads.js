'use strict';

// Abandoned-lead capture: visitors who finish the contact step of the signup
// but never submit the card step. Rows are keyed by the browser's
// submission_id so a completed signup can mark its own lead as converted.

const LEAD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// How long a lead must sit unfinished before the team is told about it, and
// how far back the follow-up job looks.
const FOLLOWUP_DELAY_MINUTES = 30;
const FOLLOWUP_LOOKBACK_DAYS = 7;
const FOLLOWUP_BATCH_LIMIT = 25;

const readyTables = new WeakSet();

async function ensureLeadsTable(sql) {
  if (readyTables.has(sql)) return;
  await sql`
    CREATE TABLE IF NOT EXISTS partner_service_leads (
      id SERIAL PRIMARY KEY,
      lead_id TEXT NOT NULL UNIQUE,
      customer_type TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      company_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      number_of_bins INTEGER,
      trash_pickup_day TEXT NOT NULL DEFAULT '',
      recycling_frequency TEXT NOT NULL DEFAULT '',
      recycling_pickup_day TEXT NOT NULL DEFAULT '',
      property_count INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      followup_notified_at TIMESTAMPTZ,
      followup_message_id TEXT NOT NULL DEFAULT '',
      converted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS partner_service_leads_open_idx
    ON partner_service_leads (status, updated_at)
  `;
  readyTables.add(sql);
}

// Best effort: a lead row must never block or fail a real signup.
async function markLeadConverted(sql, leadId, logger) {
  const log = logger || console;
  if (!LEAD_ID_RE.test(String(leadId || ''))) return false;
  try {
    const exists = await sql`SELECT to_regclass('public.partner_service_leads') AS t`;
    if (!exists[0] || !exists[0].t) return false;
    await sql`
      UPDATE partner_service_leads
      SET status = 'converted', converted_at = NOW(), updated_at = NOW()
      WHERE lead_id = ${String(leadId).toLowerCase()}
        AND status <> 'converted'
    `;
    return true;
  } catch (error) {
    log.error('Lead could not be marked converted.', { error_name: error && error.name || 'Error' });
    return false;
  }
}

module.exports = {
  FOLLOWUP_BATCH_LIMIT,
  FOLLOWUP_DELAY_MINUTES,
  FOLLOWUP_LOOKBACK_DAYS,
  LEAD_ID_RE,
  ensureLeadsTable,
  markLeadConverted
};
