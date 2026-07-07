'use strict';

/**
 * Vertical registry for the Event-Driven Devin demo.
 *
 * Each vertical is a small, believable "primary action" for an industry. The
 * action deliberately fails in a realistic way so the remediation pipeline has
 * something to react to. Every handler is written to fail on cue (that is the
 * whole point of the demo) — see the accompanying `bug` note on each entry.
 *
 * NOTE: These are intentional demo props. Never ship guaranteed failures like
 * this to production.
 */

const CATALOG = {
  'TOOL-001': { name: 'Power Tool Pro', price: 89.99 },
  'GADGET-001': { name: 'Super Gadget', price: 49.99 },
  'WIDGET-001': { name: 'Premium Widget', price: 29.99 },
};

// ---- Retail: promo SKU crash -------------------------------------------------
function retailCheckout(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  const subtotal = Number(body.subtotal) || 0;

  const lineItems = items.slice();
  // Promo engine: orders over $200 earn a 2026 gift item.
  if (subtotal > 200) {
    lineItems.push({ sku: 'PROMO-GIFT-2026', qty: 1, price: 0 });
  }

  // BUG: the promo SKU is not in the product catalog, so the receipt
  // formatter dereferences `undefined.name`.
  const receipt = lineItems.map((item) => ({
    name: CATALOG[item.sku].name,
    qty: item.qty,
    price: CATALOG[item.sku].price,
  }));

  const total = receipt.reduce((s, r) => s + r.price * r.qty, 0);
  const tax = total * 0.08;
  return { orderId: 'ORD-' + Date.now(), total: total + tax, tax };
}

// ---- Banking: falsy zero trap ------------------------------------------------
function bankingTransfer(body) {
  const amount = Number(body.amount) || 0;
  const accountTier = body.accountTier;

  const tierTable = {
    premium: { label: 'Premium', rate: 0 },
    standard: { label: 'Standard', rate: 2.5 },
    basic: { label: 'Basic', rate: 4.99 },
  };
  const waivedSchedules = {}; // populated per-promotion; empty this cycle

  const tier = tierTable[accountTier];
  // BUG: premium's fee rate is a legitimate 0, but `!tier.rate` treats it as
  // "missing" and falls through to an empty waived-schedule map -> undefined.
  const schedule = tier.rate ? tier : waivedSchedules[accountTier];
  const fee = (amount * schedule.rate) / 100;

  return { transferId: 'TXN-' + Date.now(), amount, fee };
}

// ---- Financial Services: map key mismatch ------------------------------------
function tradingExecute(body) {
  const quantity = Number(body.quantity) || 0;
  const price = Number(body.price) || 0;

  const feeTiers = new Map([
    ['TIER_1', { fees: 0.005 }],
    ['TIER_2', { fees: 0.0035 }],
    ['TIER_3', { fees: 0.001 }],
  ]);

  // BUG: the UI sends tierId "1"/"2"/"3" but the fee table is keyed
  // "TIER_1"/… — the Map lookup misses and returns null.
  const tier = feeTiers.get(body.tierId) ?? null;
  const commission = quantity * price * tier.fees;

  return { tradeId: 'TRD-' + Date.now(), commission };
}

// ---- Insurance: wrong destructure --------------------------------------------
function insuranceClaim(body) {
  const policyIndex = new Map([
    ['POL_5001', { policy: { deductible: 500, limit: 25000 } }],
    ['POL_5002', { policy: { deductible: 1000, limit: 400000 } }],
  ]);

  // BUG: policy ids arrive hyphenated ("POL-5001") but are stored with
  // underscores; the record is null and destructuring its `.policy` throws.
  const record = policyIndex.get(body.policyId) ?? null;
  const { deductible, limit } = record.policy;

  const payout = Math.min(Number(body.amount) || 0, limit) - deductible;
  return { claimId: 'CLM-' + Date.now(), payout };
}

