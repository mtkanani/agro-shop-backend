const settingService = require('./settings.service');
const { successResponse, paginatedResponse } = require('../../utils/response');

async function handleGetAllSettings(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const settings = await settingService.getAllSettings(shopId);
    return successResponse(res, settings, 'Shop settings and configurations retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleUpdateShopProfile(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.user.id;
    const updatedShop = await settingService.updateShopProfile(shopId, userId, req.body);
    return successResponse(res, updatedShop, 'Shop profile updated successfully');
  } catch (error) {
    next(error);
  }
}

async function handleUpdateOwnerProfile(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.user.id;
    const updatedUser = await settingService.updateOwnerProfile(shopId, userId, req.body);
    return successResponse(res, updatedUser, 'Owner profile updated successfully');
  } catch (error) {
    next(error);
  }
}

async function handleUpdateBillingSettings(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.user.id;
    const result = await settingService.updateCategorySettings(shopId, userId, 'BILLING', req.body);
    return successResponse(res, result, 'Billing settings updated successfully');
  } catch (error) {
    next(error);
  }
}

async function handleUpdateTaxSettings(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.user.id;
    const result = await settingService.updateCategorySettings(shopId, userId, 'TAX', req.body);
    return successResponse(res, result, 'Tax / GST settings updated successfully');
  } catch (error) {
    next(error);
  }
}

async function handleUpdateInventorySettings(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.user.id;
    const result = await settingService.updateCategorySettings(shopId, userId, 'INVENTORY', req.body);
    return successResponse(res, result, 'Inventory settings updated successfully');
  } catch (error) {
    next(error);
  }
}

async function handleUpdateCreditSettings(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.user.id;
    const result = await settingService.updateCategorySettings(shopId, userId, 'CREDIT', req.body);
    return successResponse(res, result, 'Credit & due settings updated successfully');
  } catch (error) {
    next(error);
  }
}

async function handleUpdateRegionalSettings(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.user.id;
    const result = await settingService.updateCategorySettings(shopId, userId, 'REGIONAL', req.body);
    return successResponse(res, result, 'Regional & language settings updated successfully');
  } catch (error) {
    next(error);
  }
}

async function handleUpdateInvoiceSettings(req, res, next) {
  try {
    const shopId = req.user.shopId;
    const userId = req.user.id;
    const result = await settingService.updateCategorySettings(shopId, userId, 'INVOICE', req.body);
    return successResponse(res, result, 'Invoice settings updated successfully');
  } catch (error) {
    next(error);
  }
}

async function handleGetAuditLogs(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const { logs, pagination } = await settingService.getAuditLogs({ ...req.query, shopId });
    return paginatedResponse(res, logs, pagination, 'System audit logs retrieved');
  } catch (error) {
    next(error);
  }
}

async function handleUpdateShopLanguage(req, res, next) {
  try {
    const shopId = req.user.role === 'SUPER_ADMIN' ? (req.query.shopId || req.user.shopId) : req.user.shopId;
    const userId = req.user.id;
    const { language } = req.body;
    const result = await settingService.updateShopLanguage(shopId, userId, language);
    return successResponse(res, result, 'Shop default language updated successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleGetAllSettings,
  handleUpdateShopProfile,
  handleUpdateOwnerProfile,
  handleUpdateBillingSettings,
  handleUpdateTaxSettings,
  handleUpdateInventorySettings,
  handleUpdateCreditSettings,
  handleUpdateRegionalSettings,
  handleUpdateInvoiceSettings,
  handleUpdateShopLanguage,
  getAuditLogs: handleGetAuditLogs,
  handleGetAuditLogs,
};
