const jwt = require('jsonwebtoken');
const config = require('../config/env');
const AppError = require('./AppError');

/**
 * Generate Access and Refresh JWT Tokens
 * @param {object} user - User record { id, email, role, is_verified }
 * @returns {{ accessToken: string, refreshToken: string, expiresIn: string }}
 */
function generateTokens(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    is_verified: user.is_verified
  };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });

  const refreshToken = jwt.sign({ id: user.id }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: config.jwt.expiresIn
  };
}

/**
 * Verify a JWT Access Token
 * @param {string} token
 * @returns {object} Decoded payload
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Your session has expired. Please log in again.', 401, 'TOKEN_EXPIRED');
    }
    throw new AppError('Invalid authentication token.', 401, 'INVALID_TOKEN');
  }
}

/**
 * Verify a JWT Refresh Token
 * @param {string} token
 * @returns {object} Decoded payload
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Your refresh token has expired. Please log in again.', 401, 'REFRESH_TOKEN_EXPIRED');
    }
    throw new AppError('Invalid refresh token.', 401, 'INVALID_REFRESH_TOKEN');
  }
}

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken
};