// ---- CPG: forEach undefined --------------------------------------------------
function cpgOrder(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  const warehouses = {
    NORTHEAST: { code: 'WH-NE' },
    SOUTHEAST: { code: 'WH-SE' },
    CENTRAL: { code: 'WH-CE' },
    PACIFIC: { code: 'WH-PC' },
  };

  const routed = [];
  items.forEach((line) => {
    // BUG: fulfillmentZone comes through lowercased ("southeast") but the
    // warehouse map is keyed by uppercase codes -> undefined.code.
    const warehouse = warehouses[body.fulfillmentZone];
    routed.push({ sku: line.sku, qty: line.qty, warehouse: warehouse.code });
  });

  return { orderId: 'PO-' + Date.now(), lines: routed.length };
}

// ---- High Tech: indexOf -1 ---------------------------------------------------
function licensesProvision(body) {
  const seats = Number(body.seats) || 0;
  const plans = [
    { tier: 'ENT', pricePerSeat: 50 },
    { tier: 'BIZ', pricePerSeat: 30 },
    { tier: 'STARTER', pricePerSeat: 12 },
  ];

  // BUG: the request sends the long tier name ("enterprise") but the catalog
  // stores short codes; indexOf returns -1 and plans[-1] is undefined.
  const names = plans.map((p) => p.tier);
  const idx = names.indexOf(body.planName);
  const plan = plans[idx];

  const total = seats * plan.pricePerSeat;
  return { licenseId: 'LIC-' + Date.now(), seats, total };
}

// ---- Industrials: case mismatch ----------------------------------------------
function maintenanceWorkorder(body) {
  const hours = Number(body.estimatedHours) || 0;
  const laborRates = {
    rotating: { rates: { preventive: 90, corrective: 140, emergency: 220, inspection: 60 } },
    static: { rates: { preventive: 75, corrective: 120, emergency: 190, inspection: 55 } },
    electrical: { rates: { preventive: 110, corrective: 160, emergency: 260, inspection: 70 } },
  };

  // BUG: equipmentCategory arrives capitalized ("Rotating") but the rate table
  // is keyed lowercase -> undefined.rates.
  const category = laborRates[body.equipmentCategory];
  const rate = category.rates[body.issueType];

  const labor = rate * hours;
  return { workOrderId: 'WO-' + Date.now(), labor };
}

// ---- Health Care: date off-by-one --------------------------------------------
function healthcareAppointment(body) {
  // Copays are published for the clinic's Mon–Fri business week (5 slots).
  const businessWeek = [
    { copayAmount: 25 },
    { copayAmount: 25 },
    { copayAmount: 30 },
    { copayAmount: 30 },
    { copayAmount: 35 },
  ];

  const d = new Date((body.appointmentDate || '') + 'T00:00:00Z');
  // BUG: the schedule should be indexed by the weekday offset (0–4), but the
  // code indexes with the calendar day-of-month — an off-by-one that runs off
  // the end of the array and yields null for any real appointment date.
  const slot = businessWeek[d.getUTCDate()] ?? null;
  const copay = slot.copayAmount;

  return { appointmentId: 'APT-' + Date.now(), copay };
}

// ---- Telco: regex mismatch ---------------------------------------------------
function telcoUpgrade(body) {
  const planCatalog = {
    PLUS: { monthlyRate: 45 },
    ULTRA: { monthlyRate: 65 },
    UNLIMITED: { monthlyRate: 85 },
    FAMILY: { monthlyRate: 55 },
  };

  // BUG: plan codes look like "PLUS-24" (hyphen) but the parser expects an
  // underscore separator, so the family capture never matches and the catalog
  // lookup returns undefined.
  const match = /^([A-Z]+)_\d+$/.exec(body.targetPlanCode || '');
  const family = match ? match[1] : '';
  const plan = planCatalog[family];

  const monthly = plan.monthlyRate;
  return { subscriptionId: 'SUB-' + Date.now(), monthly };
}

