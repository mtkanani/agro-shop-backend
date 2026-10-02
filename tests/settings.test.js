const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('Settings Management Module Test Suite', () => {
  let shopA, shopB;
  let ownerA, staffA, ownerB;
  let tokenOwnerA, tokenStaffA, tokenOwnerB;

  beforeAll(async () => {
    // 1. Create Shop A with OWNER A and STAFF A
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Settings Test Shop A',
        code: `STSA_${Date.now()}`,
        mobile: `+919910${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Owner Settings A',
        email: `owner_settings_a_${Date.now()}@shop.com`,
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
        fullName: 'Staff Settings A',
        email: `staff_settings_a_${Date.now()}@shop.com`,
        mobile: `+919911${String(Date.now()).slice(-6)}`,
        passwordHash: 'hash',
        role: 'BILLING_STAFF',
        status: 'ACTIVE',
      },
    });
    tokenStaffA = generateAccessToken(staffA);

    // 2. Create Shop B with OWNER B
    shopB = await prisma.shop.create({
      data: {
        shopName: 'Settings Test Shop B',
        code: `STSB_${Date.now()}`,
        mobile: `+919920${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Owner Settings B',
        email: `owner_settings_b_${Date.now()}@shop.com`,
        mobile: shopB.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);
  });

  // Test 1: Get All Settings with Agricultural Defaults
  it('GET /api/v1/settings - should return shop settings with agricultural 0% tax default', async () => {
    const res = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.shop.shopName).toEqual('Settings Test Shop A');
    expect(res.body.data.configurations.defaultTaxRate).toEqual('0'); // Agriculture zero tax default
    expect(res.body.data.configurations.currency).toEqual('INR');
  });

  // Test 2: Update Shop Profile Settings
  it('PUT /api/v1/settings/shop - should update shop profile details', async () => {
    const res = await request(app)
      .put('/api/v1/settings/shop')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        shopName: 'Agro Care Super Center',
        address: 'Market Yard Road',
        villageCity: 'Nagpur',
        state: 'Maharashtra',
        pincode: '440001',
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.shopName).toEqual('Agro Care Super Center');
    expect(res.body.data.villageCity).toEqual('Nagpur');
  });

  // Test 3: Update Owner Profile Settings
  it('PUT /api/v1/settings/profile - should update owner profile details', async () => {
    const res = await request(app)
      .put('/api/v1/settings/profile')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        fullName: 'Ramesh Patel Owner',
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.fullName).toEqual('Ramesh Patel Owner');
  });

  // Test 4: Update Domain Configurations (Billing, Tax, Inventory, Credit, Regional, Invoice)
  it('PUT /api/v1/settings/billing & /tax & /inventory - should update configuration keys', async () => {
    const billRes = await request(app)
      .put('/api/v1/settings/billing')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({ maxDiscountPercent: 15, allowCreditSales: true });

    expect(billRes.statusCode).toEqual(200);
    expect(billRes.body.data.configurations.maxDiscountPercent).toEqual('15');

    const taxRes = await request(app)
      .put('/api/v1/settings/tax')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({ gstEnabled: false, defaultTaxRate: 0 });

    expect(taxRes.statusCode).toEqual(200);
    expect(taxRes.body.data.configurations.defaultTaxRate).toEqual('0');

    const invRes = await request(app)
      .put('/api/v1/settings/inventory')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({ allowNegativeStock: false, expiryWarningDays: 45 });

    expect(invRes.statusCode).toEqual(200);
    expect(invRes.body.data.configurations.expiryWarningDays).toEqual('45');
  });

  // Test 5: Audit Log History
  it('GET /api/v1/settings/audit-logs - should return recorded audit logs for settings changes', async () => {
    const res = await request(app)
      .get('/api/v1/settings/audit-logs')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].module).toEqual('SETTINGS');
  });

  // Test 6: RBAC Protection - Staff cannot update settings
  it('PUT /api/v1/settings/shop - should return 403 Forbidden for Staff attempting settings update', async () => {
    const res = await request(app)
      .put('/api/v1/settings/shop')
      .set('Authorization', `Bearer ${tokenStaffA}`)
      .send({ shopName: 'Hacked Shop Name' });

    expect(res.statusCode).toEqual(403);
  });

  // Test 7: Multi-Tenant Security Isolation
  it('GET /api/v1/settings - Shop B should not see Shop A settings', async () => {
    const resB = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${tokenOwnerB}`);

    expect(resB.statusCode).toEqual(200);
    expect(resB.body.data.shop.shopName).toEqual('Settings Test Shop B');
    expect(resB.body.data.shop.shopName).not.toEqual('Agro Care Super Center');
  });
});
