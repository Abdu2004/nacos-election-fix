/**
 * Standardized API Response Utilities
 */

/**
 * Send a success response
 * @param {import('express').Response} res
 * @param {any} data
 * @param {string} [message]
 * @param {number} [statusCode=200]
 */
function sendSuccess(res, data = null, message = null, statusCode = 200) {
  const payload = {
    status: 'success',
    data,
    ...(message && { message }),
    timestamp: new Date().toISOString()
  };
  return res.status(statusCode).json(payload);
}

/**
 * Send a resource created response
 * @param {import('express').Response} res
 * @param {any} data
 * @param {string} [message='Resource created successfully']
 */
function sendCreated(res, data = null, message = 'Resource created successfully') {
  return sendSuccess(res, data, message, 201);
}

/**
 * Send a paginated response
 * @param {import('express').Response} res
 * @param {Array} items
 * @param {number} totalCount
 * @param {number} page
 * @param {number} limit
 * @param {string} [message]
 */
function sendPaginated(res, items, totalCount, page, limit, message = null) {
  const totalPages = Math.ceil(totalCount / limit);
  const payload = {
    status: 'success',
    data: {
      items,
      pagination: {
        totalItems: totalCount,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    },
    ...(message && { message }),
    timestamp: new Date().toISOString()
  };
  return res.status(200).json(payload);
}

/**
 * Send an error response
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} [statusCode=500]
 * @param {string} [errorCode='INTERNAL_ERROR']
 * @param {any} [details=null]
 */
function sendError(res, message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) {
  const payload = {
    status: statusCode >= 500 ? 'error' : 'fail',
    message,
    errorCode,
    ...(details && { details }),
    timestamp: new Date().toISOString()
  };
  return res.status(statusCode).json(payload);
}

module.exports = {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError
};
