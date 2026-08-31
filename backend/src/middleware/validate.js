const AppError = require('../utils/AppError');

/**
 * Validates a value against a field rule definition
 * @param {any} value
 * @param {object} rule
 * @param {string} fieldName
 * @returns {string|null} Error message or null if valid
 */
function validateField(value, rule, fieldName) {
  // Required check
  if (rule.required && (value === undefined || value === null || value === '')) {
    return rule.message || `${fieldName} is required.`;
  }

  // If optional and not provided, pass
  if (value === undefined || value === null || value === '') {
    return null;
  }

  // Type check
  if (rule.type) {
    if (rule.type === 'string' && typeof value !== 'string') {
      return `${fieldName} must be a string.`;
    }
    if (rule.type === 'number' && typeof value !== 'number' && isNaN(Number(value))) {
      return `${fieldName} must be a valid number.`;
    }
    if (rule.type === 'boolean' && typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
      return `${fieldName} must be a boolean.`;
    }
    if (rule.type === 'array' && !Array.isArray(value)) {
      return `${fieldName} must be an array.`;
    }
    if (rule.type === 'object' && (typeof value !== 'object' || Array.isArray(value) || value === null)) {
      return `${fieldName} must be an object.`;
    }
  }

  // String length checks
  if (typeof value === 'string') {
    if (rule.minLength && value.trim().length < rule.minLength) {
      return `${fieldName} must be at least ${rule.minLength} characters.`;
    }
    if (rule.maxLength && value.trim().length > rule.maxLength) {
      return `${fieldName} must not exceed ${rule.maxLength} characters.`;
    }
    if (rule.regex && !rule.regex.test(value)) {
      return rule.message || `${fieldName} has an invalid format.`;
    }
    if (rule.isEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return `${fieldName} must be a valid email address.`;
      }
    }
    if (rule.isGmail) {
      const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
      if (!gmailRegex.test(value.trim())) {
        return `${fieldName} must be a valid @gmail.com address.`;
      }
    }
    if (rule.isUUID) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(value)) {
        return `${fieldName} must be a valid UUID.`;
      }
    }
  }

  // Enum check
  if (rule.enum && !rule.enum.includes(value)) {
    return `${fieldName} must be one of: ${rule.enum.join(', ')}.`;
  }

  // Number range checks
  if (typeof value === 'number' || (rule.type === 'number' && !isNaN(Number(value)))) {
    const num = Number(value);
    if (rule.min !== undefined && num < rule.min) {
      return `${fieldName} must be at least ${rule.min}.`;
    }
    if (rule.max !== undefined && num > rule.max) {
      return `${fieldName} must not exceed ${rule.max}.`;
    }
  }

  return null;
}

/**
 * Middleware generator for request validation
 * @param {object} schema - Schema containing body, query, or params validation rules
 * @example
 * validate({
 *   body: {
 *     email: { required: true, isGmail: true },
 *     admissionNumber: { required: true, minLength: 4 }
 *   }
 * })
 */
function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    ['body', 'query', 'params'].forEach((target) => {
      if (schema[target]) {
        const rules = schema[target];
        const data = req[target] || {};

        for (const [field, rule] of Object.entries(rules)) {
          const value = data[field];
          const errorMsg = validateField(value, rule, field);
          if (errorMsg) {
            errors.push({ field, location: target, message: errorMsg });
          }
        }
      }
    });

    if (errors.length > 0) {
      return next(new AppError('Validation failed on request parameters.', 400, 'VALIDATION_ERROR', errors));
    }

    next();
  };
}

module.exports = {
  validate,
  validateField
};
