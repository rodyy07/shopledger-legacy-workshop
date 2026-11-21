'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('CURRENT BEHAVIOUR: pricing uses HSN GST and prorates coupon discount before tax', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 2 }];
  const totals = pricing.computeTotals(items, 'SAVE10');

  assert.equal(totals.subtotal, 200);
  assert.equal(totals.discount, 0); // SAVE10 has a ₹500 minimum.
  assert.equal(totals.taxable, 200);
  assert.equal(totals.tax, 10);
  assert.equal(totals.cgst, 5);
  assert.equal(totals.sgst, 5);
  assert.equal(totals.total, 210);
});

test('invoice resolves GST from the HSN slab when gstRate is absent', () => {
  const order = {
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }], coupon: ''
  };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.subtotal, 100);
  assert.equal(figures.tax, 5);
  assert.equal(figures.cgst, 2.5);
  assert.equal(figures.sgst, 2.5);
  assert.equal(figures.total, 105);
});

test('invoice and pricing both accept decimal gstRate values', () => {
  const item = { name: 'Item', price: 100, qty: 1, gstRate: 0.05 };
  assert.equal(pricing.computeTotals([item], '').tax, 5);
  assert.equal(invoice.computeInvoiceFigures({ items: [item], coupon: '' }).tax, 5);
});

test('CURRENT BEHAVIOUR: invoices without stored billed totals calculate coupons independently', () => {
  const items = [{ name: 'Bulk goods', hsn: '1006', price: 2000, qty: 1 }];
  const stored = pricing.computeTotals(items, 'WHOLESALE15');
  const billedInvoice = invoice.computeInvoiceFigures({ items, coupon: 'WHOLESALE15' });

  assert.equal(stored.discount, 300); // Pricing applies configured ₹400 cap to 15% of subtotal.
  assert.equal(stored.tax, 85);
  assert.equal(stored.total, 1785);
  assert.equal(billedInvoice.discount, 315);
  assert.equal(billedInvoice.tax, 100);
  assert.equal(billedInvoice.total, 1785);
});

test('reconciliation matches invoice figures to stored billed ledger figures', () => {
  const items = [{ name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }];
  const stored = pricing.computeTotals(items, '');
  const db = {
    orders: [{ id: 1001, date: '21/11/2026', customer: 'Test', coupon: '', status: 'completed',
      items, subtotal: stored.subtotal, discount: stored.discount, tax: stored.tax, total: stored.total }],
    products: [], customers: []
  };
  const result = reports.getGstReconciliation(db);

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.deepEqual({ ledgerTax: result.rows[0].ledgerTax, invoiceTax: result.rows[0].invoiceTax,
    ledgerTotal: result.rows[0].ledgerTotal, invoiceTotal: result.rows[0].invoiceTotal,
    delta: result.rows[0].delta, matched: result.rows[0].matched },
  { ledgerTax: 5, invoiceTax: 5, ledgerTotal: 105, invoiceTotal: 105, delta: 0, matched: true });
});


