const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('POS Billing & Invoice Module Test Suite', () => {
  let shopA, shopB;
  let ownerA, ownerB, staffA;
  let tokenOwnerA, tokenOwnerB, tokenStaffA;
  let farmerA;
  let categoryA;
  let product1, product2;
  let batch1, batch2;
  let invoiceA, walkInInvoice;

  beforeAll(async () => {
    // 1. Create Shop A with OWNER, BILLING_STAFF, Farmer A, Category A, and Products with Batches
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Billing Test Shop A',
        code: `BSA_${Date.now()}`,
        mobile: `+919500${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Owner Billing A',
        email: `owner_bill_a_${Date.now()}@shop.com`,
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
        fullName: 'Staff Billing A',
        email: `staff_bill_a_${Date.now()}@shop.com`,
        mobile: `+919550${String(Date.now()).slice(-6)}`,
        passwordHash: 'hash',
        role: 'BILLING_STAFF',
        status: 'ACTIVE',
      },
    });
    tokenStaffA = generateAccessToken(staffA);

    farmerA = await prisma.farmer.create({
      data: {
        shopId: shopA.id,
        name: 'Ramesh Patel',
        phone: `+91957${String(Date.now()).slice(-7)}`,
        address: 'APMC Road, Junagadh',
      },
    });

    categoryA = await prisma.category.create({
      data: {
        shopId: shopA.id,
        name: 'Fertilizers Billing A',
      },
    });

    product1 = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'Urea Fertilizer 50 KG',
        shortName: 'Urea 50KG',
        code: `UREA_BILL_${Date.now()}`,
        categoryId: categoryA.id,
        minStock: 10,
        variants: {
          create: [{ variantName: '50 KG', sku: `UREAB_50_${Date.now()}`, sellingPrice: 1350, mrp: 1500 }],
        },
      },
      include: { variants: true },
    });

    product2 = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'DAP Fertilizer 50 KG',
        shortName: 'DAP 50KG',
        code: `DAP_BILL_${Date.now()}`,
        categoryId: categoryA.id,
        minStock: 5,
        variants: {
          create: [{ variantName: '50 KG', sku: `DAPB_50_${Date.now()}`, sellingPrice: 1600, mrp: 1800 }],
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
        batchNumber: `BATCH_BILL_1_${Date.now()}`,
        quantity: 50,
        purchasePrice: 1200,
        mrp: 1500,
        sellingPrice: 1350,
        expiryDate: futureDate,
      },
    });

    batch2 = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: product2.id,
        variantId: product2.variants[0].id,
        batchNumber: `BATCH_BILL_2_${Date.now()}`,
        quantity: 30,
        purchasePrice: 1450,
        mrp: 1800,
        sellingPrice: 1600,
        expiryDate: futureDate,
      },
    });

    // 2. Create Shop B & OWNER B (for cross-shop IDOR testing)
    shopB = await prisma.shop.create({
      data: {
        shopName: 'Billing Test Shop B',
        code: `BSB_${Date.now()}`,
        mobile: `+919590${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Owner Billing B',
        email: `owner_bill_b_${Date.now()}@shop.com`,
        mobile: shopB.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);
  });

  // Test 1: POST /api/v1/billing - Create Bill for Farmer (INV-YYYYMMDDDD sequence, No tax, Stock deduction)
  it('POST /api/v1/billing - should create POS invoice with INV-YYYYMMDDDD sequence, no tax, and deduct stock', async () => {
    const res = await request(app)
      .post('/api/v1/billing')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        farmerId: farmerA.id,
        customerType: 'FARMER',
        paymentMethod: 'CASH',
        amountReceived: 5000,
        billDiscount: 100,
        items: [
          { productId: product1.id, batchId: batch1.id, quantity: 2, unitPrice: 1350 }, // 2700
          { productId: product2.id, batchId: batch2.id, quantity: 1, unitPrice: 1600 }, // 1600
        ],
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoice.invoiceNumber).toMatch(/^INV-\d{6}\d{4}$/); // Matches INV-YYYYMMDDDD
    expect(res.body.data.invoice.subTotal).toEqual(4300); // 2700 + 1600
    expect(res.body.data.invoice.discount).toEqual(100);
    expect(res.body.data.invoice.taxAmount).toEqual(0); // No tax
    expect(res.body.data.invoice.totalAmount).toEqual(4200); // 4300 - 100
    expect(res.body.data.changeAmount).toEqual(800); // 5000 - 4200

    invoiceA = res.body.data.invoice;

    // Verify batch1 stock deducted (50 - 2 = 48)
    const updatedBatch1 = await prisma.inventoryBatch.findUnique({ where: { id: batch1.id } });
    expect(updatedBatch1.quantity).toEqual(48);
  });

  // Test 2: POST /api/v1/billing - Create Walk-in Customer Bill
  it('POST /api/v1/billing - should create invoice for Walk-in Customer without farmerId', async () => {
    const res = await request(app)
      .post('/api/v1/billing')
      .set('Authorization', `Bearer ${tokenStaffA}`)
      .send({
        customerType: 'WALK_IN_CUSTOMER',
        customerName: 'Suresh Walk-in',
        paymentMethod: 'UPI',
        amountReceived: 1350,
        items: [
          { productId: product1.id, batchId: batch1.id, quantity: 1, unitPrice: 1350 },
        ],
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoice.farmerId).toBeNull();
    expect(res.body.data.invoice.invoiceNumber).toMatch(/^INV-\d{6}\d{4}$/);

    walkInInvoice = res.body.data.invoice;
  });

  // Test 3: GET /api/v1/billing - Search Invoices by Invoice Number
  it('GET /api/v1/billing - should search invoices by invoiceNumber', async () => {
    const res = await request(app)
      .get(`/api/v1/billing?search=${invoiceA.invoiceNumber}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].invoiceNumber).toBe(invoiceA.invoiceNumber);
  });

  // Test 4: GET /api/v1/billing/:id/receipt - Get Printable POS Receipt
  it('GET /api/v1/billing/:id/receipt - should return structured printable receipt payload', async () => {
    const res = await request(app)
      .get(`/api/v1/billing/${invoiceA.id}/receipt`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoiceNumber).toBe(invoiceA.invoiceNumber);
    expect(res.body.data.receiptHeader.shopName).toBe('Billing Test Shop A');
    expect(res.body.data.summary.totalAmount).toEqual(4200);
    expect(res.body.data.items[0].shortName).toBe('Urea 50KG');
  });

  // Test 5: Insufficient Stock Check (400 Bad Request)
  it('POST /api/v1/billing - should reject bill creation if requested quantity exceeds available batch stock', async () => {
    const res = await request(app)
      .post('/api/v1/billing')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        customerType: 'WALK_IN_CUSTOMER',
        items: [
          { productId: product1.id, batchId: batch1.id, quantity: 1000, unitPrice: 1350 }, // Requested 1000 when only 47 available!
        ],
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Insufficient stock');
  });

  // Test 6: POST /api/v1/billing/:id/cancel - Cancel Bill & Reverse Stock
  it('POST /api/v1/billing/:id/cancel - should cancel bill and reversely restore inventory batch stock', async () => {
    const res = await request(app)
      .post(`/api/v1/billing/${walkInInvoice.id}/cancel`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        reason: 'Customer returned item before leaving counter',
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paymentStatus).toBe('CANCELLED');

    // Verify batch1 stock restored (+1)
    const restoredBatch1 = await prisma.inventoryBatch.findUnique({ where: { id: batch1.id } });
    expect(restoredBatch1.quantity).toEqual(48); // 47 + 1 = 48
  });

  // Test 7: IDOR Protection Guard - Owner B accessing Shop A Invoice returns 404
  it('GET /api/v1/billing/:id - should reject access when user from another shop accesses invoice (IDOR Guard)', async () => {
    const res = await request(app)
      .get(`/api/v1/billing/${invoiceA.id}`)
      .set('Authorization', `Bearer ${tokenOwnerB}`);

    expect(res.statusCode).toEqual(404);
  });

  // Test 8: Role Restriction - BILLING_STAFF cannot cancel invoice (403 Forbidden)
  it('POST /api/v1/billing/:id/cancel - should reject invoice cancellation by BILLING_STAFF with 403 Forbidden', async () => {
    const res = await request(app)
      .post(`/api/v1/billing/${invoiceA.id}/cancel`)
      .set('Authorization', `Bearer ${tokenStaffA}`)
      .send({
        reason: 'Staff cancellation attempt',
      });

    expect(res.statusCode).toEqual(403);
  });
});
