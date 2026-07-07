'use strict';

const crypto = require('crypto');
const config = require('./config');
const logger = require('./logger');

function slug(s) {
  return String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function shortHash(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
}

/**
 * Resolve a viewer's org/user into Devin identifiers used to attribute the
 * session that the pipeline creates.
 *
 * A production integration would resolve names/emails against an enterprise
 * admin API. This demo supports that via env-configured defaults and otherwise
 * derives stable placeholder ids so the flow works without extra credentials.
 */
async function resolveIdentity({ orgName, orgId, email }) {
  const result = {};

  // Locked / preconfigured org wins.
  if (config.lockOrg && config.defaultOrgId) {
    result.orgId = config.defaultOrgId;
  } else if (orgId) {
    result.orgId = orgId;
  } else if (orgName) {
    result.orgId = config.defaultOrgId || 'org_' + shortHash('org:' + slug(orgName));
  }

  if (!result.orgId) {
    const err = new Error('Org name is required');
    err.field = 'orgName';
    throw err;
  }

  if (config.lockUser && config.defaultUserId) {
    result.userId = config.defaultUserId;
  } else if (email) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      const err = new Error('Enter a valid email');
      err.field = 'email';
      throw err;
    }
    result.userId = 'usr_' + shortHash('user:' + email.trim().toLowerCase());
  }

  logger.info('Resolved identity', { orgId: result.orgId, hasUser: !!result.userId });
  return result;
}

module.exports = { resolveIdentity };
