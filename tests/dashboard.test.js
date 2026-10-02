const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('Owner Dashboard Module Test Suite', () => {
  let shopA, shopB;
  let ownerA, ownerB;
  let tokenOwnerA, tokenOwnerB;
  let farmerA, supplierA;
  let categoryA, product1, batch1;
  let completedInvoice;

  beforeAll(async () => {
    // 1. Create Shop A with OWNER A
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Dashboard Test Shop A',
        code: `DTSA_${Date.now()}`,
        mobile: `+919800${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Owner Dashboard A',
        email: `owner_dash_a_${Date.now()}@shop.com`,
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
        name: 'Suresh Dashboard Test',
        phone: `+91981${String(Date.now()).slice(-7)}`,
        village: 'Amreli',
        khataBalance: 1500, // Due = 1500
      },
    });

    supplierA = await prisma.supplier.create({
      data: {
        shopId: shopA.id,
        name: 'Ganesh Supplier Dashboard',
        companyName: 'Gujarat Chemical Agro Dashboard',
        phone: `+91982${String(Date.now()).slice(-7)}`,
      },
    });

    categoryA = await prisma.category.create({
      data: {
        shopId: shopA.id,
        name: 'Insecticides Dashboard Test',
      },
    });

    product1 = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'Confidor Insecticide Dashboard',
        shortName: 'Confidor 100ML',
        code: `CONF_DASH_${Date.now()}`,
        categoryId: categoryA.id,
        minStock: 10,
        variants: {
          create: [{ variantName: '100 ML', sku: `CONF_100_${Date.now()}`, sellingPrice: 350, mrp: 400 }],
        },
      },
      include: { variants: true },
    });

    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);

    // Create 1 batch of 8 units (stock = 8, minStock = 10 -> LOW STOCK)
    batch1 = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: product1.id,
        variantId: product1.variants[0].id,
        supplierId: supplierA.id,
        batchNumber: `BATCH_DASH_1_${Date.now()}`,
        quantity: 8,
        purchasePrice: 200, // Cost = 200
        mrp: 400,
        sellingPrice: 350,  // Selling = 350
        expiryDate: futureDate,
      },
    });

    // Create 1 completed sales bill: 2 units * 350 = 700
    const billRes = await request(app)
      .post('/api/v1/billing')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        farmerId: farmerA.id,
        customerType: 'FARMER',
        paymentMethod: 'CASH',
        amountReceived: 700,
        items: [
          { productId: product1.id, batchId: batch1.id, quantity: 2, unitPrice: 350 },
        ],
      });
    completedInvoice = billRes.body.data.invoice;

    // 2. Create Shop B & Owner B for new shop zero data & cross-shop isolation testing
    shopB = await prisma.shop.create({
      data: {
        shopName: 'Dashboard Test Shop B (New Shop)',
        code: `DTSB_${Date.now()}`,
        mobile: `+919830${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Owner Dashboard B',
        email: `owner_dash_b_${Date.now()}@shop.com`,
        mobile: shopB.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);
  });

  // Test 1: Zero Data New Shop Dashboard Summary
  it('GET /api/v1/dashboard/summary - should return numeric 0 summary metrics for empty Shop B without crashing', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${tokenOwnerB}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sales.amount).toEqual(0);
    expect(res.body.data.purchases.amount).toEqual(0);
    expect(res.body.data.profit.amount).toEqual(0);
    expect(res.body.data.credit.outstanding).toEqual(0);
    expect(res.body.data.farmers.total).toEqual(0);
    expect(res.body.data.products.total).toEqual(0);
  });

  // Test 2: Dashboard Summary API for Shop A
  it('GET /api/v1/dashboard/summary - should return real-time overview metrics for Shop A', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary?filter=today')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sales.amount).toEqual(700);
    expect(res.body.data.sales.invoiceCount).toEqual(1);
    expect(res.body.data.purchases.amount).toEqual(1200); // 6 remaining units * 200 = 1200
    expect(res.body.data.profit.amount).toEqual(300);     // 700 - (2 * 200) = 300
    expect(res.body.data.credit.outstanding).toEqual(1500);
    expect(res.body.data.farmers.total).toEqual(1);
    expect(res.body.data.products.total).toEqual(1);
  });

  // Test 3: Sales Trend API
  it('GET /api/v1/dashboard/sales-trend - should return daily sales trend array for chart rendering', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/sales-trend?filter=today')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].salesAmount).toEqual(700);
  });

  // Test 4: Top Products API
  it('GET /api/v1/dashboard/top-products - should return top selling products', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/top-products?limit=5')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].shortName).toBe('Confidor 100ML');
    expect(res.body.data[0].quantitySold).toEqual(2);
  });

  // Test 5: Low Stock Alerts API
  it('GET /api/v1/dashboard/low-stock - should return low stock alert items', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/low-stock')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].shortName).toBe('Confidor 100ML');
    expect(res.body.data[0].currentStock).toEqual(6); // 8 - 2 = 6
    expect(res.body.data[0].minimumStock).toEqual(10);
    expect(res.body.data[0].status).toBe('LOW_STOCK');
  });

  // Test 6: Farmer Credit Widget API
  it('GET /api/v1/dashboard/credit - should return credit overview and top due farmers', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/credit')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalOutstanding).toEqual(1500);
    expect(res.body.data.topFarmers.length).toBeGreaterThan(0);
    expect(res.body.data.topFarmers[0].name).toBe('Suresh Dashboard Test');
  });

  // Test 7: Recent Sales, Payments, and Restocks APIs
  it('GET /api/v1/dashboard/recent-sales, /recent-payments, /recent-restocks - should return latest activities', async () => {
    const salesRes = await request(app)
      .get('/api/v1/dashboard/recent-sales?limit=5')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(salesRes.statusCode).toEqual(200);
    expect(salesRes.body.success).toBe(true);
    expect(salesRes.body.data.length).toBeGreaterThan(0);
    expect(salesRes.body.data[0].totalAmount).toEqual(700);

    const paymentsRes = await request(app)
      .get('/api/v1/dashboard/recent-payments?limit=5')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(paymentsRes.statusCode).toEqual(200);
    expect(paymentsRes.body.success).toBe(true);

    const restocksRes = await request(app)
      .get('/api/v1/dashboard/recent-restocks?limit=5')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(restocksRes.statusCode).toEqual(200);
    expect(restocksRes.body.success).toBe(true);
    expect(restocksRes.body.data.length).toBeGreaterThan(0);
  });
});
