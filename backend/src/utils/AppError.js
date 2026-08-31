/**
 * Custom Application Error class for operational errors.
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code (4xx, 5xx)
   * @param {string} [errorCode] - Unique application error code (e.g. 'VALIDATION_FAILED')
   * @param {any} [details] - Optional extra error details or field errors
   */
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
