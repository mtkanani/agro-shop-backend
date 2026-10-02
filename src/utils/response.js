/**
 * Standardized Success Response
 */
function successResponse(res, data = null, message = 'Success', statusCode = 200) {
  const payload = {
    success: true,
    message,
    data: data !== undefined ? data : {},
  };

  return res.status(statusCode).json(payload);
}

/**
 * Standardized Error Response
 */
function errorResponse(res, message = 'An error occurred', statusCode = 500, errorCode = null, details = null) {
  const code = errorCode || (statusCode === 404 ? 'NOT_FOUND' : (statusCode === 400 ? 'BAD_REQUEST' : (statusCode === 401 ? 'UNAUTHORIZED' : (statusCode === 403 ? 'FORBIDDEN' : 'INTERNAL_SERVER_ERROR'))));

  const payload = {
    success: false,
    message,
    error: {
      code,
      ...(details ? { details } : {}),
    },
  };

  return res.status(statusCode).json(payload);
}

/**
 * Standardized Paginated Response
 */
function paginatedResponse(res, data, pagination, message = 'Data fetched successfully', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    pagination,
  });
}

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
};
