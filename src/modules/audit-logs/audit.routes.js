const express = require('express');
const router = express.Router();
const auditController = require('./audit.controller');
const auditValidation = require('./audit.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');

router.use(authenticate);
router.use(requireRole(['OWNER', 'SUPER_ADMIN']));

router.get('/', validate(auditValidation.auditLogQuerySchema, 'query'), auditController.handleGetAuditLogs);
router.get('/:id', auditController.handleGetAuditLogById);

module.exports = router;
