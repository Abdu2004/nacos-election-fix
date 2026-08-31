const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/response');
const AuditService = require('../services/auditService');
const NotificationService = require('../services/notificationService');
const { CANDIDATE_PHOTOS_DIR, CANDIDATE_CREDENTIALS_DIR } = require('../middleware/upload');

/**
 * Generate cryptographically secure formatted candidate code: CAND-XXXX-XXXX-XXXX
 */
function generateSecureCandidateCode() {
  const randHex = crypto.randomBytes(6).toString('hex').toUpperCase();
  const parts = randHex.match(/.{1,4}/g);
  return `CAND-${parts.join('-')}`;
}

// ==============================================================================
// 1. CANDIDATE CODE MANAGEMENT (Administrator & Validator)
// ==============================================================================

/**
 * Issue / Generate new candidate codes for an election
 * POST /api/v1/candidates/codes/generate
 */
async function generateCandidateCodes(req, res, next) {
  const { electionId, count = 1, issuedToEmail, expiresInDays = 30 } = req.body;

  if (!electionId) {
    return next(new AppError('Election ID is required to generate candidate codes.', 400, 'ELECTION_ID_REQUIRED'));
  }

  const numCodes = Math.min(Math.max(parseInt(count, 10) || 1, 1), 50);

  // Verify election exists
  const electRes = await query('SELECT id, title, status FROM elections WHERE id = $1', [electionId]);
  if (electRes.rows.length === 0) {
    return next(new AppError('The specified election does not exist.', 404, 'ELECTION_NOT_FOUND'));
  }

  const expiresAt = new Date(Date.now() + (parseInt(expiresInDays, 10) || 30) * 24 * 60 * 60 * 1000);
  const issuerId = req.user.id;
  const generatedCodes = [];

  for (let i = 0; i < numCodes; i++) {
    const code = generateSecureCandidateCode();
    const insertRes = await query(`
      INSERT INTO candidate_codes (
        code, election_id, issued_by, issued_to_email, status, expires_at
      ) VALUES ($1, $2, $3, $4, 'UNUSED', $5)
      RETURNING id, code, election_id, issued_to_email, status, expires_at, created_at;
    `, [code, electionId, issuerId, issuedToEmail ? issuedToEmail.toLowerCase().trim() : null, expiresAt]);

    generatedCodes.push(insertRes.rows[0]);
  }

  // Audit code generation
  await AuditService.log({
    action: 'CANDIDATE_CODES_GENERATED',
    userId: req.user.id,
    userEmail: req.user.email,
    userRole: req.user.role,
    entityType: 'candidate_code',
    entityId: generatedCodes[0].id,
    details: {
      electionId,
      count: numCodes,
      issuedToEmail: issuedToEmail || null,
      expiresAt: expiresAt.toISOString()
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendCreated(res, {
    electionId,
    totalGenerated: generatedCodes.length,
    codes: generatedCodes
  }, `Successfully generated ${generatedCodes.length} candidate code(s).`);
}

/**
 * List candidate codes with status filtering and pagination
 * GET /api/v1/candidates/codes
 */
async function listCandidateCodes(req, res, next) {
  const { electionId, status, search } = req.query;
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (electionId) {
    params.push(electionId);
    conditions.push(`cc.election_id = $${params.length}`);
  }

  if (status) {
    params.push(status.toUpperCase());
    conditions.push(`cc.status = $${params.length}`);
  }

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(cc.code) LIKE $${params.length} OR LOWER(cc.issued_to_email) LIKE $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM candidate_codes cc ${whereClause};`;
  const countRes = await query(countSql, params);
  const totalCount = parseInt(countRes.rows[0].total, 10);

  const dataParams = [...params, limit, offset];
  const dataSql = `
    SELECT 
      cc.id,
      cc.code,
      cc.election_id,
      e.title as election_title,
      cc.status,
      cc.issued_to_email,
      cc.expires_at,
      cc.created_at,
      issuer.email as issued_by_email,
      user_candidate.email as used_by_email,
      user_candidate.full_name as used_by_name
    FROM candidate_codes cc
    LEFT JOIN elections e ON cc.election_id = e.id
    LEFT JOIN users issuer ON cc.issued_by = issuer.id
    LEFT JOIN users user_candidate ON cc.used_by = user_candidate.id
    ${whereClause}
    ORDER BY cc.created_at DESC
    LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length};
  `;

  const codesRes = await query(dataSql, dataParams);

  return sendPaginated(res, codesRes.rows, totalCount, page, limit, 'Candidate codes retrieved successfully.');
}

/**
 * Revoke an unused candidate code
 * PATCH /api/v1/candidates/codes/:id/revoke
 */
async function revokeCandidateCode(req, res, next) {
  const { id } = req.params;

  const codeRes = await query('SELECT id, code, status, election_id FROM candidate_codes WHERE id = $1', [id]);
  if (codeRes.rows.length === 0) {
    return next(new AppError('Candidate code not found.', 404, 'CANDIDATE_CODE_NOT_FOUND'));
  }

  const codeRecord = codeRes.rows[0];
  if (codeRecord.status !== 'UNUSED') {
    return next(new AppError(`Cannot revoke candidate code with status '${codeRecord.status}'. Only UNUSED codes may be revoked.`, 400, 'INVALID_CODE_STATE'));
  }

  await query(
    `UPDATE candidate_codes SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [id]
  );

  await AuditService.log({
    action: 'CANDIDATE_CODE_REVOKED',
    userId: req.user.id,
    userEmail: req.user.email,
    userRole: req.user.role,
    entityType: 'candidate_code',
    entityId: id,
    details: { code: codeRecord.code, electionId: codeRecord.election_id },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendSuccess(res, { id, status: 'REVOKED' }, 'Candidate code successfully revoked.');
}

// ==============================================================================
// 2. CANDIDATE APPLICATION SUBMISSION (Verified Voters)
// ==============================================================================

/**
 * Submit candidate application
 * POST /api/v1/candidates/apply
 */
async function applyForCandidacy(req, res, next) {
  const user = req.user;
  const {
    electionId,
    positionId,
    candidateCode,
    externalPaymentReference,
    paymentReference,
    manifesto,
    campaignPitch
  } = req.body;

  const paymentRef = (externalPaymentReference || paymentReference || '').toString().trim();

  // 1. Rule 3: Verification Check
  if (!user.is_verified || user.verification_status !== 'APPROVED') {
    return next(new AppError(
      'You must be an approved, verified voter before you can apply to become a candidate.',
      403,
      'UNVERIFIED_USER_CANNOT_CONTEST'
    ));
  }

  // 2. Validate Required Fields
  if (!electionId || !positionId || !candidateCode || !paymentRef) {
    return next(new AppError(
      'Election ID, Position ID, Candidate Code, and External Payment Reference are mandatory.',
      400,
      'MISSING_REQUIRED_FIELDS'
    ));
  }

  if (paymentRef.length < 1) {
    return next(new AppError(
      'A valid external payment reference is required to verify candidate fee submission.',
      400,
      'INVALID_PAYMENT_REFERENCE'
    ));
  }

  // 3. Verify Election exists and is accepting candidates (UPCOMING or OPEN)
  const electRes = await query('SELECT id, title, status FROM elections WHERE id = $1', [electionId]);
  if (electRes.rows.length === 0) {
    return next(new AppError('Target election not found.', 404, 'ELECTION_NOT_FOUND'));
  }

  const election = electRes.rows[0];
  if (!['UPCOMING', 'OPEN'].includes(election.status)) {
    return next(new AppError(
      `Cannot apply for election with status '${election.status}'. Candidacy applications are only accepted for UPCOMING or OPEN elections.`,
      400,
      'ELECTION_NOT_ACCEPTING_APPLICATIONS'
    ));
  }

  // 4. Verify Position belongs to this Election
  const posRes = await query(`
    SELECT p.id, p.name 
    FROM positions p
    INNER JOIN election_positions ep ON p.id = ep.position_id
    WHERE ep.election_id = $1 AND p.id = $2;
  `, [electionId, positionId]);

  if (posRes.rows.length === 0) {
    return next(new AppError(
      'The selected position does not belong to this election or is inactive.',
      400,
      'INVALID_ELECTION_POSITION'
    ));
  }

  // 5. CRITICAL ELECTION RULE 2: One candidate, one position in a particular election
  const existingApp = await query(
    'SELECT id, position_id, status FROM candidate_applications WHERE election_id = $1 AND user_id = $2',
    [electionId, user.id]
  );
  if (existingApp.rows.length > 0) {
    return next(new AppError(
      'CRITICAL ELECTION RULE VIOLATION: You have already applied for a position in this election. A candidate can contest for ONLY ONE position in a particular election.',
      409,
      'CANDIDATE_MULTIPLE_POSITIONS_FORBIDDEN'
    ));
  }

  // Check approved candidates table as well
  const existingCandidate = await query(
    'SELECT id, position_id FROM candidates WHERE election_id = $1 AND user_id = $2',
    [electionId, user.id]
  );
  if (existingCandidate.rows.length > 0) {
    return next(new AppError(
      'CRITICAL ELECTION RULE VIOLATION: You are already an approved candidate for this election. A candidate can contest for ONLY ONE position.',
      409,
      'ALREADY_CONTESTING_IN_ELECTION'
    ));
  }

  // 6. Handle File Uploads (Photo & Credentials)
  let photoUrl = null;
  let credentialsPath = null;

  if (req.files) {
    if (req.files.photo && req.files.photo.length > 0) {
      photoUrl = `/api/v1/candidates/photos/${req.files.photo[0].filename}`;
    }
    if (req.files.credentials && req.files.credentials.length > 0) {
      credentialsPath = req.files.credentials[0].filename;
    }
  }

  // 7. Atomic Transaction: Validate & consume Candidate Code + insert Application
  const newApplication = await withTransaction(async (client) => {
    // Validate candidate code with row lock (supports spaces or hyphens)
    const cleanCode = candidateCode.toString().trim().toUpperCase().replace(/\s+/g, '-');
    const compactCode = cleanCode.replace(/[- ]/g, '');
    const codeQuery = await client.query(
      `SELECT id, election_id, status, expires_at 
       FROM candidate_codes 
       WHERE (code = $1 OR REPLACE(code, '-', '') = $2) 
       FOR UPDATE;`,
      [cleanCode, compactCode]
    );

    if (codeQuery.rows.length === 0) {
      throw new AppError('The candidate code provided is invalid.', 400, 'INVALID_CANDIDATE_CODE');
    }

    const codeRecord = codeQuery.rows[0];

    if (codeRecord.election_id !== electionId) {
      throw new AppError('The candidate code provided is not valid for this election.', 400, 'CANDIDATE_CODE_ELECTION_MISMATCH');
    }

    if (codeRecord.status !== 'UNUSED') {
      throw new AppError(`The candidate code has already been ${codeRecord.status.toLowerCase()}. A single-use code is required.`, 400, 'CANDIDATE_CODE_ALREADY_USED');
    }

    if (codeRecord.expires_at && new Date(codeRecord.expires_at) < new Date()) {
      throw new AppError('The candidate code has expired.', 400, 'CANDIDATE_CODE_EXPIRED');
    }

    // Mark code as USED
    await client.query(`
      UPDATE candidate_codes 
      SET 
        status = 'USED',
        used_by = $1,
        used_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2;
    `, [user.id, codeRecord.id]);

    // Insert into candidate_applications
    const insertAppSql = `
      INSERT INTO candidate_applications (
        user_id,
        election_id,
        position_id,
        candidate_code_id,
        external_payment_reference,
        payment_verified,
        status,
        manifesto,
        campaign_pitch,
        photo_url,
        credentials_document_path
      ) VALUES ($1, $2, $3, $4, $5, FALSE, 'PENDING', $6, $7, $8, $9)
      RETURNING id, user_id, election_id, position_id, external_payment_reference, status, manifesto, campaign_pitch, photo_url, created_at;
    `;

    const appRes = await client.query(insertAppSql, [
      user.id,
      electionId,
      positionId,
      codeRecord.id,
      paymentRef,
      manifesto || null,
      campaignPitch || null,
      photoUrl,
      credentialsPath
    ]);

    return appRes.rows[0];
  });

  // 8. Audit Log
  await AuditService.log({
    action: 'CANDIDATE_APPLICATION_SUBMITTED',
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    entityType: 'candidate_application',
    entityId: newApplication.id,
    details: {
      electionId,
      positionId,
      externalPaymentReference: paymentRef
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  // Notify Admins and Validators
  await NotificationService.notifyAdminsAndValidators({
    type: 'VERIFICATION_REQUEST',
    title: 'New Candidate Application Submitted',
    message: `${user.full_name} (${user.admission_number}) submitted an application to contest for election.`,
    link: '/validator'
  });

  return sendCreated(res, {
    application: newApplication
  }, 'Candidate application submitted successfully. Awaiting validator credential review.');
}

// ==============================================================================
// 3. CANDIDATE APPLICATION REVIEW (Validator & Administrator)
// ==============================================================================

/**
 * List candidate applications (Staff review queue)
 * GET /api/v1/candidates/applications
 */
async function listCandidateApplications(req, res, next) {
  const { electionId, status } = req.query;
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (electionId) {
    params.push(electionId);
    conditions.push(`ca.election_id = $${params.length}`);
  }

  if (status) {
    params.push(status.toUpperCase());
    conditions.push(`ca.status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM candidate_applications ca ${whereClause};`;
  const countRes = await query(countSql, params);
  const totalCount = parseInt(countRes.rows[0].total, 10);

  const dataParams = [...params, limit, offset];
  const dataSql = `
    SELECT 
      ca.id,
      ca.id as application_id,
      ca.user_id,
      u.full_name,
      u.full_name as applicant_name,
      u.admission_number,
      u.email,
      u.email as applicant_email,
      ca.election_id,
      e.title as election_title,
      ca.position_id,
      p.name as position_name,
      ca.external_payment_reference,
      ca.external_payment_reference as payment_reference,
      cc.code as candidate_code,
      ca.payment_verified,
      ca.status,
      ca.photo_url,
      ca.credentials_document_path,
      ca.manifesto,
      ca.campaign_pitch,
      ca.rejection_reason,
      ca.reviewed_at,
      reviewer.email as reviewed_by_email,
      ca.created_at,
      ca.created_at as submitted_at
    FROM candidate_applications ca
    INNER JOIN users u ON ca.user_id = u.id
    INNER JOIN positions p ON ca.position_id = p.id
    INNER JOIN elections e ON ca.election_id = e.id
    LEFT JOIN candidate_codes cc ON ca.candidate_code_id = cc.id
    LEFT JOIN users reviewer ON ca.reviewed_by = reviewer.id
    ${whereClause}
    ORDER BY ca.created_at ASC
    LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length};
  `;

  const appsRes = await query(dataSql, dataParams);

  return sendPaginated(res, appsRes.rows, totalCount, page, limit, 'Candidate applications retrieved successfully.');
}

/**
 * Get candidate application details by ID
 * GET /api/v1/candidates/applications/:id
 */
async function getApplicationDetails(req, res, next) {
  const { id } = req.params;

  const appSql = `
    SELECT 
      ca.*,
      u.full_name as applicant_name,
      u.admission_number,
      u.email as applicant_email,
      u.is_verified as voter_is_verified,
      u.verification_status as voter_verification_status,
      p.name as position_name,
      e.title as election_title,
      e.status as election_status,
      cc.code as candidate_code_used
    FROM candidate_applications ca
    INNER JOIN users u ON ca.user_id = u.id
    INNER JOIN positions p ON ca.position_id = p.id
    INNER JOIN elections e ON ca.election_id = e.id
    LEFT JOIN candidate_codes cc ON ca.candidate_code_id = cc.id
    WHERE ca.id = $1;
  `;

  const appRes = await query(appSql, [id]);
  if (appRes.rows.length === 0) {
    return next(new AppError('Candidate application not found.', 404, 'APPLICATION_NOT_FOUND'));
  }

  const application = appRes.rows[0];

  // RBAC / IDOR Protection: Owner or Staff
  const isOwner = req.user.id === application.user_id;
  const isStaff = req.user.role === 'ADMINISTRATOR' || req.user.role === 'VALIDATOR';

  if (!isOwner && !isStaff) {
    return next(new AppError('You do not have permission to view this candidate application.', 403, 'FORBIDDEN_APPLICATION_ACCESS'));
  }

  return sendSuccess(res, { application }, 'Candidate application details retrieved.');
}

/**
 * Review Candidate Application (Approve or Reject)
 * PATCH /api/v1/candidates/applications/:id/review
 */
async function reviewCandidateApplication(req, res, next) {
  const { id } = req.params;
  const { status, rejectionReason, paymentVerified = true } = req.body;
  const reviewer = req.user;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return next(new AppError('Review status must be either APPROVED or REJECTED.', 400, 'INVALID_REVIEW_STATUS'));
  }

  if (status === 'REJECTED' && (!rejectionReason || rejectionReason.trim().length < 3)) {
    return next(new AppError('A valid rejection reason is required when rejecting a candidate application.', 400, 'REJECTION_REASON_REQUIRED'));
  }

  const appRes = await query('SELECT * FROM candidate_applications WHERE id = $1', [id]);
  if (appRes.rows.length === 0) {
    return next(new AppError('Candidate application not found.', 404, 'APPLICATION_NOT_FOUND'));
  }

  const application = appRes.rows[0];
  const isApproved = status === 'APPROVED';

  // Process Approval / Rejection in Atomic Transaction
  const reviewResult = await withTransaction(async (client) => {
    // 1. Update candidate_applications
    await client.query(`
      UPDATE candidate_applications
      SET 
        status = $1,
        payment_verified = $2,
        reviewed_by = $3,
        reviewed_at = CURRENT_TIMESTAMP,
        rejection_reason = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5;
    `, [status, isApproved ? Boolean(paymentVerified) : false, reviewer.id, isApproved ? null : rejectionReason.trim(), id]);

    let candidateRecord = null;

    if (isApproved) {
      // 2. CRITICAL ELECTION RULE 2: Insert into official candidates table
      // ON CONFLICT (election_id, user_id) DO NOTHING to prevent duplicate entry
      const insertCandidateSql = `
        INSERT INTO candidates (
          election_id,
          user_id,
          position_id,
          application_id,
          photo_url,
          manifesto,
          campaign_statement,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'APPROVED')
        ON CONFLICT (election_id, user_id) 
        DO UPDATE SET
          position_id = EXCLUDED.position_id,
          photo_url = EXCLUDED.photo_url,
          manifesto = EXCLUDED.manifesto,
          campaign_statement = EXCLUDED.campaign_statement,
          status = 'APPROVED',
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;

      const cRes = await client.query(insertCandidateSql, [
        application.election_id,
        application.user_id,
        application.position_id,
        application.id,
        application.photo_url,
        application.manifesto,
        application.campaign_pitch
      ]);

      candidateRecord = cRes.rows[0];

      // 3. Promote User Role to CANDIDATE if they were VOTER
      await client.query(`
        UPDATE users 
        SET role = 'CANDIDATE', updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1 AND role = 'VOTER';
      `, [application.user_id]);

      // 4. Automatically publish candidate campaign announcement to Feed/Trends section
      const applicantUserRes = await client.query('SELECT full_name FROM users WHERE id = $1', [application.user_id]);
      const posRes = await client.query('SELECT name FROM positions WHERE id = $1', [application.position_id]);
      const electRes = await client.query('SELECT title FROM elections WHERE id = $1', [application.election_id]);

      const candidateName = applicantUserRes.rows[0]?.full_name || 'Candidate';
      const positionName = posRes.rows[0]?.name || 'Contested Position';
      const electionTitle = electRes.rows[0]?.title || 'Election';

      const postTitle = `Official Campaign Launch: ${candidateName} for ${positionName}`;
      const postContent = application.manifesto || application.campaign_pitch || `I am officially contesting for ${positionName} in ${electionTitle}. Check out my campaign manifesto!`;

      await client.query(`
        INSERT INTO posts (
          author_id, author_role, post_type, title, content, image_url, candidate_position, status, is_pinned, published_at
        ) VALUES ($1, 'CANDIDATE', 'CAMPAIGN', $2, $3, $4, $5, 'PUBLISHED', FALSE, CURRENT_TIMESTAMP);
      `, [
        application.user_id,
        postTitle,
        postContent,
        application.photo_url || null,
        positionName
      ]);
    }

    return { application, candidateRecord };
  });

  // 4. Audit Log
  await AuditService.log({
    action: isApproved ? 'CANDIDATE_APPROVED' : 'CANDIDATE_REJECTED',
    userId: reviewer.id,
    userEmail: reviewer.email,
    userRole: reviewer.role,
    entityType: 'candidate_application',
    entityId: id,
    details: {
      applicantUserId: application.user_id,
      electionId: application.election_id,
      positionId: application.position_id,
      status,
      rejectionReason: isApproved ? null : rejectionReason.trim()
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  // Notify applicant of review decision
  await NotificationService.createNotification({
    userId: application.user_id,
    type: 'VERIFICATION_STATUS',
    title: `Candidate Application ${isApproved ? 'Approved' : 'Rejected'}`,
    message: isApproved
      ? 'Congratulations! Your candidate application has been approved. You are now contesting on the official ballot.'
      : `Your candidate application was rejected. Reason: ${rejectionReason ? rejectionReason.trim() : 'Application requirements not met.'}`,
    link: '/candidate-portal'
  });

  return sendSuccess(res, {
    applicationId: id,
    status,
    candidate: reviewResult.candidateRecord,
    reviewedBy: reviewer.email,
    reviewedAt: new Date().toISOString()
  }, `Candidate application successfully ${status.toLowerCase()}.`);
}

// ==============================================================================
// 4. PUBLIC CANDIDATE ROSTER & PROFILE ENDPOINTS
// ==============================================================================

/**
 * List approved candidates for an election (Public / Voter roster)
 * GET /api/v1/candidates/elections/:electionId
 */
async function listApprovedCandidates(req, res, next) {
  const { electionId } = req.params;
  const { positionId } = req.query;

  const params = [electionId];
  let positionFilter = '';

  if (positionId) {
    params.push(positionId);
    positionFilter = `AND c.position_id = $2`;
  }

  const sql = `
    SELECT 
      c.id,
      c.id as candidate_id,
      c.election_id,
      e.title as election_title,
      c.position_id,
      p.name as position_name,
      p.display_order as position_display_order,
      u.id as user_id,
      u.full_name,
      c.photo_url,
      c.manifesto,
      c.campaign_statement,
      c.status as candidate_status,
      c.created_at
    FROM candidates c
    INNER JOIN users u ON c.user_id = u.id
    INNER JOIN positions p ON c.position_id = p.id
    INNER JOIN elections e ON c.election_id = e.id
    WHERE c.election_id = $1 AND c.status = 'APPROVED' ${positionFilter}
    ORDER BY p.display_order ASC, u.full_name ASC;
  `;

  const candidatesRes = await query(sql, params);

  return sendSuccess(res, {
    electionId,
    totalCandidates: candidatesRes.rows.length,
    candidates: candidatesRes.rows
  }, 'Approved candidates retrieved successfully.');
}

/**
 * Get individual candidate public profile
 * GET /api/v1/candidates/:id
 */
async function getCandidateProfile(req, res, next) {
  const { id } = req.params;

  const sql = `
    SELECT 
      c.id,
      c.id as candidate_id,
      c.election_id,
      e.title as election_title,
      e.status as election_status,
      c.position_id,
      p.name as position_name,
      u.id as user_id,
      u.full_name,
      c.photo_url,
      c.manifesto,
      c.campaign_statement,
      c.status as candidate_status,
      c.created_at
    FROM candidates c
    INNER JOIN users u ON c.user_id = u.id
    INNER JOIN positions p ON c.position_id = p.id
    INNER JOIN elections e ON c.election_id = e.id
    WHERE c.id = $1;
  `;

  const candidateRes = await query(sql, [id]);
  if (candidateRes.rows.length === 0) {
    return next(new AppError('Candidate not found.', 404, 'CANDIDATE_NOT_FOUND'));
  }

  return sendSuccess(res, { candidate: candidateRes.rows[0] }, 'Candidate profile retrieved.');
}

/**
 * Get authenticated user's candidacy application for an election
 * GET /api/v1/candidates/me/application
 */
async function getMyApplication(req, res, next) {
  const userId = req.user.id;
  const { electionId } = req.query;

  if (!electionId) {
    return next(new AppError('Election ID is required.', 400, 'ELECTION_ID_REQUIRED'));
  }

  const sql = `
    SELECT 
      ca.*,
      p.name as position_name,
      e.title as election_title,
      e.status as election_status
    FROM candidate_applications ca
    INNER JOIN positions p ON ca.position_id = p.id
    INNER JOIN elections e ON ca.election_id = e.id
    WHERE ca.user_id = $1 AND ca.election_id = $2
    ORDER BY ca.created_at DESC LIMIT 1;
  `;

  const appRes = await query(sql, [userId, electionId]);
  const application = appRes.rows.length > 0 ? appRes.rows[0] : null;

  return sendSuccess(res, {
    hasApplied: Boolean(application),
    application
  }, 'User candidate application retrieved.');
}

/**
 * Serve candidate photo safely
 * GET /api/v1/candidates/photos/:filename
 */
async function serveCandidatePhoto(req, res, next) {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);
  const targetPath = path.join(CANDIDATE_PHOTOS_DIR, safeFilename);

  if (!fs.existsSync(targetPath)) {
    return next(new AppError('Candidate photograph not found.', 404, 'PHOTO_NOT_FOUND'));
  }

  return res.sendFile(targetPath);
}

/**
 * Stream private candidate credentials document (Staff / Owner only)
 * GET /api/v1/candidates/applications/:id/credentials
 */
async function getCandidateCredentialsFile(req, res, next) {
  const { id } = req.params;

  const appRes = await query('SELECT id, user_id, credentials_document_path FROM candidate_applications WHERE id = $1', [id]);
  if (appRes.rows.length === 0) {
    return next(new AppError('Candidate application not found.', 404, 'APPLICATION_NOT_FOUND'));
  }

  const appRecord = appRes.rows[0];

  if (!appRecord.credentials_document_path) {
    return next(new AppError('No credentials document was attached to this application.', 404, 'NO_CREDENTIALS_ATTACHED'));
  }

  // RBAC & IDOR: Staff or Owner only
  const isOwner = req.user.id === appRecord.user_id;
  const isStaff = req.user.role === 'ADMINISTRATOR' || req.user.role === 'VALIDATOR';

  if (!isOwner && !isStaff) {
    return next(new AppError('Forbidden: Unauthorized credentials document access.', 403, 'FORBIDDEN_CREDENTIALS_ACCESS'));
  }

  const safeFilename = path.basename(appRecord.credentials_document_path);
  const targetPath = path.join(CANDIDATE_CREDENTIALS_DIR, safeFilename);

  if (!fs.existsSync(targetPath)) {
    return next(new AppError('The requested credentials file does not exist on storage.', 404, 'FILE_NOT_FOUND'));
  }

  return res.sendFile(targetPath);
}

module.exports = {
  generateSecureCandidateCode,
  generateCandidateCodes,
  listCandidateCodes,
  revokeCandidateCode,
  applyForCandidacy,
  listCandidateApplications,
  getApplicationDetails,
  reviewCandidateApplication,
  listApprovedCandidates,
  getCandidateProfile,
  getMyApplication,
  serveCandidatePhoto,
  getCandidateCredentialsFile
};
