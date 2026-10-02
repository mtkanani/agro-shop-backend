const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('Expense & Dealer Inward Management Test Suite', () => {
  let shopA, shopB;
  let ownerA, ownerB, staffA;
  let tokenOwnerA, tokenOwnerB, tokenStaffA;
  let supplierA;
  let expense1, expense2, expenseShopB;

  beforeAll(async () => {
    // 1. Create Shop A and Users
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Green Krishi Expenses Shop A',
        code: `EXP_A_${Date.now()}`,
        mobile: `+919700${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Ramesh Owner Exp A',
        email: `owner_exp_a_${Date.now()}@test.com`,
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
        fullName: 'Mahesh Staff Exp A',
        email: `staff_exp_a_${Date.now()}@test.com`,
        mobile: `+919710${String(Date.now()).slice(-6)}`,
        passwordHash: 'hash',
        role: 'BILLING_STAFF',
        status: 'ACTIVE',
      },
    });
    tokenStaffA = generateAccessToken(staffA);

    // 2. Create Shop B for Multi-Tenant Isolation
    shopB = await prisma.shop.create({
      data: {
        shopName: 'Kisan Exp Shop B',
        code: `EXP_B_${Date.now()}`,
        mobile: `+919800${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Dinesh Owner Exp B',
        email: `owner_exp_b_${Date.now()}@test.com`,
        mobile: shopB.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);

    // 3. Dealer / Supplier in Shop A
    supplierA = await prisma.supplier.create({
      data: {
        shopId: shopA.id,
        name: 'IFFCO Fertilizer Depot',
        phone: `+91983${String(Date.now()).slice(-7)}`,
        companyName: 'IFFCO Gujarat State Federation',
      },
    });
  });

  afterAll(async () => {
    await prisma.expense.deleteMany({
      where: { shopId: { in: [shopA.id, shopB.id] } },
    });
    await prisma.supplier.deleteMany({
      where: { id: supplierA.id },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerA.id, staffA.id, ownerB.id] } },
    });
    await prisma.shop.deleteMany({
      where: { id: { in: [shopA.id, shopB.id] } },
    });
  });

  describe('1. Log New Expense (POST /api/v1/expenses)', () => {
    it('should record dealer procurement purchase invoice linked to supplier', async () => {
      const res = await request(app)
        .get('/api/v1/expenses'); // warm up
      const createRes = await request(app)
        .post('/api/v1/expenses')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          title: 'Urea 100 Bags Procurement Inward',
          amount: 27000,
          category: 'DEALER_PROCUREMENT',
          supplierId: supplierA.id,
          paymentMethod: 'BANK_TRANSFER',
          paymentRef: 'NEFT-IFFCO-8899',
          billNumber: 'INV-IFFCO-2026-091',
          billDate: '2026-09-08',
          notes: 'Pre-monsoon first lot',
        });

      expect(createRes.statusCode).toEqual(201);
      expect(createRes.body.success).toBe(true);
      expense1 = createRes.body.data;
      expect(expense1.id).toBeDefined();
      expect(expense1.expenseNumber).toContain('EXP-');
      expect(expense1.amount).toEqual(27000);
      expect(expense1.supplier.name).toEqual('IFFCO Fertilizer Depot');
    });

    it('should record freight transport charges for dealer delivery', async () => {
      const createRes = await request(app)
        .post('/api/v1/expenses')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          title: 'Truck Freight from Junagadh Depot',
          amount: 2500,
          category: 'FREIGHT_TRANSPORT',
          supplierId: supplierA.id,
          paymentMethod: 'CASH',
          billNumber: 'BILTI-TRUCK-442',
        });

      expect(createRes.statusCode).toEqual(201);
      expense2 = createRes.body.data;
      expect(expense2.amount).toEqual(2500);
      expect(expense2.category).toEqual('FREIGHT_TRANSPORT');
    });

    it('should record general store operating expense (Shop Rent)', async () => {
      const createRes = await request(app)
        .post('/api/v1/expenses')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          title: 'Monthly Retail Store Rent',
          amount: 15000,
          category: 'SHOP_RENT',
          paymentMethod: 'CHEQUE',
          paymentRef: 'CHQ-778811',
        });

      expect(createRes.statusCode).toEqual(201);
      expect(createRes.body.data.amount).toEqual(15000);
      expect(createRes.body.data.category).toEqual('SHOP_RENT');
    });

    it('should reject expense creation when amount is 0 or negative', async () => {
      const res = await request(app)
        .post('/api/v1/expenses')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          title: 'Invalid Amount Expense',
          amount: -50,
          category: 'OTHER',
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject expense creation with non-existent supplierId (404)', async () => {
      const res = await request(app)
        .post('/api/v1/expenses')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          title: 'Invalid Dealer Expense',
          amount: 1000,
          category: 'DEALER_PROCUREMENT',
          supplierId: '00000000-0000-0000-0000-000000000000',
        });

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('2. Get All Expenses & Filtering (GET /api/v1/expenses)', () => {
    it('should return paginated expenses for Shop A', async () => {
      const res = await request(app)
        .get('/api/v1/expenses?page=1&limit=10')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      expect(res.body.pagination.totalRecords).toBeGreaterThanOrEqual(3);
    });

    it('should filter expenses by category=DEALER_PROCUREMENT', async () => {
      const res = await request(app)
        .get('/api/v1/expenses?category=DEALER_PROCUREMENT')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toEqual(1);
      expect(res.body.data[0].id).toEqual(expense1.id);
    });

    it('should filter expenses by supplierId', async () => {
      const res = await request(app)
        .get(`/api/v1/expenses?supplierId=${supplierA.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toEqual(2); // expense1 and expense2
    });
  });

  describe('3. Expense Analytics (GET /api/v1/expenses/analytics)', () => {
    it('should calculate comprehensive expense totals, dealer inward analysis, and percentages', async () => {
      const res = await request(app)
        .get('/api/v1/expenses/analytics')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      const { summary, byCategory, topSuppliers } = res.body.data;

      expect(summary.totalExpenseAmount).toBeGreaterThanOrEqual(44500); // 27000 + 2500 + 15000
      expect(summary.dealerInwardTotal).toBeGreaterThanOrEqual(29500); // 27000 + 2500
      expect(summary.generalStoreExpensesTotal).toBeGreaterThanOrEqual(15000);

      // Category breakdown
      expect(Array.isArray(byCategory)).toBe(true);
      const procurementCat = byCategory.find((c) => c.category === 'DEALER_PROCUREMENT');
      expect(procurementCat).toBeDefined();
      expect(procurementCat.amount).toEqual(27000);

      // Top suppliers
      expect(Array.isArray(topSuppliers)).toBe(true);
      expect(topSuppliers.length).toBeGreaterThanOrEqual(1);
      expect(topSuppliers[0].supplierName).toEqual('IFFCO Fertilizer Depot');
      expect(topSuppliers[0].totalAmount).toEqual(29500);
    });
  });

  describe('4. Single Expense, Updates & Deletion', () => {
    beforeAll(async () => {
      // Create expense in Shop B for isolation test
      const expB = await prisma.expense.create({
        data: {
          shopId: shopB.id,
          expenseNumber: `EXP-SHB-${Date.now()}`,
          category: 'SHOP_RENT',
          title: 'Shop B Rent',
          amount: 20000,
        },
      });
      expenseShopB = expB;
    });

    it('should retrieve single expense details', async () => {
      const res = await request(app)
        .get(`/api/v1/expenses/${expense1.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.id).toEqual(expense1.id);
      expect(res.body.data.title).toEqual(expense1.title);
    });

    it('should enforce multi-tenant IDOR protection (Shop A cannot view Shop B expense)', async () => {
      const res = await request(app)
        .get(`/api/v1/expenses/${expenseShopB.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(404);
    });

    it('should update expense details', async () => {
      const res = await request(app)
        .put(`/api/v1/expenses/${expense2.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          title: 'Truck Freight (Negotiated Discount)',
          amount: 2200,
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.title).toEqual('Truck Freight (Negotiated Discount)');
      expect(res.body.data.amount).toEqual(2200);
    });

    it('should export expenses to CSV format', async () => {
      const res = await request(app)
        .get('/api/v1/expenses/export')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Expense No,Date,Category,Title,Amount');
    });

    it('should delete expense successfully', async () => {
      const res = await request(app)
        .delete(`/api/v1/expenses/${expense2.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);

      // Verify deletion
      const checkRes = await request(app)
        .get(`/api/v1/expenses/${expense2.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);
      expect(checkRes.statusCode).toEqual(404);
    });
  });
});
