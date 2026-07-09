'use strict';

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

exports.handler = async function () {
  return respond(200, {
    stripe_publishable_key: process.env.STRIPE_PUBLISHABLE_KEY || ''
  });
};
