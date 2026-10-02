const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('Smart Agro Reminders & Dealer Procurement Test Suite', () => {
  let shopA, shopB;
  let ownerA, ownerB, staffA;
  let tokenOwnerA, tokenOwnerB, tokenStaffA;
  let farmerA, farmerB;
  let supplierA;
  let createdReminder;

  beforeAll(async () => {
    // 1. Setup Shop A
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Shree Krishna Agro Center',
        code: `SKAC_${Date.now()}`,
        mobile: `+919725${String(Date.now()).slice(-6)}`,
        email: 'info@krishnaagro.com',
        address: 'Station Road, APMC Market',
        villageCity: 'Rajkot',
        state: 'Gujarat',
        pincode: '360001',
        gstin: '24AABCS1234E1Z6',
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Kishore Bhai',
        email: `kishore_${Date.now()}@shop.com`,
        mobile: shopA.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerA = generateAccessToken(ownerA);

    staffA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Chetan Staff',
        email: `chetan_staff_${Date.now()}@shop.com`,
        mobile: `+919726${String(Date.now()).slice(-6)}`,
        passwordHash: 'hash',
        role: 'BILLING_STAFF',
        status: 'ACTIVE',
      },
    });
    tokenStaffA = generateAccessToken(staffA);

    // 2. Setup Shop B for multi-tenant checks
    shopB = await prisma.shop.create({
      data: {
        shopName: 'Shop B Agro',
        code: `SBA_${Date.now()}`,
        mobile: `+919730${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Owner B',
        email: `owner_b_${Date.now()}@shop.com`,
        mobile: shopB.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);

    // 3. Create Farmer A (Shop A) & Farmer B (Shop B)
    farmerA = await prisma.farmer.create({
      data: {
        shopId: shopA.id,
        name: 'Bharat Bhai Patel',
        phone: '9825123456',
        email: 'bharat@farmer.com',
        village: 'Gondal',
        creditLimit: 40000,
        khataBalance: 1200,
      },
    });

    farmerB = await prisma.farmer.create({
      data: {
        shopId: shopB.id,
        name: 'Farmer in Shop B',
        phone: '9825999999',
        creditLimit: 10000,
      },
    });

    // 4. Create Supplier A (Dealer in Shop A)
    supplierA = await prisma.supplier.create({
      data: {
        shopId: shopA.id,
        name: 'Rajesh Shah',
        companyName: 'Gujarat Seeds & Fertilizers Distributors',
        phone: '9898012345',
        email: 'distributor@gsfd.com',
        address: 'GIDC Industrial Area',
      },
    });
  });

  // Test 1: Create a Farmer Product Demand Reminder
  it('POST /api/v1/reminders - should create a farmer product demand reminder', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const payload = {
      title: 'Order 5 bags Pioneer Maize for Bharat Bhai',
      description: 'Farmer needs this for kharif sowing next week.',
      type: 'FARMER_PRODUCT_DEMAND',
      priority: 'HIGH',
      dueDate: tomorrow.toISOString(),
      farmerId: farmerA.id,
      supplierId: supplierA.id,
      productName: 'Pioneer Hybrid Maize 3302',
      quantityNeeded: 5,
      unit: 'Bags',
      estimatedCost: 7500,
      advancePaid: 1000,
    };

    const res = await request(app)
      .post('/api/v1/reminders')
      .set('Authorization', `Bearer ${tokenStaffA}`)
      .send(payload);

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);

    createdReminder = res.body.data;
    expect(createdReminder.id).toBeDefined();
    expect(createdReminder.title).toEqual(payload.title);
    expect(createdReminder.status).toEqual('PENDING');
    expect(createdReminder.productName).toEqual('Pioneer Hybrid Maize 3302');
    expect(createdReminder.quantityNeeded).toEqual(5);
    expect(createdReminder.advancePaid).toEqual(1000);
    expect(createdReminder.farmer.name).toEqual('Bharat Bhai Patel');
    expect(createdReminder.supplier.companyName).toEqual('Gujarat Seeds & Fertilizers Distributors');
  });

  // Test 2: Get Reminder Metrics
  it('GET /api/v1/reminders/metrics - should return metrics counts', async () => {
    const res = await request(app)
      .get('/api/v1/reminders/metrics')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalPending).toBeGreaterThanOrEqual(1);
    expect(res.body.data).toHaveProperty('dueToday');
    expect(res.body.data).toHaveProperty('overdue');
    expect(res.body.data).toHaveProperty('orderedToDealer');
    expect(res.body.data).toHaveProperty('stockArrived');
    expect(res.body.data).toHaveProperty('completed');
  });

  // Test 3: List Reminders with Search & Filters
  it('GET /api/v1/reminders - should list reminders filtered by type and search', async () => {
    const res = await request(app)
      .get('/api/v1/reminders')
      .query({
        type: 'FARMER_PRODUCT_DEMAND',
        search: 'Pioneer',
      })
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].id).toEqual(createdReminder.id);
  });

  // Test 4: Generate Dealer WhatsApp Purchase Order
  it('GET /api/v1/reminders/:id/dealer-whatsapp - should generate dealer purchase order text and deep link', async () => {
    const res = await request(app)
      .get(`/api/v1/reminders/${createdReminder.id}/dealer-whatsapp`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);

    const { supplier, message, deepLink, productName } = res.body.data;
    expect(supplier.phone).toEqual('9898012345');
    expect(productName).toEqual('Pioneer Hybrid Maize 3302');
    expect(message).toContain('PURCHASE REQUIREMENT / ORDER INDENT');
    expect(message).toContain('5 Bags');
    expect(deepLink).toContain('https://wa.me/919898012345?text=');
  });

  // Test 5: Status Transition to ORDERED_TO_DEALER and STOCK_ARRIVED
  it('PATCH /api/v1/reminders/:id/status - should transition status to ORDERED_TO_DEALER and then STOCK_ARRIVED', async () => {
    // Step 1: Mark Ordered to Dealer
    const res1 = await request(app)
      .patch(`/api/v1/reminders/${createdReminder.id}/status`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        status: 'ORDERED_TO_DEALER',
        notes: 'Placed order via WhatsApp call with dealer.',
      });

    expect(res1.statusCode).toEqual(200);
    expect(res1.body.data.status).toEqual('ORDERED_TO_DEALER');
    expect(res1.body.data.orderedAt).toBeDefined();

    // Step 2: Mark Stock Arrived
    const res2 = await request(app)
      .patch(`/api/v1/reminders/${createdReminder.id}/status`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        status: 'STOCK_ARRIVED',
        notes: 'Stock received at shop in morning shipment.',
      });

    expect(res2.statusCode).toEqual(200);
    expect(res2.body.data.status).toEqual('STOCK_ARRIVED');
    expect(res2.body.data.arrivedAt).toBeDefined();
  });

  // Test 6: Generate Farmer Arrival WhatsApp Alert
  it('GET /api/v1/reminders/:id/farmer-whatsapp - should generate farmer stock arrival alert and deep link', async () => {
    const res = await request(app)
      .get(`/api/v1/reminders/${createdReminder.id}/farmer-whatsapp`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);

    const { farmer, message, deepLink, productName } = res.body.data;
    expect(farmer.name).toEqual('Bharat Bhai Patel');
    expect(farmer.phone).toEqual('9825123456');
    expect(productName).toEqual('Pioneer Hybrid Maize 3302');
    expect(message).toContain('PRODUCT ARRIVAL NOTIFICATION');
    expect(message).toContain('*Advance Token Paid:* ₹1000');
    expect(deepLink).toContain('https://wa.me/919825123456?text=');
  });

  // Test 7: Snooze / Reschedule Reminder
  it('PATCH /api/v1/reminders/:id/snooze - should snooze reminder by specified days', async () => {
    const res = await request(app)
      .patch(`/api/v1/reminders/${createdReminder.id}/snooze`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        snoozeDays: 3,
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.dueDate).toBeDefined();
  });

  // Test 8: Status Transition to COMPLETED
  it('PATCH /api/v1/reminders/:id/status - should complete reminder when farmer collects order', async () => {
    const res = await request(app)
      .patch(`/api/v1/reminders/${createdReminder.id}/status`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        status: 'COMPLETED',
        notes: 'Farmer collected 5 bags and settled remaining bill.',
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.status).toEqual('COMPLETED');
    expect(res.body.data.completedAt).toBeDefined();
  });

  // Test 9: Multi-Tenant Protection & IDOR Isolation
  it('should enforce multi-tenant isolation and reject cross-shop access with 404', async () => {
    // Owner B cannot view Owner A's reminder
    const viewRes = await request(app)
      .get(`/api/v1/reminders/${createdReminder.id}`)
      .set('Authorization', `Bearer ${tokenOwnerB}`);
    expect(viewRes.statusCode).toEqual(404);

    // Owner A cannot link Farmer from Shop B
    const crossFarmerRes = await request(app)
      .post('/api/v1/reminders')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        title: 'Cross shop farmer test',
        dueDate: new Date().toISOString(),
        farmerId: farmerB.id, // Belongs to Shop B!
      });
    expect(crossFarmerRes.statusCode).toEqual(404);
  });

  // Test 10: Delete Reminder
  it('DELETE /api/v1/reminders/:id - should delete reminder', async () => {
    const deleteRes = await request(app)
      .delete(`/api/v1/reminders/${createdReminder.id}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(deleteRes.statusCode).toEqual(200);
    expect(deleteRes.body.success).toBe(true);

    const getRes = await request(app)
      .get(`/api/v1/reminders/${createdReminder.id}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);
    expect(getRes.statusCode).toEqual(404);
  });
});
