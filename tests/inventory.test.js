const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('Inventory & Stock Management Module Test Suite', () => {
  let shopA, shopB;
  let ownerA, ownerB, staffA;
  let tokenOwnerA, tokenOwnerB, tokenStaffA;
  let categoryA;
  let supplierA;
  let product1, product2, productLowStock;
  let batchActive, batchNearExpiry, batchExpired;

  beforeAll(async () => {
    // 1. Create Shop A with OWNER, BILLING_STAFF, Category A, Supplier A
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Inventory Test Shop A',
        code: `ISA_${Date.now()}`,
        mobile: `+919600${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Owner Inventory A',
        email: `owner_inv_a_${Date.now()}@shop.com`,
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
        fullName: 'Staff Inventory A',
        email: `staff_inv_a_${Date.now()}@shop.com`,
        mobile: `+919650${String(Date.now()).slice(-6)}`,
        passwordHash: 'hash',
        role: 'BILLING_STAFF',
        status: 'ACTIVE',
      },
    });
    tokenStaffA = generateAccessToken(staffA);

    categoryA = await prisma.category.create({
      data: {
        shopId: shopA.id,
        name: 'Fertilizers Inv A',
      },
    });

    supplierA = await prisma.supplier.create({
      data: {
        shopId: shopA.id,
        name: 'KRIBHCO Distributor',
        companyName: 'KRIBHCO Agro',
        phone: `+91967${String(Date.now()).slice(-7)}`,
      },
    });

    // 2. Create Products
    product1 = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'Urea Fertilizer Premium 50 KG',
        shortName: 'Urea 50KG',
        code: `UREA_INV_${Date.now()}`,
        categoryId: categoryA.id,
        minStock: 20,
        variants: {
          create: [{ variantName: '50 KG', sku: `UREAS_50_${Date.now()}` }],
        },
      },
      include: { variants: true },
    });

    productLowStock = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'Confidor Pesticide 100 ML',
        shortName: 'Confidor 100ML',
        code: `CONF_${Date.now()}`,
        categoryId: categoryA.id,
        minStock: 10,
        variants: {
          create: [{ variantName: '100 ML', sku: `CONF_100_${Date.now()}` }],
        },
      },
      include: { variants: true },
    });

    // 3. Create Batches: Active, Near Expiry, Expired, Low Stock
    const currentDate = new Date();
    const nearExpiryDate = new Date();
    nearExpiryDate.setDate(currentDate.getDate() + 15); // Expiring in 15 days

    const pastExpiryDate = new Date();
    pastExpiryDate.setDate(currentDate.getDate() - 10); // Expired 10 days ago

    const futureExpiryDate = new Date();
    futureExpiryDate.setFullYear(currentDate.getFullYear() + 2); // 2 years

    batchActive = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: product1.id,
        variantId: product1.variants[0].id,
        supplierId: supplierA.id,
        batchNumber: `BATCH_ACT_${Date.now()}`,
        quantity: 50,
        purchasePrice: 1200,
        mrp: 1500,
        sellingPrice: 1350,
        expiryDate: futureExpiryDate,
      },
    });

    batchNearExpiry = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: product1.id,
        variantId: product1.variants[0].id,
        supplierId: supplierA.id,
        batchNumber: `BATCH_NEAR_${Date.now()}`,
        quantity: 20,
        purchasePrice: 1180,
        mrp: 1500,
        sellingPrice: 1350,
        expiryDate: nearExpiryDate,
      },
    });

    batchExpired = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: product1.id,
        variantId: product1.variants[0].id,
        supplierId: supplierA.id,
        batchNumber: `BATCH_EXP_${Date.now()}`,
        quantity: 10,
        purchasePrice: 1150,
        mrp: 1500,
        sellingPrice: 1350,
        expiryDate: pastExpiryDate,
      },
    });

    // Create low stock batch for productLowStock (quantity 3 <= minStock 10)
    await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: productLowStock.id,
        variantId: productLowStock.variants[0].id,
        supplierId: supplierA.id,
        batchNumber: `BATCH_LOW_${Date.now()}`,
        quantity: 3,
        purchasePrice: 400,
        mrp: 550,
        sellingPrice: 500,
        expiryDate: futureExpiryDate,
      },
    });

    // 4. Create Shop B & OWNER B (for cross-shop IDOR testing)
    shopB = await prisma.shop.create({
      data: {
        shopName: 'Inventory Test Shop B',
        code: `ISB_${Date.now()}`,
        mobile: `+919690${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Owner Inventory B',
        email: `owner_inv_b_${Date.now()}@shop.com`,
        mobile: shopB.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);
  });

  // Test 1: GET /api/v1/inventory/metrics - Dashboard Summary Metrics
  it('GET /api/v1/inventory/metrics - should return dashboard metrics summary', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/metrics')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalProducts).toBeGreaterThanOrEqual(2);
    expect(res.body.data.totalStock).toBeGreaterThanOrEqual(83); // 50 + 20 + 10 + 3
    expect(res.body.data.lowStockCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.nearExpiryCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.expiredCount).toBeGreaterThanOrEqual(1);
  });

  // Test 2: GET /api/v1/inventory - List Stock Catalog with Short Name
  it('GET /api/v1/inventory - should list inventory stock catalog displaying shortName and status', async () => {
    const res = await request(app)
      .get('/api/v1/inventory')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const ureaItem = res.body.data.find((i) => i.productId === product1.id);
    expect(ureaItem).toBeDefined();
    expect(ureaItem.shortName).toBe('Urea 50KG');
    expect(ureaItem.totalStock).toBe(80); // 50 + 20 + 10
    expect(ureaItem.status).toBe('IN_STOCK');
  });

  // Test 3: GET /api/v1/inventory/product/:productId - Product Inventory Profile
  it('GET /api/v1/inventory/product/:productId - should return detailed inventory profile for product', async () => {
    const res = await request(app)
      .get(`/api/v1/inventory/product/${product1.id}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.product.shortName).toBe('Urea 50KG');
    expect(res.body.data.stock.current).toBe(80);
    expect(res.body.data.nearExpiryBatchesCount).toBe(1);
    expect(res.body.data.expiredBatchesCount).toBe(1);
  });

  // Test 4: GET /api/v1/inventory/product/:productId/batches - Product Batches Breakdown
  it('GET /api/v1/inventory/product/:productId/batches - should return list of batches with derived statuses', async () => {
    const res = await request(app)
      .get(`/api/v1/inventory/product/${product1.id}/batches`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(3);
  });

  // Test 5: GET /api/v1/inventory/low-stock - Low Stock Products Filter
  it('GET /api/v1/inventory/low-stock - should return products where currentStock <= minStock', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/low-stock')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.some((p) => p.shortName === 'Confidor 100ML')).toBe(true);
  });

  // Test 6: GET /api/v1/inventory/near-expiry - Near Expiry Batches Filter
  it('GET /api/v1/inventory/near-expiry - should return batches expiring within threshold', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/near-expiry?days=30')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.some((b) => b.batchNumber === batchNearExpiry.batchNumber)).toBe(true);
  });

  // Test 7: GET /api/v1/inventory/expired - Expired Batches Filter
  it('GET /api/v1/inventory/expired - should return expired inventory batches', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/expired')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.some((b) => b.batchNumber === batchExpired.batchNumber)).toBe(true);
  });

  // Test 8: POST /api/v1/inventory/adjustments - Stock Adjustment / Damage Write-Off
  it('POST /api/v1/inventory/adjustments - should adjust batch stock level and create stock transaction log', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/adjustments')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        batchId: batchActive.id,
        type: 'DECREASE',
        adjustmentQuantity: 5,
        reason: 'Physical stock shortage',
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.batch.quantity).toEqual(45); // 50 - 5 = 45
    expect(res.body.data.transaction.type).toEqual('ADJUSTMENT');
  });

  // Test 9: Negative Stock Guard (400 Bad Request)
  it('POST /api/v1/inventory/adjustments - should reject adjustment that causes negative stock with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/adjustments')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        batchId: batchActive.id,
        type: 'DECREASE',
        adjustmentQuantity: 100, // Attempting to remove 100 when current is 45!
        reason: 'Excessive damage test',
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Insufficient stock');
  });

  // Test 10: GET /api/v1/inventory/transactions - Stock Movement History
  it('GET /api/v1/inventory/transactions - should list stock movement transaction logs', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/transactions')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  // Test 11: IDOR Protection Guard - Owner B accessing Shop A product profile returns 404
  it('GET /api/v1/inventory/product/:productId - should reject access when user from another shop accesses inventory (IDOR Guard)', async () => {
    const res = await request(app)
      .get(`/api/v1/inventory/product/${product1.id}`)
      .set('Authorization', `Bearer ${tokenOwnerB}`);

    expect(res.statusCode).toEqual(404);
  });

  // Test 12: Role Restriction - BILLING_STAFF cannot perform stock adjustments (403 Forbidden)
  it('POST /api/v1/inventory/adjustments - should reject stock adjustment by BILLING_STAFF with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/adjustments')
      .set('Authorization', `Bearer ${tokenStaffA}`)
      .send({
        batchId: batchActive.id,
        adjustmentQuantity: 2,
        reason: 'Staff adjustment attempt',
      });

    expect(res.statusCode).toEqual(403);
  });
});
