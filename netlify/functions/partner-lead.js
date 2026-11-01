'use strict';

// Saves an in-progress signup once the visitor finishes the contact step, so
// the team can follow up if the card step is never submitted. No card data is
// ever sent here. The browser fires this in the background and ignores the
// result; a failure here never blocks the signup.

const { neon } = require('@neondatabase/serverless');
const { LEAD_ID_RE, ensureLeadsTable } = require('./_shared/leads');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CUSTOMER_TYPES = ['Residential Homeowner/Renter', 'Business', 'Property Management Company'];
const RECYCLING = ['No Recycling', 'Weekly Recycling', 'Bi-Weekly Recycling'];

function s(value, max) {
  const text = value == null ? '' : String(value).trim();
  return text.slice(0, max || 200);
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

function oneOf(value, allowed) {
  const text = s(value);
  return allowed.includes(text) ? text : '';
}

// Returns a cleaned lead, or a string describing the first problem.
function normalize(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Invalid request body.';
  const leadId = s(body.lead_id).toLowerCase();
  if (!LEAD_ID_RE.test(leadId)) return 'Invalid lead identifier.';

  const name = s(body.name);
  const phone = s(body.phone, 40);
  const email = s(body.email, 254).toLowerCase();
  if (!name) return 'Name is required.';
  if ((phone.match(/\d/g) || []).length < 7) return 'A valid phone number is required.';
  if (!EMAIL_RE.test(email)) return 'Invalid email address.';

  const bins = Number(body.number_of_bins);
  const count = Number(body.property_count);

  return {
    lead_id: leadId,
    customer_type: oneOf(body.customer_type, CUSTOMER_TYPES),
    name,
    company_name: s(body.company_name),
    phone,
    email,
    address: s(body.address, 300),
    number_of_bins: Number.isInteger(bins) && bins >= 1 && bins <= 30 ? bins : null,
    trash_pickup_day: oneOf(body.trash_pickup_day, DAYS),
    recycling_frequency: oneOf(body.recycling_frequency, RECYCLING),
    recycling_pickup_day: oneOf(body.recycling_pickup_day, DAYS),
    property_count: Number.isInteger(count) && count >= 1 && count <= 20 ? count : 1,
    source: s(body.source, 80) || 'yourtrashdayteam-home'
  };
}

// Insert, or refresh the same lead if the visitor goes back and edits. Leads
// that were already followed up or converted are left as they are.
async function saveLead(sql, lead) {
  await ensureLeadsTable(sql);
  await sql`
    INSERT INTO partner_service_leads (
      lead_id, customer_type, name, company_name, phone, email,
      address, number_of_bins, trash_pickup_day, recycling_frequency,
      recycling_pickup_day, property_count, source
    ) VALUES (
      ${lead.lead_id}, ${lead.customer_type}, ${lead.name}, ${lead.company_name}, ${lead.phone}, ${lead.email},
      ${lead.address}, ${lead.number_of_bins}, ${lead.trash_pickup_day}, ${lead.recycling_frequency},
      ${lead.recycling_pickup_day}, ${lead.property_count}, ${lead.source}
    )
    ON CONFLICT (lead_id) DO UPDATE SET
      customer_type = EXCLUDED.customer_type,
      name = EXCLUDED.name,
      company_name = EXCLUDED.company_name,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      address = EXCLUDED.address,
      number_of_bins = EXCLUDED.number_of_bins,
      trash_pickup_day = EXCLUDED.trash_pickup_day,
      recycling_frequency = EXCLUDED.recycling_frequency,
      recycling_pickup_day = EXCLUDED.recycling_pickup_day,
      property_count = EXCLUDED.property_count,
      source = EXCLUDED.source,
      updated_at = NOW()
    WHERE partner_service_leads.status = 'open'
  `;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return respond(405, { error: 'Method Not Allowed' });

  const headers = event.headers || {};
  const contentType = s(headers['content-type'] || headers['Content-Type']).toLowerCase();
  if (!contentType.includes('application/json')) {
    return respond(415, { error: 'Content-Type must be application/json.' });
  }
  if ((event.body || '').length > 8192) return respond(413, { error: 'Request too large.' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return respond(400, { error: 'Invalid request body.' });
  }

  const lead = normalize(body);
  if (typeof lead === 'string') return respond(400, { error: lead });

  if (!process.env.DATABASE_URL) {
    return respond(500, { error: 'DATABASE_URL is not configured.' });
  }

  try {
    await saveLead(neon(process.env.DATABASE_URL), lead);
  } catch (err) {
    console.error('Lead save failed.', { error_name: err && err.name || 'Error' });
    return respond(500, { error: 'Lead could not be saved.' });
  }
  return respond(200, { success: true });
};

exports._test = { normalize, saveLead };
