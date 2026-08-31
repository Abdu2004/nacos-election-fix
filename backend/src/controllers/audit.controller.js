const { query } = require('../config/db');
const AppError = require('../utils/AppError');
const { sendSuccess, sendPaginated } = require('../utils/response');

// ==============================================================================
// 1. LIST AUDIT LOGS (Administrator Only)
// ==============================================================================

/**
 * List audit records with extensive filtering and pagination.
 * GET /api/v1/audit-logs
 */
async function listAuditLogs(req, res, next) {
  const {
    action,
    userEmail,
    userRole,
    entityType,
    startDate,
    endDate,
    search
  } = req.query;

  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (action) {
    params.push(action.toUpperCase().trim());
    conditions.push(`a.action = $${params.length}`);
  }

  if (userEmail) {
    params.push(`%${userEmail.toLowerCase().trim()}%`);
    conditions.push(`LOWER(a.user_email) LIKE $${params.length}`);
  }

  if (userRole) {
    params.push(userRole.toUpperCase().trim());
    conditions.push(`a.user_role = $${params.length}`);
  }

  if (entityType) {
    params.push(entityType.toLowerCase().trim());
    conditions.push(`a.entity_type = $${params.length}`);
  }

  if (startDate) {
    const parsedStart = new Date(startDate);
    if (!isNaN(parsedStart.getTime())) {
      params.push(parsedStart);
      conditions.push(`a.created_at >= $${params.length}`);
    }
  }

  if (endDate) {
    const parsedEnd = new Date(endDate);
    if (!isNaN(parsedEnd.getTime())) {
      params.push(parsedEnd);
      conditions.push(`a.created_at <= $${params.length}`);
    }
  }

  if (search) {
    params.push(`%${search.toLowerCase().trim()}%`);
    conditions.push(`(LOWER(a.action) LIKE $${params.length} OR LOWER(a.user_email) LIKE $${params.length} OR LOWER(COALESCE(a.entity_id, '')) LIKE $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM audit_logs a ${whereClause};`;
  const countRes = await query(countSql, params);
  const totalCount = parseInt(countRes.rows[0].total, 10);

  const dataParams = [...params, limit, offset];
  const dataSql = `
    SELECT 
      a.id,
      a.user_id,
      a.user_email,
      a.user_role,
      a.action,
      a.entity_type,
      a.entity_id,
      a.details,
      a.ip_address,
      a.user_agent,
      a.created_at
    FROM audit_logs a
    ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length};
  `;

  const logsRes = await query(dataSql, dataParams);

  return sendPaginated(res, logsRes.rows, totalCount, page, limit, 'Audit logs retrieved successfully.');
}

// ==============================================================================
// 2. GET SINGLE AUDIT RECORD (Administrator Only)
// ==============================================================================

/**
 * Get detailed audit log entry.
 * GET /api/v1/audit-logs/:id
 */
async function getAuditLogById(req, res, next) {
  const { id } = req.params;

  const logRes = await query('SELECT * FROM audit_logs WHERE id = $1', [id]);
  if (logRes.rows.length === 0) {
    return next(new AppError('Audit record not found.', 404, 'AUDIT_RECORD_NOT_FOUND'));
  }

  return sendSuccess(res, { auditLog: logRes.rows[0] }, 'Audit record retrieved.');
}

// ==============================================================================
// 3. GET AUDIT SUMMARY (Administrator Only)
// ==============================================================================

/**
 * Get audit statistics and distribution breakdown.
 * GET /api/v1/audit-logs/summary
 */
async function getAuditSummary(req, res, next) {
  const totalRes = await query('SELECT COUNT(*) as total FROM audit_logs');
  const totalLogs = parseInt(totalRes.rows[0].total, 10);

  const topActionsRes = await query(`
    SELECT action, COUNT(*) as count 
    FROM audit_logs 
    GROUP BY action 
    ORDER BY count DESC 
    LIMIT 10;
  `);

  const roleDistributionRes = await query(`
    SELECT COALESCE(user_role, 'SYSTEM') as role, COUNT(*) as count 
    FROM audit_logs 
    GROUP BY user_role 
    ORDER BY count DESC;
  `);

  const securityEventsRes = await query(`
    SELECT COUNT(*) as security_alerts 
    FROM audit_logs 
    WHERE action IN ('UNAUTHORIZED_ACCESS_ATTEMPT', 'OTP_MAX_ATTEMPTS_EXCEEDED', 'FAILED_LOGIN_ATTEMPT');
  `);

  return sendSuccess(res, {
    totalLogs,
    topActions: topActionsRes.rows,
    roleDistribution: roleDistributionRes.rows,
    securityAlertsCount: parseInt(securityEventsRes.rows[0].security_alerts, 10)
  }, 'Audit summary statistics retrieved.');
}

// ==============================================================================
// 4. EXPORT AUDIT LOGS (Administrator Only)
// ==============================================================================

/**
 * Export audit records as CSV or JSON format.
 * GET /api/v1/audit-logs/export
 */
async function exportAuditLogs(req, res, next) {
  const { format = 'json', action, startDate, endDate } = req.query;

  const conditions = [];
  const params = [];

  if (action) {
    params.push(action.toUpperCase().trim());
    conditions.push(`a.action = $${params.length}`);
  }

  if (startDate) {
    const parsedStart = new Date(startDate);
    if (!isNaN(parsedStart.getTime())) {
      params.push(parsedStart);
      conditions.push(`a.created_at >= $${params.length}`);
    }
  }

  if (endDate) {
    const parsedEnd = new Date(endDate);
    if (!isNaN(parsedEnd.getTime())) {
      params.push(parsedEnd);
      conditions.push(`a.created_at <= $${params.length}`);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT 
      a.id,
      a.user_id,
      a.user_email,
      a.user_role,
      a.action,
      a.entity_type,
      a.entity_id,
      a.details,
      a.ip_address,
      a.user_agent,
      a.created_at
    FROM audit_logs a
    ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT 5000;
  `;

  const logsRes = await query(sql, params);
  const records = logsRes.rows;

  if (format.toLowerCase() === 'csv') {
    // Generate CSV
    const headers = ['ID', 'Timestamp', 'Action', 'User Email', 'User Role', 'Entity Type', 'Entity ID', 'IP Address', 'Details'];
    const rows = records.map(r => [
      r.id,
      r.created_at,
      r.action,
      r.user_email || '',
      r.user_role || '',
      r.entity_type || '',
      r.entity_id || '',
      r.ip_address || '',
      JSON.stringify(r.details || {}).replace(/"/g, '""')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${Date.now()}.csv"`);
    return res.send(csvContent);
  }

  // JSON export
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${Date.now()}.json"`);
  return res.json({
    exportedAt: new Date().toISOString(),
    totalRecords: records.length,
    logs: records
  });
}

module.exports = {
  listAuditLogs,
  getAuditLogById,
  getAuditSummary,
  exportAuditLogs
};
