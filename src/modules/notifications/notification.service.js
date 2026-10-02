const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

// Priority mappings
const PRIORITY_MAP = {
  LOW_STOCK: 'MEDIUM',
  OUT_OF_STOCK: 'HIGH',
  OVERDUE_CREDIT: 'HIGH',
  UPCOMING_DUE: 'MEDIUM',
  PAYMENT_RECEIVED: 'LOW',
  RESTOCK_COMPLETED: 'LOW',
  SALES_RETURN_CREATED: 'MEDIUM',
  PURCHASE_RETURN_CREATED: 'MEDIUM',
  EXPIRY_WARNING: 'HIGH',
  EXPIRY_TODAY: 'CRITICAL',
  SYSTEM_ALERT: 'HIGH',
};

// 1. Get Unread Notifications Count
async function getUnreadCount(shopId, userId) {
  const count = await prisma.notification.count({
    where: {
      shopId,
      isRead: false,
    },
  });
  return { count };
}

// 2. Get Paginated Notifications List
async function getNotifications(shopId, userId, query = {}) {
  const where = { shopId };
  if (query.isRead !== undefined && query.isRead !== null && query.isRead !== '') {
    where.isRead = query.isRead === 'true' || query.isRead === true;
  }
  if (query.type) where.type = query.type;
  if (query.priority) where.priority = query.priority;

  const { page, limit, skip } = getPagination(query);

  const [total, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    notifications,
    pagination: getPaginationMeta(total, page, limit),
  };
}

// 3. Get Single Notification Details
async function getNotificationById(shopId, userId, notificationId) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, shopId },
  });

  if (!notification) {
    const err = new Error('Notification not found');
    err.statusCode = 404;
    throw err;
  }

  return notification;
}

// 4. Mark Single Notification as Read
async function markAsRead(shopId, userId, notificationId) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, shopId },
  });

  if (!notification) {
    const err = new Error('Notification not found');
    err.statusCode = 404;
    throw err;
  }

  return await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
}

// 5. Mark All Notifications as Read for Shop
async function markAllAsRead(shopId, userId) {
  const result = await prisma.notification.updateMany({
    where: { shopId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  return { updatedCount: result.count };
}

// 6. Delete Notification
async function deleteNotification(shopId, userId, notificationId) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, shopId },
  });

  if (!notification) {
    const err = new Error('Notification not found');
    err.statusCode = 404;
    throw err;
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  return { message: 'Notification deleted successfully' };
}

// 7. Preferences Management
async function getPreferences(shopId, userId) {
  let pref = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  if (!pref) {
    pref = await prisma.notificationPreference.create({
      data: { shopId, userId },
    });
  }

  return pref;
}

async function updatePreferences(shopId, userId, data) {
  return await prisma.notificationPreference.upsert({
    where: { userId },
    update: data,
    create: { shopId, userId, ...data },
  });
}

// 8. Event Notification Helper
async function createNotificationFromEvent(shopId, payload) {
  try {
    const { type, title, message, entityType, entityId, dedupeKey } = payload;
    const priority = PRIORITY_MAP[type] || 'MEDIUM';

    if (dedupeKey) {
      const existing = await prisma.notification.findUnique({
        where: { shopId_dedupeKey: { shopId, dedupeKey } },
      });
      if (existing) return existing; // Skip duplicate creation
    }

    return await prisma.notification.create({
      data: {
        shopId,
        type,
        priority,
        title,
        message,
        entityType,
        entityId,
        dedupeKey: dedupeKey || null,
      },
    });
  } catch (error) {
    console.error('Non-blocking Notification Creation Error:', error.message);
  }
}

