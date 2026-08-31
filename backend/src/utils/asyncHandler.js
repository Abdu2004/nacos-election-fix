/**
 * Async handler wrapper to forward errors to next() middleware
 * @param {Function} fn
 * @returns {Function}
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
