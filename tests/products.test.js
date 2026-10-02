const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('Product Management, Product Types & Product Variants Test Suite', () => {
  let shopA, shopB;
  let ownerA, ownerB, staffA;
  let tokenOwnerA, tokenOwnerB, tokenStaffA;
  let categoryA, categoryB;
  let productTypeBottleA;
  let productA;

  beforeAll(async () => {
    // 1. Create Shop A with OWNER, BILLING_STAFF, and Category A
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Product Test Shop A',
        code: `PSA_${Date.now()}`,
        mobile: `+919500${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Owner Product A',
        email: `owner_prod_a_${Date.now()}@shop.com`,
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
        fullName: 'Staff Product A',
        email: `staff_prod_a_${Date.now()}@shop.com`,
        mobile: `+919550${String(Date.now()).slice(-6)}`,
        passwordHash: 'hash',
        role: 'BILLING_STAFF',
        status: 'ACTIVE',
      },
    });
    tokenStaffA = generateAccessToken(staffA);

    categoryA = await prisma.category.create({
      data: {
        shopId: shopA.id,
        name: 'Pesticides Shop A',
        description: 'Crop protection chemicals',
      },
    });

    // 2. Create Shop B, OWNER B, and Category B (for cross-shop security testing)
    shopB = await prisma.shop.create({
      data: {
        shopName: 'Product Test Shop B',
        code: `PSB_${Date.now()}`,
        mobile: `+919600${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Owner Product B',
        email: `owner_prod_b_${Date.now()}@shop.com`,
        mobile: shopB.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);

    categoryB = await prisma.category.create({
      data: {
        shopId: shopB.id,
        name: 'Pesticides Shop B',
      },
    });
  });

  // Test 1: POST /api/v1/product-types - Create Master Product Type
  it('POST /api/v1/product-types - should create master product type (Bottle)', async () => {
    const res = await request(app)
      .post('/api/v1/product-types')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        name: 'Bottle',
        shortName: 'BTL',
        description: 'Liquid bottle packaging',
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Bottle');
    expect(res.body.data.shopId).toBe(shopA.id);

    productTypeBottleA = res.body.data;
  });

  // Test 2: Duplicate Product Type in Same Shop (409 Conflict)
  it('POST /api/v1/product-types - should return 409 Conflict when creating duplicate product type name in same shop', async () => {
    const res = await request(app)
      .post('/api/v1/product-types')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        name: 'bottle',
        shortName: 'BTL2',
      });

    expect(res.statusCode).toEqual(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('already exists in your shop');
  });

  // Test 3: POST /api/v1/products - Create Product with mandatory shortName and 3 Variants
  it('POST /api/v1/products - should create Product selecting Product Type and manually adding 3 variants (100 ML, 500 ML, 1 L)', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        name: 'Bayer Confidor Insecticide 100 ML',
        shortName: 'Confidor',
        categoryId: categoryA.id,
        productTypeId: productTypeBottleA.id,
        brand: 'Bayer',
        barcode: '8901234567890',
        variants: [
          {
            variantName: '100 ML',
            shortName: 'Confidor 100ML',
            sku: `CONF100_${Date.now()}`,
            barcode: '8901234567891',
            unit: 'ML',
            purchasePrice: 350,
            mrp: 500,
            sellingPrice: 420,
            taxRate: 5,
          },
          {
            variantName: '500 ML',
            shortName: 'Confidor 500ML',
            sku: `CONF500_${Date.now()}`,
            barcode: '8901234567892',
            unit: 'ML',
            purchasePrice: 1300,
            mrp: 1800,
            sellingPrice: 1550,
            taxRate: 5,
          },
          {
            variantName: '1 L',
            shortName: 'Confidor 1L',
            sku: `CONF1L_${Date.now()}`,
            barcode: '8901234567893',
            unit: 'LITRE',
            purchasePrice: 2450,
            mrp: 3200,
            sellingPrice: 2900,
            taxRate: 5,
          },
        ],
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.shortName).toBe('Confidor');
    expect(res.body.data.shopId).toBe(shopA.id);
    expect(res.body.data.variants.length).toEqual(3);

    productA = res.body.data;
  });

  // Test 4: Missing mandatory shortName returns 400 Bad Request
  it('POST /api/v1/products - should reject product creation missing mandatory shortName', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        name: 'Urea Fertilizer 50 KG',
        categoryId: categoryA.id,
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
  });

  // Test 5: Cross-Shop Category Security Guard (403 Forbidden)
  it('POST /api/v1/products - should reject product creation when category belongs to another shop (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        name: 'Illegal Cross Shop Product',
        shortName: 'IllegalProd',
        categoryId: categoryB.id, // Shop B category!
      });

    expect(res.statusCode).toEqual(403);
    expect(res.body.message).toContain('belongs to another shop');
  });

  // Test 6: GET /api/v1/products - List Products scoped to active shop
  it('GET /api/v1/products - should list products scoped to active shop', async () => {
    const res = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].shopId).toBe(shopA.id);
  });

  // Test 7: GET /api/v1/products - Search by Short Name / Barcode / SKU
  it('GET /api/v1/products?search=Confidor - should return matching product by shortName', async () => {
    const res = await request(app)
      .get('/api/v1/products?search=Confidor')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].shortName).toBe('Confidor');
  });

  // Test 8: GET /api/v1/products/:id - Get Product Details & Variants
  it('GET /api/v1/products/:id - should return product details with 3 variants and stock summary', async () => {
    const res = await request(app)
      .get(`/api/v1/products/${productA.id}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(productA.id);
    expect(res.body.data.variants.length).toEqual(3);
    expect(res.body.data.productType.name).toBe('Bottle');
  });

  // Test 9: IDOR Protection - Owner B accessing Shop A Product returns 404
  it('GET /api/v1/products/:id - should reject access when user from another shop accesses product (IDOR Guard)', async () => {
    const res = await request(app)
      .get(`/api/v1/products/${productA.id}`)
      .set('Authorization', `Bearer ${tokenOwnerB}`);

    expect(res.statusCode).toEqual(404);
  });

  // Test 10: Role Restriction - BILLING_STAFF cannot create product (403 Forbidden)
  it('POST /api/v1/products - should reject product creation by BILLING_STAFF with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${tokenStaffA}`)
      .send({
        name: 'Staff Unauthorized Product',
        shortName: 'StaffProd',
        categoryId: categoryA.id,
      });

    expect(res.statusCode).toEqual(403);
  });

  // Test 11: DELETE /api/v1/products/:id - Soft Deactivate Product
  it('DELETE /api/v1/products/:id - should soft-deactivate product (isActive = false)', async () => {
    const res = await request(app)
      .delete(`/api/v1/products/${productA.id}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);

    const deactivated = await prisma.product.findUnique({ where: { id: productA.id } });
    expect(deactivated.isActive).toBe(false);
  });
});
