const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');
const { logAuditAction, sanitizeData } = require('../src/modules/audit-logs/audit.service');

describe('Audit Log + Security Finalization Test Suite', () => {
  let shopA, shopB;
  let ownerA, staffA, ownerB;
  let tokenOwnerA, tokenStaffA, tokenOwnerB;

  beforeAll(async () => {
    // 1. Create Shop A with OWNER A and STAFF A
    shopA = await prisma.shop.create({
      data: {
        shopName: `Audit Test Shop A ${Date.now()}`,
        code: `ATSA_${Date.now()}`,
        mobile: `+919901${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Owner Audit A',
        email: `owner_audit_a_${Date.now()}@shop.com`,
        mobile: shopA.mobile,
        passwordHash: 'secret_hash_value',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerA = generateAccessToken(ownerA);

    staffA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Staff Audit A',
        email: `staff_audit_a_${Date.now()}@shop.com`,
        mobile: `+919902${String(Date.now()).slice(-6)}`,
        passwordHash: 'secret_hash_value',
        role: 'BILLING_STAFF',
        status: 'ACTIVE',
      },
    });
    tokenStaffA = generateAccessToken(staffA);

    // 2. Create Shop B with OWNER B
    shopB = await prisma.shop.create({
      data: {
        shopName: `Audit Test Shop B ${Date.now()}`,
        code: `ATSB_${Date.now()}`,
        mobile: `+919903${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Owner Audit B',
        email: `owner_audit_b_${Date.now()}@shop.com`,
        mobile: shopB.mobile,
        passwordHash: 'secret_hash_value',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);
  });

  // Test 1: Sensitive Data Masking Guard
  it('sanitizeData - should mask passwords, OTPs, and secret keys in log values', () => {
    const sensitivePayload = {
      user: 'ramesh',
      password: 'MySecretPassword123',
      otp: '123456',
      token: 'jwt_token_secret',
      module: 'SECURITY',
    };

    const sanitizedStr = sanitizeData(sensitivePayload);
    expect(sanitizedStr).not.toContain('MySecretPassword123');
    expect(sanitizedStr).not.toContain('123456');
    expect(sanitizedStr).toContain('[REDACTED_SENSITIVE_DATA]');
  });

  // Test 2: Audit Action Logging & Retrieval
  it('GET /api/v1/audit-logs - should retrieve recorded audit log history for shop owner', async () => {
    // Log a test action
    await logAuditAction({
      userId: ownerA.id,
      shopId: shopA.id,
      module: 'SECURITY',
      action: 'PASSWORD_CHANGED',
      recordId: ownerA.id,
      newValue: { status: 'SUCCESS' },
    });

    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].module).toEqual('SECURITY');
  });

  // Test 3: Audit Log Details API
  it('GET /api/v1/audit-logs/:id - should return detailed audit log record', async () => {
    const listRes = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    const logId = listRes.body.data[0].id;

    const detailRes = await request(app)
      .get(`/api/v1/audit-logs/${logId}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(detailRes.statusCode).toEqual(200);
    expect(detailRes.body.data.id).toEqual(logId);
    expect(detailRes.body.data.user.fullName).toEqual('Owner Audit A');
  });

  // Test 4: Unauthenticated Request Guard
  it('GET /api/v1/audit-logs - should return 401 Unauthorized when requested without Bearer token', async () => {
    const res = await request(app).get('/api/v1/audit-logs');
    expect(res.statusCode).toEqual(401);
  });

  // Test 5: RBAC Protection - Staff cannot view audit logs
  it('GET /api/v1/audit-logs - should return 403 Forbidden for Staff role', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${tokenStaffA}`);

    expect(res.statusCode).toEqual(403);
  });

  // Test 6: Multi-Tenant Security Isolation Guard
  it('GET /api/v1/audit-logs - Shop B should not see Shop A audit logs', async () => {
    const resB = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${tokenOwnerB}`);

    expect(resB.statusCode).toEqual(200);
    expect(resB.body.data.length).toEqual(0);
  });
});
