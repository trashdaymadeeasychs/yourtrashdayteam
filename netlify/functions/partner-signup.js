'use strict';

const { neon } = require('@neondatabase/serverless');

let stripeClient;
let tableReady = false;

function stripe() {
  if (!stripeClient) {
    stripeClient = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

function s(value) {
  return value == null ? '' : String(value).trim();
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(body)
  };
}

async function ensureTable(sql) {
  if (tableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS partner_service_signups (
      id SERIAL PRIMARY KEY,
      customer_type TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      company_name TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      number_of_bins INTEGER NOT NULL DEFAULT 1,
      trash_pickup_day TEXT NOT NULL DEFAULT '',
      recycling_frequency TEXT NOT NULL DEFAULT 'No Recycling',
      recycling_pickup_day TEXT NOT NULL DEFAULT '',
      recycling_week TEXT NOT NULL DEFAULT '',
      pickup_schedule TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      service_plan TEXT NOT NULL DEFAULT 'Your Trash Day Team',
      monthly_price NUMERIC(10,2) NOT NULL DEFAULT 70.00,
      billing_cadence TEXT NOT NULL DEFAULT 'Monthly on the 1st',
      account_status TEXT NOT NULL DEFAULT 'Pending Approval',
      service_status TEXT NOT NULL DEFAULT 'Pending Approval',
      billing_status TEXT NOT NULL DEFAULT 'Pending Approval',
      source TEXT NOT NULL DEFAULT '',
      billing_consent BOOLEAN NOT NULL DEFAULT FALSE,
      name_on_card TEXT NOT NULL DEFAULT '',
      billing_zip TEXT NOT NULL DEFAULT '',
      stripe_customer_id TEXT NOT NULL DEFAULT '',
      stripe_payment_method_id TEXT NOT NULL DEFAULT '',
      stripe_setup_intent_id TEXT NOT NULL DEFAULT '',
      card_brand TEXT NOT NULL DEFAULT '',
      card_last4 TEXT NOT NULL DEFAULT '',
      notification_status TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE partner_service_signups ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE partner_service_signups ADD COLUMN IF NOT EXISTS pickup_schedule TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE partner_service_signups ADD COLUMN IF NOT EXISTS billing_cadence TEXT NOT NULL DEFAULT 'Monthly on the 1st'`;
  await sql`ALTER TABLE partner_service_signups ADD COLUMN IF NOT EXISTS notification_status TEXT NOT NULL DEFAULT ''`;
  tableReady = true;
}

function extraProperties(body) {
  return Array.isArray(body.additional_properties) ? body.additional_properties : [];
}

function validateProperty(property, label) {
  if (!s(property.address)) return label + ': service address is required.';
  const bins = Number(property.number_of_bins);
  if (!Number.isInteger(bins) || bins < 1 || bins > 30) return label + ': number of bins must be between 1 and 30.';
  if (!s(property.trash_pickup_day)) return label + ': trash day is required.';
  const frequency = s(property.recycling_frequency) || 'No Recycling';
  if (!['No Recycling', 'Weekly Recycling', 'Bi-Weekly Recycling'].includes(frequency)) {
    return label + ': invalid recycling frequency.';
  }
  if ((frequency === 'Weekly Recycling' || frequency === 'Bi-Weekly Recycling') && !s(property.recycling_pickup_day)) {
    return label + ': recycling pickup day is required.';
  }
  if (frequency === 'Bi-Weekly Recycling' && !['Week A', 'Week B'].includes(s(property.recycling_week))) {
    return label + ': Week A or Week B is required for bi-weekly recycling.';
  }
  return '';
}

function validate(body) {
  const required = [
    'name',
    'address',
    'phone',
    'email',
    'number_of_bins',
    'trash_pickup_day',
    'name_on_card',
    'billing_zip',
    'payment_method_id'
  ];
  const missing = required.filter((key) => !s(body[key]));
  if (missing.length) return 'Missing required fields: ' + missing.join(', ');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s(body.email))) return 'Invalid email address.';
  const bins = Number(body.number_of_bins);
  if (!Number.isInteger(bins) || bins < 1 || bins > 30) return 'Number of bins must be between 1 and 30.';
  if (body.billing_consent !== true) return 'Billing authorization is required.';

  const recyclingFrequency = s(body.recycling_frequency) || 'No Recycling';
  if (!['No Recycling', 'Weekly Recycling', 'Bi-Weekly Recycling'].includes(recyclingFrequency)) {
    return 'Invalid recycling frequency.';
  }
  if ((recyclingFrequency === 'Weekly Recycling' || recyclingFrequency === 'Bi-Weekly Recycling') && !s(body.recycling_pickup_day)) {
    return 'Recycling pickup day is required.';
  }
  if (recyclingFrequency === 'Bi-Weekly Recycling' && !['Week A', 'Week B'].includes(s(body.recycling_week))) {
    return 'Week A or Week B is required for bi-weekly recycling.';
  }

  const extras = extraProperties(body);
  if (extras.length > 19) return 'Too many properties in one signup. Please call 843-955-3132.';
  for (let i = 0; i < extras.length; i += 1) {
    const propertyError = validateProperty(extras[i], 'Property ' + (i + 2));
    if (propertyError) return propertyError;
  }
  return '';
}

function scheduleText(body) {
  const recyclingFrequency = s(body.recycling_frequency) || 'No Recycling';
  const recyclingDay = recyclingFrequency === 'No Recycling' ? '' : s(body.recycling_pickup_day);
  const recyclingWeek = recyclingFrequency === 'Bi-Weekly Recycling' ? s(body.recycling_week) : '';
  return 'Trash: ' + s(body.trash_pickup_day) + (
    recyclingDay ? ' | Recycling: ' + recyclingDay + (recyclingWeek ? ' - ' + recyclingWeek : '') : ''
  );
}

function notificationRecipients() {
  const configured = s(process.env.SIGNUP_NOTIFICATION_EMAILS);
  const list = configured || 'info@trashdaymadeeasy.com,bryan@thebinboy.com';
  return list.split(',').map((item) => item.trim()).filter(Boolean);
}

function escapeHtml(value) {
  return s(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function tableHtml(rows) {
  const bodyRows = rows.map(([label, value]) => (
    '<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#475569;font-weight:700;">' + escapeHtml(label) + '</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#0f172a;">' + escapeHtml(value) + '</td></tr>'
  )).join('');
  return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:680px;border:1px solid #e5e7eb;">'
    + bodyRows
    + '</table>';
}

function propertyRows(record) {
  return [
    ['Address', record.address],
    ['Number of Bins', String(record.number_of_bins)],
    ['Trash Day', record.trash_pickup_day],
    ['Recycling', record.recycling_frequency],
    ['Recycling Day', record.recycling_pickup_day],
    ['Recycling Week', record.recycling_week],
    ['Notes', record.notes]
  ];
}

function emailHtml(record, extraRecords) {
  const extras = extraRecords || [];
  const count = 1 + extras.length;
  const planText = count > 1
    ? '$70/month per property, ' + count + ' properties ($' + (count * 70) + '/month total), pending approval'
    : '$70/month, pending approval';
  const accountRows = [
    ['Name', record.name],
    ['Customer Type', record.customer_type],
    ['Company or Property', record.company_name],
    ['Phone', record.phone],
    ['Email', record.email],
    ['Plan', planText],
    ['Card', (record.card_brand || 'card') + ' ending in ' + (record.card_last4 || '')]
  ];
  const propertyTables = [record].concat(extras).map((property, i) => (
    '<h3 style="margin:18px 0 8px;color:#0e1f3d;">Property ' + (i + 1) + '</h3>'
    + tableHtml(propertyRows(property))
  )).join('');
  return '<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#0f172a;">'
    + '<h2 style="margin:0 0 12px;color:#0e1f3d;">New Your Trash Day Team signup</h2>'
    + '<p style="margin:0 0 18px;color:#475569;">A new account was submitted and is pending approval.</p>'
    + tableHtml(accountRows)
    + propertyTables
    + '</div>';
}

async function notify(record, extraRecords) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
    return 'skipped';
  }
  const count = 1 + (extraRecords || []).length;
  const subjectSuffix = count > 1 ? ' (' + count + ' properties)' : '';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM,
      to: notificationRecipients(),
      subject: 'New Your Trash Day Team signup: ' + record.name + subjectSuffix,
      html: emailHtml(record, extraRecords)
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error('Resend notification failed: ' + text);
  }
  return 'sent';
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return respond(200, {});
  if (event.httpMethod !== 'POST') return respond(405, { error: 'Method Not Allowed' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return respond(400, { error: 'Invalid request body.' });
  }

  if (s(body.company_website)) {
    return respond(200, { success: true, spam: true });
  }

  const validationError = validate(body);
  if (validationError) return respond(400, { error: validationError });

  if (!process.env.DATABASE_URL) {
    return respond(500, { error: 'DATABASE_URL is not configured.' });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return respond(500, { error: 'STRIPE_SECRET_KEY is not configured.' });
  }

  const sql = neon(process.env.DATABASE_URL);
  try {
    await ensureTable(sql);
  } catch (err) {
    console.error('DB init error:', err.message);
    return respond(500, { error: 'Database setup failed. Please call 843-955-3132.' });
  }

  const stripeApi = stripe();
  const cleanEmail = s(body.email).toLowerCase();
  const cleanName = s(body.name);
  const bins = Number(body.number_of_bins);
  const recyclingFrequency = s(body.recycling_frequency) || 'No Recycling';
  const recyclingDay = recyclingFrequency === 'No Recycling' ? '' : s(body.recycling_pickup_day);
  const recyclingWeek = recyclingFrequency === 'Bi-Weekly Recycling' ? s(body.recycling_week) : '';
  const extras = extraProperties(body);
  const propertyCount = 1 + extras.length;

  let customer;
  let setupIntent;
  let paymentMethod;
  try {
    const existing = await stripeApi.customers.list({ email: cleanEmail, limit: 1 });
    customer = existing.data[0] || await stripeApi.customers.create({
      email: cleanEmail,
      name: cleanName,
      phone: s(body.phone) || undefined,
      metadata: {
        source: s(body.source) || 'yourtrashdayteam-home',
        service_plan: 'Your Trash Day Team',
        monthly_price: '70.00',
        account_status: 'Pending Approval'
      }
    });

    await stripeApi.customers.update(customer.id, {
      name: cleanName,
      phone: s(body.phone) || undefined,
      metadata: {
        source: s(body.source) || 'yourtrashdayteam-home',
        customer_type: s(body.customer_type),
        company_name: s(body.company_name),
        address: s(body.address),
        number_of_bins: String(bins),
        trash_pickup_day: s(body.trash_pickup_day),
        recycling_frequency: recyclingFrequency,
        recycling_pickup_day: recyclingDay,
        recycling_week: recyclingWeek,
        service_plan: 'Your Trash Day Team',
        monthly_price: '70.00',
        property_count: String(propertyCount),
        monthly_price_total: (propertyCount * 70).toFixed(2),
        account_status: 'Pending Approval'
      }
    });

    setupIntent = await stripeApi.setupIntents.create({
      customer: customer.id,
      payment_method: s(body.payment_method_id),
      confirm: true,
      usage: 'off_session',
      description: 'Card authorization - Your Trash Day Team pending approval',
      metadata: {
        service_plan: 'Your Trash Day Team',
        monthly_price: '70.00',
        billing_cadence: 'Monthly on the 1st',
        account_status: 'Pending Approval'
      },
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' }
    });

    if (setupIntent.status !== 'succeeded') {
      return respond(402, { error: 'Card authorization did not complete. Please use another card or call 843-955-3132.' });
    }

    await stripeApi.customers.update(customer.id, {
      invoice_settings: { default_payment_method: s(body.payment_method_id) }
    });
    paymentMethod = await stripeApi.paymentMethods.retrieve(s(body.payment_method_id));
  } catch (err) {
    console.error('Stripe setup error:', err.message);
    return respond(402, { error: err.message || 'Could not securely store the card.' });
  }

  let record;
  const extraRecords = [];
  try {
    const rows = await sql`
      INSERT INTO partner_service_signups (
        customer_type, name, company_name, address, phone, email,
        number_of_bins, trash_pickup_day, recycling_frequency,
        recycling_pickup_day, recycling_week, pickup_schedule, notes,
        service_plan, monthly_price, billing_cadence,
        account_status, service_status, billing_status, source,
        billing_consent, name_on_card, billing_zip,
        stripe_customer_id, stripe_payment_method_id, stripe_setup_intent_id,
        card_brand, card_last4, notification_status
      ) VALUES (
        ${s(body.customer_type)}, ${cleanName}, ${s(body.company_name)}, ${s(body.address)}, ${s(body.phone)}, ${cleanEmail},
        ${bins}, ${s(body.trash_pickup_day)}, ${recyclingFrequency},
        ${recyclingDay}, ${recyclingWeek}, ${scheduleText(body)}, ${s(body.notes)},
        'Your Trash Day Team', ${70.00}, 'Monthly on the 1st',
        'Pending Approval', 'Pending Approval', 'Pending Approval', ${s(body.source) || 'yourtrashdayteam-home'},
        ${true}, ${s(body.name_on_card)}, ${s(body.billing_zip)},
        ${customer.id}, ${s(body.payment_method_id)}, ${setupIntent.id},
        ${s(paymentMethod.card && paymentMethod.card.brand)}, ${s(paymentMethod.card && paymentMethod.card.last4)}, 'pending'
      )
      RETURNING *
    `;
    record = rows[0];

    for (const property of extras) {
      const propertyFrequency = s(property.recycling_frequency) || 'No Recycling';
      const propertyDay = propertyFrequency === 'No Recycling' ? '' : s(property.recycling_pickup_day);
      const propertyWeek = propertyFrequency === 'Bi-Weekly Recycling' ? s(property.recycling_week) : '';
      const extraRows = await sql`
        INSERT INTO partner_service_signups (
          customer_type, name, company_name, address, phone, email,
          number_of_bins, trash_pickup_day, recycling_frequency,
          recycling_pickup_day, recycling_week, pickup_schedule, notes,
          service_plan, monthly_price, billing_cadence,
          account_status, service_status, billing_status, source,
          billing_consent, name_on_card, billing_zip,
          stripe_customer_id, stripe_payment_method_id, stripe_setup_intent_id,
          card_brand, card_last4, notification_status
        ) VALUES (
          ${s(body.customer_type)}, ${cleanName}, ${s(body.company_name)}, ${s(property.address)}, ${s(body.phone)}, ${cleanEmail},
          ${Number(property.number_of_bins)}, ${s(property.trash_pickup_day)}, ${propertyFrequency},
          ${propertyDay}, ${propertyWeek}, ${scheduleText(property)}, ${s(property.notes)},
          'Your Trash Day Team', ${70.00}, 'Monthly on the 1st',
          'Pending Approval', 'Pending Approval', 'Pending Approval', ${s(body.source) || 'yourtrashdayteam-home'},
          ${true}, ${s(body.name_on_card)}, ${s(body.billing_zip)},
          ${customer.id}, ${s(body.payment_method_id)}, ${setupIntent.id},
          ${s(paymentMethod.card && paymentMethod.card.brand)}, ${s(paymentMethod.card && paymentMethod.card.last4)}, 'skipped'
        )
        RETURNING *
      `;
      extraRecords.push(extraRows[0]);
    }
  } catch (err) {
    console.error('DB insert error:', err.message);
    return respond(500, { error: 'Your card was authorized, but the account record did not save. Please call 843-955-3132.' });
  }

  let notificationStatus = 'skipped';
  try {
    notificationStatus = await notify(record, extraRecords);
  } catch (err) {
    notificationStatus = 'failed';
    console.error('Notification error:', err.message);
  }

  try {
    await sql`
      UPDATE partner_service_signups
      SET notification_status = ${notificationStatus}, updated_at = NOW()
      WHERE id = ${record.id}
    `;
  } catch (err) {
    console.error('Notification status update failed:', err.message);
  }

  return respond(200, {
    success: true,
    id: record.id,
    property_count: propertyCount,
    property_ids: [record.id].concat(extraRecords.map((row) => row.id)),
    account_status: 'Pending Approval',
    service_status: 'Pending Approval',
    billing_status: 'Pending Approval',
    notification_status: notificationStatus,
    stripe_customer_id: customer.id,
    stripe_setup_intent_id: setupIntent.id
  });
};
