const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('Sales Return + Purchase Return Management Test Suite', () => {
  let shopA, shopB;
  let ownerA, ownerB;
  let tokenOwnerA, tokenOwnerB;
  let farmerA, supplierA;
  let categoryA, product1, batch1;
  let invoice1;

  beforeAll(async () => {
    // 1. Create Shop A with OWNER A
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Returns Test Shop A',
        code: `RTSA_${Date.now()}`,
        mobile: `+919900${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Owner Returns A',
        email: `owner_ret_a_${Date.now()}@shop.com`,
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
        name: 'Dinesh Returns Test',
        phone: `+91991${String(Date.now()).slice(-7)}`,
        village: 'Bhavnagar',
        khataBalance: 0,
      },
    });

    supplierA = await prisma.supplier.create({
      data: {
        shopId: shopA.id,
        name: 'Super Supplier Returns',
        companyName: 'Agro Ret Corp',
        phone: `+91992${String(Date.now()).slice(-7)}`,
        khataBalance: 5000,
      },
    });

    categoryA = await prisma.category.create({
      data: {
        shopId: shopA.id,
        name: 'Seeds Returns Test',
      },
    });

    product1 = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'Hybrid Cotton Seeds Returns',
        shortName: 'Cotton Seeds',
        code: `COT_RET_${Date.now()}`,
        categoryId: categoryA.id,
        minStock: 5,
        variants: {
          create: [{ variantName: '1 KG', sku: `COT_1_${Date.now()}`, sellingPrice: 900, mrp: 1000 }],
        },
      },
      include: { variants: true },
    });

    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);

    // Initial Batch: 50 units @ 600 cost, 900 selling
    batch1 = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: product1.id,
        variantId: product1.variants[0].id,
        supplierId: supplierA.id,
        batchNumber: `BATCH_RET_1_${Date.now()}`,
        quantity: 50,
        purchasePrice: 600,
        mrp: 1000,
        sellingPrice: 900,
        expiryDate: futureDate,
      },
    });

    // Create Credit Bill for Farmer A: 10 units * 900 = 9000 (Unpaid -> Khata balance = 9000)
    const billRes = await request(app)
      .post('/api/v1/billing')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        farmerId: farmerA.id,
        customerType: 'FARMER',
        paymentMethod: 'KHATA',
        amountReceived: 0,
        items: [
          { productId: product1.id, batchId: batch1.id, quantity: 10, unitPrice: 900 },
        ],
      });
    invoice1 = billRes.body.data.invoice;

    // 2. Create Shop B & Owner B for cross-shop security testing
    shopB = await prisma.shop.create({
      data: {
        shopName: 'Returns Test Shop B',
        code: `RTSB_${Date.now()}`,
        mobile: `+919930${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Owner Returns B',
        email: `owner_ret_b_${Date.now()}@shop.com`,
        mobile: shopB.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);
  });

  // Test 1: Partial Sales Return Execution
  it('POST /api/v1/returns/sales - should create partial sales return, restore stock IN, and adjust farmer due', async () => {
    const res = await request(app)
      .post('/api/v1/returns/sales')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        invoiceId: invoice1.id,
        items: [
          { invoiceItemId: invoice1.items[0].id, quantity: 3, condition: 'GOOD' },
        ],
        reason: 'DAMAGED',
        refundMethod: 'ADJUST_DUE',
        notes: '3 units returned by farmer',
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.returnNumber).toMatch(/^SR-/);
    expect(res.body.data.returnAmount).toEqual(2700); // 3 * 900 = 2700

    // Check Farmer Khata Balance (Original 9000 - 2700 = 6300)
    const farmer = await prisma.farmer.findUnique({ where: { id: farmerA.id } });
    expect(farmer.khataBalance).toEqual(6300);

    // Check Stock Quantity Restored (Original 40 + 3 = 43)
    const batch = await prisma.inventoryBatch.findUnique({ where: { id: batch1.id } });
    expect(batch.quantity).toEqual(43);

    // Check Invoice Payment Status (PARTIALLY_RETURNED)
    const updatedInvoice = await prisma.invoice.findUnique({ where: { id: invoice1.id } });
    expect(updatedInvoice.paymentStatus).toBe('PARTIALLY_RETURNED');
  });

  // Test 2: Over-Return Quantity Rejection
  it('POST /api/v1/returns/sales - should reject return if quantity exceeds remaining returnable items', async () => {
    // Already returned 3 out of 10 -> Available: 7
    const res = await request(app)
      .post('/api/v1/returns/sales')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        invoiceId: invoice1.id,
        items: [
          { invoiceItemId: invoice1.items[0].id, quantity: 8, condition: 'GOOD' },
        ],
        reason: 'WRONG_QUANTITY',
        refundMethod: 'ADJUST_DUE',
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Cannot return more than remaining/);
  });

  // Test 3: Purchase Return Execution
  it('POST /api/v1/returns/purchases - should create purchase return, deduct stock OUT, and adjust supplier khata balance', async () => {
    const res = await request(app)
      .post('/api/v1/returns/purchases')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        supplierId: supplierA.id,
        items: [
          { batchId: batch1.id, quantity: 5, condition: 'DAMAGED' },
        ],
        reason: 'DAMAGED',
        settlementMethod: 'SUPPLIER_CREDIT',
        notes: 'Damaged items returned to supplier',
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.returnNumber).toMatch(/^PR-/);
    expect(res.body.data.returnAmount).toEqual(3000); // 5 * 600 = 3000

    // Check Batch Stock Deducted (43 - 5 = 38)
    const batch = await prisma.inventoryBatch.findUnique({ where: { id: batch1.id } });
    expect(batch.quantity).toEqual(38);

    // Check Supplier Khata Balance (Original 5000 - 3000 = 2000)
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierA.id } });
    expect(supplier.khataBalance).toEqual(2000);
  });

  // Test 4: Get Returns Directory & Summary
  it('GET /api/v1/returns/summary, /sales, /purchases - should return returns history lists and metrics', async () => {
    const summaryRes = await request(app)
      .get('/api/v1/returns/summary')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(summaryRes.statusCode).toEqual(200);
    expect(summaryRes.body.data.salesReturns.count).toEqual(1);
    expect(summaryRes.body.data.salesReturns.amount).toEqual(2700);
    expect(summaryRes.body.data.purchaseReturns.count).toEqual(1);
    expect(summaryRes.body.data.purchaseReturns.amount).toEqual(3000);

    const salesListRes = await request(app)
      .get('/api/v1/returns/sales')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(salesListRes.statusCode).toEqual(200);
    expect(salesListRes.body.data.returns.length).toEqual(1);

    const purchaseListRes = await request(app)
      .get('/api/v1/returns/purchases')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(purchaseListRes.statusCode).toEqual(200);
    expect(purchaseListRes.body.data.returns.length).toEqual(1);
  });

  // Test 5: Reverse Sales Return
  it('POST /api/v1/returns/sales/:id/reverse - should reverse sales return and restore original stock & credit', async () => {
    const salesListRes = await request(app)
      .get('/api/v1/returns/sales')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    const salesReturnId = salesListRes.body.data.returns[0].id;

    const reverseRes = await request(app)
      .post(`/api/v1/returns/sales/${salesReturnId}/reverse`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({ reason: 'Customer changed mind back' });

    expect(reverseRes.statusCode).toEqual(200);
    expect(reverseRes.body.data.status).toBe('REVERSED');

    // Farmer Khata Balance restored (6300 + 2700 = 9000)
    const farmer = await prisma.farmer.findUnique({ where: { id: farmerA.id } });
    expect(farmer.khataBalance).toEqual(9000);

    // Stock Quantity decremented back (38 - 3 = 35)
    const batch = await prisma.inventoryBatch.findUnique({ where: { id: batch1.id } });
    expect(batch.quantity).toEqual(35);
  });

  // Test 6: Multi-Tenant Security Guard - Shop B cannot return Shop A invoice
  it('POST /api/v1/returns/sales - should return 404 for Shop B trying to process Shop A invoice', async () => {
    const res = await request(app)
      .post('/api/v1/returns/sales')
      .set('Authorization', `Bearer ${tokenOwnerB}`)
      .send({
        invoiceId: invoice1.id,
        items: [
          { invoiceItemId: invoice1.items[0].id, quantity: 1, condition: 'GOOD' },
        ],
        reason: 'DAMAGED',
      });

    expect(res.statusCode).toEqual(404);
    expect(res.body.success).toBe(false);
  });
});
