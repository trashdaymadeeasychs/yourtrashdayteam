'use strict';

// Your Trash Day Team pricing, as billed. Must match the PRICING TABLE at the top of
// index.html (window.YTDT_PRICING) and the prices written in the site copy
// (index.html, /faq/, the service pages, llms.txt).
const PRICING = Object.freeze({
  basePerProperty: 70, // dollars per month per property: weekly valet + monthly wash
  includedBins: 2,     // bins covered by the base price
  perExtraBin: 5       // dollars per month for each bin beyond includedBins
});

// Monthly price in dollars for one property with this many bins.
// A missing or invalid count is priced as 1 bin (the base price).
function propertyMonthlyPrice(bins) {
  let n = Number.parseInt(bins, 10);
  if (!(n >= 1)) n = 1;
  return PRICING.basePerProperty + Math.max(0, n - PRICING.includedBins) * PRICING.perExtraBin;
}

// e.g. "$75/month (3 bins: $70 base + $5 x 1 extra bin)"
function describePropertyPrice(bins) {
  const n = Math.max(1, Number.parseInt(bins, 10) || 1);
  const extra = Math.max(0, n - PRICING.includedBins);
  const detail = extra
    ? '$' + PRICING.basePerProperty + ' base + $' + PRICING.perExtraBin + ' x ' + extra + ' extra bin' + (extra > 1 ? 's' : '')
    : PRICING.includedBins + ' bins included';
  return '$' + propertyMonthlyPrice(n) + '/month (' + n + ' bin' + (n > 1 ? 's' : '') + ': ' + detail + ')';
}

module.exports = { PRICING, propertyMonthlyPrice, describePropertyPrice };
