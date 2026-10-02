const auditService = require('./audit.service');
const { successResponse, paginatedResponse } = require('../../utils/response');

async function handleGetAuditLogs(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const { logs, pagination } = await auditService.getAuditLogs(shopId, req.query);
    return paginatedResponse(res, logs, pagination, 'System audit logs retrieved successfully');
  } catch (error) {
    next(error);
  }
}

async function handleGetAuditLogById(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const log = await auditService.getAuditLogById(shopId, req.params.id);
    return successResponse(res, log, 'Audit log details retrieved successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleGetAuditLogs,
  handleGetAuditLogById,
};
