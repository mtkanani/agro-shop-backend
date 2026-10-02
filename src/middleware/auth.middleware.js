const { verifyAccessToken } = require('../utils/jwt');
const { errorResponse } = require('../utils/response');
const { prisma } = require('../config/database');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // 1. Read & verify Authorization header exists
    if (!authHeader) {
      return errorResponse(res, 'Authentication required', 401);
    }

    // 2. Verify format starts with "Bearer " and has token part
    if (!authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Invalid authorization header', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token || token.trim() === '') {
      return errorResponse(res, 'Invalid authorization header', 401);
    }

    // 3. Verify JWT using secret
    const decoded = verifyAccessToken(token);
    if (!decoded || !decoded.userId) {
      return errorResponse(res, 'Invalid or expired access token', 401);
    }

    // 4. Find user in database using Prisma (excluding passwords/hashes)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        shopId: true,
        role: true,
        fullName: true,
        email: true,
        mobile: true,
        status: true,
      },
    });

    // 5. Verify user still exists in database
    if (!user) {
      return errorResponse(res, 'User not found', 401);
    }

    // 6. Verify user status is ACTIVE
    if (user.status !== 'ACTIVE') {
      return errorResponse(res, 'User account is inactive', 403);
    }

    // 7. Attach authenticated user payload to req.user
    req.user = {
      id: user.id,
      shopId: user.shopId,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      mobile: user.mobile,
      status: user.status,
    };

    next();
  } catch (error) {
    return errorResponse(res, 'Invalid or expired access token', 401);
  }
}

module.exports = {
  authenticate,
  authMiddleware: authenticate,
};
