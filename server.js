'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');

const config = require('./src/config');
const logger = require('./src/logger');
const sessionCap = require('./src/sessionCap');
const { resolveIdentity } = require('./src/identity');
const { createAlertAndTriggerAI } = require('./src/pipeline');
const { VERTICALS, BY_ID } = require('./src/verticals');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

const PUBLIC_DIR = path.join(__dirname, 'public');

function requestId() {
  return crypto.randomBytes(16).toString('hex');
}

// ---- Public config + metadata -----------------------------------------------
app.get('/api/config', (req, res) => res.json(config.publicConfig()));

app.get('/api/verticals', (req, res) => {
  res.json({
    verticals: VERTICALS.map((v) => ({
      id: v.id, name: v.name, brand: v.brand, path: v.path, icon: v.icon, color: v.color,
    })),
  });
});

app.get('/api/admin/session-stats', (req, res) => res.json(sessionCap.stats()));

// ---- Identity ----------------------------------------------------------------
app.post('/api/resolve-identity', async (req, res) => {
  try {
    const result = await resolveIdentity(req.body || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Resolution failed', field: err.field });
  }
});

// ---- Vertical "primary action" endpoints ------------------------------------
// Each performs its business action and fails on cue; the catch block records
// telemetry and fires the remediation pipeline without blocking the response.
function handleAction(vertical, req, res) {
  const rid = requestId();
  const body = req.body || {};
  try {
    const result = vertical.handler(body);
    res.json(Object.assign({ success: true }, result));
  } catch (error) {
    logger.error('Action failed', {
      route: vertical.endpoint,
      service: vertical.service,
      errorClass: error.name,
      message: error.message,
      requestId: rid,
    });

    createAlertAndTriggerAI({
      title: error.name + ': ' + error.message,
      route: vertical.endpoint,
      culprit: vertical.culprit,
      service: vertical.service,
      environment: vertical.environment,
      errorClass: error.name,
      message: error.message,
      requestId: rid,
      tags: { route: vertical.endpoint, service: vertical.service, environment: vertical.environment },
      context: { vertical: vertical.id, bug: vertical.bug },
      devinOrgId: body.devinOrgId || '',
      devinUserId: body.devinUserId || '',
      devinEmail: body.devinEmail || '',
    });

    res.status(500).json({
      success: false,
      error: error.message,
      errorClass: error.name,
      code: vertical.code,
      requestId: rid,
    });
  }
}

for (const vertical of VERTICALS) {
  app.post(vertical.endpoint, (req, res) => handleAction(vertical, req, res));
}

// ---- Static assets + pages ---------------------------------------------------
app.get(['/', '/hub.html'], (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'hub.html')));

app.get('/favicon.png', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'favicon.png')));
app.get('/session-cap-banner.js', (req, res) =>
  res.sendFile(path.join(PUBLIC_DIR, 'session-cap-banner.js'))
);

app.get('/:id', (req, res, next) => {
  const vertical = BY_ID.get(req.params.id);
  if (!vertical) return next();
  res.sendFile(path.join(PUBLIC_DIR, `${vertical.id}.html`));
});

app.use((req, res) => res.status(404).send('Not found'));

if (require.main === module) {
  app.listen(config.port, () => {
    logger.info('Event-Driven Devin demo listening', {
      port: config.port,
      simulate: config.simulate || !config.devinApiKey,
      verticals: VERTICALS.length,
    });
  });
}

module.exports = app;
