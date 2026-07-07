'use strict';

const config = require('./config');
const logger = require('./logger');
const sessionCap = require('./sessionCap');

/** In-memory counters standing in for a real metrics backend. */
const metrics = Object.create(null);
function incrementMetric(name, tags) {
  const key = name + (tags ? ' ' + JSON.stringify(tags) : '');
  metrics[key] = (metrics[key] || 0) + 1;
  logger.info('metric', { metric: name, tags: tags || {}, value: metrics[key] });
}

/** Capture the exception in an error tracker (Sentry-style). Best-effort. */
async function captureException(alert) {
  if (!config.sentryDsn) {
    logger.info('sentry.capture (simulated — no DSN)', {
      errorClass: alert.errorClass,
      culprit: alert.culprit,
      requestId: alert.requestId,
    });
    return;
  }
  // A real integration would use the Sentry SDK. Kept intentionally minimal.
  logger.info('sentry.capture', { errorClass: alert.errorClass, requestId: alert.requestId });
}

/** Post a rich, human-readable alert to a chat channel. Best-effort. */
async function postChatAlert(alert) {
  const text =
    `:rotating_light: *${alert.title}*\n` +
    `*Service:* ${alert.service}  *Env:* ${alert.environment}\n` +
    `*Culprit:* \`${alert.culprit}\`\n` +
    `*Error:* ${alert.errorClass} — ${alert.message}\n` +
    `*Request:* ${alert.requestId}`;

  if (!config.slackWebhookUrl) {
    logger.info('chat.alert (simulated — no webhook)', { title: alert.title });
    return;
  }
  try {
    await fetch(config.slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    logger.info('chat.alert posted', { title: alert.title });
  } catch (e) {
    logger.error('chat.alert failed', { error: e.message });
  }
}

/** The investigation prompt is the most important context Devin receives. */
function buildPrompt(alert) {
  const lines = [
    `A production incident just fired in the ${alert.service} service (${alert.environment}).`,
    '',
    `Error: ${alert.errorClass}: ${alert.message}`,
    `Likely culprit: ${alert.culprit}`,
    `Request ID: ${alert.requestId}`,
  ];
  if (alert.tags) lines.push(`Tags: ${JSON.stringify(alert.tags)}`);
  if (alert.context) lines.push(`Context: ${JSON.stringify(alert.context)}`);
  lines.push(
    '',
    'Please investigate autonomously:',
    '1. Read the telemetry above and locate the failing code path.',
    '2. Determine the root cause of the exception.',
    '3. Implement a minimal, correct fix with a regression test.',
    '4. Open a pull request describing the root cause and the fix.',
  );
  return lines.join('\n');
}

/** Create a Devin session via the REST API. Returns { sessionId, url } or null. */
async function triggerAI(alert) {
  if (config.simulate || !config.devinApiKey) {
    logger.info('devin.session (simulated)', {
      reason: config.simulate ? 'SIMULATE_PIPELINE' : 'no DEVIN_API_KEY',
      orgId: alert.devinOrgId || null,
      prompt: buildPrompt(alert),
    });
    return { simulated: true };
  }

  if (!sessionCap.tryReserve()) {
    logger.warn('devin.session skipped — session cap reached', sessionCap.stats());
    return { capped: true };
  }

  try {
    const res = await fetch(config.devinApiBase.replace(/\/$/, '') + '/v1/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + config.devinApiKey,
      },
      body: JSON.stringify({
        prompt: buildPrompt(alert),
        title: alert.title,
        tags: ['event-driven-demo', alert.service],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      logger.error('devin.session failed', { status: res.status, body: data });
      return { error: true };
    }
    const sessionId = data.session_id || data.sessionId;
    const url = data.url || (sessionId ? `https://app.devin.ai/sessions/${String(sessionId).replace(/^devin-/, '')}` : null);
    logger.info('devin.session created', { sessionId, url });
    return { sessionId, url };
  } catch (e) {
    logger.error('devin.session error', { error: e.message });
    return { error: true };
  }
}

/**
 * On failure: record a metric, capture the exception, post a chat alert, and
 * trigger the AI engineer — all without blocking the request response.
 */
function createAlertAndTriggerAI(alert) {
  incrementMetric('action.failure', { route: alert.route, errorClass: alert.errorClass });
  return Promise.allSettled([
    captureException(alert),
    postChatAlert(alert),
    triggerAI(alert),
  ]).then((results) => {
    for (const r of results) {
      if (r.status === 'rejected') {
        logger.error('Remediation pipeline step failed', { reason: String(r.reason) });
      }
    }
  });
}

module.exports = { createAlertAndTriggerAI, buildPrompt };
