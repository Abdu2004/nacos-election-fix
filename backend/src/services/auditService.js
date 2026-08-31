const { query } = require('../config/db');

// Sensitive keys to always redact from audit logs
const REDACTED_KEYS = new Set([
  'password',
  'password_hash',
  'passwordConfirm',
  'otp',
  'otp_hash',
  'token',
  'jwt',
  'secret',
  'apiKey',
  'smtpPass',
  'credentials'
]);

/**
 * Sanitize an object to ensure no sensitive fields are stored in audit logs
 * @param {object} obj
 * @returns {object}
 */
function sanitizeAuditDetails(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeAuditDetails);

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (REDACTED_KEYS.has(key) || key.toLowerCase().includes('password') || key.toLowerCase().includes('otp')) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeAuditDetails(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Audit Logging Service
 */
class AuditService {
  /**
   * Record a sensitive action to the audit_logs table
   * @param {object} params
   * @param {string} params.action - e.g. 'USER_REGISTERED', 'VOTER_APPROVED', 'BALLOT_SUBMITTED'
   * @param {string} [params.userId] - User ID who performed or triggered the action
   * @param {string} [params.userEmail] - Email of the user
   * @param {string} [params.userRole] - Role of the user
   * @param {string} [params.entityType] - e.g. 'user', 'election', 'candidate', 'ballot'
   * @param {string} [params.entityId] - Target entity ID
   * @param {object} [params.details] - Non-sensitive metadata details
   * @param {string} [params.ipAddress] - Client IP address
   * @param {string} [params.userAgent] - Client User-Agent
   * @param {import('pg').PoolClient} [params.client] - Optional transactional client
   */
  static async log({
    action,
    userId = null,
    userEmail = null,
    userRole = null,
    entityType = null,
    entityId = null,
    details = null,
    ipAddress = null,
    userAgent = null,
    client = null
  }) {
    const sanitizedDetails = details ? sanitizeAuditDetails(details) : null;
    const sql = `
      INSERT INTO audit_logs (
        user_id, user_email, user_role, action, entity_type, entity_id, details, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, action, created_at;
    `;
    const params = [
      userId,
      userEmail,
      userRole,
      action,
      entityType,
      entityId ? String(entityId) : null,
      sanitizedDetails ? JSON.stringify(sanitizedDetails) : null,
      ipAddress,
      userAgent
    ];

    try {
      if (client) {
        return await client.query(sql, params);
      }
      return await query(sql, params);
    } catch (error) {
      // Never crash the primary flow if audit logging fails; log to console safely
      console.error(`[Audit Logging Warning] Failed to persist audit record for action '${action}':`, error.message);
      return null;
    }
  }

  static sanitizeDetails(obj) {
    return sanitizeAuditDetails(obj);
  }
}

module.exports = AuditService;