// 9. Automated Stock Alerts Scanner
async function evaluateStockAlerts(shopId, productIds = null) {
  try {
    const where = { shopId, isActive: true };
    if (Array.isArray(productIds) && productIds.length > 0) {
      where.id = { in: productIds };
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        batches: { where: { quantity: { gt: 0 } } },
      },
    });

    for (const p of products) {
      const totalQty = p.batches.reduce((sum, b) => sum + b.quantity, 0);

      if (totalQty <= 0) {
        // Out of Stock Alert
        await createNotificationFromEvent(shopId, {
          type: 'OUT_OF_STOCK',
          title: 'Product Out of Stock',
          message: `${p.shortName || p.name} is currently out of stock.`,
          entityType: 'PRODUCT',
          entityId: p.id,
          dedupeKey: `OUT_OF_STOCK:${p.id}`,
        });
      } else if (totalQty <= p.minStock) {
        // Low Stock Alert
        await createNotificationFromEvent(shopId, {
          type: 'LOW_STOCK',
          title: 'Low Stock Alert',
          message: `${p.shortName || p.name} is running low (Current: ${totalQty}, Min: ${p.minStock}).`,
          entityType: 'PRODUCT',
          entityId: p.id,
          dedupeKey: `LOW_STOCK:${p.id}`,
        });
      } else {
        // Normal Stock -> Clear previous out of stock / low stock alerts for this product
        await prisma.notification.deleteMany({
          where: {
            shopId,
            dedupeKey: { in: [`LOW_STOCK:${p.id}`, `OUT_OF_STOCK:${p.id}`] },
          },
        });
      }
    }
  } catch (error) {
    console.error('Stock Alerts Evaluation Error:', error.message);
  }
}

// 10. Automated Credit Alerts Scanner
async function evaluateCreditAlerts(shopId) {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        shopId,
        paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
        createdAt: { lte: thirtyDaysAgo },
      },
      include: { farmer: { select: { id: true, name: true } } },
    });

    for (const inv of overdueInvoices) {
      const due = inv.totalAmount - inv.paidAmount;
      if (due > 0 && inv.farmer) {
        await createNotificationFromEvent(shopId, {
          type: 'OVERDUE_CREDIT',
          title: 'Farmer Payment Overdue',
          message: `${inv.farmer.name} has ₹${due} overdue on Invoice ${inv.invoiceNumber}.`,
          entityType: 'FARMER',
          entityId: inv.farmer.id,
          dedupeKey: `OVERDUE:${inv.farmer.id}:${inv.id}`,
        });
      }
    }
  } catch (error) {
    console.error('Credit Alerts Evaluation Error:', error.message);
  }
}

// 11. Automated Expiry Alerts Scanner
async function evaluateExpiryAlerts(shopId) {
  try {
    const now = new Date();
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expiringBatches = await prisma.inventoryBatch.findMany({
      where: {
        shopId,
        quantity: { gt: 0 },
        expiryDate: { lte: thirtyDaysAhead },
      },
      include: { product: { select: { name: true, shortName: true } } },
    });

    for (const b of expiringBatches) {
      if (!b.expiryDate) continue;
      const isExpiringToday = b.expiryDate.toISOString().split('T')[0] === now.toISOString().split('T')[0];
      const pName = b.product ? (b.product.shortName || b.product.name) : 'Product';

      if (isExpiringToday) {
        await createNotificationFromEvent(shopId, {
          type: 'EXPIRY_TODAY',
          title: 'Batch Expiring Today',
          message: `Batch ${b.batchNumber} of ${pName} expires today! Do not sell expired stock.`,
          entityType: 'INVENTORY_BATCH',
          entityId: b.id,
          dedupeKey: `EXPIRY_TODAY:${b.id}`,
        });
      } else {
        await createNotificationFromEvent(shopId, {
          type: 'EXPIRY_WARNING',
          title: 'Batch Expiry Warning',
          message: `Batch ${b.batchNumber} of ${pName} expires on ${b.expiryDate.toISOString().split('T')[0]}.`,
          entityType: 'INVENTORY_BATCH',
          entityId: b.id,
          dedupeKey: `EXPIRY_WARN:${b.id}`,
        });
      }
    }
  } catch (error) {
    console.error('Expiry Alerts Evaluation Error:', error.message);
  }
}

// Master Evaluator
async function evaluateAllAlerts(shopId) {
  await Promise.all([
    evaluateStockAlerts(shopId),
    evaluateCreditAlerts(shopId),
    evaluateExpiryAlerts(shopId),
  ]);
  return { message: 'Alerts evaluation completed successfully' };
}

module.exports = {
  getUnreadCount,
  getNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getPreferences,
  updatePreferences,
  createNotificationFromEvent,
  evaluateStockAlerts,
  evaluateCreditAlerts,
  evaluateExpiryAlerts,
  evaluateAllAlerts,
};
