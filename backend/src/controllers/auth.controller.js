const { query, withTransaction } = require('../config/db');
const { hashPassword, comparePassword, generateOTP, hashOTP, compareOTP } = require('../utils/crypto');
const { generateTokens, verifyRefreshToken } = require('../utils/token');
const { sendOTPEmail } = require('../services/emailService');
const AuditService = require('../services/auditService');
const AppError = require('../utils/AppError');
const { sendSuccess, sendCreated } = require('../utils/response');
const config = require('../config/env');

/**
 * Determine effective verification status based on submitted verification documents
 */
async function getEffectiveVerificationStatus(userId, isVerified, defaultStatus) {
  if (isVerified || defaultStatus === 'APPROVED') return 'APPROVED';
  const docRes = await query(
    `SELECT verification_status FROM verification_documents 
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  if (docRes.rows.length > 0) {
    return docRes.rows[0].verification_status;
  }
  return 'NOT_SUBMITTED';
}

/**
 * Register a new Student Voter account
 * POST /api/v1/auth/register
 */
async function register(req, res, next) {
  const { fullName, admissionNumber, email, password } = req.body;

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedAdmission = admissionNumber.trim().toUpperCase();

  // 1. Validate NACOS admission number format: 10 digits with '204' as digits 5, 6, and 7
  const nacosAdmissionRegex = /^\d{4}204\d{3}$/;
  if (!nacosAdmissionRegex.test(normalizedAdmission)) {
    return next(new AppError(
      "Invalid NACOS admission number. It must be exactly 10 digits with '204' as the 5th, 6th, and 7th digits (e.g., 2022204001).",
      400,
      'INVALID_ADMISSION_NUMBER'
    ));
  }

  // 2. Check if user with same email already exists
  const existingEmailRes = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existingEmailRes.rows.length > 0) {
    return next(new AppError('An account with this Gmail address already exists.', 409, 'DUPLICATE_EMAIL'));
  }

  // 3. Check if user with same admission number already exists
  const existingAdmRes = await query('SELECT id FROM users WHERE admission_number = $1', [normalizedAdmission]);
  if (existingAdmRes.rows.length > 0) {
    return next(new AppError('An account with this admission number already exists.', 409, 'DUPLICATE_ADMISSION_NUMBER'));
  }

  // 3. Hash password
  const passwordHash = await hashPassword(password);

  // 4. Insert user into database
  const insertSql = `
    INSERT INTO users (
      full_name, admission_number, email, password_hash, role, is_verified, verification_status, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, full_name, admission_number, email, role, is_verified, verification_status, status, created_at;
  `;
  const insertParams = [
    fullName.trim(),
    normalizedAdmission,
    normalizedEmail,
    passwordHash,
    'VOTER',
    false,
    'PENDING',
    'ACTIVE'
  ];

  const userRes = await query(insertSql, insertParams);
  const newUser = userRes.rows[0];

  // 5. Generate Auth Tokens
  const tokens = generateTokens(newUser);

  // 6. Write Audit Log
  await AuditService.log({
    action: 'USER_REGISTERED',
    userId: newUser.id,
    userEmail: newUser.email,
    userRole: newUser.role,
    entityType: 'user',
    entityId: newUser.id,
    details: {
      admissionNumber: newUser.admission_number,
      verificationStatus: newUser.verification_status
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendCreated(res, {
    user: {
      id: newUser.id,
      fullName: newUser.full_name,
      admissionNumber: newUser.admission_number,
      email: newUser.email,
      role: newUser.role,
      isVerified: newUser.is_verified,
      verificationStatus: 'NOT_SUBMITTED',
      status: newUser.status,
      createdAt: newUser.created_at
    },
    tokens
  }, 'Student registration completed successfully. Please proceed to upload verification documents.');
}

/**
 * Standard Password Login
 * POST /api/v1/auth/login
 */
async function loginWithPassword(req, res, next) {
  const { email, password } = req.body;
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Fetch user by email
  const userRes = await query(
    'SELECT id, full_name, admission_number, email, password_hash, role, is_verified, verification_status, status FROM users WHERE email = $1',
    [normalizedEmail]
  );

  if (userRes.rows.length === 0) {
    return next(new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS'));
  }

  const user = userRes.rows[0];

  if (user.status !== 'ACTIVE') {
    return next(new AppError('Your account has been deactivated. Please contact an administrator.', 403, 'ACCOUNT_INACTIVE'));
  }

  // 2. Compare password
  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) {
    return next(new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS'));
  }

  // 3. Generate tokens
  const tokens = generateTokens(user);
  const effectiveVerificationStatus = await getEffectiveVerificationStatus(user.id, user.is_verified, user.verification_status);

  // 4. Audit Log
  await AuditService.log({
    action: 'USER_LOGIN_PASSWORD',
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    entityType: 'user',
    entityId: user.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendSuccess(res, {
    user: {
      id: user.id,
      fullName: user.full_name,
      admissionNumber: user.admission_number,
      email: user.email,
      role: user.role,
      isVerified: user.is_verified,
      verificationStatus: effectiveVerificationStatus
    },
    tokens
  }, 'Logged in successfully.');
}

/**
 * Request a One-Time Password (OTP) for Gmail Authentication
 * POST /api/v1/auth/request-otp
 */
async function requestOTP(req, res, next) {
  const { email } = req.body;
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Verify user exists
  const userRes = await query(
    'SELECT id, full_name, email, status FROM users WHERE email = $1',
    [normalizedEmail]
  );

  if (userRes.rows.length === 0) {
    return next(new AppError('No account found with this Gmail address.', 404, 'USER_NOT_FOUND'));
  }

  const user = userRes.rows[0];

  if (user.status !== 'ACTIVE') {
    return next(new AppError('Your account is not active.', 403, 'ACCOUNT_INACTIVE'));
  }

  // 2. Check for recent OTP cooldown (60 seconds)
  const recentOtpRes = await query(
    `SELECT created_at FROM otp_verifications 
     WHERE email = $1 AND purpose = 'AUTHENTICATION' AND is_used = FALSE 
     ORDER BY created_at DESC LIMIT 1`,
    [normalizedEmail]
  );

  if (recentOtpRes.rows.length > 0) {
    const lastCreated = new Date(recentOtpRes.rows[0].created_at).getTime();
    const timeDiffSeconds = (Date.now() - lastCreated) / 1000;
    if (timeDiffSeconds < 60) {
      const waitSeconds = Math.ceil(60 - timeDiffSeconds);
      return next(new AppError(`Please wait ${waitSeconds} seconds before requesting a new OTP.`, 429, 'OTP_COOLDOWN_ACTIVE'));
    }
  }

  // 3. Generate secure OTP and Hash
  const otp = generateOTP(6);
  const otpHash = await hashOTP(otp);
  const expiryMinutes = config.otp.expiryMinutes || 10;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  // 4. Save to database
  await query(
    `INSERT INTO otp_verifications (
      email, otp_hash, purpose, attempts, max_attempts, is_used, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [normalizedEmail, otpHash, 'AUTHENTICATION', 0, 3, false, expiresAt]
  );

  // 5. Send email via Nodemailer
  await sendOTPEmail(normalizedEmail, otp, user.full_name, expiryMinutes);

  // 6. Audit Log (Never log OTP values!)
  await AuditService.log({
    action: 'OTP_REQUESTED',
    userId: user.id,
    userEmail: user.email,
    details: { purpose: 'AUTHENTICATION', expiryMinutes },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendSuccess(res, {
    email: normalizedEmail,
    expiryMinutes
  }, `A 6-digit verification code has been sent to ${normalizedEmail}.`);
}

/**
 * Verify OTP and Authenticate User
 * POST /api/v1/auth/verify-otp
 */
async function verifyOTPAndLogin(req, res, next) {
  const { email, otp } = req.body;
  const normalizedEmail = email.trim().toLowerCase();
  const cleanOtp = String(otp).trim();

  // 1. Fetch the latest active OTP record for this email
  const otpRecordRes = await query(
    `SELECT id, otp_hash, attempts, max_attempts, is_used, expires_at 
     FROM otp_verifications 
     WHERE email = $1 AND purpose = 'AUTHENTICATION' AND is_used = FALSE 
     ORDER BY created_at DESC LIMIT 1`,
    [normalizedEmail]
  );

  if (otpRecordRes.rows.length === 0) {
    return next(new AppError('No active OTP found. Please request a new code.', 400, 'OTP_NOT_FOUND'));
  }

  const otpRecord = otpRecordRes.rows[0];

  // 2. Check if expired
  if (new Date(otpRecord.expires_at) < new Date()) {
    await query('UPDATE otp_verifications SET is_used = TRUE WHERE id = $1', [otpRecord.id]);
    return next(new AppError('This verification code has expired. Please request a new code.', 400, 'OTP_EXPIRED'));
  }

  // 3. Check attempt limit
  if (otpRecord.attempts >= otpRecord.max_attempts) {
    await query('UPDATE otp_verifications SET is_used = TRUE WHERE id = $1', [otpRecord.id]);
    return next(new AppError('Maximum OTP attempts exceeded. Code has been invalidated.', 400, 'OTP_MAX_ATTEMPTS_EXCEEDED'));
  }

  // 4. Compare OTP
  const isMatch = await compareOTP(cleanOtp, otpRecord.otp_hash);

  if (!isMatch) {
    const newAttempts = otpRecord.attempts + 1;
    await query('UPDATE otp_verifications SET attempts = $1 WHERE id = $2', [newAttempts, otpRecord.id]);
    const remaining = otpRecord.max_attempts - newAttempts;
    if (remaining <= 0) {
      await query('UPDATE otp_verifications SET is_used = TRUE WHERE id = $1', [otpRecord.id]);
      return next(new AppError('Invalid OTP code. Maximum attempts reached; code invalidated.', 400, 'OTP_MAX_ATTEMPTS_EXCEEDED'));
    }
    return next(new AppError(`Invalid verification code. ${remaining} attempt(s) remaining.`, 400, 'OTP_INVALID', { remainingAttempts: remaining }));
  }

  // 5. Mark OTP as used
  await query('UPDATE otp_verifications SET is_used = TRUE WHERE id = $1', [otpRecord.id]);

  // 6. Fetch user details
  const userRes = await query(
    'SELECT id, full_name, admission_number, email, role, is_verified, verification_status, status FROM users WHERE email = $1',
    [normalizedEmail]
  );

  if (userRes.rows.length === 0) {
    return next(new AppError('User account not found.', 404, 'USER_NOT_FOUND'));
  }

  const user = userRes.rows[0];
  const tokens = generateTokens(user);
  const effectiveVerificationStatus = await getEffectiveVerificationStatus(user.id, user.is_verified, user.verification_status);

  // 7. Audit Log
  await AuditService.log({
    action: 'USER_LOGIN_OTP',
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    entityType: 'user',
    entityId: user.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendSuccess(res, {
    user: {
      id: user.id,
      fullName: user.full_name,
      admissionNumber: user.admission_number,
      email: user.email,
      role: user.role,
      isVerified: user.is_verified,
      verificationStatus: effectiveVerificationStatus
    },
    tokens
  }, 'OTP verified successfully. Authenticated.');
}

/**
 * Refresh Access Token
 * POST /api/v1/auth/refresh
 */
async function refreshToken(req, res, next) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new AppError('Refresh token is required.', 400, 'MISSING_REFRESH_TOKEN'));
  }

  const decoded = verifyRefreshToken(refreshToken);

  const userRes = await query(
    'SELECT id, full_name, admission_number, email, role, is_verified, verification_status, status FROM users WHERE id = $1',
    [decoded.id]
  );

  if (userRes.rows.length === 0 || userRes.rows[0].status !== 'ACTIVE') {
    return next(new AppError('User session is invalid.', 401, 'INVALID_SESSION'));
  }

  const user = userRes.rows[0];
  const tokens = generateTokens(user);

  return sendSuccess(res, { tokens }, 'Access token refreshed successfully.');
}

/**
 * Get current authenticated user profile
 * GET /api/v1/auth/me
 */
async function getMe(req, res) {
  const effectiveVerificationStatus = await getEffectiveVerificationStatus(req.user.id, req.user.is_verified, req.user.verification_status);
  return sendSuccess(res, {
    user: {
      id: req.user.id,
      fullName: req.user.full_name,
      admissionNumber: req.user.admission_number,
      email: req.user.email,
      role: req.user.role,
      isVerified: req.user.is_verified,
      verificationStatus: effectiveVerificationStatus,
      status: req.user.status
    }
  }, 'User profile retrieved.');
}

/**
 * Request Password Reset OTP
 * POST /api/v1/auth/forgot-password
 */
async function requestPasswordResetOTP(req, res, next) {
  const { email } = req.body;

  if (!email || !email.trim()) {
    return next(new AppError('Registered email address is required.', 400, 'EMAIL_REQUIRED'));
  }

  const normalizedEmail = email.trim().toLowerCase();

  const userRes = await query(
    'SELECT id, full_name, email, status FROM users WHERE email = $1;',
    [normalizedEmail]
  );

  if (userRes.rows.length === 0) {
    return next(new AppError('No account found with this Gmail address.', 404, 'USER_NOT_FOUND'));
  }

  const user = userRes.rows[0];

  if (user.status !== 'ACTIVE') {
    return next(new AppError('Your account is not active. Please contact election administrators.', 403, 'ACCOUNT_INACTIVE'));
  }

  // Check cooldown: 60s
  const recentOtpRes = await query(
    `SELECT created_at FROM otp_verifications 
     WHERE email = $1 AND purpose = 'PASSWORD_RESET' AND is_used = FALSE 
     ORDER BY created_at DESC LIMIT 1`,
    [normalizedEmail]
  );

  if (recentOtpRes.rows.length > 0) {
    const lastCreated = new Date(recentOtpRes.rows[0].created_at).getTime();
    const timeDiffSeconds = (Date.now() - lastCreated) / 1000;
    if (timeDiffSeconds < 60) {
      const waitSeconds = Math.ceil(60 - timeDiffSeconds);
      return next(new AppError(`Please wait ${waitSeconds} seconds before requesting a new password reset code.`, 429, 'OTP_COOLDOWN_ACTIVE'));
    }
  }

  const otp = generateOTP(6);
  const otpHash = await hashOTP(otp);
  const expiryMinutes = config.otp.expiryMinutes || 10;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  await query(
    `INSERT INTO otp_verifications (
      email, otp_hash, purpose, attempts, max_attempts, is_used, expires_at
    ) VALUES ($1, $2, 'PASSWORD_RESET', 0, 3, false, $3)`,
    [normalizedEmail, otpHash, expiresAt]
  );

  await sendOTPEmail(normalizedEmail, otp, user.full_name, expiryMinutes, 'PASSWORD_RESET');

  await AuditService.log({
    action: 'PASSWORD_RESET_REQUESTED',
    userId: user.id,
    userEmail: user.email,
    details: { purpose: 'PASSWORD_RESET', expiryMinutes },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendSuccess(res, {
    email: normalizedEmail,
    expiryMinutes
  }, `Password reset code dispatched to ${normalizedEmail}.`);
}

/**
 * Reset Password with OTP Verification
 * POST /api/v1/auth/reset-password
 */
async function resetPasswordWithOTP(req, res, next) {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return next(new AppError('Email, 6-digit OTP code, and new password are required.', 400, 'MISSING_FIELDS'));
  }

  if (newPassword.length < 6) {
    return next(new AppError('Password must be at least 6 characters long.', 400, 'PASSWORD_TOO_SHORT'));
  }

  const normalizedEmail = email.trim().toLowerCase();

  const otpRes = await query(
    `SELECT id, otp_hash, attempts, max_attempts, is_used, expires_at 
     FROM otp_verifications 
     WHERE email = $1 AND purpose = 'PASSWORD_RESET' AND is_used = FALSE 
     ORDER BY created_at DESC LIMIT 1`,
    [normalizedEmail]
  );

  if (otpRes.rows.length === 0) {
    return next(new AppError('No active password reset request found. Please request a new code.', 400, 'NO_ACTIVE_OTP'));
  }

  const otpRecord = otpRes.rows[0];

  if (new Date() > new Date(otpRecord.expires_at)) {
    return next(new AppError('Your password reset code has expired. Please request a new code.', 400, 'OTP_EXPIRED'));
  }

  if (otpRecord.attempts >= otpRecord.max_attempts) {
    return next(new AppError('Maximum verification attempts exceeded. Please request a new code.', 429, 'MAX_ATTEMPTS_EXCEEDED'));
  }

  const isMatch = await compareOTP(otp, otpRecord.otp_hash);
  if (!isMatch) {
    await query('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1', [otpRecord.id]);
    return next(new AppError('Invalid verification code. Please try again.', 400, 'INVALID_OTP'));
  }

  // Update password in database
  const passwordHash = await hashPassword(newPassword);

  const updateRes = await query(
    `UPDATE users 
     SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE email = $2 
     RETURNING id, full_name, email, role;`,
    [passwordHash, normalizedEmail]
  );

  if (updateRes.rows.length === 0) {
    return next(new AppError('User not found.', 404, 'USER_NOT_FOUND'));
  }

  const updatedUser = updateRes.rows[0];

  // Invalidate OTP
  await query('UPDATE otp_verifications SET is_used = TRUE WHERE id = $1', [otpRecord.id]);

  // Audit Log
  await AuditService.log({
    action: 'PASSWORD_RESET_COMPLETED',
    userId: updatedUser.id,
    userEmail: updatedUser.email,
    userRole: updatedUser.role,
    entityType: 'user',
    entityId: updatedUser.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return sendSuccess(res, { email: normalizedEmail }, 'Password reset successfully. You may now log in with your new password.');
}

/**
 * Logout
 * POST /api/v1/auth/logout
 */
async function logout(req, res) {
  if (req.user) {
    await AuditService.log({
      action: 'USER_LOGOUT',
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
  return sendSuccess(res, null, 'Logged out successfully.');
}

module.exports = {
  register,
  loginWithPassword,
  requestOTP,
  verifyOTPAndLogin,
  requestPasswordResetOTP,
  resetPasswordWithOTP,
  refreshToken,
  getMe,
  logout
};
