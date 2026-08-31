const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * Factory for creating configured rate limiters
 * @param {object} options
 */
function createLimiter({ windowMs, max, message, errorCode = 'TOO_MANY_REQUESTS', skipSuccessfulRequests = false, keyGenerator }) {
  const opts = {
    windowMs,
    max: config.env === 'test' ? 10000 : max, // Loosen limits in automated test mode
    standardHeaders: true,   // Return RateLimit-* headers
    legacyHeaders: false,
    skipSuccessfulRequests,  // Don't count successful requests against the limit
    handler: (req, res, next) => {
      next(new AppError(message, 429, errorCode));
    }
  };

  if (keyGenerator) {
    opts.keyGenerator = keyGenerator;
    opts.validate = { ip: false };
  }

  return rateLimit(opts);
}

// 1. General Global API Rate Limiter
//    500 requests per IP per 15 min — handles normal classroom / exam-hall bursts
const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Too many requests from this IP address, please try again in 15 minutes.',
  errorCode: 'RATE_LIMIT_EXCEEDED'
});

// 2. Authentication Limiter
//    30 attempts per IP per 15 min; successful logins do NOT count against the limit.
//    This means a real student can log in many times per session without being blocked.
//    Only repeated failed attempts (wrong password / invalid OTP) exhaust the quota.
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skipSuccessfulRequests: true,
  message: 'Too many failed authentication attempts from this address. Please wait 15 minutes before trying again.',
  errorCode: 'AUTH_RATE_LIMIT_EXCEEDED'
});

// 3. OTP Verification Limiter
//    10 OTP checks per IP per 10 min; successful verifications are skipped.
const otpVerifyLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: 'Too many OTP verification attempts. Please wait before retrying.',
  errorCode: 'OTP_RATE_LIMIT_EXCEEDED'
});

// 4. Voting Submission Limiter
//    20 attempts per IP per 5 min — allows multiple verified voters on the same
//    network to cast ballots in quick succession (e.g., a computer lab).
const votingLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  message: 'Too many voting submissions attempted. Please wait a few minutes.',
  errorCode: 'VOTING_RATE_LIMIT_EXCEEDED'
});

module.exports = {
  apiLimiter,
  authLimiter,
  otpVerifyLimiter,
  votingLimiter
};
