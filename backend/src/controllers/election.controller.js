const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/response');
const AuditService = require('../services/auditService');

// ==============================================================================
// VALID STATUS TRANSITIONS
// ==============================================================================
const VALID_TRANSITIONS = {
  UPCOMING: ['OPEN'],
  OPEN: ['CLOSED'],
  CLOSED: ['RESULTS_PUBLISHED'],
  RESULTS_PUBLISHED: []
};

/**
 * Validate that the requested status transition is legal
 */
function validateStatusTransition(currentStatus, targetStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
}

// ==============================================================================
// 1. ELECTION CREATION (Administrator Only)
// ==============================================================================

/**
 * Create a new election with optional positions
 * POST /api/v1/elections
 */
async function createElection(req, res, next) {
  const { title, description, startDate, endDate, positionIds } = req.body;

  if (!title || !title.trim()) {
    return next(new AppError('Election title is required.', 400, 'ELECTION_TITLE_REQUIRED'));
  }

  const parsedStart = new Date(startDate);
  const parsedEnd = new Date(endDate);
  const now = new Date();

  if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
    return next(new AppError('Invalid start or end date provided.', 400, 'INVALID_DATE'));
  }

  if (parsedStart >= parsedEnd) {
    return next(new AppError('Election start date must be before the end date.', 400, 'INVALID_DATE_RANGE'));
  }

  const election = await withTransaction(async (client) => {
    // 1. Insert election
    const insertSql = `
      INSERT INTO elections (title, description, status, start_date, end_date, created_by)
      VALUES ($1, $2, 'UPCOMING', $3, $4, $5)
      RETURNING *;
    `;

    const electRes = await client.query(insertSql, [
      title.trim(),
      description ? description.trim() : null,
      parsedStart,
      parsedEnd,
      req.user.id
    ]);

    const election = electRes.rows[0];

    // 2. Optionally assign positions to election
    if (Array.isArray(positionIds) && positionIds.length > 0) {
      for (let i = 0; i < positionIds.length; i++) {
        await client.query(`
          INSERT INTO election_positions (election_id, position_id, display_order)
          VALUES ($1, $2, $3)
          ON CONFLICT (election_id, position_id) DO NOTHING;
        `, [election.id, positionIds[i], i + 1]);
      }
    }

    return election;
  });

  // 3. Fetch assigned positions for response
  const posRes = await query(`
    SELECT p.id, p.name, p.display_order, ep.max_votes
    FROM election_positions ep
    INNER JOIN positions p ON ep.position_id = p.id
    WHERE ep.election_id = $1
    ORDER BY ep.display_order ASC;
  `, [election.id]);

  await AuditService.log({
    action: 'ELECTION_CREATED',
    userId: req.user.id,
    userEmail: req.user.email,
    userRole: req.user.role,
    entityType: 'election',
    entityId: election.id,
    details: { title: election.title, startDate, endDate, positionCount: posRes.rows.length },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendCreated(res, {
    election: { ...election, positions: posRes.rows }
  }, 'Election created successfully with UPCOMING status.');
}

// ==============================================================================
// 2. ELECTION LISTING & DETAILS
// ==============================================================================

/**
 * List elections (optionally filtered by status)
 * GET /api/v1/elections
 */
async function listElections(req, res, next) {
  const { status } = req.query;
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (status) {
    const upperStatus = status.toUpperCase();
    const validStatuses = ['UPCOMING', 'OPEN', 'CLOSED', 'RESULTS_PUBLISHED'];
    if (!validStatuses.includes(upperStatus)) {
      return next(new AppError(`Invalid status filter '${status}'.`, 400, 'INVALID_STATUS_FILTER'));
    }
    params.push(upperStatus);
    conditions.push(`e.status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM elections e ${whereClause};`;
  const countRes = await query(countSql, params);
  const totalCount = parseInt(countRes.rows[0].total, 10);

  const dataParams = [...params, limit, offset];
  const dataSql = `
    SELECT 
      e.id,
      e.title,
      e.description,
      e.status,
      e.start_date,
      e.end_date,
      e.published_at,
      e.created_at,
      e.updated_at,
      creator.full_name as created_by_name,
      creator.email as created_by_email,
      (SELECT COUNT(*) FROM election_positions ep WHERE ep.election_id = e.id) as total_positions,
      (SELECT COUNT(*) FROM candidates c WHERE c.election_id = e.id AND c.status = 'APPROVED') as total_candidates
    FROM elections e
    LEFT JOIN users creator ON e.created_by = creator.id
    ${whereClause}
    ORDER BY e.created_at DESC
    LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length};
  `;

  const elecRes = await query(dataSql, dataParams);

  return sendPaginated(res, elecRes.rows, totalCount, page, limit, 'Elections retrieved successfully.');
}

/**
 * Get single election details with positions and candidates
 * GET /api/v1/elections/:id
 */
async function getElectionDetails(req, res, next) {
  const { id } = req.params;

  const electRes = await query(`
    SELECT 
      e.*,
      creator.full_name as created_by_name,
      creator.email as created_by_email,
      publisher.email as published_by_email
    FROM elections e
    LEFT JOIN users creator ON e.created_by = creator.id
    LEFT JOIN users publisher ON e.published_by = publisher.id
    WHERE e.id = $1;
  `, [id]);

  if (electRes.rows.length === 0) {
    return next(new AppError('Election not found.', 404, 'ELECTION_NOT_FOUND'));
  }

  const election = electRes.rows[0];

  // Get assigned positions
  const posRes = await query(`
    SELECT p.id, p.name, p.description, p.display_order, ep.max_votes, ep.display_order as election_display_order
    FROM election_positions ep
    INNER JOIN positions p ON ep.position_id = p.id
    WHERE ep.election_id = $1
    ORDER BY ep.display_order ASC;
  `, [id]);

  // Get approved candidate count per position
  const candCountRes = await query(`
    SELECT position_id, COUNT(*) as candidate_count
    FROM candidates
    WHERE election_id = $1 AND status = 'APPROVED'
    GROUP BY position_id;
  `, [id]);

  const candidateCountMap = {};
  candCountRes.rows.forEach(r => {
    candidateCountMap[r.position_id] = parseInt(r.candidate_count, 10);
  });

  const positionsWithCounts = posRes.rows.map(p => ({
    ...p,
    candidate_count: candidateCountMap[p.id] || 0
  }));

  return sendSuccess(res, {
    election: { ...election, positions: positionsWithCounts }
  }, 'Election details retrieved successfully.');
}

// ==============================================================================
// 3. ELECTION POSITION MANAGEMENT (Administrator Only)
// ==============================================================================

/**
 * Get all available positions (global master list)
 * GET /api/v1/elections/positions/all
 */
async function listAllPositions(req, res, next) {
  const posRes = await query(`
    SELECT id, name, description, display_order, is_active, created_at
    FROM positions
    WHERE is_active = TRUE
    ORDER BY display_order ASC;
  `);

  return sendSuccess(res, {
    totalPositions: posRes.rows.length,
    positions: posRes.rows
  }, 'All election positions retrieved.');
}

/**
 * Assign positions to an election
 * POST /api/v1/elections/:id/positions
 */
async function assignPositions(req, res, next) {
  const { id } = req.params;
  const { positionIds } = req.body;

  if (!Array.isArray(positionIds) || positionIds.length === 0) {
    return next(new AppError('positionIds must be a non-empty array of position UUIDs.', 400, 'POSITION_IDS_REQUIRED'));
  }

  // Verify election exists and is UPCOMING
  const electRes = await query('SELECT id, status FROM elections WHERE id = $1', [id]);
  if (electRes.rows.length === 0) {
    return next(new AppError('Election not found.', 404, 'ELECTION_NOT_FOUND'));
  }

  const election = electRes.rows[0];
  if (!['UPCOMING'].includes(election.status)) {
    return next(new AppError(
      `Cannot modify positions of an election with status '${election.status}'. Only UPCOMING elections can be configured.`,
      400,
      'ELECTION_NOT_CONFIGURABLE'
    ));
  }

  const assigned = [];
  for (let i = 0; i < positionIds.length; i++) {
    const posId = positionIds[i];

    // Verify position exists
    const posRes = await query('SELECT id, name FROM positions WHERE id = $1 AND is_active = TRUE', [posId]);
    if (posRes.rows.length === 0) continue;

    await query(`
      INSERT INTO election_positions (election_id, position_id, display_order)
      VALUES ($1, $2, $3)
      ON CONFLICT (election_id, position_id) DO NOTHING;
    `, [id, posId, i + 1]);

    assigned.push(posRes.rows[0]);
  }

  await AuditService.log({
    action: 'ELECTION_POSITIONS_ASSIGNED',
    userId: req.user.id,
    userEmail: req.user.email,
    userRole: req.user.role,
    entityType: 'election',
    entityId: id,
    details: { positionsAssigned: assigned.map(p => p.name) },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendSuccess(res, { electionId: id, assigned }, 'Positions assigned to election successfully.');
}

/**
 * Remove a position from an election
 * DELETE /api/v1/elections/:id/positions/:positionId
 */
async function removePosition(req, res, next) {
  const { id, positionId } = req.params;

  // Verify election is UPCOMING
  const electRes = await query('SELECT id, status FROM elections WHERE id = $1', [id]);
  if (electRes.rows.length === 0) {
    return next(new AppError('Election not found.', 404, 'ELECTION_NOT_FOUND'));
  }

  if (electRes.rows[0].status !== 'UPCOMING') {
    return next(new AppError(
      `Cannot remove positions from an election with status '${electRes.rows[0].status}'.`,
      400,
      'ELECTION_NOT_CONFIGURABLE'
    ));
  }

  // Ensure no approved candidates exist for this position in this election
  const candCheck = await query(
    'SELECT COUNT(*) as count FROM candidates WHERE election_id = $1 AND position_id = $2 AND status = \'APPROVED\'',
    [id, positionId]
  );
  if (parseInt(candCheck.rows[0].count, 10) > 0) {
    return next(new AppError(
      'Cannot remove this position — approved candidates already exist for it in this election.',
      409,
      'CANDIDATES_EXIST_FOR_POSITION'
    ));
  }

  const delRes = await query(
    'DELETE FROM election_positions WHERE election_id = $1 AND position_id = $2 RETURNING id',
    [id, positionId]
  );

  if (delRes.rows.length === 0) {
    return next(new AppError('Position is not assigned to this election.', 404, 'ELECTION_POSITION_NOT_FOUND'));
  }

  return sendSuccess(res, { electionId: id, positionId }, 'Position removed from election.');
}

// ==============================================================================
// 4. ELECTION STATE TRANSITIONS (Administrator Only)
// ==============================================================================

/**
 * Open election for voting: UPCOMING → OPEN
 * PATCH /api/v1/elections/:id/open
 */
async function openElection(req, res, next) {
  const { id } = req.params;

  const electRes = await query('SELECT * FROM elections WHERE id = $1', [id]);
  if (electRes.rows.length === 0) {
    return next(new AppError('Election not found.', 404, 'ELECTION_NOT_FOUND'));
  }

  const election = electRes.rows[0];

  if (!validateStatusTransition(election.status, 'OPEN')) {
    return next(new AppError(
      `Cannot open an election with status '${election.status}'. Only UPCOMING elections can be opened.`,
      400,
      'INVALID_STATUS_TRANSITION'
    ));
  }

  // Validate election has at least one position with at least one approved candidate
  const posCount = await query('SELECT COUNT(*) as count FROM election_positions WHERE election_id = $1', [id]);
  if (parseInt(posCount.rows[0].count, 10) === 0) {
    return next(new AppError(
      'Cannot open election: no positions have been assigned. Configure positions before opening.',
      400,
      'NO_POSITIONS_ASSIGNED'
    ));
  }

  const updatedElection = await query(`
    UPDATE elections
    SET status = 'OPEN', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *;
  `, [id]);

  await AuditService.log({
    action: 'ELECTION_OPENED',
    userId: req.user.id,
    userEmail: req.user.email,
    userRole: req.user.role,
    entityType: 'election',
    entityId: id,
    details: { previousStatus: 'UPCOMING', newStatus: 'OPEN', electionTitle: election.title },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendSuccess(res, {
    election: updatedElection.rows[0]
  }, `Election '${election.title}' is now OPEN for voting.`);
}

/**
 * Close election to stop voting: OPEN → CLOSED
 * PATCH /api/v1/elections/:id/close
 */
async function closeElection(req, res, next) {
  const { id } = req.params;

  const electRes = await query('SELECT * FROM elections WHERE id = $1', [id]);
  if (electRes.rows.length === 0) {
    return next(new AppError('Election not found.', 404, 'ELECTION_NOT_FOUND'));
  }

  const election = electRes.rows[0];

  if (!validateStatusTransition(election.status, 'CLOSED')) {
    return next(new AppError(
      `Cannot close an election with status '${election.status}'. Only OPEN elections can be closed.`,
      400,
      'INVALID_STATUS_TRANSITION'
    ));
  }

  const updatedElection = await query(`
    UPDATE elections
    SET status = 'CLOSED', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *;
  `, [id]);

  await AuditService.log({
    action: 'ELECTION_CLOSED',
    userId: req.user.id,
    userEmail: req.user.email,
    userRole: req.user.role,
    entityType: 'election',
    entityId: id,
    details: { previousStatus: 'OPEN', newStatus: 'CLOSED', electionTitle: election.title },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendSuccess(res, {
    election: updatedElection.rows[0]
  }, `Election '${election.title}' is now CLOSED. Voting has ended.`);
}

/**
 * Update election metadata (title, description, dates) - UPCOMING only
 * PATCH /api/v1/elections/:id
 */
async function updateElection(req, res, next) {
  const { id } = req.params;
  const { title, description, startDate, endDate } = req.body;

  const electRes = await query('SELECT * FROM elections WHERE id = $1', [id]);
  if (electRes.rows.length === 0) {
    return next(new AppError('Election not found.', 404, 'ELECTION_NOT_FOUND'));
  }

  const election = electRes.rows[0];

  if (election.status !== 'UPCOMING') {
    return next(new AppError(
      `Cannot edit an election with status '${election.status}'. Only UPCOMING elections can be modified.`,
      400,
      'ELECTION_NOT_EDITABLE'
    ));
  }

  const newTitle = title ? title.trim() : election.title;
  const newDesc = description !== undefined ? (description ? description.trim() : null) : election.description;
  const newStart = startDate ? new Date(startDate) : election.start_date;
  const newEnd = endDate ? new Date(endDate) : election.end_date;

  if (newStart >= newEnd) {
    return next(new AppError('Election start date must be before the end date.', 400, 'INVALID_DATE_RANGE'));
  }

  const updatedRes = await query(`
    UPDATE elections
    SET title = $1, description = $2, start_date = $3, end_date = $4, updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *;
  `, [newTitle, newDesc, newStart, newEnd, id]);

  await AuditService.log({
    action: 'ELECTION_UPDATED',
    userId: req.user.id,
    userEmail: req.user.email,
    userRole: req.user.role,
    entityType: 'election',
    entityId: id,
    details: { title: newTitle },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendSuccess(res, { election: updatedRes.rows[0] }, 'Election updated successfully.');
}

/**
 * Get election statistics (admin private view)
 * GET /api/v1/elections/:id/stats
 */
async function getElectionStats(req, res, next) {
  const { id } = req.params;

  const electRes = await query('SELECT id, title, status FROM elections WHERE id = $1', [id]);
  if (electRes.rows.length === 0) {
    return next(new AppError('Election not found.', 404, 'ELECTION_NOT_FOUND'));
  }

  const election = electRes.rows[0];

  // Total ballots (voters who have voted)
  const ballotCount = await query('SELECT COUNT(*) as total FROM ballots WHERE election_id = $1', [id]);

  // Total candidates per position
  const candidateStats = await query(`
    SELECT p.name as position, COUNT(c.id) as candidate_count
    FROM positions p
    INNER JOIN election_positions ep ON p.id = ep.position_id AND ep.election_id = $1
    LEFT JOIN candidates c ON p.id = c.position_id AND c.election_id = $1 AND c.status = 'APPROVED'
    GROUP BY p.name, p.display_order
    ORDER BY p.display_order ASC;
  `, [id]);

  // Total pending candidate applications
  const pendingApps = await query(
    "SELECT COUNT(*) as total FROM candidate_applications WHERE election_id = $1 AND status = 'PENDING'",
    [id]
  );

  return sendSuccess(res, {
    election: {
      id: election.id,
      title: election.title,
      status: election.status
    },
    stats: {
      totalBallotsCast: parseInt(ballotCount.rows[0].total, 10),
      totalPendingApplications: parseInt(pendingApps.rows[0].total, 10),
      candidatesByPosition: candidateStats.rows
    }
  }, 'Election statistics retrieved.');
}

module.exports = {
  createElection,
  listElections,
  getElectionDetails,
  listAllPositions,
  assignPositions,
  removePosition,
  openElection,
  closeElection,
  updateElection,
  getElectionStats,
  validateStatusTransition
};
