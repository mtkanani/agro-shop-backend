const express = require('express');
const router = express.Router();
const notificationController = require('./notification.controller');
const notificationValidation = require('./notification.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');

router.use(authenticate);

// Special Static Routes (Defined before generic :id parameters)
router.get('/unread-count', notificationController.handleGetUnreadCount);
router.get('/preferences', notificationController.handleGetPreferences);
router.patch('/preferences', validate(notificationValidation.updatePreferencesSchema), notificationController.handleUpdatePreferences);
router.patch('/read-all', notificationController.handleMarkAllAsRead);
router.post('/evaluate-alerts', notificationController.handleEvaluateAlerts);

// Standard Parameterized Routes
router.get('/', validate(notificationValidation.notificationQuerySchema, 'query'), notificationController.handleGetNotifications);
router.get('/:id', notificationController.handleGetNotificationById);
router.patch('/:id/read', notificationController.handleMarkAsRead);
router.delete('/:id', notificationController.handleDeleteNotification);

module.exports = router;
