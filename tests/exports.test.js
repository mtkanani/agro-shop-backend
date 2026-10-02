const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('Export + Backup Management Module Test Suite', () => {
  let shopA, shopB;
  let ownerA, staffA, ownerB;
  let tokenOwnerA, tokenStaffA, tokenOwnerB;
  let farmerA, categoryA, productA;

  beforeAll(async () => {
    // 1. Create Shop A with OWNER A and STAFF A
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Exports Test Shop A',
        code: `ETSA_${Date.now()}`,
        mobile: `+919930${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Owner Exports A',
        email: `owner_exports_a_${Date.now()}@shop.com`,
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
        fullName: 'Staff Exports A',
        email: `staff_exports_a_${Date.now()}@shop.com`,
        mobile: `+919931${String(Date.now()).slice(-6)}`,
        passwordHash: 'secret_hash_value',
        role: 'BILLING_STAFF',
        status: 'ACTIVE',
      },
    });
    tokenStaffA = generateAccessToken(staffA);

    farmerA = await prisma.farmer.create({
      data: {
        shopId: shopA.id,
        name: 'Ramesh Export Farmer',
        phone: `+919932${String(Date.now()).slice(-6)}`,
        village: 'Kheda',
        khataBalance: 1500,
      },
    });

    categoryA = await prisma.category.create({
      data: {
        shopId: shopA.id,
        name: `Export Seeds Test ${Date.now()}`,
      },
    });

    productA = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: `Wheat Seeds Export ${Date.now()}`,
        code: `PROD_EX_${Date.now()}`,
        categoryId: categoryA.id,
      },
    });

    // 2. Create Shop B with OWNER B
    shopB = await prisma.shop.create({
      data: {
        shopName: 'Exports Test Shop B',
        code: `ETSB_${Date.now()}`,
        mobile: `+919940${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Owner Exports B',
        email: `owner_exports_b_${Date.now()}@shop.com`,
        mobile: shopB.mobile,
        passwordHash: 'secret_hash_value',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);
  });

  // Test 1: Data Export (Sales & Farmers CSV/JSON)
  it('POST /api/v1/exports - should generate CSV data export file and record ExportLog', async () => {
    const res = await request(app)
      .post('/api/v1/exports')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({ type: 'FARMERS', format: 'CSV' });

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toEqual('FARMERS');
    expect(res.body.data.format).toEqual('CSV');
    expect(res.body.data.fileName).toMatch(/\.csv$/);
  });

  // Test 2: Get Export History and Download Export File
  it('GET /api/v1/exports & /download - should list export history and allow file download', async () => {
    const listRes = await request(app)
      .get('/api/v1/exports')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(listRes.statusCode).toEqual(200);
    expect(listRes.body.data.length).toBeGreaterThan(0);

    const exportId = listRes.body.data[0].id;

    const downloadRes = await request(app)
      .get(`/api/v1/exports/${exportId}/download`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(downloadRes.statusCode).toEqual(200);
    expect(downloadRes.headers['content-disposition']).toMatch(/attachment; filename=/);
  });

  // Test 3: Create Logical JSON Backup
  it('POST /api/v1/backups - should create structured logical shop database backup file', async () => {
    const res = await request(app)
      .post('/api/v1/backups')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toEqual('LOGICAL_JSON');
    expect(res.body.data.fileName).toMatch(/\.json$/);
  });

  // Test 4: Download Backup File & List History
  it('GET /api/v1/backups & /download - should list backup history and support backup file download', async () => {
    const listRes = await request(app)
      .get('/api/v1/backups')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(listRes.statusCode).toEqual(200);
    expect(listRes.body.data.length).toBeGreaterThan(0);

    const backupId = listRes.body.data[0].id;

    const downloadRes = await request(app)
      .get(`/api/v1/backups/${backupId}/download`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(downloadRes.statusCode).toEqual(200);
    expect(downloadRes.text).toContain('Agro Shop Management System');
    expect(downloadRes.text).not.toContain('secret_hash_value'); // Sensitive security protection check
  });

  // Test 5: Controlled Backup Safety Restore
  it('POST /api/v1/backups/:id/restore - should execute controlled backup restore with automatic pre-restore safety snapshot', async () => {
    const listRes = await request(app)
      .get('/api/v1/backups')
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    const backupId = listRes.body.data[0].id;

    const restoreRes = await request(app)
      .post(`/api/v1/backups/${backupId}/restore`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);

    expect(restoreRes.statusCode).toEqual(200);
    expect(restoreRes.body.success).toBe(true);
    expect(restoreRes.body.data.message).toMatch(/safety restored/);
  });

  // Test 6: RBAC Protection - Staff cannot trigger backup creation
  it('POST /api/v1/backups - should return 403 Forbidden for Staff attempting backup creation', async () => {
    const res = await request(app)
      .post('/api/v1/backups')
      .set('Authorization', `Bearer ${tokenStaffA}`);

    expect(res.statusCode).toEqual(403);
  });

  // Test 7: Multi-Tenant Security Isolation
  it('GET /api/v1/exports - Shop B should not see Shop A exports or backups', async () => {
    const exportsB = await request(app)
      .get('/api/v1/exports')
      .set('Authorization', `Bearer ${tokenOwnerB}`);

    expect(exportsB.statusCode).toEqual(200);
    expect(exportsB.body.data.length).toEqual(0);

    const backupsB = await request(app)
      .get('/api/v1/backups')
      .set('Authorization', `Bearer ${tokenOwnerB}`);

    expect(backupsB.statusCode).toEqual(200);
    expect(backupsB.body.data.length).toEqual(0);
  });
});
