const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/jwt');
const { prisma } = require('../src/config/database');
const { t, getDictionary, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } = require('../src/i18n');
const whatsappService = require('../src/services/whatsapp.service');

jest.setTimeout(30000);

describe('Trilingual Support (English, Gujarati, Gujlish) Test Suite', () => {
  let shopA;
  let ownerA;
  let tokenOwnerA;
  let categoryA;
  let farmerGu, farmerGujlish;
  let productA, batchA, invoiceGu;
  let reminderA;

  beforeAll(async () => {
    // 1. Create Shop A with OWNER
    shopA = await prisma.shop.create({
      data: {
        shopName: 'Green Krishi Trilingual Shop A',
        code: `LANG_A_${Date.now()}`,
        mobile: `+919700${String(Date.now()).slice(-6)}`,
        status: 'ACTIVE',
        defaultLanguage: 'en',
      },
    });

    ownerA = await prisma.user.create({
      data: {
        shopId: shopA.id,
        fullName: 'Bhavin Patel Owner',
        email: `owner_lang_${Date.now()}@test.com`,
        mobile: shopA.mobile,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
        preferredLanguage: 'gu',
      },
    });
    tokenOwnerA = generateAccessToken(ownerA);

    // 2. Create Farmers with distinct preferred languages
    farmerGu = await prisma.farmer.create({
      data: {
        shopId: shopA.id,
        name: 'Hasmukhbhai Patel',
        phone: `+91981${String(Date.now()).slice(-7)}`,
        village: 'Anand',
        preferredLanguage: 'gu',
      },
    });

    farmerGujlish = await prisma.farmer.create({
      data: {
        shopId: shopA.id,
        name: 'Jagdishbhai Desai',
        phone: `+91982${String(Date.now()).slice(-7)}`,
        village: 'Nadiad',
        preferredLanguage: 'gujlish',
      },
    });

    // 3. Product, Batch & Invoice
    categoryA = await prisma.category.create({
      data: { shopId: shopA.id, name: 'Fertilizers Shop A' },
    });

    productA = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: 'IFFCO NPK 12:32:16 50 KG',
        shortName: 'NPK 50KG',
        code: `NPK_${Date.now()}`,
        categoryId: categoryA.id,
        variants: {
          create: [{
            variantName: '50 KG',
            sku: `NPK_SKU_${Date.now()}`,
            purchasePrice: 1200,
            sellingPrice: 1470,
            mrp: 1500,
          }],
        },
      },
      include: { variants: true },
    });

    batchA = await prisma.inventoryBatch.create({
      data: {
        shopId: shopA.id,
        productId: productA.id,
        batchNumber: `BATCH_NPK_${Date.now()}`,
        quantity: 50,
        purchasePrice: 1200,
        sellingPrice: 1470,
        mrp: 1500,
      },
    });

    invoiceGu = await prisma.invoice.create({
      data: {
        shopId: shopA.id,
        farmerId: farmerGu.id,
        userId: ownerA.id,
        invoiceNumber: `INV-NPK-${Date.now()}`,
        subTotal: 1470,
        taxAmount: 0,
        discount: 0,
        totalAmount: 1470,
        paidAmount: 1000,
        paymentStatus: 'PARTIAL',
        paymentMethod: 'CASH',
        items: {
          create: [{
            productId: productA.id,
            batchId: batchA.id,
            quantity: 1,
            unitPrice: 1470,
            totalPrice: 1470,
          }],
        },
      },
    });

    // 4. Reminder for Stock Arrival & Dealer Order
    reminderA = await prisma.reminder.create({
      data: {
        shopId: shopA.id,
        farmerId: farmerGu.id,
        title: 'Need 10 bags DAP',
        productName: 'DAP 50KG Fertilizer',
        type: 'FARMER_ARRIVAL',
        quantityNeeded: 10,
        unit: 'Bags',
        dueDate: new Date(Date.now() + 86400000),
      },
    });
  });

  afterAll(async () => {
    try {
      await prisma.reminder.deleteMany({ where: { shopId: shopA.id } });
      await prisma.invoiceItem.deleteMany({ where: { invoice: { shopId: shopA.id } } });
      await prisma.invoice.deleteMany({ where: { shopId: shopA.id } });
      await prisma.inventoryBatch.deleteMany({ where: { shopId: shopA.id } });
      await prisma.productVariant.deleteMany({ where: { product: { shopId: shopA.id } } });
      await prisma.product.deleteMany({ where: { shopId: shopA.id } });
      if (categoryA) await prisma.category.deleteMany({ where: { id: categoryA.id } });
      await prisma.farmer.deleteMany({ where: { shopId: shopA.id } });
      await prisma.setting.deleteMany({ where: { shopId: shopA.id } });
      await prisma.user.deleteMany({ where: { id: ownerA.id } });
      await prisma.shop.deleteMany({ where: { id: shopA.id } });
    } catch (e) {
      console.warn('Cleanup error in i18n test:', e.message);
    }
  });

  describe('1. Core i18n Translation Engine Unit Tests', () => {
    it('should correctly translate common keys in English, Gujarati, and Gujlish', () => {
      expect(t('common.save', 'en')).toEqual('Save');
      expect(t('common.save', 'gu')).toEqual('સાચવો');
      expect(t('common.save', 'gujlish')).toEqual('Save Karo');

      expect(t('categories.fertilizer', 'en')).toContain('Fertilizer');
      expect(t('categories.fertilizer', 'gu')).toContain('ખાતર');
      expect(t('categories.fertilizer', 'gujlish')).toContain('Khaatar');
    });

    it('should interpolate dynamic variables correctly in all languages', () => {
      const enMsg = t('whatsapp.reminderMessage', 'en', { amount: '2,500' });
      expect(enMsg).toContain('₹2,500');

      const guMsg = t('whatsapp.reminderMessage', 'gu', { amount: '2,500' });
      expect(guMsg).toContain('₹2,500');
      expect(guMsg).toContain('નમસ્કાર ખેડૂત મિત્ર');

      const gujlishMsg = t('whatsapp.reminderMessage', 'gujlish', { amount: '2,500' });
      expect(gujlishMsg).toContain('₹2,500');
      expect(gujlishMsg).toContain('Namaskar Khedut mitra');
    });

    it('should fallback gracefully to English when key is missing in target language', () => {
      // Non-existent key in gu returns english or raw key
      const fallback = t('non_existent_key_xyz', 'gu');
      expect(fallback).toEqual('non_existent_key_xyz');
    });

    it('should return full dictionary object for frontend hydration', () => {
      const dictGu = getDictionary('gu');
      expect(dictGu.common.save).toEqual('સાચવો');
      expect(dictGu.billing.totalAmount).toEqual('કુલ બિલ રકમ');

      const dictGujlish = getDictionary('gujlish');
      expect(dictGujlish.common.save).toEqual('Save Karo');
      expect(dictGujlish.billing.totalAmount).toEqual('Kul Bill Rakam');
    });
  });

  describe('2. Express i18n API Endpoints (/api/v1/i18n)', () => {
    it('GET /api/v1/i18n/languages - should return all 3 supported languages with metadata', async () => {
      const res = await request(app).get('/api/v1/i18n/languages');

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      const languages = res.body.data.languages;
      expect(languages.length).toEqual(3);

      const codes = languages.map((l) => l.code);
      expect(codes).toContain('en');
      expect(codes).toContain('gu');
      expect(codes).toContain('gujlish');

      const guLang = languages.find((l) => l.code === 'gu');
      expect(guLang.nativeName).toEqual('ગુજરાતી');
    });

    it('GET /api/v1/i18n/translations?lang=gu - should return complete Gujarati dictionary', async () => {
      const res = await request(app).get('/api/v1/i18n/translations?lang=gu');

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.language).toEqual('gu');
      expect(res.body.data.translations.common.save).toEqual('સાચવો');
      expect(res.body.data.translations.billing.invoice).toContain('બિલ');
    });

    it('GET /api/v1/i18n/translations?lang=gujlish - should return complete Gujlish dictionary', async () => {
      const res = await request(app).get('/api/v1/i18n/translations?lang=gujlish');

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.language).toEqual('gujlish');
      expect(res.body.data.translations.common.save).toEqual('Save Karo');
      expect(res.body.data.translations.billing.invoice).toContain('Bill');
    });

    it('GET /api/v1/i18n/translations/whatsapp?lang=gu - should return specific section translations', async () => {
      const res = await request(app).get('/api/v1/i18n/translations/whatsapp?lang=gu');

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.section).toEqual('whatsapp');
      expect(res.body.data.translations.farmerStatementTitle).toEqual('ખેડૂત બિલ સ્ટેટમેન્ટ');
    });

    it('GET /api/v1/i18n/translations/invalid_section - should return 404', async () => {
      const res = await request(app).get('/api/v1/i18n/translations/invalid_section_xyz');
      expect(res.statusCode).toEqual(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Express Middleware Language Resolution & Content-Language Header', () => {
    it('should resolve language from query param ?lang=gu', async () => {
      const res = await request(app).get('/api/v1/i18n/translations?lang=gu');
      expect(res.headers['content-language']).toEqual('gu');
    });

    it('should resolve language from X-Language header: gujlish', async () => {
      const res = await request(app)
        .get('/api/v1/i18n/translations')
        .set('X-Language', 'gujlish');
      expect(res.headers['content-language']).toEqual('gujlish');
    });

    it('should resolve language from Accept-Language header: gu', async () => {
      const res = await request(app)
        .get('/api/v1/i18n/translations')
        .set('Accept-Language', 'gu-IN,gu;q=0.9');
      expect(res.headers['content-language']).toEqual('gu');
    });
  });

  describe('4. WhatsApp Statement Dispatch in 3 Languages', () => {
    it('should format WhatsApp bill in Gujarati script when lang=gu', () => {
      const message = whatsappService.formatFarmerBillsWhatsAppMessage({
        shop: shopA,
        farmer: farmerGu,
        billType: 'ALL',
        bills: [invoiceGu],
        summary: { totalAmount: 1470, totalPaid: 1000, totalDue: 470 },
        customNote: 'Krupa kari samaysar chukavni karvi',
        lang: 'gu',
      });

      expect(message).toContain('ખેડૂત બિલ સ્ટેટમેન્ટ');
      expect(message).toContain('*ખેડૂત:* Hasmukhbhai Patel');
      expect(message).toContain('કુલ બિલ રકમ: ₹1,470');
      expect(message).toContain('કુલ જમા રકમ: ₹1,000');
      expect(message).toContain('કુલ બાકી રકમ: ₹470');
      expect(message).toContain('અમારી સાથે ખેતી કરવા બદલ ખૂબ ખૂબ આભાર!');
      expect(message).toContain('UPI દ્વારા સરળતાથી ચુકવણી કરો');
    });

    it('should format WhatsApp bill in Gujlish phonetic text when lang=gujlish', () => {
      const message = whatsappService.formatFarmerBillsWhatsAppMessage({
        shop: shopA,
        farmer: farmerGujlish,
        billType: 'ALL',
        bills: [invoiceGu],
        summary: { totalAmount: 1470, totalPaid: 1000, totalDue: 470 },
        lang: 'gujlish',
      });

      expect(message).toContain('KHEDUT BILL STATEMENT');
      expect(message).toContain('*Khedut:* Jagdishbhai Desai');
      expect(message).toContain('Kul Bill Rakam: ₹1,470');
      expect(message).toContain('Kul Jama Rakam: ₹1,000');
      expect(message).toContain('Kul Baki Rakam: ₹470');
      expect(message).toContain('Amari sathe kheti karva badal khub aabhar!');
      expect(message).toContain('UPI thi tarat payment karo');
    });

    it('should format WhatsApp bill in standard English when lang=en', () => {
      const message = whatsappService.formatFarmerBillsWhatsAppMessage({
        shop: shopA,
        farmer: farmerGu,
        billType: 'ALL',
        bills: [invoiceGu],
        summary: { totalAmount: 1470, totalPaid: 1000, totalDue: 470 },
        lang: 'en',
      });

      expect(message).toContain('FARMER BILL STATEMENT');
      expect(message).toContain('*Farmer:* Hasmukhbhai Patel');
      expect(message).toContain('Total Bills Amount: ₹1,470');
      expect(message).toContain('Total Paid Amount: ₹1,000');
      expect(message).toContain('Total Due Balance: ₹470');
      expect(message).toContain('Thank you for farming with us!');
    });
  });

  describe('5. Reminder WhatsApp Payloads Localization', () => {
    it('GET /api/v1/reminders/:id/dealer-whatsapp?lang=gu - should return localized Dealer PO message in Gujarati', async () => {
      const res = await request(app)
        .get(`/api/v1/reminders/${reminderA.id}/dealer-whatsapp?lang=gu`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('ખરીદી ઓર્ડર પૂછપરછ');
      expect(res.body.data.message).toContain('*ઉત્પાદન / માલની વિગત:* DAP 50KG Fertilizer');
    });

    it('GET /api/v1/reminders/:id/farmer-whatsapp?lang=gujlish - should return localized stock arrival in Gujlish', async () => {
      const res = await request(app)
        .get(`/api/v1/reminders/${reminderA.id}/farmer-whatsapp?lang=gujlish`)
        .set('Authorization', `Bearer ${tokenOwnerA}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('STOCK ARRIVAL JAN');
      expect(res.body.data.message).toContain('Shubh Samachar! Tamari jaruriyat no agro stock');
    });
  });

  describe('6. Shop Default Language Settings (PATCH /api/v1/settings/language)', () => {
    it('should update shop default language to gu', async () => {
      const res = await request(app)
        .patch('/api/v1/settings/language')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({ language: 'gu' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.defaultLanguage).toEqual('gu');

      // Verify in Shop record
      const shop = await prisma.shop.findUnique({ where: { id: shopA.id } });
      expect(shop.defaultLanguage).toEqual('gu');
    });

    it('should update shop default language to gujlish', async () => {
      const res = await request(app)
        .patch('/api/v1/settings/language')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({ language: 'gujlish' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.defaultLanguage).toEqual('gujlish');
    });

    it('should reject invalid language code with 400 Bad Request', async () => {
      const res = await request(app)
        .patch('/api/v1/settings/language')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({ language: 'spanish_unsupported' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Unsupported language');
    });
  });

  describe('7. Farmer Preferred Language & Automated Dispatch', () => {
    it('POST /api/v1/farmers - should save farmer preferred language', async () => {
      const res = await request(app)
        .post('/api/v1/farmers')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          name: 'Mukeshbhai Bharwad',
          phone: `+91983${String(Date.now()).slice(-7)}`,
          preferredLanguage: 'gu',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.data.preferredLanguage).toEqual('gu');
    });

    it('POST /api/v1/farmer-credit/farmers/:id/send-bills - should dispatch bills in farmer chosen language', async () => {
      const res = await request(app)
        .post(`/api/v1/farmer-credit/farmers/${farmerGu.id}/send-bills`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .send({
          billType: 'ALL',
          channels: ['WHATSAPP'],
          lang: 'gu',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.language).toEqual('gu');
      expect(res.body.data.delivery.whatsapp.messagePreview).toContain('ખેડૂત બિલ સ્ટેટમેન્ટ');
    });
  });
});
