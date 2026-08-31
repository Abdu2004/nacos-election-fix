const crypto = require('crypto');
const { query, withTransaction } = require('../config/db');
const { generateOTP, hashOTP, compareOTP } = require('../utils/crypto');
const { sendOTPEmail } = require('../services/emailService');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const { sendSuccess, sendCreated } = require('../utils/response');
const AuditService = require('../services/auditService');

// ==============================================================================
// HELPERS
// ==============================================================================

/**
 * Generate a unique ballot receipt hash for voter confirmation.
 * Does NOT link the voter identity to individual vote choices.
 */
function generateBallotReceiptHash(electionId, voterId, submittedAt) {
  const raw = `${electionId}:${voterId}:${submittedAt}:${crypto.randomBytes(16).toString('hex')}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ==============================================================================
// 1. SUBMIT BALLOT (VOTE)
// ==============================================================================

/**
 * Submit a ballot for an election.
 * POST /api/v1/votes
 */
async function submitBallot(req, res, next) {
  const voter = req.user;
  const { electionId, votes, otp } = req.body;

  // --- Restriction: Administrator cannot vote ---
  if (voter.role === 'ADMINISTRATOR') {
    return next(new AppError('Administrators are not permitted to vote to maintain neutral election integrity.', 403, 'ADMIN_CANNOT_VOTE'));
  }

  // --- 1. Input Validation ---
  if (!electionId) {
    return next(new AppError('Election ID is required.', 400, 'ELECTION_ID_REQUIRED'));
  }

  if (!Array.isArray(votes) || votes.length === 0) {
    return next(new AppError(
      'Ballot must contain at least one vote. Provide an array of { positionId, candidateId } entries.',
      400,
      'EMPTY_BALLOT'
    ));
  }

  // --- 2. Verify voter eligibility ---
  if (!voter.is_verified || voter.verification_status !== 'APPROVED') {
    return next(new AppError(
      'You must be a verified, approved voter to cast a ballot.',
      403,
      'UNVERIFIED_VOTER_CANNOT_VOTE'
    ));
  }

  // --- 2b. Verify Voting OTP if provided ---
  if (otp) {
    const otpRes = await query(
      `SELECT id, otp_hash, attempts, max_attempts, is_used, expires_at 
       FROM otp_verifications 
       WHERE email = $1 AND purpose = 'VOTING' AND is_used = FALSE 
       ORDER BY created_at DESC LIMIT 1`,
      [voter.email]
    );

    if (otpRes.rows.length === 0) {
      return next(new AppError('No active voting confirmation code found. Please request a new code.', 400, 'NO_ACTIVE_OTP'));
    }

    const otpRecord = otpRes.rows[0];

    if (new Date() > new Date(otpRecord.expires_at)) {
      return next(new AppError('Your voting confirmation code has expired. Please request a new code.', 400, 'OTP_EXPIRED'));
    }

    if (otpRecord.attempts >= otpRecord.max_attempts) {
      return next(new AppError('Maximum confirmation attempts exceeded. Please request a new code.', 429, 'MAX_ATTEMPTS_EXCEEDED'));
    }

    const isMatch = await compareOTP(otp, otpRecord.otp_hash);
    if (!isMatch) {
      await query('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1', [otpRecord.id]);
      return next(new AppError('Invalid voting confirmation code. Please try again.', 400, 'INVALID_OTP'));
    }

    // Mark OTP as used
    await query('UPDATE otp_verifications SET is_used = TRUE WHERE id = $1', [otpRecord.id]);
  }

  // --- 3. Check for duplicate position entries in submitted ballot ---
  const submittedPositions = votes.map(v => v.positionId);
  const uniquePositions = new Set(submittedPositions);
  if (uniquePositions.size !== submittedPositions.length) {
    return next(new AppError(
      'Invalid ballot: duplicate positions detected. You may only vote once per position.',
      400,
      'DUPLICATE_POSITION_IN_BALLOT'
    ));
  }

  // --- All critical checks run inside a single atomic transaction ---
  const ballotResult = await withTransaction(async (client) => {

    // --- 4. Lock voter row to prevent concurrent duplicate submissions (§13 Concurrency) ---
    const voterLockRes = await client.query(
      'SELECT id, is_verified, verification_status FROM users WHERE id = $1 FOR UPDATE',
      [voter.id]
    );

    if (voterLockRes.rows.length === 0) {
      throw new AppError('Voter account not found.', 404, 'VOTER_NOT_FOUND');
    }

    const lockedVoter = voterLockRes.rows[0];

    // Re-validate verification after lock (double-check)
    if (!lockedVoter.is_verified || lockedVoter.verification_status !== 'APPROVED') {
      throw new AppError(
        'Your voter verification status is not APPROVED. You cannot vote.',
        403,
        'UNVERIFIED_VOTER_CANNOT_VOTE'
      );
    }

    // --- 5. Verify election is OPEN (Rule from §15) ---
    const electRes = await client.query(
      'SELECT id, title, status FROM elections WHERE id = $1',
      [electionId]
    );

    if (electRes.rows.length === 0) {
      throw new AppError('Election not found.', 404, 'ELECTION_NOT_FOUND');
    }

    const election = electRes.rows[0];

    if (election.status !== 'OPEN') {
      throw new AppError(
        `Voting is not currently open. Election status is '${election.status}'.`,
        400,
        'ELECTION_NOT_OPEN'
      );
    }

    // --- 6. Critical Rule 1: Check no previous ballot exists (one voter, one ballot) ---
    const existingBallot = await client.query(
      'SELECT id FROM ballots WHERE election_id = $1 AND voter_id = $2',
      [electionId, voter.id]
    );

    if (existingBallot.rows.length > 0) {
      throw new AppError(
        'CRITICAL ELECTION RULE VIOLATION: You have already submitted a ballot for this election. Ballots cannot be changed.',
        409,
        'BALLOT_ALREADY_SUBMITTED'
      );
    }

    // --- 7. Validate all positions belong to this election ---
    const electionPositionsRes = await client.query(
      'SELECT position_id FROM election_positions WHERE election_id = $1',
      [electionId]
    );

    const validPositionIds = new Set(electionPositionsRes.rows.map(r => r.position_id));

    for (const vote of votes) {
      if (!vote.positionId || !vote.candidateId) {
        throw new AppError(
          'Each vote entry must contain positionId and candidateId.',
          400,
          'INVALID_VOTE_ENTRY'
        );
      }

      if (!validPositionIds.has(vote.positionId)) {
        throw new AppError(
          `Position '${vote.positionId}' is not part of this election.`,
          400,
          'INVALID_POSITION_FOR_ELECTION'
        );
      }
    }

    // --- 8. Validate all candidates are APPROVED and belong to correct positions in this election ---
    for (const vote of votes) {
      const candidateRes = await client.query(
        `SELECT id, election_id, position_id, status 
         FROM candidates 
         WHERE id = $1`,
        [vote.candidateId]
      );

      if (candidateRes.rows.length === 0) {
        throw new AppError(
          `Candidate '${vote.candidateId}' does not exist.`,
          400,
          'CANDIDATE_NOT_FOUND'
        );
      }

      const candidate = candidateRes.rows[0];

      if (candidate.election_id !== electionId) {
        throw new AppError(
          `Candidate '${vote.candidateId}' is not registered for this election.`,
          400,
          'CANDIDATE_NOT_IN_ELECTION'
        );
      }

      if (candidate.status !== 'APPROVED') {
        throw new AppError(
          `Candidate '${vote.candidateId}' is not an approved candidate.`,
          400,
          'CANDIDATE_NOT_APPROVED'
        );
      }

      if (candidate.position_id !== vote.positionId) {
        throw new AppError(
          `Candidate '${vote.candidateId}' is contesting for a different position than specified.`,
          400,
          'CANDIDATE_POSITION_MISMATCH'
        );
      }
    }

    // --- 9. Create the ballot record (privacy: does not store individual choices linked to voter) ---
    const submittedAt = new Date().toISOString();
    const receiptHash = generateBallotReceiptHash(electionId, voter.id, submittedAt);

    const ballotRes = await client.query(`
      INSERT INTO ballots (election_id, voter_id, ballot_receipt_hash, ip_address, user_agent, submitted_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, election_id, ballot_receipt_hash, submitted_at;
    `, [
      electionId,
      voter.id,
      receiptHash,
      req.ip || null,
      req.headers['user-agent'] || null,
      submittedAt
    ]);

    const ballot = ballotRes.rows[0];

    // --- 10. Insert individual votes (linked to ballot, NOT to voter identity directly) ---
    for (const vote of votes) {
      await client.query(`
        INSERT INTO votes (election_id, ballot_id, position_id, candidate_id, cast_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP);
      `, [electionId, ballot.id, vote.positionId, vote.candidateId]);
    }

    return ballot;
  });

  // Audit log: record the vote event (no individual choices logged - §14 privacy)
  await AuditService.log({
    action: 'BALLOT_SUBMITTED',
    userId: voter.id,
    userEmail: voter.email,
    userRole: voter.role,
    entityType: 'ballot',
    entityId: ballotResult.id,
    details: {
      electionId,
      totalPositionsVoted: votes.length
      // NOTE: individual candidate choices are NOT logged to protect vote privacy
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendCreated(res, {
    ballotReceiptHash: ballotResult.ballot_receipt_hash,
    electionId,
    submittedAt: ballotResult.submitted_at,
    totalVotesCast: votes.length
  }, 'Your ballot has been submitted successfully. Keep your receipt hash for your records.');
}

// ==============================================================================
// 2. GET VOTER BALLOT STATUS
// ==============================================================================

/**
 * Check if the authenticated voter has already voted in a specific election.
 * GET /api/v1/votes/status?electionId=xxx
 *
 * Intentionally does NOT return individual choices — only submission status.
 */
async function getVotingStatus(req, res, next) {
  const { electionId } = req.query;
  const voter = req.user;

  if (!electionId) {
    return next(new AppError('Election ID is required.', 400, 'ELECTION_ID_REQUIRED'));
  }

  // Verify election exists
  const electRes = await query(
    'SELECT id, title, status FROM elections WHERE id = $1',
    [electionId]
  );

  if (electRes.rows.length === 0) {
    return next(new AppError('Election not found.', 404, 'ELECTION_NOT_FOUND'));
  }

  const election = electRes.rows[0];

  // Check ballot existence only - do NOT return vote choices (§14 privacy)
  const ballotRes = await query(
    'SELECT id, ballot_receipt_hash, submitted_at FROM ballots WHERE election_id = $1 AND voter_id = $2',
    [electionId, voter.id]
  );

  const hasVoted = ballotRes.rows.length > 0;

  return sendSuccess(res, {
    electionId,
    electionTitle: election.title,
    electionStatus: election.status,
    hasVoted,
    // Only return receipt hash if they have voted (for their own confirmation)
    ballotReceiptHash: hasVoted ? ballotRes.rows[0].ballot_receipt_hash : null,
    submittedAt: hasVoted ? ballotRes.rows[0].submitted_at : null
    // Individual vote choices are deliberately NOT exposed
  }, hasVoted ? 'You have already voted in this election.' : 'You have not yet voted in this election.');
}

// ==============================================================================
// 3. VERIFY BALLOT RECEIPT (Public Verification)
// ==============================================================================

/**
 * Verify a ballot receipt hash exists in the system (for voter self-verification).
 * GET /api/v1/votes/verify/:receiptHash
 *
 * Does NOT reveal who voted or what they voted for.
 */
async function verifyBallotReceipt(req, res, next) {
  const { receiptHash } = req.params;

  if (!receiptHash || receiptHash.length < 32) {
    return next(new AppError('Invalid ballot receipt hash.', 400, 'INVALID_RECEIPT_HASH'));
  }

  const ballotRes = await query(
    'SELECT id, election_id, submitted_at FROM ballots WHERE ballot_receipt_hash = $1',
    [receiptHash]
  );

  if (ballotRes.rows.length === 0) {
    return sendSuccess(res, { valid: false }, 'No ballot found with this receipt hash.');
  }

  const ballot = ballotRes.rows[0];

  // Fetch election title but do NOT reveal voter identity
  const electRes = await query(
    'SELECT title, status FROM elections WHERE id = $1',
    [ballot.election_id]
  );

  const electionTitle = electRes.rows.length > 0 ? electRes.rows[0].title : 'Unknown';

  return sendSuccess(res, {
    valid: true,
    electionId: ballot.election_id,
    electionTitle,
    submittedAt: ballot.submitted_at
  }, 'Ballot receipt verified. This ballot was successfully recorded.');
}

/**
 * Request a 6-digit Voting Confirmation OTP for casting a ballot
 * POST /api/v1/votes/request-otp
 */
async function requestVotingOTP(req, res, next) {
  const user = req.user;
  const { electionId } = req.body;

  if (user.role === 'ADMINISTRATOR') {
    return next(new AppError('Administrators are not permitted to vote.', 403, 'ADMIN_CANNOT_VOTE'));
  }

  if (!user.is_verified || user.verification_status !== 'APPROVED') {
    return next(new AppError('You must be a verified voter to receive a voting confirmation code.', 403, 'UNVERIFIED_VOTER_CANNOT_VOTE'));
  }

  if (electionId) {
    const ballotCheck = await query(
      'SELECT id FROM ballots WHERE election_id = $1 AND voter_id = $2',
      [electionId, user.id]
    );
    if (ballotCheck.rows.length > 0) {
      return next(new AppError('You have already submitted a ballot for this election.', 409, 'BALLOT_ALREADY_SUBMITTED'));
    }
  }

  // Check recent OTP cooldown (60 seconds)
  const recentOtpRes = await query(
    `SELECT created_at FROM otp_verifications 
     WHERE email = $1 AND purpose = 'VOTING' AND is_used = FALSE 
     ORDER BY created_at DESC LIMIT 1`,
    [user.email]
  );

  if (recentOtpRes.rows.length > 0) {
    const lastCreated = new Date(recentOtpRes.rows[0].created_at).getTime();
    const timeDiffSeconds = (Date.now() - lastCreated) / 1000;
    if (timeDiffSeconds < 60) {
      const waitSeconds = Math.ceil(60 - timeDiffSeconds);
      return next(new AppError(`Please wait ${waitSeconds} seconds before requesting a new voting confirmation code.`, 429, 'OTP_COOLDOWN_ACTIVE'));
    }
  }

  const otp = generateOTP(6);
  const otpHash = await hashOTP(otp);
  const expiryMinutes = config.otp?.expiryMinutes || 10;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  await query(
    `INSERT INTO otp_verifications (
      email, otp_hash, purpose, attempts, max_attempts, is_used, expires_at
    ) VALUES ($1, $2, 'VOTING', 0, 5, FALSE, $3);`,
    [user.email, otpHash, expiresAt]
  );

  await sendOTPEmail(user.email, otp, user.full_name || 'Voter', expiryMinutes, 'VOTING');

  return sendSuccess(res, {
    email: user.email,
    expiresInMinutes: expiryMinutes
  }, 'Voting confirmation OTP has been dispatched to your registered Gmail.');
}

module.exports = {
  submitBallot,
  requestVotingOTP,
  getVotingStatus,
  verifyBallotReceipt,
  generateBallotReceiptHash
};
