const express = require('express');
const router = express.Router();
const exportController = require('./export.controller');
const exportValidation = require('./export.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');

router.use(authenticate);

router.post('/', validate(exportValidation.createExportSchema), exportController.handleCreateExport);
router.get('/', validate(exportValidation.exportQuerySchema, 'query'), exportController.handleGetExportHistory);
router.get('/:id/download', exportController.handleDownloadExport);

module.exports = router;
