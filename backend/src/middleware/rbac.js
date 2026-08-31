const AppError = require('../utils/AppError');
const AuditService = require('../services/auditService');

/**
 * Role-Based Access Control (RBAC) Authorization Middleware
 * Verifies that the authenticated user possesses one of the permitted roles
 * @param  {...string} allowedRoles - e.g. 'ADMINISTRATOR', 'VALIDATOR', 'CANDIDATE', 'VOTER'
 */
function authorize(...allowedRoles) {
  return async (req, res, next) => {
    // 1. Ensure user is authenticated
    if (!req.user || !req.user.role) {
      return next(new AppError('Authentication required to access this resource.', 401, 'UNAUTHENTICATED'));
    }

    // 2. Check if user's role is in the allowed list
    if (!allowedRoles.includes(req.user.role)) {
      // Audit unauthorized access attempt
      await AuditService.log({
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.role,
        details: {
          attemptedPath: req.originalUrl,
          method: req.method,
          requiredRoles: allowedRoles
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return next(new AppError(
        `Access denied. Your role '${req.user.role}' is not authorized to perform this action.`,
        403,
        'FORBIDDEN_ROLE'
      ));
    }

    next();
  };
}

/**
 * Middleware ensuring user is a verified voter
 * Required before ballot casting or candidate application
 */
function requireVerified(req, res, next) {
  if (!req.user) {
    return next(new AppError('Authentication required.', 401, 'UNAUTHENTICATED'));
  }

  if (!req.user.is_verified || req.user.verification_status !== 'APPROVED') {
    return next(new AppError(
      'Account verification required. Your student identity has not yet been approved.',
      403,
      'VERIFICATION_REQUIRED',
      { verificationStatus: req.user.verification_status }
    ));
  }

  next();
}

/**
 * Middleware ensuring user is accessing their own resource or has elevated staff privileges (Admin/Validator)
 * Prevents IDOR (Insecure Direct Object References)
 * @param {string} [idParam='id'] - Request parameter containing the target user ID
 */
function requireSelfOrStaff(idParam = 'id') {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401, 'UNAUTHENTICATED'));
    }

    const targetUserId = req.params[idParam];
    const isOwner = req.user.id === targetUserId;
    const isStaff = req.user.role === 'ADMINISTRATOR' || req.user.role === 'VALIDATOR';

    if (!isOwner && !isStaff) {
      return next(new AppError('You are not authorized to view or modify this user resource.', 403, 'FORBIDDEN_RESOURCE'));
    }

    next();
  };
}

module.exports = {
  authorize,
  requireVerified,
  requireSelfOrStaff
};
