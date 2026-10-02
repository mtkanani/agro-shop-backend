const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('Farmer Credit & Due Management Module Test Suite', () => {
  let shopA, shopB;
  let ownerA, ownerB, staffA;
  let tokenOwnerA, tokenOwnerB, tokenStaffA;
  let farmerA, farmerB;
  let categoryA, product1, batch1;
  let creditInvoiceA, recordedPayment;

  beforeAll(async () => {
    // 1. Create Shop A with OWNER, STAFF, Farmer A (credit limit 50,000)
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Farmer Credit Shop A',
        code: `FCSA_${Date.now()}`,
        mobile: `+919600${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Owner Credit A',
        email: `owner_cred_a_${Date.now()}@shop.com`,
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
        fullName: 'Staff Credit A',
        email: `staff_cred_a_${Date.now()}@shop.com`,
        mobile: `+919650${String(Date.now()).slice(-6)}`,
        passwordHash: 'hash',
        role: 'BILLING_STAFF',
        status: 'ACTIVE',
      },
    });
    tokenStaffA = generateAccessToken(staffA);

    farmerA = await prisma.farmer.create({
      data: {
        shopId: shopA.id,
        name: 'Ramesh Patel Credit Test',
        phone: `+91967${String(Date.now()).slice(-7)}`,
        village: 'Junagadh',
        creditLimit: 50000,
        khataBalance: 0,
      },
    });

    categoryA = await prisma.category.create({
      data: {
        shopId: shopA.id,
        name: 'Fertilizers Credit Test',
      },
    });

    product1 = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'Urea Credit Product',
        shortName: 'Urea 50KG',
        code: `UREA_CRED_${Date.now()}`,
        categoryId: categoryA.id,
        minStock: 5,
        variants: {
          create: [{ variantName: '50 KG', sku: `UREAC_50_${Date.now()}`, sellingPrice: 1350, mrp: 1500 }],
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
        batchNumber: `BATCH_CRED_1_${Date.now()}`,
        quantity: 100,
        purchasePrice: 1200,
        mrp: 1500,
        sellingPrice: 1350,
        expiryDate: futureDate,
      },
    });

    // 2. Create Shop B & Owner B for cross-shop IDOR testing
    shopB = await prisma.shop.create({
      data: {
        shopName: 'Farmer Credit Shop B',
        code: `FCSB_${Date.now()}`,
        mobile: `+919690${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Owner Credit B',
        email: `owner_cred_b_${Date.now()}@shop.com`,
        mobile: shopB.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);

    farmerB = await prisma.farmer.create({
      data: {
        shopId: shopB.id,
        name: 'Suresh Patel Shop B',
        phone: `+91968${String(Date.now()).slice(-7)}`,
        khataBalance: 5000,
      },
    });
  });

  // Test 1: POS Credit Sale -> creates credit invoice and updates farmer khata balance
  it('POST /api/v1/billing - should create credit bill and update farmer khata balance', async () => {
    const res = await request(app)
      .post('/api/v1/billing')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        farmerId: farmerA.id,
        customerType: 'FARMER',
        paymentMethod: 'CREDIT',
        paidAmount: 2000, // Grand total = 5400 (4 * 1350), Paid = 2000, Remaining Due = 3400
        items: [
          { productId: product1.id, batchId: batch1.id, quantity: 4, unitPrice: 1350 },
        ],
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoice.paymentStatus).toBe('PARTIAL');
    expect(res.body.data.outstanding.invoiceDueAmount).toEqual(3400);

    creditInvoiceA = res.body.data.invoice;

    // Verify Farmer khataBalance updated to 3400
    const updatedFarmer = await prisma.farmer.findUnique({ where: { id: farmerA.id } });
    expect(updatedFarmer.khataBalance).toEqual(3400);
  });

  // Test 2: PATCH /api/v1/farmer-credit/invoices/:id/settle - Single-Click Pending Bill Status Settlement
  it('PATCH /api/v1/farmer-credit/invoices/:id/settle - should mark pending bill status as PAID and clear khata balance', async () => {
    const res = await request(app)
      .patch(`/api/v1/farmer-credit/invoices/${creditInvoiceA.id}/settle`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        paymentMethod: 'CASH',
        notes: 'Owner collected full remaining 3400 due',
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoice.paymentStatus).toBe('PAID');
    expect(res.body.data.invoice.paidAmount).toEqual(5400);

    // Verify Farmer khataBalance cleared back to 0
    const updatedFarmer = await prisma.farmer.findUnique({ where: { id: farmerA.id } });
    expect(updatedFarmer.khataBalance).toEqual(0);
  });

  // Test 3: Credit Limit Enforcement Guard (400 Bad Request)
  it('POST /api/v1/billing - should reject credit checkout if requested due exceeds farmer credit limit', async () => {
    // Temporarily set farmerA credit limit to 2000
    await prisma.farmer.update({
      where: { id: farmerA.id },
      data: { creditLimit: 2000 },
    });

    const res = await request(app)
      .post('/api/v1/billing')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        farmerId: farmerA.id,
        customerType: 'FARMER',
        paymentMethod: 'CREDIT',
        paidAmount: 0, // Requested due = 5400, when credit limit is only 2000!
        items: [
          { productId: product1.id, batchId: batch1.id, quantity: 4, unitPrice: 1350 },
        ],
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('credit limit exceeded');

    // Restore credit limit to 50000
    await prisma.farmer.update({
      where: { id: farmerA.id },
      data: { creditLimit: 50000 },
    });
  });

  // Test 4: Record Farmer Payment & Oldest Due First Allocation
  it('POST /api/v1/farmer-credit/payments - should record farmer payment and reduce khata balance', async () => {
    // 1. Create a credit bill of 5400 (paid 0) -> due 5400
    const billRes = await request(app)
      .post('/api/v1/billing')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        farmerId: farmerA.id,
        customerType: 'FARMER',
        paymentMethod: 'CREDIT',
        paidAmount: 0,
        items: [
          { productId: product1.id, batchId: batch1.id, quantity: 4, unitPrice: 1350 },
        ],
      });

    expect(billRes.statusCode).toEqual(201);
    const newInvoice = billRes.body.data.invoice;

    // 2. Record payment of 2000 against Farmer A
    const res = await request(app)
      .post('/api/v1/farmer-credit/payments')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        farmerId: farmerA.id,
        amount: 2000,
        method: 'UPI',
        txnRef: 'TXN_DUE_TEST_001',
        notes: 'Partial payment by Ramesh',
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.previousDue).toEqual(5400);
    expect(res.body.data.remainingDue).toEqual(3400);

    recordedPayment = res.body.data.payment;

    // Verify invoice paidAmount updated to 2000 and status PARTIAL
    const updatedInvoice = await prisma.invoice.findUnique({ where: { id: newInvoice.id } });
    expect(updatedInvoice.paidAmount).toEqual(2000);
    expect(updatedInvoice.paymentStatus).toBe('PARTIAL');
  });

  // Test 5: Payment Exceeds Outstanding Guard (400 Bad Request)
  it('POST /api/v1/farmer-credit/payments - should reject payment if amount exceeds farmer outstanding balance', async () => {
    const res = await request(app)
      .post('/api/v1/farmer-credit/payments')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        farmerId: farmerA.id,
        amount: 100000, // Outstanding is 3400
        method: 'CASH',
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('exceeds farmer outstanding balance');
  });

  // Test 6: GET /api/v1/farmer-credit/payments/:id/receipt - Get POS Payment Receipt
  it('GET /api/v1/farmer-credit/payments/:id/receipt - should return structured POS payment receipt', async () => {
    const res = await request(app)
      .get(`/api/v1/farmer-credit/payments/${recordedPayment.id}/receipt`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paymentNumber).toBe(recordedPayment.paymentNumber);
    expect(res.body.data.paymentDetails.amountPaid).toEqual(2000);
  });

  // Test 7: GET /api/v1/farmer-credit/farmers/:id/ledger - Get Farmer Ledger
  it('GET /api/v1/farmer-credit/farmers/:id/ledger - should return farmer ledger statement', async () => {
    const res = await request(app)
      .get(`/api/v1/farmer-credit/farmers/${farmerA.id}/ledger`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary.closingBalance).toEqual(3400);
    expect(res.body.data.transactions.length).toBeGreaterThan(0);
  });

  // Test 8: POST /api/v1/farmer-credit/payments/:id/reverse - Payment Reversal
  it('POST /api/v1/farmer-credit/payments/:id/reverse - should reverse payment and restore farmer balance', async () => {
    const res = await request(app)
      .post(`/api/v1/farmer-credit/payments/${recordedPayment.id}/reverse`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        reason: 'Payment entered against wrong account',
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.restoredBalance).toEqual(5400); // Restored 3400 + 2000 = 5400
  });

  // Test 9: PATCH /api/v1/farmer-credit/farmers/:id/credit-limit - Update Credit Limit (Owner Only)
  it('PATCH /api/v1/farmer-credit/farmers/:id/credit-limit - should update credit limit', async () => {
    const res = await request(app)
      .patch(`/api/v1/farmer-credit/farmers/${farmerA.id}/credit-limit`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        creditLimit: 75000,
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.creditLimit).toEqual(75000);
  });

  // Test 10: IDOR Protection Guard - Owner A recording payment for Farmer B returns 404
  it('POST /api/v1/farmer-credit/payments - should reject recording payment for farmer in another shop', async () => {
    const res = await request(app)
      .post('/api/v1/farmer-credit/payments')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        farmerId: farmerB.id, // Belongs to Shop B!
        amount: 1000,
        method: 'CASH',
      });

    expect(res.statusCode).toEqual(404);
  });
});
