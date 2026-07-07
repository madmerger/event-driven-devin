'use strict';

/** Minimal structured JSON logger. */
function log(level, msg, extra) {
  const entry = Object.assign(
    { ts: new Date().toISOString(), level, msg },
    extra || {}
  );
  const line = JSON.stringify(entry);
  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

module.exports = {
  info: (msg, extra) => log('info', msg, extra),
  warn: (msg, extra) => log('warn', msg, extra),
  error: (msg, extra) => log('error', msg, extra),
};
