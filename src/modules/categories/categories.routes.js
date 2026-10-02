const express = require('express');
const router = express.Router();
const categoryController = require('./categories.controller');
const categoryValidation = require('./categories.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

router.post('/', requirePermission('CATEGORY_CREATE'), validate(categoryValidation.createCategorySchema), categoryController.handleCreateCategory);
router.get('/', requirePermission('CATEGORY_VIEW'), validate(categoryValidation.categoryQuerySchema, 'query'), categoryController.handleGetAllCategories);
router.get('/:id', requirePermission('CATEGORY_VIEW'), categoryController.handleGetCategoryById);
router.put('/:id', requirePermission('CATEGORY_UPDATE'), validate(categoryValidation.updateCategorySchema), categoryController.handleUpdateCategory);
router.delete('/:id', requirePermission('CATEGORY_DELETE'), categoryController.handleDeleteCategory);

module.exports = router;
