const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { emitShopEvent } = require('../../config/socket');
const { logAuditAction } = require('../../utils/auditLogger');
const { sanitizePhoneNumber } = require('../../services/whatsapp.service');

function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * 1. Create Reminder / Farmer Product Demand
 */
async function createReminder(shopId, userId, data) {
  if (data.farmerId) {
    const farmer = await prisma.farmer.findFirst({
      where: { id: data.farmerId, shopId },
    });
    if (!farmer) {
      const err = new Error('Farmer not found in this shop');
      err.statusCode = 404;
      throw err;
    }
  }

  if (data.supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, shopId },
    });
    if (!supplier) {
      const err = new Error('Supplier/Dealer not found in this shop');
      err.statusCode = 404;
      throw err;
    }
  }

  const reminder = await prisma.reminder.create({
    data: {
      shopId,
      userId,
      title: data.title,
      description: data.description || null,
      type: data.type || 'FARMER_PRODUCT_DEMAND',
      priority: data.priority || 'MEDIUM',
      dueDate: new Date(data.dueDate),
      status: 'PENDING',
      farmerId: data.farmerId || null,
      supplierId: data.supplierId || null,
      productName: data.productName || null,
      quantityNeeded: data.quantityNeeded !== undefined ? data.quantityNeeded : null,
      unit: data.unit || null,
      estimatedCost: data.estimatedCost !== undefined ? data.estimatedCost : null,
      advancePaid: data.advancePaid !== undefined ? data.advancePaid : 0,
    },
    include: {
      farmer: { select: { id: true, name: true, phone: true, village: true } },
      supplier: { select: { id: true, name: true, companyName: true, phone: true } },
    },
  });

  emitShopEvent(shopId, 'reminder.created', reminder);

  logAuditAction({
    userId,
    shopId,
    action: 'REMINDER_CREATE',
    module: 'REMINDERS',
    recordId: reminder.id,
    newValue: reminder,
  });

  return reminder;
}

/**
 * 2. Get Reminders List with Filter & Timeframes
 */
