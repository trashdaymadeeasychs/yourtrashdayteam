'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  NotificationError,
  notificationConfig,
  sendSignupNotification
} = require('../netlify/functions/_shared/signup-notification');
const { handler, _test } = require('../netlify/functions/partner-signup');

function response(statusCode, payload) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' }
  });
}

test('notificationConfig requires a production sender and valid recipients', () => {
  assert.throws(
    () => notificationConfig({ RESEND_FROM: 'hello@yourtrashdayteam.com' }),
    (error) => error instanceof NotificationError && error.code === 'missing_api_key'
  );
  assert.throws(
    () => notificationConfig({
      RESEND_API_KEY: 're_test',
      RESEND_FROM: 'Test <onboarding@resend.dev>'
    }),
    (error) => error instanceof NotificationError && error.code === 'test_sender_not_allowed'
  );
  assert.throws(
    () => notificationConfig({
      RESEND_API_KEY: 're_test',
      RESEND_FROM: 'hello@yourtrashdayteam.com',
      SIGNUP_NOTIFICATION_EMAILS: 'not-an-email'
    }),
    (error) => error instanceof NotificationError && error.code === 'invalid_recipients'
  );
});

test('sendSignupNotification sends from configuration and replies to the submitter', async () => {
  let request;
  const loggerEntries = [];
  const result = await sendSignupNotification({
    env: {
      RESEND_API_KEY: 're_test',
      RESEND_FROM: 'Your Trash Day Team <hello@yourtrashdayteam.com>',
      SIGNUP_NOTIFICATION_EMAILS: 'info@trashdaymadeeasy.com,bryan@thebinboy.com'
    },
    replyTo: 'Visitor@Example.com',
    idempotencyKey: 'ytt-signup/11111111-1111-4111-8111-111111111111',
    subject: 'New signup\r\nignored header',
    html: '<p>escaped content</p>',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return response(200, { id: 'email-test-message-id' });
    },
    logger: {
      info(message, details) {
        loggerEntries.push({ message, details });
      }
    }
  });

  assert.equal(result.messageId, 'email-test-message-id');
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.options.headers.Authorization, 'Bearer re_test');
  assert.equal(
    request.options.headers['Idempotency-Key'],
    'ytt-signup/11111111-1111-4111-8111-111111111111'
  );
  const body = JSON.parse(request.options.body);
  assert.equal(body.from, 'Your Trash Day Team <hello@yourtrashdayteam.com>');
  assert.deepEqual(body.to, ['info@trashdaymadeeasy.com', 'bryan@thebinboy.com']);
  assert.equal(body.reply_to, 'visitor@example.com');
  assert.equal(body.subject, 'New signup ignored header');
  assert.equal(loggerEntries[0].details.resend_message_id, 'email-test-message-id');
});

test('sendSignupNotification rejects provider errors without retaining secrets or addresses', async () => {
  await assert.rejects(
    sendSignupNotification({
      env: {
        RESEND_API_KEY: 're_private_value',
        RESEND_FROM: 'hello@yourtrashdayteam.com'
      },
      replyTo: 'visitor@example.com',
      idempotencyKey: 'ytt-signup/22222222-2222-4222-8222-222222222222',
      subject: 'New signup',
      html: '<p>test</p>',
      fetchImpl: async () => response(403, {
        name: 'validation_error',
        message: 'Key re_private_value rejected for visitor@example.com'
      })
    }),
    (error) => {
      assert.equal(error.code, 'validation_error');
      assert.equal(error.providerStatus, 403);
      assert.equal(error.providerMessage.includes('re_private_value'), false);
      assert.equal(error.providerMessage.includes('visitor@example.com'), false);
      return true;
    }
  );
});

test('sendSignupNotification requires a Resend message ID', async () => {
  await assert.rejects(
    sendSignupNotification({
      env: {
        RESEND_API_KEY: 're_test',
        RESEND_FROM: 'hello@yourtrashdayteam.com'
      },
      replyTo: 'visitor@example.com',
      idempotencyKey: 'ytt-signup/33333333-3333-4333-8333-333333333333',
      subject: 'New signup',
      html: '<p>test</p>',
      fetchImpl: async () => response(200, {})
    }),
    (error) => error instanceof NotificationError && error.code === 'missing_message_id'
  );
});

test('partner-signup rejects non-JSON and invalid requests before external services', async () => {
  const nonJson = await handler({
    httpMethod: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: '{}'
  });
  assert.equal(nonJson.statusCode, 415);

  const invalidJson = await handler({
    httpMethod: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{'
  });
  assert.equal(invalidJson.statusCode, 400);

  const missingFields = await handler({
    httpMethod: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  });
  assert.equal(missingFields.statusCode, 400);
});

test('partner-signup validation accepts the browser payload field names', () => {
  const valid = {
    name: 'Test Customer',
    address: '123 Test Street',
    phone: '843-555-0100',
    email: 'customer@example.com',
    number_of_bins: '1',
    trash_pickup_day: 'Monday',
    recycling_frequency: 'No Recycling',
    name_on_card: 'Test Customer',
    billing_zip: '29401',
    billing_consent: true,
    payment_method_id: 'pm_test_only',
    submission_id: '44444444-4444-4444-8444-444444444444',
    additional_properties: []
  };

  assert.equal(_test.validate(valid), '');
  assert.equal(_test.validate({ ...valid, email: 'invalid' }), 'Invalid email address.');
  assert.equal(
    _test.validate({ ...valid, submission_id: 'invalid' }),
    'Invalid submission identifier.'
  );
});

test('partner-signup never reports honeypot submissions as successful', async () => {
  const result = await handler({
    httpMethod: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ company_website: 'filled-by-autofill.example' })
  });
  const body = JSON.parse(result.body);
  assert.equal(result.statusCode, 422);
  assert.equal(body.success, undefined);
});

test('signup email HTML escapes all submitted content', () => {
  const html = _test.emailHtml({
    name: '<script>alert(1)</script>',
    customer_type: 'Business',
    company_name: 'A & B',
    phone: '555-0100',
    email: 'visitor@example.com',
    card_brand: 'visa',
    card_last4: '4242',
    address: '<img src=x onerror=alert(1)>',
    number_of_bins: 1,
    trash_pickup_day: 'Monday',
    recycling_frequency: 'No Recycling',
    recycling_pickup_day: '',
    recycling_next_pickup: '',
    notes: '"quoted"'
  }, []);

  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.equal(html.includes('<img src=x onerror=alert(1)>'), false);
  assert.equal(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true);
  assert.equal(html.includes('&lt;img src=x onerror=alert(1)&gt;'), true);
  assert.equal(html.includes('A &amp; B'), true);
});