const VERTICALS = [
  {
    id: 'retail', name: 'Retail eCommerce', brand: 'ACME Commerce', path: '/retail',
    icon: '\u{1F6D2}', color: '#c8a97e', endpoint: '/api/storefront/checkout',
    service: 'storefront-api', environment: 'production',
    culprit: 'services/checkout.js - formatReceipt', code: 'INTERNAL_ERROR',
    bug: 'Promo SKU crash', handler: retailCheckout,
  },
  {
    id: 'banking', name: 'Banking', brand: 'Apex Bank', path: '/banking',
    icon: '\u{1F3E6}', color: '#2E86AB', endpoint: '/api/banking/transfer',
    service: 'banking-api', environment: 'production',
    culprit: 'services/transfer.js - calculateFee', code: 'INTERNAL_ERROR',
    bug: 'Falsy zero trap', handler: bankingTransfer,
  },
  {
    id: 'financial-services', name: 'Financial Services', brand: 'Meridian Capital', path: '/financial-services',
    icon: '\u{1F4C8}', color: '#1B998B', endpoint: '/api/trading/execute',
    service: 'trading-api', environment: 'production',
    culprit: 'services/trade.js - computeCommission', code: 'TRADE_FAILED',
    bug: 'Map key mismatch', handler: tradingExecute,
  },
  {
    id: 'insurance', name: 'Insurance', brand: 'Shield Insurance', path: '/insurance',
    icon: '\u{1F6E1}\uFE0F', color: '#E84855', endpoint: '/api/insurance/claim',
    service: 'claims-api', environment: 'production',
    culprit: 'services/claim.js - assessClaim', code: 'CLAIM_FAILED',
    bug: 'Wrong destructure', handler: insuranceClaim,
  },
  {
    id: 'cpg', name: 'CPG', brand: 'Harvest Goods', path: '/cpg',
    icon: '\u{1F4E6}', color: '#F18F01', endpoint: '/api/cpg/order',
    service: 'distributor-api', environment: 'production',
    culprit: 'services/order.js - routeWarehouses', code: 'ORDER_FAILED',
    bug: 'forEach undefined', handler: cpgOrder,
  },
  {
    id: 'hightech', name: 'High Tech', brand: 'NovaSoft', path: '/hightech',
    icon: '\u{1F4BB}', color: '#7B2CBF', endpoint: '/api/licenses/provision',
    service: 'licensing-api', environment: 'production',
    culprit: 'services/license.js - priceProvision', code: 'PROVISION_FAILED',
    bug: 'indexOf -1', handler: licensesProvision,
  },
  {
    id: 'industrials', name: 'Industrials', brand: 'Titan Manufacturing', path: '/industrials',
    icon: '\u{1F3ED}', color: '#6C757D', endpoint: '/api/maintenance/workorder',
    service: 'maintenance-api', environment: 'production',
    culprit: 'services/workorder.js - estimateLabor', code: 'WORKORDER_FAILED',
    bug: 'Case mismatch', handler: maintenanceWorkorder,
  },
  {
    id: 'healthcare', name: 'Health Care', brand: 'CarePoint Health', path: '/healthcare',
    icon: '\u{1F3E5}', color: '#06D6A0', endpoint: '/api/healthcare/appointment',
    service: 'scheduling-api', environment: 'production',
    culprit: 'services/appointment.js - resolveCopay', code: 'APPOINTMENT_FAILED',
    bug: 'Date off-by-one', handler: healthcareAppointment,
  },
  {
    id: 'telco', name: 'Telco', brand: 'WaveConnect', path: '/telco',
    icon: '\u{1F4F1}', color: '#118AB2', endpoint: '/api/telco/upgrade',
    service: 'billing-api', environment: 'production',
    culprit: 'services/upgrade.js - lookupPlan', code: 'UPGRADE_FAILED',
    bug: 'Regex mismatch', handler: telcoUpgrade,
  },
];

const BY_ENDPOINT = new Map(VERTICALS.map((v) => [v.endpoint, v]));
const BY_ID = new Map(VERTICALS.map((v) => [v.id, v]));

module.exports = { VERTICALS, BY_ENDPOINT, BY_ID };
