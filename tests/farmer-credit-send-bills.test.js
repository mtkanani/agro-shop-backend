const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('Farmer Credit Send Bills Test Suite (Email & WhatsApp)', () => {
  let shopA, shopB;
  let ownerA, ownerB;
  let tokenOwnerA, tokenOwnerB;
  let farmerA, farmerB;
  let product1, batch1;
  let paidInvoice, pendingInvoice1, pendingInvoice2;

  beforeAll(async () => {
    // 1. Create Shop A
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Green Krishi Kendra',
        code: `GKK_${Date.now()}`,
        mobile: `+919879${String(Date.now()).slice(-6)}`,
        email: 'info@greenkrishi.com',
        address: 'Market Yard, Station Road',
        villageCity: 'Amreli',
        state: 'Gujarat',
        pincode: '365601',
        gstin: '24AAACG1234F1Z5',
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Bhavesh Patel',
        email: `bhavesh_${Date.now()}@shop.com`,
        mobile: shopA.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerA = generateAccessToken(ownerA);

    // 2. Create Shop B for cross-tenant IDOR checks
    shopB = await prisma.shop.create({
      data: {
        shopName: 'Other Agro Shop',
        code: `OAS_${Date.now()}`,
        mobile: `+919888${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Other Owner',
        email: `other_owner_${Date.now()}@shop.com`,
        mobile: shopB.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);

    // 3. Create Farmer A (Shop A) with email and phone
    farmerA = await prisma.farmer.create({
      data: {
        shopId: shopA.id,
        name: 'Suresh Bhai Patel',
        phone: '9876543210',
        email: 'suresh.farmer@example.com',
        village: 'Babra',
        creditLimit: 50000,
        khataBalance: 3500,
      },
    });

    // 4. Create Farmer B (Shop B)
    farmerB = await prisma.farmer.create({
      data: {
        shopId: shopB.id,
        name: 'Dinesh Bhai Shop B',
        phone: '9876543211',
        email: 'dinesh@shopb.com',
        creditLimit: 20000,
        khataBalance: 1000,
      },
    });

    // 5. Create product and batch for invoice items
    const category = await prisma.category.create({
      data: {
        shopId: shopA.id,
        name: 'Pesticides',
      },
    });

    product1 = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'Chlorpyrifos 20% EC',
        shortName: 'Chlorpy 1L',
        code: `CHLOR_${Date.now()}`,
        categoryId: category.id,
        minStock: 2,
        variants: {
          create: [{ variantName: '1 LTR', sku: `CHL1_${Date.now()}`, sellingPrice: 500, mrp: 600 }],
        },
      },
      include: { variants: true },
    });

    batch1 = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: product1.id,
        variantId: product1.variants[0].id,
        batchNumber: `BATCH_CHL_${Date.now()}`,
        quantity: 100,
        purchasePrice: 400,
        mrp: 600,
        sellingPrice: 500,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    // 6. Create invoices for Farmer A
    // Invoice 1: PAID (COMPLETED)
    paidInvoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-TEST-PAID-${Date.now()}`,
        shopId: shopA.id,
        farmerId: farmerA.id,
        userId: ownerA.id,
        subTotal: 1000,
        taxAmount: 0,
        discount: 0,
        totalAmount: 1000,
        paidAmount: 1000,
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        items: {
          create: [
            {
              productId: product1.id,
              batchId: batch1.id,
              quantity: 2,
              unitPrice: 500,
              totalPrice: 1000,
            },
          ],
        },
      },
    });

    // Invoice 2: UNPAID (PENDING)
    pendingInvoice1 = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-TEST-DUE1-${Date.now()}`,
        shopId: shopA.id,
        farmerId: farmerA.id,
        userId: ownerA.id,
        subTotal: 2500,
        taxAmount: 0,
        discount: 0,
        totalAmount: 2500,
        paidAmount: 0,
        paymentStatus: 'UNPAID',
        paymentMethod: 'KHATA',
        items: {
          create: [
            {
              productId: product1.id,
              batchId: batch1.id,
              quantity: 5,
              unitPrice: 500,
              totalPrice: 2500,
            },
          ],
        },
      },
    });

    // Invoice 3: PARTIAL (PENDING)
    pendingInvoice2 = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-TEST-PARTIAL-${Date.now()}`,
        shopId: shopA.id,
        farmerId: farmerA.id,
        userId: ownerA.id,
        subTotal: 2000,
        taxAmount: 0,
        discount: 0,
        totalAmount: 2000,
        paidAmount: 1000,
        paymentStatus: 'PARTIAL',
        paymentMethod: 'KHATA',
        items: {
          create: [
            {
              productId: product1.id,
              batchId: batch1.id,
              quantity: 4,
              unitPrice: 500,
              totalPrice: 2000,
            },
          ],
        },
      },
    });
  });

  // Test 1: GET /api/v1/farmer-credit/farmers/:farmerId/bills-summary
  it('GET /api/v1/farmer-credit/farmers/:farmerId/bills-summary - should return correct counts and totals for ALL, PENDING, COMPLETED', async () => {
    const res = await request(app)
      .get(`/api/v1/farmer-credit/farmers/${farmerA.id}/bills-summary`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);

    const { farmer, summaries } = res.body.data;
    expect(farmer.id).toEqual(farmerA.id);
    expect(farmer.name).toEqual(farmerA.name);
    expect(farmer.email).toEqual('suresh.farmer@example.com');

    // ALL (3 invoices: 1000 + 2500 + 2000 = 5500 total, 2000 paid, 3500 due)
    expect(summaries.ALL.count).toEqual(3);
    expect(summaries.ALL.totalAmount).toEqual(5500);
    expect(summaries.ALL.totalPaid).toEqual(2000);
    expect(summaries.ALL.totalDue).toEqual(3500);

    // PENDING (2 invoices: 2500 + 2000 = 4500 total, 1000 paid, 3500 due)
    expect(summaries.PENDING.count).toEqual(2);
    expect(summaries.PENDING.totalAmount).toEqual(4500);
    expect(summaries.PENDING.totalPaid).toEqual(1000);
    expect(summaries.PENDING.totalDue).toEqual(3500);

    // COMPLETED (1 invoice: 1000 total, 1000 paid, 0 due)
    expect(summaries.COMPLETED.count).toEqual(1);
    expect(summaries.COMPLETED.totalAmount).toEqual(1000);
    expect(summaries.COMPLETED.totalPaid).toEqual(1000);
    expect(summaries.COMPLETED.totalDue).toEqual(0);
  });

  // Test 2: Validation rejection for invalid billType
  it('POST /api/v1/farmer-credit/farmers/:farmerId/send-bills - should reject invalid billType', async () => {
    const res = await request(app)
      .post(`/api/v1/farmer-credit/farmers/${farmerA.id}/send-bills`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        billType: 'INVALID_TYPE',
        channels: ['EMAIL'],
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
  });

  // Test 3: Send PENDING bills via Email and WhatsApp
  it('POST /api/v1/farmer-credit/farmers/:farmerId/send-bills - should dispatch PENDING bills via Email and WhatsApp', async () => {
    const res = await request(app)
      .post(`/api/v1/farmer-credit/farmers/${farmerA.id}/send-bills`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        billType: 'PENDING',
        channels: ['EMAIL', 'WHATSAPP'],
        customNote: 'Please clear dues before next planting season.',
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);

    const { billType, summary, delivery } = res.body.data;
    expect(billType).toEqual('PENDING');
    expect(summary.count).toEqual(2);
    expect(summary.totalAmount).toEqual(4500);
    expect(summary.totalDue).toEqual(3500);

    // Verify Email delivery report
    expect(delivery.email.sent).toBe(true);
    expect(delivery.email.recipient).toEqual('suresh.farmer@example.com');

    // Verify WhatsApp delivery report & deep link
    expect(delivery.whatsapp.sent).toBe(true);
    expect(delivery.whatsapp.recipient).toEqual('9876543210');
    expect(delivery.whatsapp.deepLink).toContain('https://wa.me/919876543210?text=');
    expect(delivery.whatsapp.deepLink).toContain(encodeURIComponent('PENDING DUE BILLS REMINDER'));
  });

  // Test 4: Send COMPLETED bills via Email and WhatsApp
  it('POST /api/v1/farmer-credit/farmers/:farmerId/send-bills - should dispatch COMPLETED bills receipt', async () => {
    const res = await request(app)
      .post(`/api/v1/farmer-credit/farmers/${farmerA.id}/send-bills`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        billType: 'COMPLETED',
        channels: ['EMAIL', 'WHATSAPP'],
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);

    const { billType, summary, delivery } = res.body.data;
    expect(billType).toEqual('COMPLETED');
    expect(summary.count).toEqual(1);
    expect(summary.totalAmount).toEqual(1000);
    expect(summary.totalDue).toEqual(0);

    expect(delivery.email.sent).toBe(true);
    expect(delivery.whatsapp.sent).toBe(true);
    expect(delivery.whatsapp.deepLink).toContain(encodeURIComponent('PAID INVOICES RECEIPT'));
  });

  // Test 5: Send ALL bills with override email and phone
  it('POST /api/v1/farmer-credit/farmers/:farmerId/send-bills - should respect custom email and phone overrides', async () => {
    const overrideEmail = 'accountant.patel@agrofarm.in';
    const overridePhone = '9900112233';

    const res = await request(app)
      .post(`/api/v1/farmer-credit/farmers/${farmerA.id}/send-bills`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        billType: 'ALL',
        channels: ['EMAIL', 'WHATSAPP'],
        recipientEmail: overrideEmail,
        recipientPhone: overridePhone,
        customNote: 'Complete yearly statement for accounts.',
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);

    const { billType, summary, delivery } = res.body.data;
    expect(billType).toEqual('ALL');
    expect(summary.count).toEqual(3);
    expect(summary.totalAmount).toEqual(5500);

    expect(delivery.email.recipient).toEqual(overrideEmail);
    expect(delivery.whatsapp.recipient).toEqual(overridePhone);
    expect(delivery.whatsapp.deepLink).toContain('https://wa.me/919900112233?text=');
  });

  // Test 6: Cross-Tenant Protection (Owner A cannot access or dispatch bills for Farmer in Shop B)
  it('should enforce multi-tenant isolation and reject cross-shop access with 404', async () => {
    // Summary endpoint
    const summaryRes = await request(app)
      .get(`/api/v1/farmer-credit/farmers/${farmerB.id}/bills-summary`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);
    expect(summaryRes.statusCode).toEqual(404);

    // Send bills endpoint
    const sendRes = await request(app)
      .post(`/api/v1/farmer-credit/farmers/${farmerB.id}/send-bills`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        billType: 'ALL',
        channels: ['EMAIL'],
      });
    expect(sendRes.statusCode).toEqual(404);
  });
});
