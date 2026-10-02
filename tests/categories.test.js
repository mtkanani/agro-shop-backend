const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('Category Management Module Test Suite', () => {
  let shopA, shopB;
  let ownerA, ownerB, staffA;
  let tokenOwnerA, tokenOwnerB, tokenStaffA;
  let categoryA;

  beforeAll(async () => {
    // 1. Create Shop A with OWNER & BILLING_STAFF
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Category Test Shop A',
        code: `CSA_${Date.now()}`,
        mobile: `+919300${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Owner Category A',
        email: `owner_cat_a_${Date.now()}@shop.com`,
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
        fullName: 'Staff Category A',
        email: `staff_cat_a_${Date.now()}@shop.com`,
        mobile: `+919350${String(Date.now()).slice(-6)}`,
        passwordHash: 'hash',
        role: 'BILLING_STAFF',
        status: 'ACTIVE',
      },
    });
    tokenStaffA = generateAccessToken(staffA);

    // 2. Create Shop B & OWNER B (for cross-shop IDOR testing)
    shopB = await prisma.shop.create({
      data: {
        shopName: 'Category Test Shop B',
        code: `CSB_${Date.now()}`,
        mobile: `+919400${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Owner Category B',
        email: `owner_cat_b_${Date.now()}@shop.com`,
        mobile: shopB.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);
  });

  // Test 1: POST /api/v1/categories - Create custom category
  it('POST /api/v1/categories - should create custom category for active shop', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        name: 'Hybrid Seeds',
        description: 'High-yield hybrid seeds',
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Hybrid Seeds');
    expect(res.body.data.shopId).toBe(shopA.id);

    categoryA = res.body.data;
  });

  // Test 2: Duplicate Category in Same Shop (409 Conflict)
  it('POST /api/v1/categories - should return 409 Conflict when creating duplicate category in same shop', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        name: 'hybrid seeds', // case-insensitive check
        description: 'Duplicate test',
      });

    expect(res.statusCode).toEqual(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('already exists in your shop');
  });

  // Test 3: Same Category Name in Different Shop (Allowed)
  it('POST /api/v1/categories - should allow same category name in a different shop', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${tokenOwnerB}`)
      .send({
        name: 'Hybrid Seeds',
        description: 'Shop B Hybrid Seeds',
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.shopId).toBe(shopB.id);
  });

  // Test 4: GET /api/v1/categories - List categories scoped to shop
  it('GET /api/v1/categories - should list categories belonging only to active shop', async () => {
    const res = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.some((cat) => cat.id === categoryA.id)).toBe(true);
    expect(res.body.data.every((cat) => cat.shopId === shopA.id)).toBe(true);
  });

  // Test 5: GET /api/v1/categories/:id - Get Category details
  it('GET /api/v1/categories/:id - should return category details with product count', async () => {
    const res = await request(app)
      .get(`/api/v1/categories/${categoryA.id}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(categoryA.id);
    expect(res.body.data._count).toBeDefined();
  });

  // Test 6: PUT /api/v1/categories/:id - Update Category
  it('PUT /api/v1/categories/:id - should update category name and description', async () => {
    const res = await request(app)
      .put(`/api/v1/categories/${categoryA.id}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        name: 'Premium Hybrid Seeds',
        description: 'Updated description',
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Premium Hybrid Seeds');
  });

  // Test 7: IDOR Protection - Owner B accessing Shop A category should be rejected
  it('GET /api/v1/categories/:id - should reject access when user from another shop accesses category (IDOR Guard)', async () => {
    const res = await request(app)
      .get(`/api/v1/categories/${categoryA.id}`)
      .set('Authorization', `Bearer ${tokenOwnerB}`);

    expect(res.statusCode).toEqual(404); // Scoped out of Shop B
  });

  // Test 8: Role Restriction - BILLING_STAFF cannot create categories
  it('POST /api/v1/categories - should reject category creation by BILLING_STAFF with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${tokenStaffA}`)
      .send({
        name: 'Staff Unauthorized Category',
      });

    expect(res.statusCode).toEqual(403);
  });

  // Test 9: DELETE /api/v1/categories/:id - Delete Category
  it('DELETE /api/v1/categories/:id - should delete category safely', async () => {
    const res = await request(app)
      .delete(`/api/v1/categories/${categoryA.id}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
  });
});
