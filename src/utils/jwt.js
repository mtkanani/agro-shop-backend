const jwt = require('jsonwebtoken');
const env = require('../config/env');

function generateAccessToken(user) {
  const payload = {
    userId: user.id || user.userId,
    shopId: user.shopId,
    role: user.role,
  };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

function generateRefreshToken(user) {
  const payload = {
    userId: user.id || user.userId,
    shopId: user.shopId,
    role: user.role,
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
}

function generateAuthTokens(user) {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
  };
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateAuthTokens,
  // Alias helpers for backwards compatibility
  generateToken: generateAccessToken,
  verifyToken: verifyAccessToken,
};
