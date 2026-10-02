const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

// Centralized Sensitive Data Sanitizer Guard
function sanitizeData(data) {
  if (!data) return null;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return sanitizeData(parsed);
    } catch (e) {
      return data;
    }
  }
  
  const copy = JSON.parse(JSON.stringify(data));
  const SENSITIVE_KEYS = ['password', 'passwordhash', 'otp', 'token', 'secret', 'accesstoken', 'refreshtoken', 'smtppassword'];
  
  const maskObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return;
    for (const key of Object.keys(obj)) {
      if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
        obj[key] = '[REDACTED_SENSITIVE_DATA]';
      } else if (typeof obj[key] === 'object') {
        maskObject(obj[key]);
      }
    }
  };

  maskObject(copy);
  return JSON.stringify(copy);
}

// 1. Centralized Audit Logger Helper
async function logAuditAction({ userId, shopId, module, action, recordId, oldValue, newValue, ipAddress }) {
  try {
    return await prisma.auditLog.create({
      data: {
        userId: userId || null,
        shopId: shopId || null,
        module,
        action,
        recordId: recordId ? String(recordId) : null,
        oldValue: sanitizeData(oldValue),
        newValue: sanitizeData(newValue),
        ipAddress: ipAddress || null,
      },
    });
  } catch (error) {
    console.error('Audit Logger Execution Error:', error.message);
  }
}

// 2. Get Paginated Audit Logs List
async function getAuditLogs(shopId, query = {}) {
  const { page, limit, skip } = getPagination(query);
  const where = { shopId };

  if (query.module) where.module = query.module;
  if (query.action) where.action = query.action;
  if (query.userId) where.userId = query.userId;

  if (query.fromDate || query.toDate) {
    where.createdAt = {};
    if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
    if (query.toDate) where.createdAt.lte = new Date(query.toDate);
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: { select: { id: true, fullName: true, role: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    logs,
    pagination: getPaginationMeta(total, page, limit),
  };
}

// 3. Get Single Audit Log Details
async function getAuditLogById(shopId, logId) {
  const log = await prisma.auditLog.findFirst({
    where: { id: logId, shopId },
    include: {
      user: { select: { id: true, fullName: true, role: true, email: true } },
    },
  });

  if (!log) {
    const err = new Error('Audit log record not found');
    err.statusCode = 404;
    throw err;
  }

  return log;
}

module.exports = {
  sanitizeData,
  logAuditAction,
  getAuditLogs,
  getAuditLogById,
};
