const { query, withTransaction } = require('../config/db');
const { hashPassword } = require('../utils/crypto');
const AppError = require('../utils/AppError');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/response');
const AuditService = require('../services/auditService');

/**
 * List all users with filtering and pagination
 * GET /api/v1/admin/users
 */
async function listUsers(req, res, next) {
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const offset = (page - 1) * limit;

  const { role, verificationStatus, status, search } = req.query;

  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (role) {
    conditions.push(`role = $${paramIdx++}`);
    params.push(role);
  }

  if (verificationStatus) {
    conditions.push(`verification_status = $${paramIdx++}`);
    params.push(verificationStatus);
  }

  if (status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }

  if (search) {
    conditions.push(`(full_name ILIKE $${paramIdx} OR email ILIKE $${paramIdx} OR admission_number ILIKE $${paramIdx})`);
    params.push(`%${search.trim()}%`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total matching
  const countSql = `SELECT COUNT(*) as total FROM users ${whereClause};`;
  const countRes = await query(countSql, params);
  const totalCount = parseInt(countRes.rows[0].total, 10);

  // Fetch paginated data
  const dataSql = `
    SELECT id, full_name, admission_number, email, role, is_verified, verification_status, status, created_at, updated_at
    FROM users
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++};
  `;
  params.push(limit, offset);

  const dataRes = await query(dataSql, params);

  return sendPaginated(res, dataRes.rows, totalCount, page, limit, 'Users retrieved successfully.');
}

/**
 * Get user by ID
 * GET /api/v1/admin/users/:id
 */
async function getUserById(req, res, next) {
  const { id } = req.params;

  const userRes = await query(`
    SELECT id, full_name, admission_number, email, role, is_verified, verification_status, status, created_at, updated_at
    FROM users WHERE id = $1;
  `, [id]);

  if (userRes.rows.length === 0) {
    return next(new AppError('User not found.', 404, 'USER_NOT_FOUND'));
  }

  return sendSuccess(res, { user: userRes.rows[0] });
}

/**
 * Create a new user with any role (Administrator, Validator, Voter, Candidate)
 * POST /api/v1/admin/users
 */
async function createUser(req, res, next) {
  const { fullName, admissionNumber, email, password, role = 'VOTER', isVerified = true } = req.body;

  if (!fullName || !admissionNumber || !email || !password) {
    return next(new AppError('Full name, admission number, email, and password are required.', 400, 'MISSING_FIELDS'));
  }

  const validRoles = ['ADMINISTRATOR', 'VALIDATOR', 'VOTER', 'CANDIDATE'];
  const normalizedRole = (role || 'VOTER').toUpperCase().trim();
  if (!validRoles.includes(normalizedRole)) {
    return next(new AppError(`Invalid role '${role}'. Allowed: ${validRoles.join(', ')}`, 400, 'INVALID_ROLE'));
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedAdmission = admissionNumber.trim().toUpperCase();

  // Check duplicate email
  const emailRes = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (emailRes.rows.length > 0) {
    return next(new AppError('An account with this email already exists.', 409, 'DUPLICATE_EMAIL'));
  }

  // Check duplicate admission number
  const admRes = await query('SELECT id FROM users WHERE admission_number = $1', [normalizedAdmission]);
  if (admRes.rows.length > 0) {
    return next(new AppError('An account with this admission number already exists.', 409, 'DUPLICATE_ADMISSION_NUMBER'));
  }

  const passwordHash = await hashPassword(password);
  const verificationStatus = isVerified ? 'APPROVED' : 'PENDING';

  const insertSql = `
    INSERT INTO users (
      full_name, admission_number, email, password_hash, role, is_verified, verification_status, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
    RETURNING id, full_name, admission_number, email, role, is_verified, verification_status, status, created_at;
  `;

  const userRes = await query(insertSql, [
    fullName.trim(),
    normalizedAdmission,
    normalizedEmail,
    passwordHash,
    normalizedRole,
    Boolean(isVerified),
    verificationStatus
  ]);

  const newUser = userRes.rows[0];

  // Audit user creation
  await AuditService.log({
    action: 'ADMIN_USER_CREATED',
    userId: req.user.id,
    userEmail: req.user.email,
    userRole: req.user.role,
    entityType: 'user',
    entityId: newUser.id,
    details: {
      userEmail: newUser.email,
      userRole: newUser.role,
      admissionNumber: newUser.admission_number
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendCreated(res, { user: newUser }, `User account created successfully with role ${normalizedRole}.`);
}

/**
 * Delete a user account and associated records
 * DELETE /api/v1/admin/users/:id
 */
async function deleteUser(req, res, next) {
  const { id } = req.params;

  if (req.user.id === id) {
    return next(new AppError('You cannot delete your own administrator account.', 400, 'CANNOT_DELETE_SELF'));
  }

  const userRes = await query('SELECT id, email, full_name, role FROM users WHERE id = $1;', [id]);
  if (userRes.rows.length === 0) {
    return next(new AppError('User not found.', 404, 'USER_NOT_FOUND'));
  }

  const targetUser = userRes.rows[0];

  await withTransaction(async (client) => {
    // Delete ballots & votes
    const ballotsRes = await client.query('SELECT id FROM ballots WHERE voter_id = $1;', [id]);
    for (const b of ballotsRes.rows) {
      await client.query('DELETE FROM votes WHERE ballot_id = $1;', [b.id]);
    }
    await client.query('DELETE FROM ballots WHERE voter_id = $1;', [id]);

    // Delete candidate references
    await client.query('DELETE FROM votes WHERE candidate_id IN (SELECT id FROM candidates WHERE user_id = $1);', [id]);
    await client.query('DELETE FROM candidates WHERE user_id = $1;', [id]);
    await client.query('DELETE FROM candidate_applications WHERE user_id = $1;', [id]);

    // Delete notifications & audit logs for user
    await client.query('DELETE FROM notifications WHERE user_id = $1;', [id]);
    await client.query('DELETE FROM audit_logs WHERE user_id = $1;', [id]);
    await client.query('DELETE FROM otp_verifications WHERE email = $1;', [targetUser.email]);

    // Delete user
    await client.query('DELETE FROM users WHERE id = $1;', [id]);
  });

  // Audit User Deletion
  await AuditService.log({
    action: 'USER_DELETED',
    userId: req.user.id,
    userEmail: req.user.email,
    userRole: req.user.role,
    entityType: 'user',
    entityId: id,
    details: {
      deletedEmail: targetUser.email,
      deletedName: targetUser.full_name,
      deletedRole: targetUser.role
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendSuccess(res, { id, email: targetUser.email }, 'User account successfully deleted.');
}

/**
 * Delete an election and all associated records (Positions, ballots, votes, applications)
 * DELETE /api/v1/admin/elections/:id
 */
async function deleteElection(req, res, next) {
  const { id } = req.params;

  const electRes = await query('SELECT id, title, status FROM elections WHERE id = $1;', [id]);
  if (electRes.rows.length === 0) {
    return next(new AppError('Election not found.', 404, 'ELECTION_NOT_FOUND'));
  }

  const targetElection = electRes.rows[0];

  await withTransaction(async (client) => {
    // 1. Delete calculated results & votes
    await client.query('DELETE FROM results WHERE election_id = $1;', [id]);
    await client.query('DELETE FROM votes WHERE election_id = $1;', [id]);

    // 2. Delete ballots
    await client.query('DELETE FROM ballots WHERE election_id = $1;', [id]);

    // 3. Delete candidate applications & candidates
    await client.query('DELETE FROM candidates WHERE election_id = $1;', [id]);
    await client.query('DELETE FROM candidate_applications WHERE election_id = $1;', [id]);

    // 4. Delete candidate codes
    await client.query('DELETE FROM candidate_codes WHERE election_id = $1;', [id]);

    // 5. Delete election positions
    await client.query('DELETE FROM election_positions WHERE election_id = $1;', [id]);

    // 6. Delete election
    await client.query('DELETE FROM elections WHERE id = $1;', [id]);
  });

  // Audit Election Deletion
  await AuditService.log({
    action: 'ELECTION_DELETED',
    userId: req.user.id,
    userEmail: req.user.email,
    userRole: req.user.role,
    entityType: 'election',
    entityId: id,
    details: {
      deletedElectionId: id,
      deletedTitle: targetElection.title,
      statusAtDeletion: targetElection.status
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendSuccess(res, { id, title: targetElection.title }, `Election '${targetElection.title}' successfully deleted.`);
}

/**
 * Update user role
 * PATCH /api/v1/admin/users/:id/role
 */
async function updateUserRole(req, res, next) {
  const { id } = req.params;
  const { role } = req.body;

  const validRoles = ['ADMINISTRATOR', 'VALIDATOR', 'VOTER', 'CANDIDATE'];
  if (!validRoles.includes(role)) {
    return next(new AppError(`Invalid role. Allowed roles: ${validRoles.join(', ')}`, 400, 'INVALID_ROLE'));
  }

  const userRes = await query('SELECT id, email, role FROM users WHERE id = $1;', [id]);
  if (userRes.rows.length === 0) {
    return next(new AppError('User not found.', 404, 'USER_NOT_FOUND'));
  }

  const targetUser = userRes.rows[0];
  const oldRole = targetUser.role;

  const updateRes = await query(`
    UPDATE users 
    SET role = $1, updated_at = CURRENT_TIMESTAMP 
    WHERE id = $2
    RETURNING id, full_name, admission_number, email, role, is_verified, verification_status, status, updated_at;
  `, [role, id]);

  const updatedUser = updateRes.rows[0];

  // Audit Role Change
  await AuditService.log({
    action: 'USER_ROLE_CHANGED',
    userId: req.user.id,
    userEmail: req.user.email,
    userRole: req.user.role,
    entityType: 'user',
    entityId: id,
    details: {
      targetEmail: targetUser.email,
      oldRole,
      newRole: role
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendSuccess(res, { user: updatedUser }, `User role updated to ${role}.`);
}

/**
 * Update user account status (ACTIVE, SUSPENDED, DEACTIVATED)
 * PATCH /api/v1/admin/users/:id/status
 */
async function updateUserStatus(req, res, next) {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'];
  if (!validStatuses.includes(status)) {
    return next(new AppError(`Invalid status. Allowed: ${validStatuses.join(', ')}`, 400, 'INVALID_STATUS'));
  }

  const userRes = await query('SELECT id, email, status FROM users WHERE id = $1;', [id]);
  if (userRes.rows.length === 0) {
    return next(new AppError('User not found.', 404, 'USER_NOT_FOUND'));
  }

  const targetUser = userRes.rows[0];
  const oldStatus = targetUser.status;

  const updateRes = await query(`
    UPDATE users 
    SET status = $1, updated_at = CURRENT_TIMESTAMP 
    WHERE id = $2
    RETURNING id, full_name, admission_number, email, role, is_verified, verification_status, status, updated_at;
  `, [status, id]);

  const updatedUser = updateRes.rows[0];

  // Audit Status Change
  await AuditService.log({
    action: 'USER_STATUS_CHANGED',
    userId: req.user.id,
    userEmail: req.user.email,
    userRole: req.user.role,
    entityType: 'user',
    entityId: id,
    details: {
      targetEmail: targetUser.email,
      oldStatus,
      newStatus: status
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendSuccess(res, { user: updatedUser }, `User status updated to ${status}.`);
}

/**
 * Get aggregated system statistics for Admin Dashboard overview
 * GET /api/v1/admin/stats
 */
async function getSystemStats(req, res) {
  const statsRes = await query(`
    SELECT
      COUNT(*) as total_users,
      COUNT(*) FILTER (WHERE role = 'VOTER') as total_voters,
      COUNT(*) FILTER (WHERE role = 'VALIDATOR') as total_validators,
      COUNT(*) FILTER (WHERE role = 'CANDIDATE') as total_candidates
    FROM users;
  `);

  return sendSuccess(res, { stats: statsRes.rows[0] }, 'System statistics retrieved.');
}

/**
 * Create a new Staff account (ADMINISTRATOR or VALIDATOR)
 * POST /api/v1/admin/users/create-staff
 */
async function createStaffUser(req, res, next) {
  return createUser(req, res, next);
}

module.exports = {
  listUsers,
  getUserById,
  createUser,
  deleteUser,
  deleteElection,
  createStaffUser,
  updateUserRole,
  updateUserStatus,
  getSystemStats
};

