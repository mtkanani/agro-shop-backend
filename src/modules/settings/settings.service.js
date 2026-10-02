const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

// Default Agricultural Settings
const AGRICULTURAL_DEFAULTS = {
  // Tax / GST Settings (Agriculture Tax Exempt 0%)
  gstEnabled: 'false',
  gstin: '',
  defaultTaxRate: '0',
  pricingType: 'EXCLUSIVE',

  // Billing Settings
  allowCreditSales: 'true',
  requireFarmerForCredit: 'true',
  allowDiscount: 'true',
  maxDiscountPercent: '20',
  defaultPaymentMethod: 'CASH',

  // Inventory Settings
  allowNegativeStock: 'false',
  expiryWarningDays: '30',
  minStockDefault: '5',

  // Credit Settings
  defaultCreditPeriodDays: '30',
  dueReminderDays: '3',
  maxCreditLimit: '50000',

  // Regional & Language Settings
  language: 'en',
  currency: 'INR',
  symbol: '₹',
  timezone: 'Asia/Kolkata',
  dateFormat: 'DD/MM/YYYY',

  // Invoice Settings
  invoicePrefix: 'INV',
  invoiceFooter: 'Thank you for shopping at Agro Care Store. Returns accepted per shop policy.',
  showShopLogo: 'true',
  showGST: 'false',
};

// 1. Get All Aggregated Settings
async function getAllSettings(shopId) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: {
      id: true,
      shopName: true,
      code: true,
      mobile: true,
      email: true,
      address: true,
      villageCity: true,
      state: true,
      pincode: true,
      fertilizerLicense: true,
      pesticideLicense: true,
      seedLicense: true,
      status: true,
      createdAt: true,
    },
  });

  const owner = await prisma.user.findFirst({
    where: { shopId, role: 'OWNER' },
    select: { id: true, fullName: true, email: true, mobile: true, role: true },
  });

  const rawSettings = await prisma.setting.findMany({
    where: { shopId },
  });

  const settingsMap = { ...AGRICULTURAL_DEFAULTS };
  rawSettings.forEach((s) => {
    settingsMap[s.key] = s.value;
  });

  const notifPreferences = await prisma.notificationPreference.findFirst({
    where: { shopId },
  });

  return {
    shop,
    owner,
    configurations: settingsMap,
    notificationPreferences: notifPreferences || {},
  };
}

// 2. Update Shop Profile
async function updateShopProfile(shopId, userId, data) {
  const updatedShop = await prisma.shop.update({
    where: { id: shopId },
    data,
  });

  await prisma.auditLog.create({
    data: {
      shopId,
      userId,
      module: 'SETTINGS',
      action: 'SHOP_PROFILE_UPDATE',
      recordId: shopId,
      newValue: JSON.stringify(data),
    },
  });

  return updatedShop;
}

// 3. Update Owner Profile
async function updateOwnerProfile(shopId, userId, data) {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data,
  });

  await prisma.auditLog.create({
    data: {
      shopId,
      userId,
      module: 'SETTINGS',
      action: 'OWNER_PROFILE_UPDATE',
      recordId: userId,
      newValue: JSON.stringify(data),
    },
  });

  return {
    id: updatedUser.id,
    fullName: updatedUser.fullName,
    email: updatedUser.email,
    mobile: updatedUser.mobile,
  };
}

// 4. Generic Update Category Settings (Upserts Key-Values into Setting Table)
async function updateCategorySettings(shopId, userId, categoryName, settingsObj) {
  const updatedKeys = [];

  for (const [key, val] of Object.entries(settingsObj)) {
    if (val === undefined || val === null) continue;
    const strVal = String(val);

    await prisma.setting.upsert({
      where: { shopId_key: { shopId, key } },
      update: { value: strVal },
      create: { shopId, key, value: strVal },
    });
    updatedKeys.push(key);
  }

  await prisma.auditLog.create({
    data: {
      shopId,
      userId,
      module: 'SETTINGS',
      action: `${categoryName.toUpperCase()}_SETTINGS_UPDATE`,
      recordId: shopId,
      newValue: JSON.stringify(settingsObj),
    },
  });

  return getAllSettings(shopId);
}

// 5. Get Audit Logs History
async function getAuditLogs(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const where = {};

  if (query.shopId) where.shopId = query.shopId;
  if (query.module) where.module = query.module;
  if (query.action) where.action = query.action;

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    logs,
    pagination: getPaginationMeta(total, page, limit),
  };
}

const { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } = require('../../i18n');

// 5. Update Shop Language (English, Gujarati, Gujlish)
async function updateShopLanguage(shopId, userId, language) {
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    const err = new Error(`Unsupported language '${language}'. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const updatedShop = await prisma.shop.update({
    where: { id: shopId },
    data: { defaultLanguage: language },
    select: { id: true, shopName: true, defaultLanguage: true },
  });

  await prisma.setting.upsert({
    where: { shopId_key: { shopId, key: 'language' } },
    update: { value: language },
    create: { shopId, key: 'language', value: language },
  });

  if (userId) {
    await prisma.auditLog.create({
      data: {
        shopId,
        userId,
        module: 'SETTINGS',
        action: 'SHOP_LANGUAGE_UPDATE',
        recordId: shopId,
        newValue: JSON.stringify({ defaultLanguage: language }),
      },
    });
  }

  return {
    shopId: updatedShop.id,
    shopName: updatedShop.shopName,
    defaultLanguage: updatedShop.defaultLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };
}

module.exports = {
  getAllSettings,
  updateShopProfile,
  updateOwnerProfile,
  updateCategorySettings,
  updateShopLanguage,
  getAuditLogs,
};
