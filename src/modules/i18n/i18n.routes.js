const express = require('express');
const router = express.Router();
const i18nController = require('./i18n.controller');

/**
 * Public & Authenticated i18n Routes
 */
router.get('/languages', i18nController.handleGetLanguages);
router.get('/translations', i18nController.handleGetTranslations);
router.get('/translations/:section', i18nController.handleGetSectionTranslations);

module.exports = router;
