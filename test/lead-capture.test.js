'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { handler, _test: lead } = require('../netlify/functions/partner-lead');
const { _test: followup } = require('../netlify/functions/lead-followup');
const { markLeadConverted } = require('../netlify/functions/_shared/leads');

const LEAD_ID = '55555555-5555-4555-8555-555555555555';
const CONFIG = {
  apiKey: 're_test',
  from: 'Your Trash Day Team <hello@yourtrashdayteam.com>',
  recipients: ['info@trashdaymadeeasy.com']
};
const quietLogger = { info() {}, error() {} };

// Minimal stand-in for the Neon tagged-template client: records each query and
// answers from a responder keyed on the SQL text.
function fakeSql(responder) {
  const calls = [];
  const sql = async (strings, ...values) => {
    const text = strings.join('$').replace(/\s+/g, ' ').trim();
    calls.push({ text, values });
    return (responder && responder(text, values)) || [];
  };
  sql.calls = calls;
  return sql;
}

function validBody(extra) {
  return {
    lead_id: LEAD_ID,
    customer_type: 'Residential Homeowner/Renter',
    name: 'Test Customer',
    phone: '843-555-0100',
    email: 'Customer@Example.com',
    address: '123 Test Street',
    number_of_bins: '2',
    trash_pickup_day: 'Tuesday',
    recycling_frequency: 'No Recycling',
    property_count: 1,
    ...extra
  };
}

test('partner-lead normalize cleans the browser payload', () => {
  const out = lead.normalize(validBody());
  assert.equal(out.lead_id, LEAD_ID);
  assert.equal(out.email, 'customer@example.com');
  assert.equal(out.number_of_bins, 2);
  assert.equal(out.trash_pickup_day, 'Tuesday');
  assert.equal(out.source, 'yourtrashdayteam-home');

  const odd = lead.normalize(validBody({
    trash_pickup_day: 'Someday',
    customer_type: '<b>x</b>',
    number_of_bins: '999',
    property_count: 500
  }));
  assert.equal(odd.trash_pickup_day, '');
  assert.equal(odd.customer_type, '');
  assert.equal(odd.number_of_bins, null);
  assert.equal(odd.property_count, 1);
});

test('partner-lead normalize rejects missing or invalid contact details', () => {
  assert.equal(lead.normalize(validBody({ lead_id: 'nope' })), 'Invalid lead identifier.');
  assert.equal(lead.normalize(validBody({ name: '  ' })), 'Name is required.');
  assert.equal(lead.normalize(validBody({ phone: '12' })), 'A valid phone number is required.');
  assert.equal(lead.normalize(validBody({ email: 'not-an-email' })), 'Invalid email address.');
  assert.equal(lead.normalize([]), 'Invalid request body.');
});

test('partner-lead handler rejects bad requests before touching the database', async () => {
  assert.equal((await handler({ httpMethod: 'GET' })).statusCode, 405);
  assert.equal((await handler({
    httpMethod: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}'
  })).statusCode, 415);
  assert.equal((await handler({
    httpMethod: 'POST', headers: { 'content-type': 'application/json' }, body: '{'
  })).statusCode, 400);
  assert.equal((await handler({
    httpMethod: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(9000)
  })).statusCode, 413);
  assert.equal((await handler({
    httpMethod: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
  })).statusCode, 400);
});

test('saveLead upserts but leaves followed-up or converted leads untouched', async () => {
  const sql = fakeSql();
  await lead.saveLead(sql, lead.normalize(validBody()));
  const insert = sql.calls.find((c) => c.text.startsWith('INSERT INTO partner_service_leads'));
  assert.ok(insert);
  assert.match(insert.text, /ON CONFLICT \(lead_id\) DO UPDATE/);
  assert.match(insert.text, /WHERE partner_service_leads\.status = 'open'$/);
  assert.equal(insert.values[0], LEAD_ID);
});

