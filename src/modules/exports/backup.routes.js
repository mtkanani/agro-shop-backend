const express = require('express');
const router = express.Router();
const exportController = require('./export.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');

router.use(authenticate);
router.use(requireRole(['OWNER', 'SUPER_ADMIN']));

router.post('/', exportController.handleCreateBackup);
router.get('/', exportController.handleGetBackupHistory);
router.get('/:id/download', exportController.handleDownloadBackup);
router.delete('/:id', exportController.handleDeleteBackup);
router.post('/:id/restore', exportController.handleRestoreBackup);

module.exports = router;
