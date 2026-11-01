'use strict';

// Scheduled (see netlify.toml): emails the team one digest of people who
// finished the contact step but have not submitted the signup after
// FOLLOWUP_DELAY_MINUTES. Each lead is included in at most one digest, and a
// completed signup (same submission_id, or same email afterwards) removes it.

const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');
const {
  NotificationError,
  extractEmail,
  notificationConfig,
  sendSignupNotification
} = require('./_shared/signup-notification');
const {
  FOLLOWUP_BATCH_LIMIT,
  FOLLOWUP_DELAY_MINUTES,
  FOLLOWUP_LOOKBACK_DAYS,
  ensureLeadsTable
} = require('./_shared/leads');

function s(value) {
  return value == null ? '' : String(value).trim();
}

function escapeHtml(value) {
  return s(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const startedFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
});

function row(label, valueHtml) {
  return '<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;color:#475569;font-weight:700;white-space:nowrap;">'
    + escapeHtml(label) + '</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;color:#0f172a;">'
    + valueHtml + '</td></tr>';
}

function leadTable(lead) {
  const phoneDigits = s(lead.phone).replace(/[^\d+]/g, '');
  const recycling = s(lead.recycling_frequency) && lead.recycling_frequency !== 'No Recycling'
    ? lead.recycling_frequency + (lead.recycling_pickup_day ? ' (' + lead.recycling_pickup_day + ')' : '')
    : s(lead.recycling_frequency);
  const rows = [
    row('Phone', '<a href="tel:' + escapeHtml(phoneDigits) + '">' + escapeHtml(lead.phone) + '</a>'),
    row('Email', '<a href="mailto:' + escapeHtml(lead.email) + '">' + escapeHtml(lead.email) + '</a>'),
    row('Customer Type', escapeHtml(lead.customer_type)),
    row('Company or Property', escapeHtml(lead.company_name)),
    row('Address', escapeHtml(lead.address)),
    row('Bins', escapeHtml(lead.number_of_bins == null ? '' : String(lead.number_of_bins))),
    row('Trash Day', escapeHtml(lead.trash_pickup_day)),
    row('Recycling', escapeHtml(recycling)),
    row('Properties', escapeHtml(String(lead.property_count || 1))),
    row('Started', escapeHtml(startedFmt.format(new Date(lead.created_at)) + ' ET'))
  ].join('');
  return '<h3 style="margin:20px 0 8px;color:#0e1f3d;">' + escapeHtml(lead.name) + '</h3>'
    + '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:680px;border:1px solid #e5e7eb;">'
    + rows + '</table>';
}

function digestHtml(leads) {
  const intro = leads.length === 1
    ? 'This person entered their contact details and reached the card step, but has not submitted the signup.'
    : 'These people entered their contact details and reached the card step, but have not submitted the signup.';
  return '<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#0f172a;">'
    + '<h2 style="margin:0 0 12px;color:#0e1f3d;">Unfinished Your Trash Day Team signup' + (leads.length === 1 ? '' : 's') + '</h2>'
    + '<p style="margin:0 0 6px;color:#475569;">' + intro + '</p>'
    + '<p style="margin:0 0 6px;color:#475569;">No card was stored and nothing was charged.</p>'
    + leads.map(leadTable).join('')
    + '</div>';
}

function digestSubject(leads) {
  return leads.length === 1
    ? 'Unfinished signup: ' + s(leads[0].name)
    : leads.length + ' unfinished signups to follow up';
}

async function signupsTableExists(sql) {
  const rows = await sql`SELECT to_regclass('public.partner_service_signups') AS t`;
  return !!(rows[0] && rows[0].t);
}

// Close out leads that turned into real signups (including ones finished on
// another device or a later visit with the same email).
async function closeConvertedLeads(sql) {
  await sql`
    UPDATE partner_service_leads l
    SET status = 'converted', converted_at = NOW(), updated_at = NOW()
    WHERE l.status = 'open'
      AND EXISTS (
        SELECT 1 FROM partner_service_signups su
        WHERE su.submission_id = l.lead_id
           OR (LOWER(su.email) = l.email AND su.created_at >= l.created_at)
      )
  `;
}

async function dueLeads(sql) {
  return sql`
    SELECT *
    FROM partner_service_leads
    WHERE status = 'open'
      AND followup_notified_at IS NULL
      AND updated_at <= NOW() - make_interval(mins => ${FOLLOWUP_DELAY_MINUTES})
      AND created_at >= NOW() - make_interval(days => ${FOLLOWUP_LOOKBACK_DAYS})
    ORDER BY created_at ASC
    LIMIT ${FOLLOWUP_BATCH_LIMIT}
  `;
}

async function runFollowup(options) {
  const sql = options.sql;
  const logger = options.logger || console;

  await ensureLeadsTable(sql);
  if (await signupsTableExists(sql)) await closeConvertedLeads(sql);

  const leads = await dueLeads(sql);
  if (!leads.length) return { sent: 0 };

  const ids = leads.map((lead) => lead.lead_id).sort();
  const digestKey = crypto.createHash('sha256').update(ids.join(',')).digest('hex');
  const replyTo = leads.length === 1 ? leads[0].email : extractEmail(options.config.from);

  const delivery = await sendSignupNotification({
    config: options.config,
    fetchImpl: options.fetchImpl,
    logger,
    replyTo,
    idempotencyKey: 'ytt-lead-digest/' + digestKey,
    subject: digestSubject(leads),
    html: digestHtml(leads)
  });

  for (const id of ids) {
    await sql`
      UPDATE partner_service_leads
      SET status = 'notified',
          followup_notified_at = NOW(),
          followup_message_id = ${delivery.messageId},
          updated_at = NOW()
      WHERE lead_id = ${id}
    `;
  }
  return { sent: leads.length, messageId: delivery.messageId };
}

exports.handler = async function () {
  if (!process.env.DATABASE_URL) {
    console.error('Lead follow-up skipped: DATABASE_URL is not configured.');
    return { statusCode: 500 };
  }
  let config;
  try {
    config = notificationConfig(process.env);
  } catch (error) {
    console.error('Lead follow-up skipped: email is not configured.', {
      code: error instanceof NotificationError ? error.code : 'notification_configuration_error'
    });
    return { statusCode: 500 };
  }

  try {
    const result = await runFollowup({ sql: neon(process.env.DATABASE_URL), config });
    console.info('Lead follow-up finished.', { leads_sent: result.sent });
    return { statusCode: 200 };
  } catch (error) {
    console.error('Lead follow-up failed.', {
      code: error instanceof NotificationError ? error.code : (error && error.name) || 'Error'
    });
    return { statusCode: 500 };
  }
};

exports._test = { digestHtml, digestSubject, runFollowup };