test('markLeadConverted is best effort and ignores bad ids', async () => {
  assert.equal(await markLeadConverted(fakeSql(), 'bad-id', quietLogger), false);

  const noTable = fakeSql((text) => (text.includes('to_regclass') ? [{ t: null }] : []));
  assert.equal(await markLeadConverted(noTable, LEAD_ID, quietLogger), false);
  assert.equal(noTable.calls.some((c) => c.text.startsWith('UPDATE')), false);

  const failing = async () => { throw new Error('db down'); };
  assert.equal(await markLeadConverted(failing, LEAD_ID, quietLogger), false);

  const ok = fakeSql((text) => (text.includes('to_regclass') ? [{ t: 'partner_service_leads' }] : []));
  assert.equal(await markLeadConverted(ok, LEAD_ID.toUpperCase(), quietLogger), true);
  const update = ok.calls.find((c) => c.text.startsWith('UPDATE'));
  assert.deepEqual(update.values, [LEAD_ID]);
});

test('follow-up sends nothing when no leads are due', async () => {
  let fetched = false;
  const sql = fakeSql((text) => (text.includes('to_regclass') ? [{ t: null }] : []));
  const result = await followup.runFollowup({
    sql, config: CONFIG, logger: quietLogger, fetchImpl: async () => { fetched = true; }
  });
  assert.deepEqual(result, { sent: 0 });
  assert.equal(fetched, false);
});

test('follow-up sends one digest for all due leads and marks each notified', async () => {
  const due = [
    { lead_id: LEAD_ID, name: 'A', email: 'a@example.com', phone: '843-555-0100', created_at: '2026-11-01T14:00:00Z' },
    { lead_id: '66666666-6666-4666-8666-666666666666', name: 'B', email: 'b@example.com', phone: '843-555-0101', created_at: '2026-11-01T15:00:00Z' }
  ];
  const sql = fakeSql((text) => {
    if (text.includes('to_regclass')) return [{ t: 'partner_service_signups' }];
    if (text.startsWith('SELECT * FROM partner_service_leads')) return due;
    return [];
  });
  const requests = [];
  const result = await followup.runFollowup({
    sql,
    config: CONFIG,
    logger: quietLogger,
    fetchImpl: async (url, options) => {
      requests.push(options);
      return new Response(JSON.stringify({ id: 'email-digest-id' }), { status: 200 });
    }
  });

  assert.equal(result.sent, 2);
  assert.equal(requests.length, 1);
  const payload = JSON.parse(requests[0].body);
  assert.equal(payload.subject, '2 unfinished signups to follow up');
  assert.equal(payload.reply_to, 'hello@yourtrashdayteam.com');
  assert.match(requests[0].headers['Idempotency-Key'], /^ytt-lead-digest\/[0-9a-f]{64}$/);
  assert.ok(sql.calls.some((c) => c.text.includes("SET status = 'converted'")));
  const marks = sql.calls.filter((c) => c.text.includes("SET status = 'notified'"));
  assert.equal(marks.length, 2);
  assert.ok(marks.every((c) => c.values.includes('email-digest-id')));
});

test('follow-up does not mark leads notified when the email is rejected', async () => {
  const sql = fakeSql((text) => {
    if (text.includes('to_regclass')) return [{ t: null }];
    if (text.startsWith('SELECT * FROM partner_service_leads')) {
      return [{ lead_id: LEAD_ID, name: 'A', email: 'a@example.com', phone: '1', created_at: '2026-11-01T14:00:00Z' }];
    }
    return [];
  });
  await assert.rejects(followup.runFollowup({
    sql,
    config: CONFIG,
    logger: quietLogger,
    fetchImpl: async () => new Response(JSON.stringify({ message: 'nope' }), { status: 422 })
  }));
  assert.equal(sql.calls.some((c) => c.text.includes("SET status = 'notified'")), false);
});

test('follow-up digest escapes submitted content', () => {
  const html = followup.digestHtml([{
    name: '<script>alert(1)</script>',
    phone: '"><img src=x>',
    email: 'a@example.com',
    address: 'A & B',
    created_at: '2026-11-01T14:00:00Z'
  }]);
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.equal(html.includes('<img src=x>'), false);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('A &amp; B'));
  assert.equal(followup.digestSubject([{ name: 'Pat' }]), 'Unfinished signup: Pat');
});
