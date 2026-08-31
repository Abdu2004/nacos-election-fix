const config = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * Map known PostgreSQL database errors to user-friendly operational AppErrors
 * @param {any} err
 * @returns {AppError}
 */
function handleDatabaseError(err) {
  // 23505: Unique violation (e.g., duplicate email, admission number, ballot)
  if (err.code === '23505') {
    const detail = err.detail || '';
    let message = 'A unique constraint was violated.';
    if (detail.includes('email')) {
      message = 'An account with this email address already exists.';
    } else if (detail.includes('admission_number')) {
      message = 'An account with this admission number already exists.';
    } else if (detail.includes('election_id, voter_id') || detail.includes('ballots_election_id_voter_id_key')) {
      message = 'You have already submitted a ballot for this election (One voter, one ballot).';
    } else if (detail.includes('candidates_election_id_user_id_key') || detail.includes('candidate_applications_election_id_user_id_key')) {
      message = 'Candidate is already registered for a position in this election (One candidate, one position).';
    } else if (detail.includes('ballot_id, position_id') || detail.includes('votes_ballot_id_position_id_key')) {
      message = 'Only one vote per position is allowed on a single ballot.';
    }
    return new AppError(message, 409, 'DUPLICATE_ENTRY', { detail: err.detail });
  }

  // 23503: Foreign key violation
  if (err.code === '23503') {
    return new AppError('Referenced record does not exist or cannot be modified.', 400, 'INVALID_REFERENCE', { detail: err.detail });
  }

  // 22P02: Invalid input syntax (e.g. invalid UUID format)
  if (err.code === '22P02') {
    return new AppError('Invalid identifier or data format provided.', 400, 'INVALID_FORMAT');
  }

  // 23514: Check constraint violation
  if (err.code === '23514') {
    return new AppError('Data value does not satisfy system constraints.', 400, 'CONSTRAINT_VIOLATION');
  }

  return err;
}

/**
 * Centralized Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
  let error = err;

  // Check if error is from PostgreSQL
  if (err.code && typeof err.code === 'string' && err.code.length === 5) {
    error = handleDatabaseError(err);
  }

  // JSON Body Parser Syntax Error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = new AppError('Malformed JSON payload received in request body.', 400, 'BAD_REQUEST');
  }

  const statusCode = error.statusCode || 500;
  const status = error.status || (statusCode >= 500 ? 'error' : 'fail');
  const errorCode = error.errorCode || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');

  // In production, never leak internal 500 details
  const message = (config.env === 'production' && statusCode === 500 && !error.isOperational)
    ? 'An unexpected error occurred on the server. Please try again later.'
    : error.message || 'Internal Server Error';

  // Securely log server errors (omitting user secrets)
  if (statusCode >= 500) {
    console.error(`[SERVER ERROR] [${req.method}] ${req.originalUrl}:`, {
      message: error.message,
      errorCode,
      stack: error.stack,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
  }

  res.status(statusCode).json({
    status,
    message,
    errorCode,
    ...(error.details && { details: error.details }),
    timestamp: new Date().toISOString(),
    ...(config.env !== 'production' && statusCode >= 500 && { stack: error.stack })
  });
}

module.exports = errorHandler;
