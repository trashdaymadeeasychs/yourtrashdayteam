'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { PRICING, propertyMonthlyPrice, describePropertyPrice } = require('../netlify/functions/_shared/pricing');
const { _test } = require('../netlify/functions/partner-signup');

const root = path.join(__dirname, '..');

test('2 bins are included; each additional bin is $5/month', () => {
  assert.equal(propertyMonthlyPrice(1), 70);
  assert.equal(propertyMonthlyPrice(2), 70);
  assert.equal(propertyMonthlyPrice(3), 75);
  assert.equal(propertyMonthlyPrice(4), 80);
  assert.equal(propertyMonthlyPrice(10), 110);
  assert.equal(propertyMonthlyPrice('3'), 75);
  assert.equal(propertyMonthlyPrice(''), 70);
  assert.equal(propertyMonthlyPrice(undefined), 70);
});

test('price description shows the math', () => {
  assert.equal(describePropertyPrice(2), '$70/month (2 bins: 2 bins included)');
  assert.equal(describePropertyPrice(3), '$75/month (3 bins: $70 base + $5 x 1 extra bin)');
  assert.equal(describePropertyPrice(5), '$85/month (5 bins: $70 base + $5 x 3 extra bins)');
});

test('the page pricing table matches the server pricing', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const script = html.match(/<script>\s*\/\/ PRICING TABLE[\s\S]*?<\/script>/);
  assert.ok(script, 'index.html must keep its PRICING TABLE script');
  const sandbox = { window: {} };
  vm.runInNewContext(script[0].replace(/<\/?script>/g, ''), sandbox);
  const page = sandbox.window.YTDT_PRICING;
  assert.equal(page.basePerProperty, PRICING.basePerProperty);
  assert.equal(page.includedBins, PRICING.includedBins);
  assert.equal(page.perExtraBin, PRICING.perExtraBin);
  for (let bins = 1; bins <= 30; bins += 1) {
    assert.equal(sandbox.window.ytdtPropertyPrice(bins), propertyMonthlyPrice(bins), `${bins} bins`);
  }
});

test('signup email states each property price and the total', () => {
  const base = {
    name: 'Pat', customer_type: 'Business', company_name: '', phone: '555-0100', email: 'p@example.com',
    card_brand: 'visa', card_last4: '4242', trash_pickup_day: 'Monday', recycling_frequency: 'No Recycling',
    recycling_pickup_day: '', recycling_next_pickup: '', notes: ''
  };
  const single = _test.emailHtml({ ...base, address: '1 A St', number_of_bins: 3, monthly_price: '75.00' }, []);
  assert.match(single, /\$75\/month \(3 bins: \$70 base \+ \$5 x 1 extra bin\), pending approval/);

  const multi = _test.emailHtml(
    { ...base, address: '1 A St', number_of_bins: 2, monthly_price: '70.00' },
    [{ ...base, address: '2 B St', number_of_bins: 4, monthly_price: '80.00' }]
  );
  assert.match(multi, /2 properties, \$150\/month total/);
});
