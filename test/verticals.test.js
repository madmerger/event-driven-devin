'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { VERTICALS } = require('../src/verticals');

// The whole point of the demo is that every primary action fails on cue with
// a realistic TypeError. This guards that property so a well-meaning refactor
// doesn't accidentally "fix" the demo props.
const SAMPLE = {
  '/api/storefront/checkout': { items: [{ sku: 'TOOL-001', qty: 1, price: 89.99 }], subtotal: 219.96 },
  '/api/banking/transfer': { amount: 500, accountTier: 'premium' },
  '/api/trading/execute': { quantity: 10, price: 227.63, tierId: '1' },
  '/api/insurance/claim': { policyId: 'POL-5001', amount: 2500 },
  '/api/cpg/order': { fulfillmentZone: 'southeast', items: [{ sku: 'X', qty: 5 }] },
  '/api/licenses/provision': { planName: 'enterprise', seats: 25 },
  '/api/maintenance/workorder': { equipmentCategory: 'Rotating', issueType: 'preventive', estimatedHours: 4 },
  '/api/healthcare/appointment': { appointmentDate: '2026-12-15' },
  '/api/telco/upgrade': { targetPlanCode: 'PLUS-24' },
};

const EXPECTED = {
  retail: "Cannot read properties of undefined (reading 'name')",
  banking: "Cannot read properties of undefined (reading 'rate')",
  'financial-services': "Cannot read properties of null (reading 'fees')",
  insurance: "Cannot read properties of null (reading 'policy')",
  cpg: "Cannot read properties of undefined (reading 'code')",
  hightech: "Cannot read properties of undefined (reading 'pricePerSeat')",
  industrials: "Cannot read properties of undefined (reading 'rates')",
  healthcare: "Cannot read properties of null (reading 'copayAmount')",
  telco: "Cannot read properties of undefined (reading 'monthlyRate')",
};

for (const v of VERTICALS) {
  test(`${v.id} fails on cue with a TypeError`, () => {
    assert.throws(
      () => v.handler(SAMPLE[v.endpoint]),
      (err) => {
        assert.strictEqual(err.name, 'TypeError');
        assert.strictEqual(err.message, EXPECTED[v.id]);
        return true;
      }
    );
  });
}

test('every vertical has the metadata the hub needs', () => {
  for (const v of VERTICALS) {
    for (const key of ['id', 'name', 'brand', 'path', 'icon', 'color', 'endpoint', 'code', 'service', 'culprit']) {
      assert.ok(v[key], `${v.id} missing ${key}`);
    }
  }
});
