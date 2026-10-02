const remindersService = require('./reminders.service');
const { successResponse, paginatedResponse } = require('../../utils/response');

async function handleCreateReminder(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.body.shopId || req.user.shopId) : req.user.shopId;
    const reminder = await remindersService.createReminder(shopId, req.user.id, req.body);
    return successResponse(res, reminder, 'Reminder created successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function handleGetReminders(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const { reminders, pagination } = await remindersService.getReminders(shopId, req.query);
    return paginatedResponse(res, reminders, pagination, 'Reminders list retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetReminderMetrics(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const metrics = await remindersService.getReminderMetrics(shopId);
    return successResponse(res, metrics, 'Reminder metrics retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetReminderById(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const reminder = await remindersService.getReminderById(req.params.id, shopId);
    return successResponse(res, reminder, 'Reminder details retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleUpdateReminder(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.body.shopId || req.user.shopId) : req.user.shopId;
    const updated = await remindersService.updateReminder(req.params.id, shopId, req.user.id, req.body);
    return successResponse(res, updated, 'Reminder updated successfully');
  } catch (error) {
    next(error);
  }
}

async function handleUpdateReminderStatus(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.body.shopId || req.user.shopId) : req.user.shopId;
    const updated = await remindersService.updateReminderStatus(req.params.id, shopId, req.user.id, req.body);
    return successResponse(res, updated, `Reminder status updated to ${req.body.status}`);
  } catch (error) {
    next(error);
  }
}

async function handleSnoozeReminder(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.body.shopId || req.user.shopId) : req.user.shopId;
    const snoozed = await remindersService.snoozeReminder(req.params.id, shopId, req.user.id, req.body);
    return successResponse(res, snoozed, 'Reminder rescheduled successfully');
  } catch (error) {
    next(error);
  }
}

async function handleGetDealerWhatsAppOrder(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const lang = req.query.lang || req.lang;
    const result = await remindersService.getDealerOrderWhatsAppPayload(req.params.id, shopId, lang);
    return successResponse(res, result, 'Dealer WhatsApp PO generated');
  } catch (error) {
    next(error);
  }
}

async function handleGetFarmerWhatsAppArrival(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const lang = req.query.lang || req.lang;
    const result = await remindersService.getFarmerArrivalWhatsAppPayload(req.params.id, shopId, lang);
    return successResponse(res, result, 'Farmer WhatsApp arrival alert generated');
  } catch (error) {
    next(error);
  }
}

async function handleDeleteReminder(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const result = await remindersService.deleteReminder(req.params.id, shopId, req.user.id);
    return successResponse(res, result, 'Reminder deleted successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleCreateReminder,
  handleGetReminders,
  handleGetReminderMetrics,
  handleGetReminderById,
  handleUpdateReminder,
  handleUpdateReminderStatus,
  handleSnoozeReminder,
  handleGetDealerWhatsAppOrder,
  handleGetFarmerWhatsAppArrival,
  handleDeleteReminder,
};
