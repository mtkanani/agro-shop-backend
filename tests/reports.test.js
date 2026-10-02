const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('Sales + Purchase Reports Module Test Suite', () => {
  let shopA, shopB;
  let ownerA, ownerB;
  let tokenOwnerA, tokenOwnerB;
  let farmerA, supplierA;
  let categoryA, product1, batch1;
  let completedInvoice, cancelledInvoice;

  beforeAll(async () => {
    // 1. Create Shop A with OWNER A
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Reports Test Shop A',
        code: `RTSA_${Date.now()}`,
        mobile: `+919700${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Owner Reports A',
        email: `owner_rep_a_${Date.now()}@shop.com`,
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
        name: 'Ramesh Reports Test',
        phone: `+91977${String(Date.now()).slice(-7)}`,
        village: 'Junagadh',
      },
    });

    supplierA = await prisma.supplier.create({
      data: {
        shopId: shopA.id,
        name: 'Suresh Supplier Reports',
        companyName: 'Gujarat Krushi Reports Agency',
        phone: `+91978${String(Date.now()).slice(-7)}`,
      },
    });

    categoryA = await prisma.category.create({
      data: {
        shopId: shopA.id,
        name: 'Fertilizers Reports Test',
      },
    });

    product1 = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'Urea Fertilizer 50 KG Reports',
        shortName: 'Urea 50KG',
        code: `UREA_REP_${Date.now()}`,
        categoryId: categoryA.id,
        minStock: 5,
        variants: {
          create: [{ variantName: '50 KG', sku: `UREAR_50_${Date.now()}`, sellingPrice: 1350, mrp: 1500 }],
        },
      },
      include: { variants: true },
    });

    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);

    batch1 = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: product1.id,
        variantId: product1.variants[0].id,
        supplierId: supplierA.id,
        batchNumber: `BATCH_REP_1_${Date.now()}`,
        quantity: 100,
        purchasePrice: 1000, // Purchase Cost = 1000
        mrp: 1500,
        sellingPrice: 1350,  // Selling Price = 1350 (Profit per unit = 350)
        expiryDate: futureDate,
      },
    });

    // Create 1 completed sales bill: 2 units * 1350 = 2700
    const billRes = await request(app)
      .post('/api/v1/billing')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        farmerId: farmerA.id,
        customerType: 'FARMER',
        paymentMethod: 'CASH',
        amountReceived: 3000,
        billDiscount: 100, // Net total = 2600
        items: [
          { productId: product1.id, batchId: batch1.id, quantity: 2, unitPrice: 1350 },
        ],
      });
    completedInvoice = billRes.body.data.invoice;

    // Create 1 bill and cancel it to test cancelled invoice exclusion
    const cancelBillRes = await request(app)
      .post('/api/v1/billing')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        customerType: 'WALK_IN_CUSTOMER',
        paymentMethod: 'CASH',
        items: [
          { productId: product1.id, batchId: batch1.id, quantity: 1, unitPrice: 1350 },
        ],
      });
    cancelledInvoice = cancelBillRes.body.data.invoice;

    await request(app)
      .post(`/api/v1/billing/${cancelledInvoice.id}/cancel`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({ reason: 'Test cancellation' });

    // 2. Create Shop B & Owner B for cross-shop IDOR testing
    shopB = await prisma.shop.create({
      data: {
        shopName: 'Reports Test Shop B',
        code: `RTSB_${Date.now()}`,
        mobile: `+919790${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Owner Reports B',
        email: `owner_rep_b_${Date.now()}@shop.com`,
        mobile: shopB.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);
  });

  // Test 1: GET /api/v1/reports/sales - Sales Report Summary & Excludes Cancelled Invoices
  it('GET /api/v1/reports/sales - should return sales report and exclude cancelled invoices', async () => {
    const res = await request(app)
      .get('/api/v1/reports/sales')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary.totalBills).toEqual(1);
    expect(res.body.data.summary.netSales).toEqual(2600); // 2700 - 100
    expect(res.body.data.summary.discount).toEqual(100);
    expect(res.body.data.summary.cancelledSales).toEqual(1);
  });

  // Test 2: GET /api/v1/reports/purchases - Restock Purchases Report
  it('GET /api/v1/reports/purchases - should return purchases report summary', async () => {
    const res = await request(app)
      .get('/api/v1/reports/purchases')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary.totalRestocks).toBeGreaterThan(0);
    expect(res.body.data.summary.totalPurchases).toEqual(98000); // 98 remaining units * 1000 = 98,000
  });

  // Test 3: GET /api/v1/reports/profit - Profit & Margin Report
  it('GET /api/v1/reports/profit - should calculate gross profit and margin percentage from batch cost', async () => {
    const res = await request(app)
      .get('/api/v1/reports/profit')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary.netSales).toEqual(2600);
    expect(res.body.data.summary.costOfGoodsSold).toEqual(2000); // 2 * 1000 = 2000
    expect(res.body.data.summary.grossProfit).toEqual(600);       // 2600 - 2000 = 600
    expect(res.body.data.summary.marginPercentage).toEqual(23.08); // (600 / 2600) * 100 = 23.08%
  });

  // Test 4: GET /api/v1/reports/products/sales - Top Selling Products Report
  it('GET /api/v1/reports/products/sales - should return product sales performance', async () => {
    const res = await request(app)
      .get('/api/v1/reports/products/sales?sortBy=revenue')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.products.length).toBeGreaterThan(0);
    expect(res.body.data.products[0].shortName).toBe('Urea 50KG');
    expect(res.body.data.products[0].quantitySold).toEqual(2);
  });

  // Test 5: GET /api/v1/reports/farmers/sales - Farmer Sales History Report
  it('GET /api/v1/reports/farmers/sales - should return farmer purchase ranking', async () => {
    const res = await request(app)
      .get('/api/v1/reports/farmers/sales')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.topFarmers.length).toBeGreaterThan(0);
    expect(res.body.data.topFarmers[0].name).toBe('Ramesh Reports Test');
    expect(res.body.data.topFarmers[0].totalPurchases).toEqual(2600);
  });

  // Test 6: GET /api/v1/reports/suppliers/purchases - Supplier Restocks Report
  it('GET /api/v1/reports/suppliers/purchases - should return supplier purchases ranking', async () => {
    const res = await request(app)
      .get('/api/v1/reports/suppliers/purchases')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.topSuppliers.length).toBeGreaterThan(0);
    expect(res.body.data.topSuppliers[0].name).toBe('Suresh Supplier Reports');
  });

  // Test 7: GET /api/v1/reports/payments - Payment Collection Report
  it('GET /api/v1/reports/payments - should return payment collection breakdown by method', async () => {
    const res = await request(app)
      .get('/api/v1/reports/payments')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary.byMethod.CASH).toBeGreaterThan(0);
  });

  // Test 8: GET /api/v1/reports/inventory - Stock Movement Report
  it('GET /api/v1/reports/inventory - should return product stock movement report', async () => {
    const res = await request(app)
      .get('/api/v1/reports/inventory')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.movements.length).toBeGreaterThan(0);
    expect(res.body.data.movements[0].shortName).toBe('Urea 50KG');
  });

  // Test 9: GET /api/v1/reports/daily & /monthly - Daily & Monthly Summaries
  it('GET /api/v1/reports/daily & /monthly - should return daily and monthly aggregated summaries', async () => {
    const dailyRes = await request(app)
      .get('/api/v1/reports/daily')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(dailyRes.statusCode).toEqual(200);
    expect(dailyRes.body.success).toBe(true);
    expect(dailyRes.body.data.billsCount).toEqual(1);
    expect(dailyRes.body.data.sales).toEqual(2600);

    const monthlyRes = await request(app)
      .get('/api/v1/reports/monthly')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(monthlyRes.statusCode).toEqual(200);
    expect(monthlyRes.body.success).toBe(true);
    expect(monthlyRes.body.data.sales).toEqual(2600);
  });

  // Test 10: GET /api/v1/reports/sales/trend - Trend Chart Data
  it('GET /api/v1/reports/sales/trend - should return daily trend data for chart rendering', async () => {
    const res = await request(app)
      .get('/api/v1/reports/sales/trend')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].salesAmount).toEqual(2600);
  });

  // Test 11: Multi-Shop Security Guard - Owner B sees 0 sales for Shop A
  it('GET /api/v1/reports/sales - should return 0 sales for Owner B (Multi-Tenant Isolation)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/sales')
      .set('Authorization', `Bearer ${tokenOwnerB}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary.totalBills).toEqual(0);
    expect(res.body.data.summary.netSales).toEqual(0);
  });
});
