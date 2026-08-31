const { verifyAccessToken } = require('../utils/token');
const { query } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Authentication Middleware
 * Enforces valid Bearer JWT access token and attaches authenticated user to req.user
 */
const authenticate = asyncHandler(async (req, res, next) => {
  let token = null;

  // 1. Extract Bearer token from header or query string (?token=)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return next(new AppError('Authentication required. Please provide a valid authorization token.', 401, 'UNAUTHENTICATED'));
  }

  // 2. Verify token signature and expiration
  const decoded = verifyAccessToken(token);

  // 3. Check if user still exists and is active
  const userResult = await query(
    'SELECT id, full_name, admission_number, email, role, is_verified, verification_status, status FROM users WHERE id = $1',
    [decoded.id]
  );

  if (userResult.rows.length === 0) {
    return next(new AppError('The user belonging to this token no longer exists.', 401, 'USER_NOT_FOUND'));
  }

  const currentUser = userResult.rows[0];

  if (currentUser.status !== 'ACTIVE') {
    return next(new AppError('Your account has been suspended or deactivated. Contact an administrator.', 403, 'ACCOUNT_INACTIVE'));
  }

  // 4. Attach user object to request
  req.user = currentUser;
  next();
});

/**
 * Optional Authentication Middleware
 * Attaches user to req.user if a valid token is present, otherwise proceeds without error
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = verifyAccessToken(token);
    const userResult = await query(
      'SELECT id, full_name, admission_number, email, role, is_verified, verification_status, status FROM users WHERE id = $1 AND status = $2',
      [decoded.id, 'ACTIVE']
    );
    if (userResult.rows.length > 0) {
      req.user = userResult.rows[0];
    }
  } catch (error) {
    // Ignore invalid optional tokens
  }
  next();
});

module.exports = {
  authenticate,
  optionalAuth
};
