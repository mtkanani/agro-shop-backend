const exportService = require('./export.service');
const backupService = require('./backup.service');
const { successResponse, paginatedResponse } = require('../../utils/response');

async function handleCreateExport(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const userId = req.user.id;
    const result = await exportService.createExport(shopId, userId, req.body);
    return successResponse(res, result, 'Data export file generated successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function handleGetExportHistory(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const { exports, pagination } = await exportService.getExportHistory(shopId, req.query);
    return paginatedResponse(res, exports, pagination, 'Export history list retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleDownloadExport(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const exportLog = await exportService.getExportFile(shopId, req.params.id);
    return res.download(exportLog.filePath, exportLog.fileName);
  } catch (error) {
    next(error);
  }
}

async function handleCreateBackup(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const userId = req.user.id;
    const result = await backupService.createBackup(shopId, userId);
    return successResponse(res, result, 'Database logical backup generated successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function handleGetBackupHistory(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const { backups, pagination } = await backupService.getBackupHistory(shopId, req.query);
    return paginatedResponse(res, backups, pagination, 'Backup history list retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleDownloadBackup(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const backupLog = await backupService.getBackupFile(shopId, req.params.id);
    return res.download(backupLog.filePath, backupLog.fileName);
  } catch (error) {
    next(error);
  }
}

async function handleDeleteBackup(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const result = await backupService.deleteBackup(shopId, req.params.id);
    return successResponse(res, result, 'Backup file deleted successfully');
  } catch (error) {
    next(error);
  }
}

async function handleRestoreBackup(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.user.id;
    const result = await backupService.restoreBackup(shopId, userId, req.params.id);
    return successResponse(res, result, 'Backup restored successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleCreateExport,
  handleGetExportHistory,
  handleDownloadExport,
  handleCreateBackup,
  handleGetBackupHistory,
  handleDownloadBackup,
  handleDeleteBackup,
  handleRestoreBackup,
};
