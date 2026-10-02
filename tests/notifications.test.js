const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('Notification + Alert Management Test Suite', () => {
  let shopA, shopB;
  let ownerA, ownerB;
  let tokenOwnerA, tokenOwnerB;
  let farmerA, supplierA;
  let categoryA, product1, batch1;

  beforeAll(async () => {
    // 1. Create Shop A with OWNER A
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Notifications Test Shop A',
        code: `NTSA_${Date.now()}`,
        mobile: `+919950${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Owner Notifications A',
        email: `owner_notif_a_${Date.now()}@shop.com`,
        mobile: shopA.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerA = generateAccessToken(ownerA);

    farmerA = await prisma.farmer.create({
      data: {
        shopId: shopA.id,
        name: 'Ganesh Notif Test',
        phone: `+91996${String(Date.now()).slice(-7)}`,
        village: 'Rajkot',
        khataBalance: 2000,
      },
    });

    supplierA = await prisma.supplier.create({
      data: {
        shopId: shopA.id,
        name: 'Agro Chemicals Notif',
        companyName: 'Notif Supplier Agency',
        phone: `+91997${String(Date.now()).slice(-7)}`,
      },
    });

    categoryA = await prisma.category.create({
      data: {
        shopId: shopA.id,
        name: 'Pesticides Notif Test',
      },
    });

    // Product minStock = 10, batch quantity = 5 (LOW STOCK state)
    product1 = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'Monocrotophos Pesticide Notif',
        shortName: 'Mono 500ML',
        code: `MONO_NOTIF_${Date.now()}`,
        categoryId: categoryA.id,
        minStock: 10,
        variants: {
          create: [{ variantName: '500 ML', sku: `MONO_500_${Date.now()}`, sellingPrice: 450, mrp: 500 }],
        },
      },
      include: { variants: true },
    });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15); // Expiry in 15 days -> EXPIRY_WARNING

    batch1 = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: product1.id,
        variantId: product1.variants[0].id,
        supplierId: supplierA.id,
        batchNumber: `BATCH_NOTIF_1_${Date.now()}`,
        quantity: 5, // Low stock: 5 <= 10
        purchasePrice: 300,
        mrp: 500,
        sellingPrice: 450,
        expiryDate: futureDate,
      },
    });

    // 2. Create Shop B & Owner B for cross-shop security testing
    shopB = await prisma.shop.create({
      data: {
        shopName: 'Notifications Test Shop B',
        code: `NTSB_${Date.now()}`,
        mobile: `+919980${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Owner Notifications B',
        email: `owner_notif_b_${Date.now()}@shop.com`,
        mobile: shopB.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);
  });

  // Test 1: Automated Alert Scanner & Deduplication
  it('POST /api/v1/notifications/evaluate-alerts - should scan and generate low stock and expiry alerts with deduplication', async () => {
    const res1 = await request(app)
      .post('/api/v1/notifications/evaluate-alerts')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res1.statusCode).toEqual(200);
    expect(res1.body.success).toBe(true);

    const list1 = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(list1.statusCode).toEqual(200);
    expect(list1.body.data.notifications.length).toBeGreaterThan(0);

    const count1 = list1.body.data.notifications.length;

    // Trigger scan a second time to test duplicate protection (dedupeKey)
    await request(app)
      .post('/api/v1/notifications/evaluate-alerts')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    const list2 = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(list2.body.data.notifications.length).toEqual(count1); // Count must NOT increase
  });

  // Test 2: Unread Count Badge API
  it('GET /api/v1/notifications/unread-count - should return unread count object for navbar badge', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.count).toBeGreaterThan(0);
  });

  // Test 3: Mark Single & Mark All Notifications as Read
  it('PATCH /api/v1/notifications/:id/read & /read-all - should mark notifications as read and decrement unread count', async () => {
    const listRes = await request(app)
      .get('/api/v1/notifications?isRead=false')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    const firstNotifId = listRes.body.data.notifications[0].id;

    const readSingleRes = await request(app)
      .patch(`/api/v1/notifications/${firstNotifId}/read`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(readSingleRes.statusCode).toEqual(200);
    expect(readSingleRes.body.data.isRead).toBe(true);

    // Mark all as read
    const readAllRes = await request(app)
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(readAllRes.statusCode).toEqual(200);

    const unreadRes = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(unreadRes.body.data.count).toEqual(0);
  });

  // Test 4: Preferences API
  it('GET & PATCH /api/v1/notifications/preferences - should get and update notification settings', async () => {
    const getPref = await request(app)
      .get('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(getPref.statusCode).toEqual(200);
    expect(getPref.body.data.enableLowStock).toBe(true);

    const updatePref = await request(app)
      .patch('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({ enablePayment: false });

    expect(updatePref.statusCode).toEqual(200);
    expect(updatePref.body.data.enablePayment).toBe(false);
  });

  // Test 5: Multi-Tenant Security Guard - Shop B cannot view Shop A notifications
  it('GET /api/v1/notifications - should return 0 notifications for empty Shop B', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${tokenOwnerB}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notifications.length).toEqual(0);
  });
});
