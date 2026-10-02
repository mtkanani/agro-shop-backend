const { prisma } = require('../config/database');

async function logAuditAction({ userId, shopId, action, module, recordId, oldValue, newValue, ipAddress }) {
  try {
    const log = await prisma.auditLog.create({
      data: {
        userId: userId || null,
        shopId: shopId || null,
        action,
        module,
        recordId: recordId || null,
        oldValue: oldValue ? (typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue)) : null,
        newValue: newValue ? (typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue)) : null,
        ipAddress: ipAddress || null,
      },
    });
    return log;
  } catch (error) {
    console.error('⚠️ Failed to write audit log:', error.message);
  }
}

module.exports = {
  logAuditAction,
};
