const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('Revenue & Profit Analytics Test Suite', () => {
  let shopA, shopB;
  let ownerA, ownerB, staffA;
  let tokenOwnerA, tokenOwnerB, tokenStaffA;
  let categoryFertilizer, categoryPesticide;
  let productUrea, productConfidor;
  let variantUrea, variantConfidor;
  let batchUrea, batchConfidor;
  let farmerA;
  let invoice1, invoice2;
  let expenseRent, expenseFreight, expenseProcurement;
  let salesReturn1;

  beforeAll(async () => {
    // 1. Create Shop A and Shop B
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Green Krishi Revenue Test Shop A',
        code: `REV_A_${Date.now()}`,
        mobile: `+919700${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Rajesh Owner Rev A',
        email: `owner_rev_a_${Date.now()}@test.com`,
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
        fullName: 'Kishan Staff Rev A',
        email: `staff_rev_a_${Date.now()}@test.com`,
        mobile: `+919720${String(Date.now()).slice(-6)}`,
        passwordHash: 'hash',
        role: 'BILLING_STAFF',
        status: 'ACTIVE',
      },
    });
    tokenStaffA = generateAccessToken(staffA);

    shopB = await prisma.shop.create({
      data: {
        shopName: 'Kisan Rev Shop B',
        code: `REV_B_${Date.now()}`,
        mobile: `+919800${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Kanti Owner Rev B',
        email: `owner_rev_b_${Date.now()}@test.com`,
        mobile: shopB.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);

    // 2. Categories
    categoryFertilizer = await prisma.category.create({
      data: { shopId: shopA.id, name: 'Fertilizers Shop A' },
    });
    categoryPesticide = await prisma.category.create({
      data: { shopId: shopA.id, name: 'Pesticides Shop A' },
    });

    // 3. Products with Variants (Dealer Purchase Price & Retail Selling Price)
    // Product 1: Urea 50KG - Buy: 240, Sell: 270 (Margin: 30)
    productUrea = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'IFFCO Neem Coated Urea 50 KG',
        shortName: 'Urea 50KG',
        code: `UREA_REV_${Date.now()}`,
        categoryId: categoryFertilizer.id,
        variants: {
          create: [{
            variantName: '50 KG Bag',
            sku: `UREA50_SKU_${Date.now()}`,
            purchasePrice: 240,
            mrp: 300,
            sellingPrice: 270,
          }],
        },
      },
      include: { variants: true },
    });
    variantUrea = productUrea.variants[0];

    // Product 2: Confidor 100ML - Buy: 320, Sell: 450 (Margin: 130)
    productConfidor = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'Bayer Confidor 100 ML',
        shortName: 'Confidor 100ML',
        code: `CONF_REV_${Date.now()}`,
        categoryId: categoryPesticide.id,
        variants: {
          create: [{
            variantName: '100 ML',
            sku: `CONF100_SKU_${Date.now()}`,
            purchasePrice: 320,
            mrp: 500,
            sellingPrice: 450,
          }],
        },
      },
      include: { variants: true },
    });
    variantConfidor = productConfidor.variants[0];

    // 4. Inventory Batches
    batchUrea = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: productUrea.id,
        variantId: variantUrea.id,
        batchNumber: `BATCH-U-${Date.now()}`,
        quantity: 100,
        purchasePrice: 240,
        mrp: 300,
        sellingPrice: 270,
      },
    });

    batchConfidor = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: productConfidor.id,
        variantId: variantConfidor.id,
        batchNumber: `BATCH-C-${Date.now()}`,
        quantity: 50,
        purchasePrice: 320,
        mrp: 500,
        sellingPrice: 450,
      },
    });

    // 5. Farmer
    farmerA = await prisma.farmer.create({
      data: {
        shopId: shopA.id,
        name: 'Kiritbhai Patel',
        phone: `+91982${String(Date.now()).slice(-7)}`,
      },
    });

    // 6. Invoices & Sales
    // Invoice 1: 10 bags Urea @ 270 = 2700. COGS = 10 * 240 = 2400. Gross Profit = 300
    invoice1 = await prisma.invoice.create({
      data: {
        shopId: shopA.id,
        farmerId: farmerA.id,
        userId: ownerA.id,
        invoiceNumber: `INV-REV-001-${Date.now()}`,
        subTotal: 2700,
        taxAmount: 0,
        discount: 0,
        totalAmount: 2700,
        paidAmount: 2700,
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        items: {
          create: [{
            productId: productUrea.id,
            batchId: batchUrea.id,
            quantity: 10,
            unitPrice: 270,
            totalPrice: 2700,
          }],
        },
      },
    });

    // Invoice 2: 4 bottles Confidor @ 450 = 1800. COGS = 4 * 320 = 1280. Gross Profit = 520
    invoice2 = await prisma.invoice.create({
      data: {
        shopId: shopA.id,
        farmerId: farmerA.id,
        userId: ownerA.id,
        invoiceNumber: `INV-REV-002-${Date.now()}`,
        subTotal: 1800,
        taxAmount: 0,
        discount: 0,
        totalAmount: 1800,
        paidAmount: 1800,
        paymentStatus: 'PAID',
        paymentMethod: 'UPI',
        items: {
          create: [{
            productId: productConfidor.id,
            batchId: batchConfidor.id,
            quantity: 4,
            unitPrice: 450,
            totalPrice: 1800,
          }],
        },
      },
    });

    // Gross Revenue = 2700 + 1800 = 4500
    // Total COGS = 2400 + 1280 = 3680
    // Gross Profit = 4500 - 3680 = 820

    // 7. Store Operating & Inward Logistics Expenses
    expenseRent = await prisma.expense.create({
      data: {
        shopId: shopA.id,
        userId: ownerA.id,
        expenseNumber: `EXP-RENT-${Date.now()}`,
        category: 'SHOP_RENT',
        title: 'Monthly Godown Rent',
        amount: 200,
        paymentMethod: 'BANK_TRANSFER',
      },
    });

    expenseFreight = await prisma.expense.create({
      data: {
        shopId: shopA.id,
        userId: ownerA.id,
        expenseNumber: `EXP-FRT-${Date.now()}`,
        category: 'FREIGHT_TRANSPORT',
        title: 'Tempo Delivery Freight',
        amount: 50,
        paymentMethod: 'CASH',
      },
    });

    // Total Operating Expenses = 200 + 50 = 250
    // Net Store Profit = 820 - 250 = 570

    // 8. Sales Return (Return 1 bag Urea @ 270)
    salesReturn1 = await prisma.salesReturn.create({
      data: {
        shopId: shopA.id,
        invoiceId: invoice1.id,
        farmerId: farmerA.id,
        userId: ownerA.id,
        returnNumber: `RET-REV-${Date.now()}`,
        returnAmount: 270,
        refundMethod: 'CASH',
        reason: 'CUSTOMER_CHANGED_MIND',
        status: 'COMPLETED',
      },
    });
  });

  afterAll(async () => {
    await prisma.salesReturn.deleteMany({ where: { shopId: { in: [shopA.id, shopB.id] } } });
    await prisma.expense.deleteMany({ where: { shopId: { in: [shopA.id, shopB.id] } } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { shopId: { in: [shopA.id, shopB.id] } } } });
    await prisma.invoice.deleteMany({ where: { shopId: { in: [shopA.id, shopB.id] } } });
    await prisma.inventoryBatch.deleteMany({ where: { shopId: { in: [shopA.id, shopB.id] } } });
    await prisma.productVariant.deleteMany({ where: { product: { shopId: { in: [shopA.id, shopB.id] } } } });
    await prisma.product.deleteMany({ where: { shopId: { in: [shopA.id, shopB.id] } } });
    await prisma.category.deleteMany({ where: { shopId: { in: [shopA.id, shopB.id] } } });
    await prisma.farmer.deleteMany({ where: { shopId: { in: [shopA.id, shopB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerA.id, staffA.id, ownerB.id] } } });
    await prisma.shop.deleteMany({ where: { id: { in: [shopA.id, shopB.id] } } });
  });

  describe('1. Product Pricing & Margin Display on Product Details', () => {
    it('GET /api/v1/products/:id - should return dealer purchase price, retail selling price, and calculated profit margins', async () => {
      const res = await request(app)
        .get(`/api/v1/products/${productConfidor.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.purchasePrice).toEqual(320);
      expect(data.sellingPrice).toEqual(450);
      expect(data.mrp).toEqual(500);
      expect(data.marginAmount).toEqual(130); // 450 - 320
      expect(data.marginPercentage).toBeCloseTo(40.6, 1); // (130 / 320) * 100
    });

    it('PUT /api/v1/products/:id - should update original purchase price and selling price and recalculate margin', async () => {
      const res = await request(app)
        .put(`/api/v1/products/${productConfidor.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          purchasePrice: 300,
          sellingPrice: 480,
          mrp: 520,
        });

      expect(res.statusCode).toEqual(200);

      // Verify updated values via GET
      const verifyRes = await request(app)
        .get(`/api/v1/products/${productConfidor.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(verifyRes.statusCode).toEqual(200);
      expect(verifyRes.body.data.purchasePrice).toEqual(300);
      expect(verifyRes.body.data.sellingPrice).toEqual(480);
      expect(verifyRes.body.data.marginAmount).toEqual(180); // 480 - 300
    });
  });

  describe('2. Revenue & Profit Summary (GET /api/v1/revenue/summary)', () => {
    it('should calculate accurate Gross Revenue, COGS, Gross Profit, Deductions, and Net Store Profit', async () => {
      const res = await request(app)
        .get('/api/v1/revenue/summary')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);

      const { revenue, costs, profitability } = res.body.data;

      // Gross Revenue = 2700 + 1800 = 4500
      expect(revenue.grossRevenue).toEqual(4500);
      expect(revenue.totalInvoicesCount).toEqual(2);
      expect(revenue.totalUnitsSold).toEqual(14); // 10 Urea + 4 Confidor

      // Net Revenue after Sales Return (4500 - 270)
      expect(revenue.netRevenue).toEqual(4230);

      // COGS (10 * 240 + 4 * 320) = 2400 + 1280 = 3680
      expect(costs.costOfGoodsSold).toEqual(3680);

      // Operating Expenses (200 Rent + 50 Freight) = 250
      expect(costs.totalOperatingExpenses).toEqual(250);
      expect(costs.dealerInwardExpenses).toEqual(50);
      expect(costs.generalStoreExpenses).toEqual(200);
      expect(costs.totalReturnedDeductions).toEqual(270);

      // Profitability:
      // Gross Profit = 4500 - 3680 = 820
      expect(profitability.grossProfit).toEqual(820);
      expect(profitability.grossMarginPercentage).toBeCloseTo(18.2, 1);

      // Net Store Profit = 820 - 250 = 570
      expect(profitability.netStoreProfit).toEqual(570);
      expect(profitability.status).toEqual('PROFITABLE');
    });

    it('should support preset timeframe query filters (e.g. timeframe=TODAY)', async () => {
      const res = await request(app)
        .get('/api/v1/revenue/summary?timeframe=TODAY')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.revenue.grossRevenue).toEqual(4500);
    });
  });

  describe('3. Category Profitability Breakdown (GET /api/v1/revenue/by-category)', () => {
    it('should calculate revenue, COGS, and margin breakdown by agricultural product category', async () => {
      const res = await request(app)
        .get('/api/v1/revenue/by-category')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const fertilizerCat = res.body.data.find((c) => c.categoryName.includes('Fertilizers'));
      const pesticideCat = res.body.data.find((c) => c.categoryName.includes('Pesticides'));

      expect(fertilizerCat).toBeDefined();
      expect(fertilizerCat.grossRevenue).toEqual(2700);
      expect(fertilizerCat.costOfGoodsSold).toEqual(2400);
      expect(fertilizerCat.grossProfit).toEqual(300);

      expect(pesticideCat).toBeDefined();
      expect(pesticideCat.grossRevenue).toEqual(1800);
      expect(pesticideCat.costOfGoodsSold).toEqual(1280);
      expect(pesticideCat.grossProfit).toEqual(520);
    });
  });

  describe('4. Top Profit-Making Products (GET /api/v1/revenue/top-products)', () => {
    it('should rank products by Gross Profit in descending order', async () => {
      const res = await request(app)
        .get('/api/v1/revenue/top-products')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      // Confidor profit is 520, Urea profit is 300 -> Confidor ranked #1
      expect(res.body.data[0].productId).toEqual(productConfidor.id);
      expect(res.body.data[0].grossProfit).toEqual(520);
      expect(res.body.data[1].productId).toEqual(productUrea.id);
      expect(res.body.data[1].grossProfit).toEqual(300);
    });
  });

  describe('5. Visual Timeline Trend (GET /api/v1/revenue/trend)', () => {
    it('should return chronological daily buckets with revenue, COGS, expenses, and net profit', async () => {
      const res = await request(app)
        .get('/api/v1/revenue/trend')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const todayPoint = res.body.data[0];
      expect(todayPoint.revenue).toEqual(4500);
      expect(todayPoint.cogs).toEqual(3680);
      expect(todayPoint.grossProfit).toEqual(820);
      expect(todayPoint.expenses).toEqual(250);
      expect(todayPoint.netProfit).toEqual(570);
    });
  });

  describe('6. Security & Multi-Tenant Isolation', () => {
    it('should reject access to BILLING_STAFF without REVENUE_VIEW permission (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/revenue/summary')
        .set('Authorization', `Bearer ${tokenStaffA}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
    });

    it('should enforce multi-tenant isolation (Shop B owner sees 0 revenue for Shop B)', async () => {
      const res = await request(app)
        .get('/api/v1/revenue/summary')
        .set('Authorization', `Bearer ${tokenOwnerB}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.revenue.grossRevenue).toEqual(0);
      expect(res.body.data.profitability.netStoreProfit).toEqual(0);
    });
  });
});
