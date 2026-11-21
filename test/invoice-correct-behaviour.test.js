'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

test('invoice figures match the amount and GST billed for a stored order', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 2 }];
  const billed = pricing.computeTotals(items, '');
  const figures = invoice.computeInvoiceFigures({ items, coupon: '' });

  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.cgst, billed.cgst);
  assert.equal(figures.sgst, billed.sgst);
  assert.equal(figures.total, billed.total);
});
