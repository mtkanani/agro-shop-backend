const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('Supplier Management & Restock Module Test Suite', () => {
  let shopA, shopB;
  let ownerA, ownerB, staffA;
  let tokenOwnerA, tokenOwnerB, tokenStaffA;
  let categoryA;
  let supplierA;
  let product1, product2;
  let restockA;

  beforeAll(async () => {
    // 1. Create Shop A with OWNER, BILLING_STAFF, Category A, and 2 Products
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Supplier Test Shop A',
        code: `SSA_${Date.now()}`,
        mobile: `+919700${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Owner Supplier A',
        email: `owner_sup_a_${Date.now()}@shop.com`,
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
        fullName: 'Staff Supplier A',
        email: `staff_sup_a_${Date.now()}@shop.com`,
        mobile: `+919750${String(Date.now()).slice(-6)}`,
        passwordHash: 'hash',
        role: 'BILLING_STAFF',
        status: 'ACTIVE',
      },
    });
    tokenStaffA = generateAccessToken(staffA);

    categoryA = await prisma.category.create({
      data: {
        shopId: shopA.id,
        name: 'Fertilizers Shop A',
      },
    });

    product1 = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'Urea 46% Fertilizer 50 KG',
        shortName: 'Urea 50KG',
        code: `UREA_${Date.now()}`,
        categoryId: categoryA.id,
        variants: {
          create: [{ variantName: '50 KG', sku: `UREA50_${Date.now()}` }],
        },
      },
      include: { variants: true },
    });

    product2 = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'DAP Fertilizer 50 KG',
        shortName: 'DAP 50KG',
        code: `DAP_${Date.now()}`,
        categoryId: categoryA.id,
        variants: {
          create: [{ variantName: '50 KG', sku: `DAP50_${Date.now()}` }],
        },
      },
      include: { variants: true },
    });

    // 2. Create Shop B & OWNER B (for cross-shop IDOR testing)
    shopB = await prisma.shop.create({
      data: {
        shopName: 'Supplier Test Shop B',
        code: `SSB_${Date.now()}`,
        mobile: `+919800${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Owner Supplier B',
        email: `owner_sup_b_${Date.now()}@shop.com`,
        mobile: shopB.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);
  });

  // Test 1: POST /api/v1/suppliers - Create Supplier
  it('POST /api/v1/suppliers - should create supplier profile for active shop', async () => {
    const res = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        name: 'IFFCO Distributor',
        companyName: 'IFFCO Agro Supplies',
        phone: `+91987${String(Date.now()).slice(-7)}`,
        address: 'Main Market Road, Nagpur',
        suppliedProducts: 'Urea, DAP',
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('IFFCO Distributor');
    expect(res.body.data.shopId).toBe(shopA.id);

    supplierA = res.body.data;
  });

  // Test 2: Duplicate Supplier Phone in Same Shop (409 Conflict)
  it('POST /api/v1/suppliers - should return 409 Conflict when creating duplicate supplier phone in same shop', async () => {
    const res = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        name: 'IFFCO Alternate Branch',
        phone: supplierA.phone, // Duplicate phone!
      });

    expect(res.statusCode).toEqual(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('already exists in your shop');
  });

  // Test 3: GET /api/v1/suppliers - List Suppliers scoped to shop
  it('GET /api/v1/suppliers - should list suppliers belonging only to active shop', async () => {
    const res = await request(app)
      .get('/api/v1/suppliers')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.some((s) => s.id === supplierA.id)).toBe(true);
  });

  // Test 4: POST /api/v1/restocks - Perform Multi-Product Restock Intake
  it('POST /api/v1/restocks - should perform stock intake for 2 products and update inventory batch & transactions', async () => {
    const res = await request(app)
      .post('/api/v1/restocks')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        supplierId: supplierA.id,
        notes: 'Monthly bulk restock',
        items: [
          {
            productId: product1.id,
            variantId: product1.variants[0].id,
            quantity: 50,
            purchasePrice: 1200,
            mrp: 1500,
            sellingPrice: 1350,
            batchNumber: `UREA_BATCH_${Date.now()}`,
          },
          {
            productId: product2.id,
            variantId: product2.variants[0].id,
            quantity: 30,
            purchasePrice: 1500,
            mrp: 1800,
            sellingPrice: 1650,
            batchNumber: `DAP_BATCH_${Date.now()}`,
          },
        ],
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalAmount).toEqual(50 * 1200 + 30 * 1500); // 105000
    expect(res.body.data.itemsCount).toEqual(2);

    restockA = res.body.data;
  });

  // Test 5: GET /api/v1/suppliers/:id/restocks - Get Restock history in Supplier Profile
  it('GET /api/v1/suppliers/:id/restocks - should return supplier restock transaction history', async () => {
    const res = await request(app)
      .get(`/api/v1/suppliers/${supplierA.id}/restocks`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  // Test 6: GET /api/v1/suppliers/:id/products - Get Supplied Products summary list
  it('GET /api/v1/suppliers/:id/products - should return unique products received from supplier with last purchase price', async () => {
    const res = await request(app)
      .get(`/api/v1/suppliers/${supplierA.id}/products`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.products.length).toEqual(2);
    expect(res.body.data.products.some((p) => p.shortName === 'Urea 50KG')).toBe(true);
  });

  // Test 7: IDOR Security Guard - Owner B accessing Shop A Supplier returns 404
  it('GET /api/v1/suppliers/:id - should reject access when user from another shop accesses supplier (IDOR Guard)', async () => {
    const res = await request(app)
      .get(`/api/v1/suppliers/${supplierA.id}`)
      .set('Authorization', `Bearer ${tokenOwnerB}`);

    expect(res.statusCode).toEqual(404);
  });

  // Test 8: Role Restriction - BILLING_STAFF cannot create restock (403 Forbidden)
  it('POST /api/v1/restocks - should reject restock creation by BILLING_STAFF with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/restocks')
      .set('Authorization', `Bearer ${tokenStaffA}`)
      .send({
        supplierId: supplierA.id,
        items: [
          {
            productId: product1.id,
            quantity: 10,
            purchasePrice: 1200,
          },
        ],
      });

    expect(res.statusCode).toEqual(403);
  });
});
