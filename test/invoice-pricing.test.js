const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');

test('CURRENT BEHAVIOUR: order pricing uses HSN slab tax and totals discount before tax', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 2 }];

  assert.deepEqual(pricing.computeTotals(items, ''), {
    subtotal: 200,
    discount: 0,
    taxable: 200,
    tax: 10,
    cgst: 5,
    sgst: 5,
    total: 210,
    lines: [{ id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 200, discount: 0, taxable: 200, tax: 10, net: 210 }]
  });
});

test('invoice uses HSN slab when stored items have no explicit gstRate', () => {
  const order = { items: [{ name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 2 }] };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 200,
    discount: 0,
    tax: 10,
    cgst: 5,
    sgst: 5,
    total: 210,
    rows: [{ name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 100, gstPercent: 5, line: 200, lineTax: 10 }]
  });
});

test('invoice accepts decimal gstRate values through the shared tax helper', () => {
  const order = { items: [{ name: 'Test', price: 100, qty: 1, gstRate: 0.05 }] };

  assert.equal(invoice.computeInvoiceFigures(order).tax, 5);
  assert.equal(pricing.computeTotals([{ name: 'Test', price: 100, qty: 1, gstRate: 0.05 }], '').tax, 5);
});

test('CURRENT BEHAVIOUR: invoices without stored billed totals retain legacy coupon calculation', () => {
  const order = {
    coupon: 'SAVE10',
    items: [{ name: 'Bulk item', price: 2000, qty: 1, gstRate: 5 }]
  };
  const billed = pricing.computeTotals(order.items, 'SAVE10');
  const invoiced = invoice.computeInvoiceFigures(order);

  assert.equal(billed.discount, 150);
  assert.equal(billed.total, 1942.5);
  assert.equal(invoiced.discount, 210);
  assert.equal(invoiced.total, 1890);
});

test('CURRENT BEHAVIOUR: invoices without stored billed totals accept FLAT50 below minimum', () => {
  const items = [{ name: 'Small item', price: 100, qty: 1, gstRate: 5 }];
  const order = { coupon: 'FLAT50', items };

  assert.equal(pricing.computeTotals(items, 'FLAT50').discount, 0);
  assert.equal(invoice.computeInvoiceFigures(order).discount, 50);
  assert.equal(invoice.computeInvoiceFigures(order).total, 55);
});

test('invoice uses stored billed totals and tax without a reconciliation warning', () => {
  const storedOrder = {
    subtotal: 200,
    discount: 0,
    tax: 10,
    total: 210,
    items: [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 2 }]
  };
  const html = invoice.render(storedOrder);

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹10\.00/);
});
