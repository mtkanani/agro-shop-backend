const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('2-Step Registration, Hashed OTP Verification & Shop Creation Suite', () => {
  const regEmail = `test_reg_${Date.now()}@agrocare.com`;
  const regMobile = `+9199${String(Date.now()).slice(-8)}`;
  let verificationId;
  let sentOtp;

  // Test 1: Valid Registration (Initiate Step 1)
  it('POST /api/v1/auth/register - should initiate registration and send OTP without creating User or Shop', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        shopName: 'Agro Care Store Test',
        fullName: 'Ramesh Patel Test',
        mobile: regMobile,
        email: regEmail,
        password: 'Owner@123',
        confirmPassword: 'Owner@123',
        address: 'Main Market Road',
        villageCity: 'Nagpur',
        state: 'Maharashtra',
        pincode: '440001',
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verificationId).toBeDefined();
    expect(res.body.data.otp).toBeDefined(); // Returned in dev mode

    verificationId = res.body.data.verificationId;
    sentOtp = res.body.data.otp;

    // Verify NO User or Shop exists yet
    const userInDb = await prisma.user.findFirst({ where: { email: regEmail } });
    const shopInDb = await prisma.shop.findFirst({ where: { email: regEmail } });
    expect(userInDb).toBeNull();
    expect(shopInDb).toBeNull();
  });

  // Test 7: Duplicate Email Check (409 Conflict)
  it('POST /api/v1/auth/register - should return 409 Conflict if email is already registered', async () => {
    // Create an active user first
    const existingEmail = `exist_${Date.now()}@agro.com`;
    const shop = await prisma.shop.create({
      data: { shopName: 'Dup Shop', mobile: `+9198${String(Date.now()).slice(-8)}`, email: existingEmail },
    });
    await prisma.user.create({
      data: { shopId: shop.id, fullName: 'Existing User', email: existingEmail, mobile: shop.mobile, passwordHash: 'hash', role: 'OWNER' },
    });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        shopName: 'Another Store',
        fullName: 'Another Owner',
        mobile: `+9197${String(Date.now()).slice(-8)}`,
        email: existingEmail,
        password: 'Owner@123',
        confirmPassword: 'Owner@123',
      });

    expect(res.statusCode).toEqual(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('already registered');
  });

  // Test 3: Incorrect OTP Verification
  it('POST /api/v1/auth/register/verify-otp - should fail when incorrect OTP is entered', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register/verify-otp')
      .send({
        verificationId,
        otp: '000000',
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_OTP');
  });

  // Test 5: Resend OTP
  it('POST /api/v1/auth/register/resend-otp - should invalidate old OTP and send new OTP', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register/resend-otp')
      .send({
        verificationId,
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.otp).toBeDefined();

    // Update sentOtp to newly resent OTP
    sentOtp = res.body.data.otp;
  });

  // Test 2: Correct OTP Verification (Step 2 - Atomic Shop + OWNER Creation + JWT)
  it('POST /api/v1/auth/register/verify-otp - should verify OTP, create Shop + OWNER User atomically, and return JWT tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register/verify-otp')
      .send({
        verificationId,
        otp: sentOtp,
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('OWNER');
    expect(res.body.data.shop.status).toBe('ACTIVE');
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();

    // Verify User linked to Shop in database
    const userInDb = await prisma.user.findFirst({ where: { email: regEmail } });
    expect(userInDb).not.toBeNull();
    expect(userInDb.shopId).toBe(res.body.data.shop.id);
  });

  // Test 11: Login After Verification
  it('POST /api/v1/auth/login - should allow login after registration verification', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: regEmail,
        password: 'Owner@123',
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('OWNER');
    expect(res.body.data.accessToken).toBeDefined();
  });
});

describe('Product Variants & Inventory Test Suite', () => {
  let shopA;
  let ownerA;
  let ownerAToken;
  let categoryA;
  let createdProduct;
  let variant1;

  beforeAll(async () => {
    // 1. Create Shop A
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Agro Shop A Inventory',
        code: `SAI_${Date.now()}`,
        mobile: `+919700${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    // 2. Create OWNER in Shop A
    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Owner Inventory',
        email: `owner_inv_${Date.now()}@shopa.com`,
        mobile: `+919800${String(Date.now()).slice(-6)}`,
        passwordHash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    ownerAToken = generateAccessToken(ownerA);

    // 3. Create Category
    categoryA = await prisma.category.create({
      data: {
        shopId: shopA.id,
        name: `Fertilizers_${Date.now()}`,
      },
    });
  });

  it('POST /api/v1/products - should create product with multiple variants', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({
        name: 'Urea Fertilizer Premium',
        shortName: 'Urea Premium',
        code: `UREA_${Date.now()}`,
        categoryId: categoryA.id,
        uom: 'KG',
        taxRate: 5,
        minStock: 10,
        variants: [
          { variantName: '1 KG', purchasePrice: 40, mrp: 60, sellingPrice: 50 },
          { variantName: '5 KG', purchasePrice: 180, mrp: 260, sellingPrice: 220 },
        ],
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.variants.length).toBe(2);

    createdProduct = res.body.data;
    variant1 = createdProduct.variants[0];
  });
});
