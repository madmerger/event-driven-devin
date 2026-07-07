'use strict';

const config = require('./config');

/**
 * A tiny rolling-window limiter for Devin session creation. In-memory only —
 * a real deployment would use a shared store and proper deduplication.
 */
const timestamps = [];

function prune(now) {
  const windowMs = config.sessionCapWindowMinutes * 60 * 1000;
  while (timestamps.length && now - timestamps[0] > windowMs) {
    timestamps.shift();
  }
}

function stats() {
  const now = Date.now();
  prune(now);
  const current = timestamps.length;
  const remaining = Math.max(config.sessionCapMax - current, 0);
  const oldest = timestamps.length ? timestamps[0] : null;
  return {
    current,
    max: config.sessionCapMax,
    remaining,
    windowMinutes: config.sessionCapWindowMinutes,
    oldestSessionAgeSeconds: oldest ? Math.floor((now - oldest) / 1000) : null,
  };
}

/** Try to reserve a slot. Returns true if allowed, false if capped. */
function tryReserve() {
  const now = Date.now();
  prune(now);
  if (timestamps.length >= config.sessionCapMax) return false;
  timestamps.push(now);
  return true;
}

module.exports = { stats, tryReserve };
