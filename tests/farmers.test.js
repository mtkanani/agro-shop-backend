const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('Farmer / Customer Management Module Test Suite', () => {
  let shopA, shopB;
  let ownerA, ownerB;
  let tokenA, tokenB;
  let farmerA;

  beforeAll(async () => {
    // 1. Create Shop A & OWNER A
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Farmer Test Shop A',
        code: `FSA_${Date.now()}`,
        mobile: `+919100${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Owner Farmer A',
        email: `owner_farmer_a_${Date.now()}@shop.com`,
        mobile: shopA.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenA = generateAccessToken(ownerA);

    // 2. Create Shop B & OWNER B (for cross-shop IDOR testing)
    shopB = await prisma.shop.create({
      data: {
        shopName: 'Farmer Test Shop B',
        code: `FSB_${Date.now()}`,
        mobile: `+919200${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Owner Farmer B',
        email: `owner_farmer_b_${Date.now()}@shop.com`,
        mobile: shopB.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenB = generateAccessToken(ownerB);
  });

  // Test 1: POST /api/v1/farmers - Create Farmer with optional credit limit
  it('POST /api/v1/farmers - should create farmer profile with optional credit limit', async () => {
    const res = await request(app)
      .post('/api/v1/farmers')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Ramesh Patel',
        phone: `+91987${String(Date.now()).slice(-7)}`,
        village: 'Nagpur',
        address: 'Main Market Road',
        creditLimit: 50000,
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Ramesh Patel');
    expect(res.body.data.shopId).toBe(shopA.id);
    expect(res.body.data.creditLimit).toEqual(50000);

    farmerA = res.body.data;
  });

  // Test 2: GET /api/v1/farmers - List Farmers scoped to shop
  it('GET /api/v1/farmers - should return farmers list belonging to current shop', async () => {
    const res = await request(app)
      .get('/api/v1/farmers')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].shopId).toBe(shopA.id);
  });

  // Test 3: GET /api/v1/farmers/:id - Get Farmer details & financial summary
  it('GET /api/v1/farmers/:id - should return farmer details, financial summary, and recent records', async () => {
    const res = await request(app)
      .get(`/api/v1/farmers/${farmerA.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.farmer.id).toBe(farmerA.id);
    expect(res.body.data.financialSummary).toBeDefined();
    expect(res.body.data.financialSummary.creditLimit).toEqual(50000);
  });

  // Test 4: PUT /api/v1/farmers/:id - Update Farmer profile
  it('PUT /api/v1/farmers/:id - should update farmer profile fields', async () => {
    const res = await request(app)
      .put(`/api/v1/farmers/${farmerA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        village: 'Updated Nagpur East',
        creditLimit: 75000,
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.village).toBe('Updated Nagpur East');
    expect(res.body.data.creditLimit).toEqual(75000);
  });

  // Test 5: POST /api/v1/farmers/:id/payments - Record Dues Payment
  it('POST /api/v1/farmers/:id/payments - should record payment, credit Khata ledger, and update balance', async () => {
    // First set a khata balance of 5000 on farmer
    await prisma.farmer.update({
      where: { id: farmerA.id },
      data: { khataBalance: 5000 },
    });

    const res = await request(app)
      .post(`/api/v1/farmers/${farmerA.id}/payments`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        amount: 2000,
        method: 'CASH',
        notes: 'Partial khata repayment',
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toEqual(2000);

    // Verify balance was reduced to 3000
    const updatedFarmer = await prisma.farmer.findUnique({ where: { id: farmerA.id } });
    expect(updatedFarmer.khataBalance).toEqual(3000);
  });

  // Test 6: GET /api/v1/farmers/:id/khata - Get Khata transactions statement
  it('GET /api/v1/farmers/:id/khata - should return farmer Khata ledger transactions', async () => {
    const res = await request(app)
      .get(`/api/v1/farmers/${farmerA.id}/khata`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].type).toBe('CREDIT');
  });

  // Test 7: GET /api/v1/farmers/:id/outstanding - Get Outstanding status
  it('GET /api/v1/farmers/:id/outstanding - should return current outstanding and available credit status', async () => {
    const res = await request(app)
      .get(`/api/v1/farmers/${farmerA.id}/outstanding`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.outstanding).toEqual(3000);
    expect(res.body.data.creditLimit).toEqual(75000);
    expect(res.body.data.availableCredit).toEqual(72000);
    expect(res.body.data.creditStatus).toBe('WITHIN_LIMIT');
  });

  // Test 8: IDOR Security Guard - Owner B accessing Farmer A should be blocked
  it('GET /api/v1/farmers/:id - should reject access when user from another shop tries to view farmer (IDOR Protection)', async () => {
    const res = await request(app)
      .get(`/api/v1/farmers/${farmerA.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.statusCode).toEqual(404); // Scoped out of Shop B
  });

  // Test 9: DELETE /api/v1/farmers/:id - Soft Delete Farmer
  it('DELETE /api/v1/farmers/:id - should soft-deactivate farmer profile (isActive = false)', async () => {
    const res = await request(app)
      .delete(`/api/v1/farmers/${farmerA.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);

    const deactivatedFarmer = await prisma.farmer.findUnique({ where: { id: farmerA.id } });
    expect(deactivatedFarmer.isActive).toBe(false);
  });
});
