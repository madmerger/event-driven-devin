'use strict';

/**
 * Central configuration, all driven by environment variables so the demo runs
 * with zero secrets (everything degrades gracefully to a no-op / simulated
 * mode) but lights up fully when credentials are provided.
 */

function bool(v, def = false) {
  if (v === undefined || v === null || v === '') return def;
  return /^(1|true|yes|on)$/i.test(String(v));
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,

  // Devin API — used to resolve org/user identity and to create sessions.
  devinApiKey: process.env.DEVIN_API_KEY || '',
  devinApiBase: process.env.DEVIN_API_BASE || 'https://api.devin.ai',

  // Optional integrations.
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
  sentryDsn: process.env.SENTRY_DSN || '',

  // Public config surfaced at /api/config (mirrors the reference demo).
  appTitle: process.env.APP_TITLE || 'Event-Driven Devin',
  defaultOrgId: process.env.DEFAULT_ORG_ID || '',
  defaultOrgName: process.env.DEFAULT_ORG_NAME || '',
  defaultUserId: process.env.DEFAULT_USER_ID || '',
  lockOrg: bool(process.env.LOCK_ORG),
  lockUser: bool(process.env.LOCK_USER),

  // Global cap on Devin sessions created within a rolling window.
  sessionCapMax: parseInt(process.env.SESSION_CAP_MAX, 10) || 5,
  sessionCapWindowMinutes: parseInt(process.env.SESSION_CAP_WINDOW_MINUTES, 10) || 60,

  // When true, never actually call the Devin API — just log what would happen.
  simulate: bool(process.env.SIMULATE_PIPELINE),
};

config.publicConfig = function publicConfig() {
  return {
    defaultOrgId: config.defaultOrgId,
    defaultOrgName: config.defaultOrgName,
    defaultUserId: config.defaultUserId,
    lockOrg: config.lockOrg,
    lockUser: config.lockUser,
    appTitle: config.appTitle,
  };
};

module.exports = config;
