const notificationService = require('./notification.service');
const { successResponse } = require('../../utils/response');

async function handleGetUnreadCount(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const userId = req.user.id;
    const result = await notificationService.getUnreadCount(shopId, userId);
    return successResponse(res, result, 'Unread notifications count retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetNotifications(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const userId = req.user.id;
    const result = await notificationService.getNotifications(shopId, userId, req.query);
    return successResponse(res, result, 'Notifications list retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleGetNotificationById(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const userId = req.user.id;
    const result = await notificationService.getNotificationById(shopId, userId, req.params.id);
    return successResponse(res, result, 'Notification details retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleMarkAsRead(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.user.id;
    const result = await notificationService.markAsRead(shopId, userId, req.params.id);
    return successResponse(res, result, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
}

async function handleMarkAllAsRead(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.user.id;
    const result = await notificationService.markAllAsRead(shopId, userId);
    return successResponse(res, result, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
}

async function handleDeleteNotification(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.user.id;
    const result = await notificationService.deleteNotification(shopId, userId, req.params.id);
    return successResponse(res, result, 'Notification deleted successfully');
  } catch (error) {
    next(error);
  }
}

async function handleGetPreferences(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.user.id;
    const result = await notificationService.getPreferences(shopId, userId);
    return successResponse(res, result, 'Notification preferences retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleUpdatePreferences(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.user.id;
    const result = await notificationService.updatePreferences(shopId, userId, req.body);
    return successResponse(res, result, 'Notification preferences updated');
  } catch (error) {
    next(error);
  }
}

async function handleEvaluateAlerts(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const result = await notificationService.evaluateAllAlerts(shopId);
    return successResponse(res, result, 'All alert scanners evaluated successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleGetUnreadCount,
  handleGetNotifications,
  handleGetNotificationById,
  handleMarkAsRead,
  handleMarkAllAsRead,
  handleDeleteNotification,
  handleGetPreferences,
  handleUpdatePreferences,
  handleEvaluateAlerts,
};
