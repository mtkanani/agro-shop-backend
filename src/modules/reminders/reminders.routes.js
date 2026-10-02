const express = require('express');
const router = express.Router();
const remindersController = require('./reminders.controller');
const remindersValidation = require('./reminders.validation');
const { validate } = require('../../middleware/validation.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/role.middleware');

router.use(authenticate);

// Metrics endpoint (Must be placed before dynamic /:id parameter)
router.get(
  '/metrics',
  requirePermission('REMINDER_VIEW'),
  remindersController.handleGetReminderMetrics
);

// List & Create
router.get(
  '/',
  requirePermission('REMINDER_VIEW'),
  validate(remindersValidation.reminderQuerySchema, 'query'),
  remindersController.handleGetReminders
);

router.post(
  '/',
  requirePermission('REMINDER_MANAGE'),
  validate(remindersValidation.createReminderSchema),
  remindersController.handleCreateReminder
);

// WhatsApp Action Payloads
router.get(
  '/:id/dealer-whatsapp',
  requirePermission('REMINDER_VIEW'),
  remindersController.handleGetDealerWhatsAppOrder
);

router.get(
  '/:id/farmer-whatsapp',
  requirePermission('REMINDER_VIEW'),
  remindersController.handleGetFarmerWhatsAppArrival
);

// Single Reminder Management
router.get(
  '/:id',
  requirePermission('REMINDER_VIEW'),
  remindersController.handleGetReminderById
);

router.patch(
  '/:id',
  requirePermission('REMINDER_MANAGE'),
  validate(remindersValidation.updateReminderSchema),
  remindersController.handleUpdateReminder
);

router.patch(
  '/:id/status',
  requirePermission('REMINDER_MANAGE'),
  validate(remindersValidation.updateReminderStatusSchema),
  remindersController.handleUpdateReminderStatus
);

router.patch(
  '/:id/snooze',
  requirePermission('REMINDER_MANAGE'),
  validate(remindersValidation.snoozeReminderSchema),
  remindersController.handleSnoozeReminder
);

router.delete(
  '/:id',
  requirePermission('REMINDER_MANAGE'),
  remindersController.handleDeleteReminder
);

module.exports = router;
