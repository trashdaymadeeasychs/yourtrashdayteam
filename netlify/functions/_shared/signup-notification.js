'use strict';

const DEFAULT_RECIPIENTS = [
  'info@trashdaymadeeasy.com',
  'bryan@thebinboy.com'
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class NotificationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'NotificationError';
    this.code = details && details.code || 'notification_error';
    this.providerStatus = details && details.providerStatus || null;
    this.providerMessage = details && details.providerMessage || '';
  }
}

function clean(value) {
  return value == null ? '' : String(value).trim();
}

function extractEmail(value) {
  const text = clean(value);
  const angleMatch = text.match(/<([^<>]+)>$/);
  return clean(angleMatch ? angleMatch[1] : text).toLowerCase();
}

function notificationRecipients(env) {
  const configured = clean(env.SIGNUP_NOTIFICATION_EMAILS);
  const recipients = (configured ? configured.split(',') : DEFAULT_RECIPIENTS)
    .map((item) => clean(item).toLowerCase())
    .filter(Boolean);

  if (!recipients.length || recipients.some((email) => !EMAIL_RE.test(email))) {
    throw new NotificationError('Signup notification recipients are not configured correctly.', {
      code: 'invalid_recipients'
    });
  }
  return recipients;
}

function notificationConfig(env) {
  const apiKey = clean(env.RESEND_API_KEY);
  const from = clean(env.RESEND_FROM);
  const fromEmail = extractEmail(from);

  if (!apiKey) {
    throw new NotificationError('RESEND_API_KEY is not configured.', { code: 'missing_api_key' });
  }
  if (!from || !EMAIL_RE.test(fromEmail)) {
    throw new NotificationError('RESEND_FROM is not configured correctly.', { code: 'invalid_sender' });
  }
  if (fromEmail.endsWith('@resend.dev')) {
    throw new NotificationError('RESEND_FROM must use the verified production domain.', {
      code: 'test_sender_not_allowed'
    });
  }

  return {
    apiKey,
    from,
    recipients: notificationRecipients(env)
  };
}

function sanitizeProviderText(value) {
  return clean(value)
    .replace(/re_[A-Za-z0-9_-]+/g, 're_[redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email-redacted]')
    .slice(0, 240);
}

async function responsePayload(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    return {};
  }
}

async function sendSignupNotification(options) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const logger = options.logger || console;
  const config = options.config || notificationConfig(env);
  const replyTo = extractEmail(options.replyTo);
  const idempotencyKey = clean(options.idempotencyKey);

  if (!EMAIL_RE.test(replyTo)) {
    throw new NotificationError('The submitter email cannot be used as reply-to.', {
      code: 'invalid_reply_to'
    });
  }
  if (!idempotencyKey || idempotencyKey.length > 256) {
    throw new NotificationError('The notification idempotency key is invalid.', {
      code: 'invalid_idempotency_key'
    });
  }

  let response;
  try {
    response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        from: config.from,
        to: config.recipients,
        reply_to: replyTo,
        subject: clean(options.subject).replace(/[\r\n]+/g, ' '),
        html: String(options.html || '')
      })
    });
  } catch (error) {
    throw new NotificationError('Resend could not be reached.', {
      code: 'provider_unreachable'
    });
  }

  const payload = await responsePayload(response);
  if (!response.ok) {
    throw new NotificationError('Resend rejected the signup notification.', {
      code: sanitizeProviderText(payload.name) || 'provider_rejected',
      providerStatus: response.status,
      providerMessage: sanitizeProviderText(payload.message)
    });
  }

  const messageId = clean(payload.id);
  if (!messageId) {
    throw new NotificationError('Resend accepted the request without returning a message ID.', {
      code: 'missing_message_id',
      providerStatus: response.status
    });
  }

  logger.info('Signup notification accepted by Resend.', {
    resend_message_id: messageId,
    recipient_count: config.recipients.length
  });

  return { messageId, recipientCount: config.recipients.length };
}

module.exports = {
  DEFAULT_RECIPIENTS,
  NotificationError,
  extractEmail,
  notificationConfig,
  notificationRecipients,
  sanitizeProviderText,
  sendSignupNotification
};
