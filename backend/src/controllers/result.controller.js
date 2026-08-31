const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { sendSuccess, sendCreated } = require('../utils/response');
const AuditService = require('../services/auditService');

// ==============================================================================
// 1. CALCULATE RESULTS (Administrator Only)
// ==============================================================================

/**
 * Tabulate and calculate vote totals for a closed election.
 * POST /api/v1/results/:electionId/calculate
 *
 * Tabulates all votes per position/candidate and determines winners.
 */
async function calculateResults(req, res, next) {
  const { electionId } = req.params;

  // 1. Verify election exists
  const electRes = await query('SELECT id, title, status FROM elections WHERE id = $1', [electionId]);
  if (electRes.rows.length === 0) {
    return next(new AppError('Election not found.', 404, 'ELECTION_NOT_FOUND'));
  }

  const election = electRes.rows[0];

  // 2. Rule 5: Cannot calculate results for active elections
  if (['UPCOMING', 'OPEN'].includes(election.status)) {
    return next(new AppError(
      `Cannot calculate results while election status is '${election.status}'. The election must be CLOSED before tabulation.`,
      400,
      'ELECTION_NOT_CLOSED'
    ));
  }

  // 3. Tabulate votes within a transaction
  const calculatedResults = await withTransaction(async (client) => {
    // Get all approved candidates in this election across all positions
    const candidateQuery = `
      SELECT 
        c.id as candidate_id,
        c.election_id,
        c.position_id,
        p.name as position_name,
        p.display_order as position_order,
        u.full_name as candidate_name,
        c.photo_url,
        COALESCE(vote_counts.total_votes, 0) as total_votes
      FROM candidates c
      INNER JOIN positions p ON c.position_id = p.id
      INNER JOIN users u ON c.user_id = u.id
      LEFT JOIN (
        SELECT candidate_id, COUNT(*) as total_votes
        FROM votes
        WHERE election_id = $1
        GROUP BY candidate_id
      ) vote_counts ON c.id = vote_counts.candidate_id
      WHERE c.election_id = $1 AND c.status = 'APPROVED'
      ORDER BY p.display_order ASC, total_votes DESC;
    `;

    const candidatesRes = await client.query(candidateQuery, [electionId]);
    const candidates = candidatesRes.rows;

    // Group by position to determine winners (highest vote count per position)
    const positionMaxVotes = {};
    candidates.forEach((cand) => {
      const votes = parseInt(cand.total_votes, 10);
      if (!(cand.position_id in positionMaxVotes) || votes > positionMaxVotes[cand.position_id]) {
        positionMaxVotes[cand.position_id] = votes;
      }
    });

    // Upsert into results table
    const results = [];
    for (const cand of candidates) {
      const votes = parseInt(cand.total_votes, 10);
      const isWinner = votes > 0 && votes === positionMaxVotes[cand.position_id];

      const upsertSql = `
        INSERT INTO results (
          election_id, position_id, candidate_id, total_votes, is_winner, calculated_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (election_id, position_id, candidate_id)
        DO UPDATE SET
          total_votes = EXCLUDED.total_votes,
          is_winner = EXCLUDED.is_winner,
          calculated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;

      const rRes = await client.query(upsertSql, [
        electionId,
        cand.position_id,
        cand.candidate_id,
        votes,
        isWinner
      ]);

      results.push({
        ...rRes.rows[0],
        candidate_name: cand.candidate_name,
        position_name: cand.position_name,
        photo_url: cand.photo_url
      });
    }

    return results;
  });

  // 4. Audit Log
  await AuditService.log({
    action: 'RESULTS_CALCULATED',
    userId: req.user.id,
    userEmail: req.user.email,
    userRole: req.user.role,
    entityType: 'election',
    entityId: electionId,
    details: {
      electionTitle: election.title,
      totalEntriesTabulated: calculatedResults.length
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendSuccess(res, {
    electionId,
    electionTitle: election.title,
    electionStatus: election.status,
    totalEntries: calculatedResults.length,
    results: calculatedResults
  }, 'Election results tabulated successfully. Results remain private until published.');
}

// ==============================================================================
// 2. PUBLISH RESULTS (Administrator Only)
// ==============================================================================

/**
 * Publish official results for a closed election.
 * POST /api/v1/results/:electionId/publish
 *
 * Transitions election status: CLOSED → RESULTS_PUBLISHED
 * Makes results publicly accessible.
 */
async function publishResults(req, res, next) {
  const { electionId } = req.params;
  const adminId = req.user.id;

  // 1. Verify election exists
  const electRes = await query('SELECT id, title, status FROM elections WHERE id = $1', [electionId]);
  if (electRes.rows.length === 0) {
    return next(new AppError('Election not found.', 404, 'ELECTION_NOT_FOUND'));
  }

  const election = electRes.rows[0];

  // 2. Confirm election is CLOSED
  if (election.status !== 'CLOSED') {
    return next(new AppError(
      `Cannot publish results for election with status '${election.status}'. Election must be in CLOSED status to publish results.`,
      400,
      'ELECTION_NOT_CLOSED'
    ));
  }

  // 3. Ensure results are tabulated, then publish in an atomic transaction
  const publishedAt = new Date().toISOString();

  await withTransaction(async (client) => {
    // A. Check if results have been tabulated; if not, calculate first
    const existingResults = await client.query('SELECT COUNT(*) as count FROM results WHERE election_id = $1', [electionId]);
    if (parseInt(existingResults.rows[0].count, 10) === 0) {
      // Auto-calculate results
      const candidateQuery = `
        SELECT 
          c.id as candidate_id,
          c.position_id,
          COALESCE(vote_counts.total_votes, 0) as total_votes
        FROM candidates c
        LEFT JOIN (
          SELECT candidate_id, COUNT(*) as total_votes
          FROM votes
          WHERE election_id = $1
          GROUP BY candidate_id
        ) vote_counts ON c.id = vote_counts.candidate_id
        WHERE c.election_id = $1 AND c.status = 'APPROVED';
      `;
      const candRes = await client.query(candidateQuery, [electionId]);
      
      const posMax = {};
      candRes.rows.forEach(c => {
        const v = parseInt(c.total_votes, 10);
        if (!(c.position_id in posMax) || v > posMax[c.position_id]) {
          posMax[c.position_id] = v;
        }
      });

      for (const c of candRes.rows) {
        const v = parseInt(c.total_votes, 10);
        const isWin = v > 0 && v === posMax[c.position_id];
        await client.query(`
          INSERT INTO results (election_id, position_id, candidate_id, total_votes, is_winner, calculated_at, published_at, published_by)
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7)
          ON CONFLICT (election_id, position_id, candidate_id)
          DO UPDATE SET total_votes = EXCLUDED.total_votes, is_winner = EXCLUDED.is_winner, published_at = $6, published_by = $7;
        `, [electionId, c.position_id, c.candidate_id, v, isWin, publishedAt, adminId]);
      }
    } else {
      // Update existing results with publication metadata
      await client.query(`
        UPDATE results 
        SET published_at = $1, published_by = $2 
        WHERE election_id = $3;
      `, [publishedAt, adminId, electionId]);
    }

    // B. Transition election status to RESULTS_PUBLISHED
    await client.query(`
      UPDATE elections
      SET 
        status = 'RESULTS_PUBLISHED',
        published_at = $1,
        published_by = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3;
    `, [publishedAt, adminId, electionId]);
  });

  // 4. Audit publication event
  await AuditService.log({
    action: 'RESULTS_PUBLISHED',
    userId: adminId,
    userEmail: req.user.email,
    userRole: req.user.role,
    entityType: 'election',
    entityId: electionId,
    details: {
      electionTitle: election.title,
      publishedAt
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendSuccess(res, {
    electionId,
    electionTitle: election.title,
    status: 'RESULTS_PUBLISHED',
    publishedAt,
    publishedBy: req.user.email
  }, `Official results for '${election.title}' have been published and are now publicly available.`);
}

// ==============================================================================
// 3. GET PUBLIC ELECTION RESULTS (Rule 5 Enforced)
// ==============================================================================

/**
 * Get official election results (Public endpoint).
 * GET /api/v1/results/:electionId
 *
 * CRITICAL RULE 5: Results remain private while election is UPCOMING, OPEN, or CLOSED.
 * Results become accessible ONLY after the Administrator publishes them (RESULTS_PUBLISHED).
 */
async function getPublicResults(req, res, next) {
  const { electionId } = req.params;

  // 1. Verify election exists
  const electRes = await query(`
    SELECT e.id, e.title, e.description, e.status, e.published_at, u.full_name as published_by_name
    FROM elections e
    LEFT JOIN users u ON e.published_by = u.id
    WHERE e.id = $1;
  `, [electionId]);

  if (electRes.rows.length === 0) {
    return next(new AppError('Election not found.', 404, 'ELECTION_NOT_FOUND'));
  }

  const election = electRes.rows[0];

  // 2. CRITICAL RULE 5 BACKEND ENFORCEMENT: Reject if not published
  if (election.status !== 'RESULTS_PUBLISHED') {
    return next(new AppError(
      'CRITICAL ELECTION PRIVACY: Election results are private and will become available only after official publication by the Administrator.',
      403,
      'RESULTS_PRIVATE',
      { currentElectionStatus: election.status }
    ));
  }

  // 3. Fetch structured official results with percentages
  const resultsQuery = `
    SELECT 
      p.id as position_id,
      p.name as position_name,
      p.display_order as position_order,
      c.id as candidate_id,
      u.full_name as candidate_name,
      c.photo_url,
      r.total_votes,
      r.is_winner,
      r.published_at
    FROM results r
    INNER JOIN positions p ON r.position_id = p.id
    INNER JOIN candidates c ON r.candidate_id = c.id
    INNER JOIN users u ON c.user_id = u.id
    WHERE r.election_id = $1
    ORDER BY p.display_order ASC, r.total_votes DESC, u.full_name ASC;
  `;

  const resultsRes = await query(resultsQuery, [electionId]);

  // Group by position and compute totals/percentages
  const positionMap = {};
  resultsRes.rows.forEach((row) => {
    if (!positionMap[row.position_id]) {
      positionMap[row.position_id] = {
        positionId: row.position_id,
        positionName: row.position_name,
        displayOrder: row.position_order,
        totalVotesForPosition: 0,
        candidates: []
      };
    }
    const votes = parseInt(row.total_votes, 10);
    positionMap[row.position_id].totalVotesForPosition += votes;
    positionMap[row.position_id].candidates.push({
      candidateId: row.candidate_id,
      candidateName: row.candidate_name,
      photoUrl: row.photo_url,
      votes,
      isWinner: row.is_winner
    });
  });

  // Calculate vote share percentages
  const structuredResults = Object.values(positionMap).map((pos) => ({
    ...pos,
    candidates: pos.candidates.map((c) => ({
      ...c,
      votePercentage: pos.totalVotesForPosition > 0
        ? ((c.votes / pos.totalVotesForPosition) * 100).toFixed(1)
        : '0.0'
    }))
  }));

  // Fetch total ballots cast in election
  const ballotCountRes = await query('SELECT COUNT(*) as count FROM ballots WHERE election_id = $1', [electionId]);
  const totalBallotsCast = parseInt(ballotCountRes.rows[0].count, 10);

  return sendSuccess(res, {
    election: {
      id: election.id,
      title: election.title,
      description: election.description,
      status: election.status,
      publishedAt: election.published_at,
      publishedBy: election.published_by_name,
      totalBallotsCast
    },
    results: structuredResults
  }, 'Official published election results retrieved successfully.');
}

// ==============================================================================
// 4. ADMIN RESULTS PREVIEW (Administrator Only)
// ==============================================================================

/**
 * Preview calculated results before publication.
 * GET /api/v1/results/:electionId/admin-preview
 */
async function getAdminResultsPreview(req, res, next) {
  const { electionId } = req.params;

  const electRes = await query('SELECT id, title, status FROM elections WHERE id = $1', [electionId]);
  if (electRes.rows.length === 0) {
    return next(new AppError('Election not found.', 404, 'ELECTION_NOT_FOUND'));
  }

  const election = electRes.rows[0];

  const resultsQuery = `
    SELECT 
      p.id as position_id,
      p.name as position_name,
      p.display_order as position_order,
      c.id as candidate_id,
      u.full_name as candidate_name,
      c.photo_url,
      COALESCE(r.total_votes, 0) as total_votes,
      COALESCE(r.is_winner, FALSE) as is_winner,
      r.calculated_at
    FROM candidates c
    INNER JOIN positions p ON c.position_id = p.id
    INNER JOIN users u ON c.user_id = u.id
    LEFT JOIN results r ON c.id = r.candidate_id AND r.election_id = $1
    WHERE c.election_id = $1 AND c.status = 'APPROVED'
    ORDER BY p.display_order ASC, total_votes DESC, u.full_name ASC;
  `;

  const resultsRes = await query(resultsQuery, [electionId]);

  return sendSuccess(res, {
    electionId,
    electionTitle: election.title,
    electionStatus: election.status,
    preview: resultsRes.rows
  }, 'Admin results preview retrieved.');
}

module.exports = {
  calculateResults,
  publishResults,
  getPublicResults,
  getAdminResultsPreview
};