async function getReminders(shopId, query = {}) {
  const where = { shopId };

  if (query.status && query.status !== 'ALL') {
    where.status = query.status;
  }

  if (query.type && query.type !== 'ALL') {
    where.type = query.type;
  }

  if (query.priority && query.priority !== 'ALL') {
    where.priority = query.priority;
  }

  if (query.farmerId) {
    where.farmerId = query.farmerId;
  }

  if (query.supplierId) {
    where.supplierId = query.supplierId;
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (query.timeframe) {
    if (query.timeframe === 'TODAY') {
      where.dueDate = { gte: startOfDay, lte: endOfDay };
    } else if (query.timeframe === 'OVERDUE') {
      where.dueDate = { lt: startOfDay };
      if (!where.status) {
        where.status = { in: ['PENDING', 'ORDERED_TO_DEALER'] };
      }
    } else if (query.timeframe === 'UPCOMING') {
      where.dueDate = { gt: endOfDay };
      if (!where.status) {
        where.status = { in: ['PENDING', 'ORDERED_TO_DEALER'] };
      }
    }
  }

  if (query.search && query.search.trim()) {
    const search = query.search.trim();
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { productName: { contains: search, mode: 'insensitive' } },
      { farmer: { name: { contains: search, mode: 'insensitive' } } },
      { supplier: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const { page, limit, skip } = getPagination(query);

  const [total, reminders] = await Promise.all([
    prisma.reminder.count({ where }),
    prisma.reminder.findMany({
      where,
      skip,
      take: limit,
      include: {
        farmer: { select: { id: true, name: true, phone: true, village: true } },
        supplier: { select: { id: true, name: true, companyName: true, phone: true } },
        user: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    }),
  ]);

  return {
    reminders,
    pagination: getPaginationMeta(total, page, limit),
  };
}

/**
 * 3. Get Reminder Metrics & Counters
 */
async function getReminderMetrics(shopId) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [
    totalPending,
    dueToday,
    overdue,
    orderedToDealer,
    stockArrived,
    completed,
  ] = await Promise.all([
    prisma.reminder.count({
      where: { shopId, status: 'PENDING' },
    }),
    prisma.reminder.count({
      where: {
        shopId,
        status: { in: ['PENDING', 'ORDERED_TO_DEALER'] },
        dueDate: { gte: startOfDay, lte: endOfDay },
      },
    }),
    prisma.reminder.count({
      where: {
        shopId,
        status: { in: ['PENDING', 'ORDERED_TO_DEALER'] },
        dueDate: { lt: startOfDay },
      },
    }),
    prisma.reminder.count({
      where: { shopId, status: 'ORDERED_TO_DEALER' },
    }),
    prisma.reminder.count({
      where: { shopId, status: 'STOCK_ARRIVED' },
    }),
    prisma.reminder.count({
      where: { shopId, status: 'COMPLETED' },
    }),
  ]);

  return {
    totalPending,
    dueToday,
    overdue,
    orderedToDealer,
    stockArrived,
    completed,
  };
}

/**
 * 4. Get Single Reminder Details
 */
async function getReminderById(reminderId, shopId) {
  const reminder = await prisma.reminder.findFirst({
    where: { id: reminderId, shopId },
    include: {
      farmer: { select: { id: true, name: true, phone: true, village: true, khataBalance: true } },
      supplier: { select: { id: true, name: true, companyName: true, phone: true } },
      user: { select: { id: true, fullName: true, role: true } },
    },
  });

  if (!reminder) {
    const err = new Error('Reminder not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  return reminder;
}

/**
 * 5. Update Reminder
 */
async function updateReminder(reminderId, shopId, userId, data) {
  const existing = await prisma.reminder.findFirst({
    where: { id: reminderId, shopId },
  });

  if (!existing) {
    const err = new Error('Reminder not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  if (data.farmerId) {
    const farmer = await prisma.farmer.findFirst({
      where: { id: data.farmerId, shopId },
    });
    if (!farmer) {
      const err = new Error('Farmer not found in this shop');
      err.statusCode = 404;
      throw err;
    }
  }

  if (data.supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, shopId },
    });
    if (!supplier) {
      const err = new Error('Supplier/Dealer not found in this shop');
      err.statusCode = 404;
      throw err;
    }
  }

  const updateData = { ...data };
  if (data.dueDate) {
    updateData.dueDate = new Date(data.dueDate);
  }

  const updated = await prisma.reminder.update({
    where: { id: reminderId },
    data: updateData,
    include: {
      farmer: { select: { id: true, name: true, phone: true, village: true } },
      supplier: { select: { id: true, name: true, companyName: true, phone: true } },
    },
  });

  emitShopEvent(shopId, 'reminder.updated', updated);

  logAuditAction({
    userId,
    shopId,
    action: 'REMINDER_UPDATE',
    module: 'REMINDERS',
    recordId: reminderId,
    oldValue: existing,
    newValue: updated,
  });

  return updated;
}

/**
 * 6. Update Reminder Status Lifecycle
 */
async function updateReminderStatus(reminderId, shopId, userId, { status, notes }) {
  const reminder = await prisma.reminder.findFirst({
    where: { id: reminderId, shopId },
  });

  if (!reminder) {
    const err = new Error('Reminder not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  const data = { status };
  const now = new Date();

  if (status === 'ORDERED_TO_DEALER') {
    data.orderedAt = now;
  } else if (status === 'STOCK_ARRIVED') {
    data.arrivedAt = now;
  } else if (status === 'COMPLETED') {
    data.completedAt = now;
  }

  if (notes && notes.trim()) {
    const existingDesc = reminder.description ? `${reminder.description}\n` : '';
    data.description = `${existingDesc}[${status} - ${formatDate(now)}]: ${notes.trim()}`;
  }

  const updated = await prisma.reminder.update({
    where: { id: reminderId },
    data,
    include: {
      farmer: { select: { id: true, name: true, phone: true, village: true } },
      supplier: { select: { id: true, name: true, companyName: true, phone: true } },
    },
  });

  emitShopEvent(shopId, 'reminder.status_updated', updated);

  logAuditAction({
    userId,
    shopId,
    action: 'REMINDER_STATUS_CHANGE',
    module: 'REMINDERS',
    recordId: reminderId,
    oldValue: { status: reminder.status },
    newValue: { status: updated.status },
  });

  return updated;
}

/**
 * 7. Snooze / Reschedule Reminder
 */
async function snoozeReminder(reminderId, shopId, userId, { dueDate, snoozeDays = 1 }) {
  const reminder = await prisma.reminder.findFirst({
    where: { id: reminderId, shopId },
  });

  if (!reminder) {
    const err = new Error('Reminder not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  let newDueDate;
  if (dueDate) {
    newDueDate = new Date(dueDate);
  } else {
    newDueDate = new Date(Date.now() + snoozeDays * 24 * 60 * 60 * 1000);
  }

  const updated = await prisma.reminder.update({
    where: { id: reminderId },
    data: {
      dueDate: newDueDate,
    },
    include: {
      farmer: { select: { id: true, name: true, phone: true, village: true } },
      supplier: { select: { id: true, name: true, companyName: true, phone: true } },
    },
  });

  emitShopEvent(shopId, 'reminder.snoozed', updated);

  return updated;
}

const { t } = require('../../i18n');

/**
 * 8. Generate Dealer WhatsApp Purchase Order
 */
async function getDealerOrderWhatsAppPayload(reminderId, shopId, lang) {
  const [reminder, shop] = await Promise.all([
    prisma.reminder.findFirst({
      where: { id: reminderId, shopId },
      include: {
        supplier: true,
        farmer: true,
      },
    }),
    prisma.shop.findUnique({
      where: { id: shopId },
    }),
  ]);

  if (!reminder) {
    const err = new Error('Reminder not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  const selectedLang = lang || shop?.defaultLanguage || 'en';
  const shopName = shop?.shopName || t('common.appName', selectedLang);
  const shopPhone = shop?.mobile || '';
  const supplierName = reminder.supplier?.companyName || reminder.supplier?.name || t('whatsapp.dealerGreeting', selectedLang);
  const supplierPhone = reminder.supplier?.phone || '';

  const productName = reminder.productName || reminder.title;
  const qtyStr = reminder.quantityNeeded
    ? `${reminder.quantityNeeded} ${reminder.unit || 'Units'}`
    : 'Required quantity';

  let message = `🌾 *${shopName.toUpperCase()}*\n`;
  message += `📦 *${t('whatsapp.dealerOrderTitle', selectedLang)}*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🏢 *To:* ${supplierName}\n`;
  message += `📋 *${t('billing.item', selectedLang)}:* ${productName}\n`;
  message += `🔢 *${t('billing.quantity', selectedLang)}:* ${qtyStr}\n`;
  message += `📅 *${t('khata.dueDate', selectedLang)}:* ${formatDate(reminder.dueDate)}\n`;

  if (reminder.description) {
    message += `📝 *${t('whatsapp.noteFromShop', selectedLang)}:* ${reminder.description}\n`;
  }
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `ℹ️ ${t('whatsapp.dealerStockInquiry', selectedLang)}\n`;
  if (shopPhone) message += `📞 ${t('whatsapp.contact', selectedLang)}: ${shopPhone}\n`;

  const sanitizedPhone = sanitizePhoneNumber(supplierPhone);
  const deepLink = sanitizedPhone
    ? `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(message)}`
    : null;

  return {
    reminderId: reminder.id,
    supplier: reminder.supplier
      ? {
          id: reminder.supplier.id,
          name: reminder.supplier.name,
          companyName: reminder.supplier.companyName,
          phone: reminder.supplier.phone,
        }
      : null,
    productName,
    quantityStr: qtyStr,
    message,
    deepLink,
  };
}

/**
 * 9. Generate Farmer Stock Arrival WhatsApp Alert
 */
async function getFarmerArrivalWhatsAppPayload(reminderId, shopId, lang) {
  const [reminder, shop] = await Promise.all([
    prisma.reminder.findFirst({
      where: { id: reminderId, shopId },
      include: {
        farmer: true,
      },
    }),
    prisma.shop.findUnique({
      where: { id: shopId },
    }),
  ]);

  if (!reminder) {
    const err = new Error('Reminder not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  const selectedLang = lang || reminder.farmer?.preferredLanguage || shop?.defaultLanguage || 'en';
  const shopName = shop?.shopName || t('common.appName', selectedLang);
  const shopPhone = shop?.mobile || '';
  const shopAddress = [shop?.address, shop?.villageCity].filter(Boolean).join(', ');
  const farmerName = reminder.farmer?.name || t('billing.customer', selectedLang);
  const farmerPhone = reminder.farmer?.phone || '';

  const productName = reminder.productName || reminder.title;
  const qtyStr = reminder.quantityNeeded
    ? `${reminder.quantityNeeded} ${reminder.unit || 'Units'}`
    : '';

  let message = `🌾 *${shopName.toUpperCase()}*\n`;
  message += `🎉 *${t('whatsapp.farmerArrivalTitle', selectedLang)}*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `👤 *Hello ${farmerName}!*\n`;
  message += `${t('whatsapp.farmerArrivalGreeting', selectedLang)}\n\n`;
  message += `📦 *${t('billing.item', selectedLang)}:* ${productName}\n`;
  if (qtyStr) message += `🔢 *${t('billing.quantity', selectedLang)}:* ${qtyStr}\n`;
  if (reminder.advancePaid > 0) {
    message += `💰 *Advance Token Paid:* ₹${reminder.advancePaid}\n`;
  }
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📍 *Store Location:* ${shopAddress || 'Visit store'}\n`;
  if (shopPhone) message += `📞 ${t('whatsapp.contact', selectedLang)}: ${shopPhone}\n`;

  const sanitizedPhone = sanitizePhoneNumber(farmerPhone);
  const deepLink = sanitizedPhone
    ? `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(message)}`
    : null;

  return {
    reminderId: reminder.id,
    farmer: reminder.farmer
      ? {
          id: reminder.farmer.id,
          name: reminder.farmer.name,
          phone: reminder.farmer.phone,
        }
      : null,
    productName,
    message,
    deepLink,
  };
}

/**
 * 10. Delete Reminder
 */
async function deleteReminder(reminderId, shopId, userId) {
  const reminder = await prisma.reminder.findFirst({
    where: { id: reminderId, shopId },
  });

  if (!reminder) {
    const err = new Error('Reminder not found in this shop');
    err.statusCode = 404;
    throw err;
  }

  await prisma.reminder.delete({
    where: { id: reminderId },
  });

  emitShopEvent(shopId, 'reminder.deleted', { reminderId });

  logAuditAction({
    userId,
    shopId,
    action: 'REMINDER_DELETE',
    module: 'REMINDERS',
    recordId: reminderId,
    oldValue: reminder,
  });

  return { id: reminderId, deleted: true };
}

module.exports = {
  createReminder,
  getReminders,
  getReminderMetrics,
  getReminderById,
  updateReminder,
  updateReminderStatus,
  snoozeReminder,
  getDealerOrderWhatsAppPayload,
  getFarmerArrivalWhatsAppPayload,
  deleteReminder,
};
