const { errorResponse } = require('../utils/response');

function errorHandler(err, req, res, next) {
  console.error('🔥 Global Error Handler Caught Exception:', err);

  // Prisma Unique Constraint Violation
  if (err.code === 'P2002') {
    const fields = err.meta?.target ? err.meta.target.join(', ') : 'field';
    return errorResponse(res, `A record with this ${fields} already exists`, 400, 'DUPLICATE_ENTRY');
  }

  // Prisma Record Not Found
  if (err.code === 'P2025') {
    return errorResponse(res, 'Target record not found in database', 404, 'RECORD_NOT_FOUND');
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const errorCode = err.code || (statusCode === 404 ? 'RESOURCE_NOT_FOUND' : (statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR'));

  return errorResponse(res, message, statusCode, errorCode, err.errors || null);
}

module.exports = {
  errorHandler,
};
