const express = require('express');
const router = express.Router();
const userController = require('./users.controller');
const userValidation = require('./users.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');

router.use(authenticate);

router.post('/', authorize('SUPER_ADMIN', 'OWNER'), validate(userValidation.createUserSchema), userController.handleCreateUser);
router.get('/', authorize('SUPER_ADMIN', 'OWNER', 'ADMIN'), userController.handleGetAllUsers);
router.get('/:id', authorize('SUPER_ADMIN', 'OWNER', 'ADMIN'), userController.handleGetUserById);
router.put('/:id', authorize('SUPER_ADMIN', 'OWNER'), validate(userValidation.updateUserSchema), userController.handleUpdateUser);
router.patch('/:id/toggle-status', authorize('SUPER_ADMIN', 'OWNER'), userController.handleToggleUserStatus);

module.exports = router;
