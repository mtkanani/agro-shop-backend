const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');

describe('Sales History Module Test Suite', () => {
  let shopA, shopB;
  let ownerA, ownerB, staffA;
  let tokenOwnerA, tokenOwnerB, tokenStaffA;
  let farmerA, farmerB;
  let categoryFertilizer, categoryPesticide;
  let productUrea, productDAP, productCoragen;
  let batchUrea, batchDAP, batchCoragen;
  let invoice1, invoice2, invoice3, invoiceShopB;

  beforeAll(async () => {
    // 1. Create Shop A
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Green Krishi Kendra A',
        code: `SH_A_${Date.now()}`,
        mobile: `+919100${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Rajesh Owner A',
        email: `owner_sh_a_${Date.now()}@test.com`,
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
        fullName: 'Mahesh Staff A',
        email: `staff_sh_a_${Date.now()}@test.com`,
        mobile: `+919110${String(Date.now()).slice(-6)}`,
        passwordHash: 'hash',
        role: 'BILLING_STAFF',
        status: 'ACTIVE',
      },
    });
    tokenStaffA = generateAccessToken(staffA);

    // 2. Create Shop B for Multi-Tenant Isolation Testing
    shopB = await prisma.shop.create({
      data: {
        shopName: 'Kisan Seva Kendra B',
        code: `SH_B_${Date.now()}`,
        mobile: `+919200${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
      },
    });

    ownerB = await prisma.user.create({
      data: {
        shopId: shopB.id,
        fullName: 'Suresh Owner B',
        email: `owner_sh_b_${Date.now()}@test.com`,
        mobile: shopB.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    tokenOwnerB = generateAccessToken(ownerB);

    // 3. Farmers
    farmerA = await prisma.farmer.create({
      data: {
        shopId: shopA.id,
        name: 'Bharat Patel',
        phone: `+91981${String(Date.now()).slice(-7)}`,
        village: 'Navagadh',
        khataBalance: 2500,
      },
    });

    farmerB = await prisma.farmer.create({
      data: {
        shopId: shopB.id,
        name: 'Dinesh ShopB Farmer',
        phone: `+91982${String(Date.now()).slice(-7)}`,
        village: 'Jetpur',
      },
    });

    // 4. Categories
    categoryFertilizer = await prisma.category.create({
      data: {
        shopId: shopA.id,
        name: `Fertilizers_${Date.now()}`,
      },
    });

    categoryPesticide = await prisma.category.create({
      data: {
        shopId: shopA.id,
        name: `Pesticides_${Date.now()}`,
      },
    });

    // 5. Products
    productUrea = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'IFFCO Urea 45kg',
        code: `UREA_${Date.now()}`,
        categoryId: categoryFertilizer.id,
        uom: 'BAG',
        variants: {
          create: [{ variantName: '45kg Bag', sku: `SKU_UREA_${Date.now()}`, sellingPrice: 300, mrp: 300 }],
        },
      },
    });

    productDAP = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'IFFCO DAP 50kg',
        code: `DAP_${Date.now()}`,
        categoryId: categoryFertilizer.id,
        uom: 'BAG',
        variants: {
          create: [{ variantName: '50kg Bag', sku: `SKU_DAP_${Date.now()}`, sellingPrice: 1350, mrp: 1400 }],
        },
      },
    });

    productCoragen = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'FMC Coragen 60ml',
        code: `CORAGEN_${Date.now()}`,
        categoryId: categoryPesticide.id,
        uom: 'BOTTLE',
        variants: {
          create: [{ variantName: '60ml Bottle', sku: `SKU_CRG_${Date.now()}`, sellingPrice: 850, mrp: 950 }],
        },
      },
    });

    // 6. Batches
    const futureExpiry = new Date();
    futureExpiry.setFullYear(futureExpiry.getFullYear() + 2);

    batchUrea = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: productUrea.id,
        batchNumber: `BATCH_UREA_${Date.now()}`,
        purchasePrice: 270,
        sellingPrice: 300,
        mrp: 300,
        quantity: 100,
        expiryDate: futureExpiry,
      },
    });

    batchDAP = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: productDAP.id,
        batchNumber: `BATCH_DAP_${Date.now()}`,
        purchasePrice: 1250,
        sellingPrice: 1350,
        mrp: 1400,
        quantity: 50,
        expiryDate: futureExpiry,
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
        quantity: 30,
        expiryDate: futureExpiry,
      },
    });

    // 7. Invoices in Shop A
    // Invoice 1: Bharat Patel, CASH, PAID, Urea + DAP
    invoice1 = await prisma.invoice.create({
      data: {
        shopId: shopA.id,
        invoiceNumber: `INV-2026-0001_${Date.now()}`,
        farmerId: farmerA.id,
        userId: staffA.id,
        subTotal: 3000,
        taxAmount: 150,
        discount: 150,
        totalAmount: 3000,
        paidAmount: 3000,
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        notes: 'Pre-monsoon season buy',
        items: {
          create: [
            {
              productId: productUrea.id,
              batchId: batchUrea.id,
              quantity: 5,
              unitPrice: 300,
              totalPrice: 1500,
            },
            {
              productId: productDAP.id,
              batchId: batchDAP.id,
              quantity: 1,
              unitPrice: 1350,
              totalPrice: 1350,
            },
          ],
        },
      },
    });

    // Invoice 2: Bharat Patel, UPI, PARTIAL, Coragen
    invoice2 = await prisma.invoice.create({
      data: {
        shopId: shopA.id,
        invoiceNumber: `INV-2026-0002_${Date.now()}`,
        farmerId: farmerA.id,
        userId: ownerA.id,
        subTotal: 1700,
        taxAmount: 85,
        discount: 0,
        totalAmount: 1785,
        paidAmount: 1000,
        paymentStatus: 'PARTIAL',
        paymentMethod: 'UPI',
        notes: 'Pest attack urgent purchase',
        items: {
          create: [
            {
              productId: productCoragen.id,
              batchId: batchCoragen.id,
              quantity: 2,
              unitPrice: 850,
              totalPrice: 1700,
            },
          ],
        },
      },
    });

    // Invoice 3: Walk-in customer, CASH, UNPAID, Urea
    invoice3 = await prisma.invoice.create({
      data: {
        shopId: shopA.id,
        invoiceNumber: `INV-2026-0003_${Date.now()}`,
        userId: staffA.id,
        subTotal: 600,
        taxAmount: 0,
        discount: 0,
        totalAmount: 600,
        paidAmount: 0,
        paymentStatus: 'UNPAID',
        paymentMethod: 'KHATA',
        items: {
          create: [
            {
              productId: productUrea.id,
              batchId: batchUrea.id,
              quantity: 2,
              unitPrice: 300,
              totalPrice: 600,
            },
          ],
        },
      },
    });

    // Invoice in Shop B (For Isolation Testing)
    invoiceShopB = await prisma.invoice.create({
      data: {
        shopId: shopB.id,
        invoiceNumber: `INV-SHB-0001_${Date.now()}`,
        farmerId: farmerB.id,
        userId: ownerB.id,
        subTotal: 5000,
        taxAmount: 250,
        discount: 0,
        totalAmount: 5250,
        paidAmount: 5250,
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
      },
    });
  });

  afterAll(async () => {
    // Delete in reverse relational order
    const invoiceIds = [invoice1?.id, invoice2?.id, invoice3?.id, invoiceShopB?.id].filter(Boolean);
    if (invoiceIds.length > 0) {
      await prisma.invoiceItem.deleteMany({
        where: { invoiceId: { in: invoiceIds } },
      });
      await prisma.invoice.deleteMany({
        where: { id: { in: invoiceIds } },
      });
    }
    const batchIds = [batchUrea?.id, batchDAP?.id, batchCoragen?.id].filter(Boolean);
    if (batchIds.length > 0) {
      await prisma.inventoryBatch.deleteMany({
        where: { id: { in: batchIds } },
      });
    }
    const productIds = [productUrea?.id, productDAP?.id, productCoragen?.id].filter(Boolean);
    if (productIds.length > 0) {
      await prisma.productVariant.deleteMany({
        where: { productId: { in: productIds } },
      });
      await prisma.product.deleteMany({
        where: { id: { in: productIds } },
      });
    }
    const categoryIds = [categoryFertilizer?.id, categoryPesticide?.id].filter(Boolean);
    if (categoryIds.length > 0) {
      await prisma.category.deleteMany({
        where: { id: { in: categoryIds } },
      });
    }
    const farmerIds = [farmerA?.id, farmerB?.id].filter(Boolean);
    if (farmerIds.length > 0) {
      await prisma.farmer.deleteMany({
        where: { id: { in: farmerIds } },
      });
    }
    const userIds = [ownerA?.id, staffA?.id, ownerB?.id].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
    const shopIds = [shopA?.id, shopB?.id].filter(Boolean);
    if (shopIds.length > 0) {
      await prisma.shop.deleteMany({
        where: { id: { in: shopIds } },
      });
    }
  });

  describe('1. GET /api/v1/sales-history - Listing & Multi-Tenant Isolation', () => {
    it('should return paginated sales history for Shop A with enriched fields', async () => {
      const res = await request(app)
        .get('/api/v1/sales-history?page=1&limit=10')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);

      // Verify enriched fields
      const inv = res.body.data.find((item) => item.id === invoice1.id);
      expect(inv).toBeDefined();
      expect(inv.farmer.name).toEqual('Bharat Patel');
      expect(inv.balanceDue).toEqual(0);
      expect(inv.totalItemsCount).toEqual(6); // 5 + 1
      expect(inv.productSummary.length).toBeGreaterThan(0);
      expect(inv.cashier.name).toEqual('Mahesh Staff A');

      // Verify pagination
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toEqual(1);
      expect(res.body.pagination.totalRecords).toBeGreaterThanOrEqual(3);
    });

    it('should enforce multi-tenant isolation (Shop A cannot see Shop B sales)', async () => {
      const res = await request(app)
        .get('/api/v1/sales-history')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      const invoiceIds = res.body.data.map((inv) => inv.id);
      expect(invoiceIds).not.toContain(invoiceShopB.id);
    });

    it('should allow BILLING_STAFF to view sales history', async () => {
      const res = await request(app)
        .get('/api/v1/sales-history')
        .set('Authorization', `Bearer ${tokenStaffA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('2. Multi-Dimensional Filtering', () => {
    it('should filter by paymentStatus=PARTIAL', async () => {
      const res = await request(app)
        .get('/api/v1/sales-history?paymentStatus=PARTIAL')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toEqual(1);
      expect(res.body.data[0].id).toEqual(invoice2.id);
      expect(res.body.data[0].paymentStatus).toEqual('PARTIAL');
      expect(res.body.data[0].balanceDue).toEqual(785);
    });

    it('should filter by paymentMethod=UPI', async () => {
      const res = await request(app)
        .get('/api/v1/sales-history?paymentMethod=UPI')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toEqual(1);
      expect(res.body.data[0].id).toEqual(invoice2.id);
    });

    it('should filter by farmerId', async () => {
      const res = await request(app)
        .get(`/api/v1/sales-history?farmerId=${farmerA.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toEqual(2); // invoice1 and invoice2
      expect(res.body.data.every((inv) => inv.farmer.id === farmerA.id)).toBe(true);
    });

    it('should filter by categoryId (Pesticides)', async () => {
      const res = await request(app)
        .get(`/api/v1/sales-history?categoryId=${categoryPesticide.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toEqual(1);
      expect(res.body.data[0].id).toEqual(invoice2.id);
    });

    it('should filter by batchNumber', async () => {
      const res = await request(app)
        .get(`/api/v1/sales-history?batchNumber=${batchDAP.batchNumber}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toEqual(1);
      expect(res.body.data[0].id).toEqual(invoice1.id);
    });

    it('should filter by minAmount and maxAmount', async () => {
      const res = await request(app)
        .get('/api/v1/sales-history?minAmount=1000&maxAmount=2000')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toEqual(1);
      expect(res.body.data[0].id).toEqual(invoice2.id);
    });

    it('should search by invoiceNumber keyword', async () => {
      const term = invoice1.invoiceNumber.slice(0, 12);
      const res = await request(app)
        .get(`/api/v1/sales-history?search=${term}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.some((inv) => inv.id === invoice1.id)).toBe(true);
    });

    it('should filter by timeframe=TODAY', async () => {
      const res = await request(app)
        .get('/api/v1/sales-history?timeframe=TODAY')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('3. GET /api/v1/sales-history/metrics - Aggregation Engine', () => {
    it('should calculate accurate metrics for matching sales in PostgreSQL', async () => {
      const res = await request(app)
        .get('/api/v1/sales-history/metrics')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      const summary = res.body.data.summary;
      expect(summary.totalInvoices).toBeGreaterThanOrEqual(3);
      expect(summary.totalGrossRevenue).toBeGreaterThanOrEqual(5385); // 3000 + 1785 + 600
      expect(summary.totalPaidAmount).toBeGreaterThanOrEqual(4000); // 3000 + 1000 + 0
      expect(summary.totalDueAmount).toBeGreaterThanOrEqual(1385);
      expect(summary.averageOrderValue).toBeGreaterThan(0);

      // Payment method breakdown
      expect(Array.isArray(res.body.data.paymentMethodsBreakdown)).toBe(true);
      const cashEntry = res.body.data.paymentMethodsBreakdown.find((b) => b.method === 'CASH');
      expect(cashEntry).toBeDefined();
      expect(cashEntry.amount).toBeGreaterThanOrEqual(3000);

      // Payment status breakdown
      expect(Array.isArray(res.body.data.paymentStatusBreakdown)).toBe(true);
      const partialEntry = res.body.data.paymentStatusBreakdown.find((b) => b.status === 'PARTIAL');
      expect(partialEntry).toBeDefined();
      expect(partialEntry.count).toEqual(1);
    });
  });

  describe('4. GET /api/v1/sales-history/items - Item-Level Traceability', () => {
    it('should return itemized sales ledger with batch and customer details', async () => {
      const res = await request(app)
        .get('/api/v1/sales-history/items?page=1&limit=10')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const ureaItem = res.body.data.find((it) => it.productId === productUrea.id);
      expect(ureaItem).toBeDefined();
      expect(ureaItem.productName).toEqual('IFFCO Urea 45kg');
      expect(ureaItem.batchNumber).toEqual(batchUrea.batchNumber);
      expect(ureaItem.farmerName).toBeDefined();
      expect(ureaItem.totalPrice).toBeDefined();
    });

    it('should filter itemized sales by categoryId', async () => {
      const res = await request(app)
        .get(`/api/v1/sales-history/items?categoryId=${categoryPesticide.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toEqual(1);
      expect(res.body.data[0].productId).toEqual(productCoragen.id);
      expect(res.body.data[0].batchNumber).toEqual(batchCoragen.batchNumber);
    });
  });

  describe('5. GET /api/v1/sales-history/farmers/:farmerId - Farmer Buying Profile', () => {
    it('should return lifetime purchasing profile and top products for Bharat Patel', async () => {
      const res = await request(app)
        .get(`/api/v1/sales-history/farmers/${farmerA.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.farmer.name).toEqual('Bharat Patel');
      expect(res.body.data.farmer.village).toEqual('Navagadh');

      // Lifetime metrics
      const lm = res.body.data.lifetimeMetrics;
      expect(lm.totalPurchasesCount).toEqual(2);
      expect(lm.lifetimeSpend).toEqual(4785); // 3000 + 1785
      expect(lm.lifetimePaid).toEqual(4000);
      expect(lm.lifetimeOutstandingDue).toEqual(785);

      // Top purchased products
      expect(Array.isArray(res.body.data.topPurchasedProducts)).toBe(true);
      expect(res.body.data.topPurchasedProducts.length).toBeGreaterThan(0);
      const topUrea = res.body.data.topPurchasedProducts.find((p) => p.productId === productUrea.id);
      expect(topUrea.totalQuantityPurchased).toEqual(5);

      // Invoices list
      expect(res.body.data.purchases.invoices.length).toEqual(2);
    });

    it('should return 404 if farmer belongs to another shop (IDOR Protection)', async () => {
      const res = await request(app)
        .get(`/api/v1/sales-history/farmers/${farmerB.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('6. GET /api/v1/sales-history/:id - Deep 360° Historical Sale Detail', () => {
    it('should return complete invoice details with items, batches, and summary', async () => {
      const res = await request(app)
        .get(`/api/v1/sales-history/${invoice1.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toEqual(invoice1.id);
      expect(res.body.data.items.length).toEqual(2);
      expect(res.body.data.items[0].batch.batchNumber).toBeDefined();
      expect(res.body.data.farmer.name).toEqual('Bharat Patel');
      expect(res.body.data.summary.balanceDue).toEqual(0);
    });

    it('should return 404 when querying invoice of another shop', async () => {
      const res = await request(app)
        .get(`/api/v1/sales-history/${invoiceShopB.id}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('7. GET /api/v1/sales-history/export - Memory-Safe Streaming CSV Export', () => {
    it('should stream CSV export of sales history with correct headers', async () => {
      const res = await request(app)
        .get('/api/v1/sales-history/export')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Invoice Number,Date,Farmer Name');
      expect(res.text).toContain(invoice1.invoiceNumber);
    });

    it('should stream itemized CSV export when type=ITEMIZED', async () => {
      const res = await request(app)
        .get('/api/v1/sales-history/export?type=ITEMIZED')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Product Name,Product Code,Category,Batch Number');
      expect(res.text).toContain('IFFCO Urea 45kg');
    });

    it('should return JSON export when format=json', async () => {
      const res = await request(app)
        .get('/api/v1/sales-history/export?format=json')
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should forbid non-export role (BILLING_STAFF) from exporting sales data (403)', async () => {
      const res = await request(app)
        .get('/api/v1/sales-history/export')
        .set('Authorization', `Bearer ${tokenStaffA}`);

      expect(res.statusCode).toEqual(403);
    });
  });
});
