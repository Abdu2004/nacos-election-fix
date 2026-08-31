const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/response');
const AuditService = require('../services/auditService');
const NotificationService = require('../services/notificationService');
const storageService = require('../services/storageService');
const { VERIFICATION_DOCS_FOLDER } = require('../middleware/upload');

/**
 * Upload Student Identification Document
 * POST /api/v1/verification/upload
 */
async function uploadDocument(req, res, next) {
  const user = req.user;

  // Enforce single verification submission rule:
  if (user.is_verified || user.verification_status === 'APPROVED') {
    return next(new AppError('Your account is already verified. No further verification submission is allowed.', 400, 'ALREADY_VERIFIED'));
  }

  // Check if user already has a pending document under review
  const pendingDocRes = await query(
    `SELECT id FROM verification_documents 
     WHERE user_id = $1 AND verification_status = 'PENDING'`,
    [user.id]
  );

  if (pendingDocRes.rows.length > 0) {
    return next(new AppError('You have already submitted a verification request. Verification requests can only be sent once while pending review.', 400, 'VERIFICATION_ALREADY_PENDING'));
  }

  if (!req.file) {
    return next(new AppError('No verification document was uploaded. Please attach a file.', 400, 'NO_FILE_UPLOADED'));
  }

  const { documentType = 'STUDENT_ID_CARD' } = req.body;

  // Upload the in-memory file buffer to Supabase Storage instead of local disk
  const storedFilename = await storageService.uploadFile(
    VERIFICATION_DOCS_FOLDER,
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype
  );

  const insertOrUpdateSql = `
    INSERT INTO verification_documents (
      user_id, document_type, file_path, original_filename, mime_type, file_size_bytes, verification_status
    ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
    RETURNING id, document_type, original_filename, mime_type, file_size_bytes, verification_status, created_at;
  `;

  const params = [
    user.id,
    documentType,
    storedFilename, // Store the Supabase Storage filename, not a local path
    req.file.originalname,
    req.file.mimetype,
    req.file.size
  ];

  const docRes = await withTransaction(async (client) => {
    // 1. Insert document record
    const dRes = await client.query(insertOrUpdateSql, params);
    
    // 2. Set user verification status to PENDING
    await client.query(
      `UPDATE users 
       SET verification_status = 'PENDING', is_verified = FALSE, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [user.id]
    );

    return dRes.rows[0];
  });

  // 3. Write Audit Log
  await AuditService.log({
    action: 'VOTER_DOCUMENT_SUBMITTED',
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    entityType: 'verification_document',
    entityId: docRes.id,
    details: {
      documentType: docRes.document_type,
      fileSize: docRes.file_size_bytes,
      mimeType: docRes.mime_type
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  // Notify Admins and Validators of new pending verification
  await NotificationService.notifyAdminsAndValidators({
    type: 'VERIFICATION_REQUEST',
    title: 'New Voter Verification Request',
    message: `Student ${user.full_name} (${user.admission_number}) submitted ${documentType} for identity verification.`,
    link: '/validator'
  });

  return sendCreated(res, {
    document: docRes
  }, 'Verification document uploaded successfully. Awaiting validator review.');
}

/**
 * Get current authenticated user's voter verification status
 * GET /api/v1/verification/status
 */
async function getVerificationStatus(req, res, next) {
  const userId = req.user.id;

  const userRes = await query(
    'SELECT id, full_name, admission_number, email, is_verified, verification_status FROM users WHERE id = $1',
    [userId]
  );

  const docRes = await query(
    `SELECT id, document_type, original_filename, mime_type, file_size_bytes, verification_status, reviewed_at, rejection_reason, created_at
     FROM verification_documents 
     WHERE user_id = $1 
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  const user = userRes.rows[0];
  const document = docRes.rows.length > 0 ? docRes.rows[0] : null;

  // Determine effective status:
  let effectiveStatus = 'NOT_SUBMITTED';
  if (user.is_verified || user.verification_status === 'APPROVED') {
    effectiveStatus = 'APPROVED';
  } else if (document) {
    effectiveStatus = document.verification_status;
  }

  return sendSuccess(res, {
    isVerified: user.is_verified,
    verificationStatus: effectiveStatus,
    document,
    rejectionReason: document ? document.rejection_reason : null
  }, 'Verification status retrieved.');
}

/**
 * Securely stream / download private verification document file
 * GET /api/v1/verification/documents/:id/file
 */
async function getDocumentFile(req, res, next) {
  const { id } = req.params;

  const docRes = await query(
    'SELECT id, user_id, file_path, original_filename, mime_type FROM verification_documents WHERE id = $1',
    [id]
  );

  if (docRes.rows.length === 0) {
    return next(new AppError('Verification document not found.', 404, 'DOCUMENT_NOT_FOUND'));
  }

  const doc = docRes.rows[0];

  // Access Control: Must be the owner OR staff (ADMINISTRATOR / VALIDATOR)
  const isOwner = req.user.id === doc.user_id;
  const isStaff = req.user.role === 'ADMINISTRATOR' || req.user.role === 'VALIDATOR';

  if (!isOwner && !isStaff) {
    return next(new AppError('Unauthorized access to private verification document.', 403, 'FORBIDDEN_DOCUMENT_ACCESS'));
  }

  const fileBuffer = await storageService.downloadFile(VERIFICATION_DOCS_FOLDER, doc.file_path);

  if (!fileBuffer) {
    return next(new AppError('The requested document file does not exist on storage.', 404, 'FILE_NOT_FOUND'));
  }

  res.setHeader('Content-Type', doc.mime_type);
  res.setHeader('Content-Disposition', `inline; filename="${doc.original_filename}"`);
  return res.send(fileBuffer);
}

/**
 * List pending voter verification applications (Validator / Admin only)
 * GET /api/v1/verification/pending
 */
async function listPendingApplications(req, res, next) {
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const offset = (page - 1) * limit;

  const countRes = await query(`
    SELECT COUNT(DISTINCT u.id) as total 
    FROM users u 
    INNER JOIN verification_documents vd ON u.id = vd.user_id 
    WHERE u.verification_status = 'PENDING' AND vd.verification_status = 'PENDING';
  `);
  const totalCount = parseInt(countRes.rows[0].total, 10);

  const applicationsRes = await query(`
    SELECT 
      u.id as user_id,
      u.full_name,
      u.admission_number,
      u.email,
      u.verification_status as user_verification_status,
      vd.id,
      vd.id as document_id,
      vd.document_type,
      vd.original_filename,
      vd.file_size_bytes,
      vd.mime_type,
      vd.created_at,
      vd.created_at as submitted_at
    FROM users u
    INNER JOIN verification_documents vd ON u.id = vd.user_id
    WHERE u.verification_status = 'PENDING' AND vd.verification_status = 'PENDING'
    ORDER BY vd.created_at ASC
    LIMIT $1 OFFSET $2;
  `, [limit, offset]);

  return sendPaginated(res, applicationsRes.rows, totalCount, page, limit, 'Pending voter verification applications retrieved.');
}

/**
 * Review voter application (Approve or Reject)
 * PATCH /api/v1/verification/applications/:id/review
 */
async function reviewApplication(req, res, next) {
  const { id } = req.params; // document_id
  const { status, rejectionReason } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return next(new AppError('Review status must be either APPROVED or REJECTED.', 400, 'INVALID_REVIEW_STATUS'));
  }

  if (status === 'REJECTED' && (!rejectionReason || rejectionReason.trim().length < 3)) {
    return next(new AppError('A valid rejection reason is required when rejecting a voter application.', 400, 'REJECTION_REASON_REQUIRED'));
  }

  const docRes = await query(
    'SELECT id, user_id, verification_status FROM verification_documents WHERE id = $1',
    [id]
  );

  if (docRes.rows.length === 0) {
    return next(new AppError('Verification application document not found.', 404, 'APPLICATION_NOT_FOUND'));
  }

  const doc = docRes.rows[0];
  const isApproved = status === 'APPROVED';
  const reviewerId = req.user.id;

  await withTransaction(async (client) => {
    // 1. Update verification_documents
    await client.query(`
      UPDATE verification_documents 
      SET 
        verification_status = $1,
        reviewed_by = $2,
        reviewed_at = CURRENT_TIMESTAMP,
        rejection_reason = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4;
    `, [status, reviewerId, isApproved ? null : rejectionReason.trim(), id]);

    // 2. Update user state
    await client.query(`
      UPDATE users 
      SET 
        is_verified = $1,
        verification_status = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3;
    `, [isApproved, status, doc.user_id]);
  });

  // 3. Write Audit Log
  await AuditService.log({
    action: isApproved ? 'VOTER_APPROVED' : 'VOTER_REJECTED',
    userId: reviewerId,
    userEmail: req.user.email,
    userRole: req.user.role,
    entityType: 'user',
    entityId: doc.user_id,
    details: {
      documentId: id,
      status,
      rejectionReason: isApproved ? null : rejectionReason
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  // Notify user of verification status change
  await NotificationService.createNotification({
    userId: doc.user_id,
    type: 'VERIFICATION_STATUS',
    title: `Voter Verification ${isApproved ? 'Approved' : 'Rejected'}`,
    message: isApproved
      ? 'Congratulations! Your student identity verification has been approved. You are now eligible to vote in active elections.'
      : `Your student identity verification was rejected. Reason: ${rejectionReason ? rejectionReason.trim() : 'Document requirements not satisfied.'}`,
    link: '/verification'
  });

  return sendSuccess(res, {
    documentId: id,
    userId: doc.user_id,
    status,
    reviewedBy: req.user.email,
    reviewedAt: new Date().toISOString()
  }, `Voter verification application ${status.toLowerCase()} successfully.`);
}

module.exports = {
  uploadDocument,
  getVerificationStatus,
  getDocumentFile,
  listPendingApplications,
  reviewApplication
};
