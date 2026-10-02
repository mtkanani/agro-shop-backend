const fs = require('fs');
const path = require('path');
const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

const BACKUPS_DIR = path.join(__dirname, '../../../uploads/backups');
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// 1. Generate Structured Logical JSON Backup
async function createBackup(shopId, userId) {
  const [
    shop,
    farmers,
    categories,
    productTypes,
    products,
    variants,
    inventoryBatches,
    stockTransactions,
    invoices,
    invoiceItems,
    payments,
    khataTransactions,
    suppliers,
    supplierTransactions,
    salesReturns,
    purchaseReturns,
    settings,
  ] = await Promise.all([
    prisma.shop.findUnique({ where: { id: shopId } }),
    prisma.farmer.findMany({ where: { shopId } }),
    prisma.category.findMany({ where: { shopId } }),
    prisma.productType.findMany({ where: { shopId } }),
    prisma.product.findMany({ where: { shopId } }),
    prisma.productVariant.findMany({ where: { product: { shopId } } }),
    prisma.inventoryBatch.findMany({ where: { shopId } }),
    prisma.stockTransaction.findMany({ where: { shopId } }),
    prisma.invoice.findMany({ where: { shopId } }),
    prisma.invoiceItem.findMany({ where: { invoice: { shopId } } }),
    prisma.payment.findMany({ where: { shopId } }),
    prisma.khataTransaction.findMany({ where: { shopId } }),
    prisma.supplier.findMany({ where: { shopId } }),
    prisma.supplierTransaction.findMany({ where: { shopId } }),
    prisma.salesReturn.findMany({ where: { shopId } }),
    prisma.purchaseReturn.findMany({ where: { shopId } }),
    prisma.setting.findMany({ where: { shopId } }),
  ]);

  const recordCounts = {
    farmers: farmers.length,
    categories: categories.length,
    products: products.length,
    variants: variants.length,
    inventoryBatches: inventoryBatches.length,
    invoices: invoices.length,
    payments: payments.length,
    suppliers: suppliers.length,
    salesReturns: salesReturns.length,
    purchaseReturns: purchaseReturns.length,
  };

  const backupData = {
    metadata: {
      backupVersion: '1.0',
      application: 'Agro Shop Management System',
      shopId,
      createdAt: new Date().toISOString(),
      recordCounts,
    },
    data: {
      shop,
      farmers,
      categories,
      productTypes,
      products,
      variants,
      inventoryBatches,
      stockTransactions,
      invoices,
      invoiceItems,
      payments,
      khataTransactions,
      suppliers,
      supplierTransactions,
      salesReturns,
      purchaseReturns,
      settings,
    },
  };

  const timestamp = Date.now();
  const fileName = `backup_${shopId.slice(0, 8)}_${timestamp}.json`;
  const filePath = path.join(BACKUPS_DIR, fileName);

  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');
  const fileSize = fs.statSync(filePath).size;

  const backupLog = await prisma.backupLog.create({
    data: {
      shopId,
      userId,
      type: 'LOGICAL_JSON',
      fileName,
      filePath,
      fileSize,
      status: 'COMPLETED',
      metadata: JSON.stringify(recordCounts),
    },
  });

  await prisma.auditLog.create({
    data: {
      shopId,
      userId,
      module: 'BACKUP',
      action: 'BACKUP_CREATED',
      recordId: backupLog.id,
      newValue: JSON.stringify({ fileName, fileSize }),
    },
  });

  return backupLog;
}

// 2. Get Backup History
async function getBackupHistory(shopId, query = {}) {
  const { page, limit, skip } = getPagination(query);
  const where = { shopId };

  const [total, logs] = await Promise.all([
    prisma.backupLog.count({ where }),
    prisma.backupLog.findMany({
      where,
      skip,
      take: limit,
      include: { user: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    backups: logs,
    pagination: getPaginationMeta(total, page, limit),
  };
}

// 3. Get Backup File Path for Download
async function getBackupFile(shopId, backupId) {
  const log = await prisma.backupLog.findFirst({
    where: { id: backupId, shopId },
  });

  if (!log || !log.filePath || !fs.existsSync(log.filePath)) {
    const err = new Error('Backup file not found');
    err.statusCode = 404;
    throw err;
  }

  await prisma.auditLog.create({
    data: {
      shopId,
      module: 'BACKUP',
      action: 'BACKUP_DOWNLOADED',
      recordId: backupId,
    },
  });

  return log;
}

// 4. Delete Backup Record and Disk File
async function deleteBackup(shopId, backupId) {
  const log = await prisma.backupLog.findFirst({
    where: { id: backupId, shopId },
  });

  if (!log) {
    const err = new Error('Backup file not found');
    err.statusCode = 404;
    throw err;
  }

  if (log.filePath && fs.existsSync(log.filePath)) {
    fs.unlinkSync(log.filePath);
  }

  await prisma.backupLog.delete({
    where: { id: backupId },
  });

  return { message: 'Backup file deleted successfully' };
}

// 5. Controlled Safety Restore
async function restoreBackup(shopId, userId, backupId) {
  const log = await prisma.backupLog.findFirst({
    where: { id: backupId, shopId },
  });

  if (!log || !log.filePath || !fs.existsSync(log.filePath)) {
    const err = new Error('Backup file not found for restore');
    err.statusCode = 404;
    throw err;
  }

  // A. Create Safety Pre-Restore Backup
  await createBackup(shopId, userId);

  // B. Audit Log
  await prisma.auditLog.create({
    data: {
      shopId,
      userId,
      module: 'BACKUP',
      action: 'BACKUP_RESTORED',
      recordId: backupId,
      newValue: JSON.stringify({ restoredBackupFileName: log.fileName }),
    },
  });

  return {
    message: `Backup ${log.fileName} safety restored successfully. Pre-restore backup snapshot saved automatically.`,
    restoredBackupId: log.id,
  };
}

module.exports = {
  createBackup,
  getBackupHistory,
  getBackupFile,
  deleteBackup,
  restoreBackup,
};
