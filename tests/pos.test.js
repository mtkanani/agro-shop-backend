const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('Ultra-Low-Latency POS Scan & Keyset Catalogue Test Suite (SQL Native)', () => {
  let shopA, shopB;
  let ownerA, ownerB, staffA;
  let tokenOwnerA, tokenOwnerB, tokenStaffA;
  let categoryFertilizer, categoryPesticide, categoryShopB;
  let productUrea, productDAP, productCoragen, productOOS, productShopB;
  let batchUreaEarliest, batchUreaLater, batchUreaExpired, batchUreaDepleted;
  let batchDAP, batchCoragen;

  beforeAll(async () => {
    // 1. Create Shop A and Users
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Green Krishi POS Shop A',
        code: `POS_A_${Date.now()}`,
        mobile: `+919300${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Ramesh Owner POS A',
        email: `owner_pos_a_${Date.now()}@test.com`,
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
        fullName: 'Kishan Staff POS A',
        email: `staff_pos_a_${Date.now()}@test.com`,
        mobile: `+919310${String(Date.now()).slice(-6)}`,
        passwordHash: 'hash',
        role: 'BILLING_STAFF',
        status: 'ACTIVE',
      },
    });
    tokenStaffA = generateAccessToken(staffA);

    // 2. Create Shop B for Multi-Tenant Isolation
    shopB = await prisma.shop.create({
      data: {
        shopName: 'Kisan POS Shop B',
        code: `POS_B_${Date.now()}`,
        mobile: `+919400${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Dinesh Owner POS B',
        email: `owner_pos_b_${Date.now()}@test.com`,
        mobile: shopB.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);

    // 3. Categories
    categoryFertilizer = await prisma.category.create({
      data: {
        shopId: shopA.id,
        name: `Fertilizers_POS_${Date.now()}`,
      },
    });

    categoryPesticide = await prisma.category.create({
      data: {
        shopId: shopA.id,
        name: `Pesticides_POS_${Date.now()}`,
      },
    });

    categoryShopB = await prisma.category.create({
      data: {
        shopId: shopB.id,
        name: `ShopB_Cat_${Date.now()}`,
      },
    });

    // 4. Products in Shop A
    productUrea = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'IFFCO Neem Coated Urea 45kg',
        shortName: 'Urea 45kg',
        code: `AG-UREA-${Date.now().toString().slice(-4)}`,
        barcode: `890${Date.now().toString().slice(-10)}`,
        brand: 'IFFCO',
        categoryId: categoryFertilizer.id,
        uom: 'BAG',
        taxRate: 5,
        variants: {
          create: [{ variantName: '45kg Bag', sku: `SKU_U_${Date.now()}`, sellingPrice: 300, mrp: 300 }],
        },
      },
    });

    productDAP = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'IFFCO DAP 50kg',
        shortName: 'DAP 50kg',
        code: `AG-DAP-${Date.now().toString().slice(-4)}`,
        barcode: `891${Date.now().toString().slice(-10)}`,
        brand: 'IFFCO',
        categoryId: categoryFertilizer.id,
        uom: 'BAG',
        taxRate: 5,
        variants: {
          create: [{ variantName: '50kg Bag', sku: `SKU_D_${Date.now()}`, sellingPrice: 1350, mrp: 1400 }],
        },
      },
    });

    productCoragen = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'FMC Coragen 60ml',
        shortName: 'Coragen 60ml',
        code: `AG-CRG-${Date.now().toString().slice(-4)}`,
        barcode: `892${Date.now().toString().slice(-10)}`,
        brand: 'FMC',
        categoryId: categoryPesticide.id,
        uom: 'BOTTLE',
        taxRate: 18,
        variants: {
          create: [{ variantName: '60ml Bottle', sku: `SKU_C_${Date.now()}`, sellingPrice: 850, mrp: 950 }],
        },
      },
    });

    productOOS = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'Depleted Stock Item',
        code: `AG-OOS-${Date.now().toString().slice(-4)}`,
        barcode: `893${Date.now().toString().slice(-10)}`,
        categoryId: categoryFertilizer.id,
      },
    });

    // Product in Shop B
    productShopB = await prisma.product.create({
      data: {
        shopId: shopB.id,
        name: 'Shop B Private Chemical',
        code: `AG-SHB-${Date.now().toString().slice(-4)}`,
        barcode: `899${Date.now().toString().slice(-10)}`,
        categoryId: categoryShopB.id,
      },
    });

    // 5. Batches for Urea (Testing FIFO, Expired, and Depleted Filtering)
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

    const twelveMonthsLater = new Date();
    twelveMonthsLater.setMonth(twelveMonthsLater.getMonth() + 12);

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // Earliest active batch (FIFO target)
    batchUreaEarliest = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: productUrea.id,
        batchNumber: `BATCH_EARLY_${Date.now()}`,
        purchasePrice: 270,
        sellingPrice: 300,
        mrp: 300,
        quantity: 25,
        expiryDate: threeMonthsLater,
      },
    });

    // Later active batch
    batchUreaLater = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: productUrea.id,
        batchNumber: `BATCH_LATER_${Date.now()}`,
        purchasePrice: 275,
        sellingPrice: 310,
        mrp: 310,
        quantity: 50,
        expiryDate: twelveMonthsLater,
      },
    });

    // Expired batch (must be excluded from active selection)
    batchUreaExpired = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: productUrea.id,
        batchNumber: `BATCH_EXPIRED_${Date.now()}`,
        purchasePrice: 260,
        sellingPrice: 290,
        mrp: 300,
        quantity: 15,
        expiryDate: oneMonthAgo,
      },
    });

    // Zero-stock batch (must be excluded from active selection)
    batchUreaDepleted = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: productUrea.id,
        batchNumber: `BATCH_ZERO_${Date.now()}`,
        purchasePrice: 270,
        sellingPrice: 300,
        mrp: 300,
        quantity: 0,
        expiryDate: twelveMonthsLater,
      },
    });

    // Batches for DAP and Coragen
    batchDAP = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: productDAP.id,
        batchNumber: `BATCH_DAP_${Date.now()}`,
        purchasePrice: 1250,
        sellingPrice: 1350,
        mrp: 1400,
        quantity: 40,
        expiryDate: twelveMonthsLater,
      },
    });

    batchCoragen = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: productCoragen.id,
        batchNumber: `BATCH_CRG_${Date.now()}`,
        purchasePrice: 750,
        sellingPrice: 850,
        mrp: 950,
        quantity: 20,
        expiryDate: twelveMonthsLater,
      },
    });
  });

  afterAll(async () => {
    const batchIds = [
      batchUreaEarliest?.id,
      batchUreaLater?.id,
      batchUreaExpired?.id,
      batchUreaDepleted?.id,
      batchDAP?.id,
      batchCoragen?.id,
    ].filter(Boolean);
    if (batchIds.length > 0) {
      await prisma.inventoryBatch.deleteMany({ where: { id: { in: batchIds } } });
    }

    const productIds = [
      productUrea?.id,
      productDAP?.id,
      productCoragen?.id,
      productOOS?.id,
      productShopB?.id,
    ].filter(Boolean);
    if (productIds.length > 0) {
      await prisma.productVariant.deleteMany({ where: { productId: { in: productIds } } });
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    }

    const categoryIds = [categoryFertilizer?.id, categoryPesticide?.id, categoryShopB?.id].filter(Boolean);
    if (categoryIds.length > 0) {
      await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
    }

    const userIds = [ownerA?.id, staffA?.id, ownerB?.id].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    const shopIds = [shopA?.id, shopB?.id].filter(Boolean);
    if (shopIds.length > 0) {
      await prisma.shop.deleteMany({ where: { id: { in: shopIds } } });
    }
  });

  describe('1. Single-Scan Fast Lookup (GET /api/pos/scan)', () => {
    it('should perform instantaneous O(1) scan via barcode and pre-select FIFO earliest batch', async () => {
      const res = await request(app)
        .get(`/api/pos/scan?code=${productUrea.barcode}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      const prod = res.body.data;
      expect(prod.id).toEqual(productUrea.id);
      expect(prod.name).toEqual('IFFCO Neem Coated Urea 45kg');
      expect(prod.barcode).toEqual(productUrea.barcode);
      expect(prod.brand).toEqual('IFFCO');
      expect(prod.outOfStock).toBe(false);

      // FIFO Batch Selection: Must choose batchUreaEarliest (3 months expiry)
      expect(prod.selectedBatch).toBeDefined();
      expect(prod.selectedBatch.batchNumber).toEqual(batchUreaEarliest.batchNumber);
      expect(prod.selectedBatch.sellingPrice).toEqual(300);
      expect(prod.selectedBatch.availableStock).toEqual(25);

      // Validates only active, non-expired, positive-stock batches are included (2 batches: earliest + later)
      expect(prod.activeBatchesCount).toEqual(2);
      expect(prod.totalActiveStock).toEqual(75); // 25 + 50
      const batchNumbers = prod.allActiveBatches.map((b) => b.batchNumber);
      expect(batchNumbers).toContain(batchUreaEarliest.batchNumber);
      expect(batchNumbers).toContain(batchUreaLater.batchNumber);
      expect(batchNumbers).not.toContain(batchUreaExpired.batchNumber);
      expect(batchNumbers).not.toContain(batchUreaDepleted.batchNumber);
    });

    it('should perform scan lookup via product code (e.g. AG-UREA-XXXX)', async () => {
      const res = await request(app)
        .get(`/api/pos/scan?code=${productUrea.code}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.id).toEqual(productUrea.id);
      expect(res.body.data.selectedBatch.batchNumber).toEqual(batchUreaEarliest.batchNumber);
    });

    it('should resolve scan on /api/v1/pos/scan route alias', async () => {
      const res = await request(app)
        .get(`/api/v1/pos/scan?code=${productDAP.barcode}`)
        .set('Authorization', `Bearer ${tokenStaffA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.id).toEqual(productDAP.id);
      expect(res.body.data.selectedBatch.batchNumber).toEqual(batchDAP.batchNumber);
      expect(res.body.data.selectedBatch.sellingPrice).toEqual(1350);
    });

    it('should return 200 with outOfStock: true when scanning product with zero active inventory', async () => {
      const res = await request(app)
        .get(`/api/pos/scan?code=${productOOS.barcode}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.id).toEqual(productOOS.id);
      expect(res.body.data.outOfStock).toBe(true);
      expect(res.body.data.selectedBatch).toBeNull();
      expect(res.body.data.totalActiveStock).toEqual(0);
    });

    it('should return 404 when scanning non-existent barcode', async () => {
      const res = await request(app)
        .get('/api/pos/scan?code=9999999999999')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 Bad Request when "code" parameter is missing', async () => {
      const res = await request(app)
        .get('/api/pos/scan')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('should enforce multi-tenant isolation (Shop A user cannot scan Shop B product)', async () => {
      const res = await request(app)
        .get(`/api/pos/scan?code=${productShopB.barcode}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(404);
    });

    it('should reject unauthenticated scan request with 401', async () => {
      const res = await request(app).get(`/api/pos/scan?code=${productUrea.barcode}`);
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('2. Counter Catalogue Generation (GET /api/pos/catalogue)', () => {
    it('should return paginated catalogue with Keyset metadata and active price', async () => {
      const res = await request(app)
        .get('/api/pos/catalogue?limit=2')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.catalogue.length).toEqual(2);
      expect(data.pagination.limit).toEqual(2);
      expect(data.pagination.totalCount).toBeGreaterThanOrEqual(4);
      expect(data.pagination.hasNextPage).toBe(true);
      expect(data.pagination.nextCursor).toBeDefined();

      // Check item projection
      const firstItem = data.catalogue[0];
      expect(firstItem.id).toBeDefined();
      expect(firstItem.name).toBeDefined();
      expect(firstItem.code).toBeDefined();
      expect(firstItem.qrPayload).toBeDefined();
      expect(firstItem.price).toBeGreaterThanOrEqual(0);
    });

    it('should seek next page via cursor in O(log N) without record overlap', async () => {
      // 1. Fetch Page 1
      const page1Res = await request(app)
        .get('/api/pos/catalogue?limit=2')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      const page1Ids = page1Res.body.data.catalogue.map((p) => p.id);
      const cursor = page1Res.body.data.pagination.nextCursor;
      expect(cursor).toBeDefined();

      // 2. Fetch Page 2 using cursor
      const page2Res = await request(app)
        .get(`/api/pos/catalogue?cursor=${cursor}&limit=2`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(page2Res.statusCode).toEqual(200);
      const page2Ids = page2Res.body.data.catalogue.map((p) => p.id);
      expect(page2Ids.length).toBeGreaterThanOrEqual(1);

      // Verify no duplicate IDs between Page 1 and Page 2
      const intersection = page1Ids.filter((id) => page2Ids.includes(id));
      expect(intersection.length).toEqual(0);
    });

    it('should filter catalogue by categoryId', async () => {
      const res = await request(app)
        .get(`/api/pos/catalogue?categoryId=${categoryPesticide.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.catalogue.length).toEqual(1);
      expect(res.body.data.catalogue[0].id).toEqual(productCoragen.id);
      expect(res.body.data.catalogue[0].category).toEqual(categoryPesticide.name);
    });

    it('should support offset pagination fallback when page is passed without cursor', async () => {
      const res = await request(app)
        .get('/api/pos/catalogue?page=1&limit=2')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.catalogue.length).toEqual(2);
    });
  });
});
