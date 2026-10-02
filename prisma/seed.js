const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Agro Shop database seed with updated Shop & User models...');

  // 1. Create or Find Default Shop
  let shop = await prisma.shop.findFirst({
    where: { code: 'SHOP001' },
  });

  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        shopName: 'Agro Care & Farmers Center',
        code: 'SHOP001',
        ownerName: 'Ramesh Patel',
        mobile: '+919876543210',
        email: 'contact@agrocare.com',
        address: 'Plot 45, Main Market Road',
        villageCity: 'Nagpur',
        state: 'Maharashtra',
        pincode: '440001',
        gstin: '27AAAAA0000A1Z5',
        fertilizerLicense: 'FL-2024-8891',
        pesticideLicense: 'PL-2024-4412',
        seedLicense: 'SL-2024-9923',
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Shop created: ${shop.shopName} (${shop.code})`);
  } else {
    console.log(`ℹ️ Shop already exists: ${shop.shopName} (${shop.code})`);
  }

  // 2. Hash Password for Users
  const ownerPassword = await bcrypt.hash('Owner@123', 10);
  const adminPassword = await bcrypt.hash('Admin@123', 10);

  // 3. Create Users with Role Enum (OWNER, ADMIN)
  await prisma.user.upsert({
    where: { email: 'owner@agroshop.com' },
    update: {
      shopId: shop.id,
      role: 'OWNER',
      status: 'ACTIVE',
    },
    create: {
      shopId: shop.id,
      fullName: 'Ramesh Patel (Owner)',
      email: 'owner@agroshop.com',
      mobile: '+919000000002',
      passwordHash: ownerPassword,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@agroshop.com' },
    update: {
      shopId: shop.id,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    create: {
      shopId: shop.id,
      fullName: 'Suresh Verma (Admin)',
      email: 'admin@agroshop.com',
      mobile: '+919000000003',
      passwordHash: adminPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Users seeded: OWNER and ADMIN');

  // 4. Create Product Categories
  const categoriesData = [
    { name: 'Seeds', description: 'High yield Hybrid & Organic Seeds' },
    { name: 'Fertilizers', description: 'NPK, Urea, Organic Bio-Fertilizers' },
    { name: 'Pesticides', description: 'Insecticides, Fungicides, Herbicides' },
    { name: 'Growth Promoters', description: 'Plant growth regulators & micronutrients' },
    { name: 'Tools & Equipment', description: 'Sprayers, pipes, and farming tools' },
  ];

  const categories = {};
  for (const cat of categoriesData) {
    let created = await prisma.category.findFirst({
      where: { shopId: shop.id, name: cat.name },
    });
    if (!created) {
      created = await prisma.category.create({
        data: {
          shopId: shop.id,
          name: cat.name,
          description: cat.description,
        },
      });
    }
    categories[cat.name] = created;
  }
  console.log('✅ Product categories seeded with shopId');

  // 5. Create Sample Supplier
  let supplier = await prisma.supplier.findFirst({
    where: { shopId: shop.id, name: 'Kishan Ferti-Chem Pvt Ltd' },
  });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        shopId: shop.id,
        name: 'Kishan Ferti-Chem Pvt Ltd',
        companyName: 'Kishan Ferti-Chem',
        phone: '+919822001122',
        email: 'orders@kishanferti.com',
        address: 'MIDC Industrial Area, Zone 2',
        gstin: '27KISHAN0000Z1',
        khataBalance: 0,
      },
    });
    console.log(`✅ Supplier created: ${supplier.companyName}`);
  }

  // 6. Create Sample Farmers
  const farmersData = [
    {
      name: 'Ramrao Deshmukh',
      phone: '+919890112233',
      village: 'Kalmeshwar',
      address: 'Near Water Tank, Kalmeshwar',
      creditLimit: 50000,
      khataBalance: 12500,
    },
    {
      name: 'Shankar Patil',
      phone: '+919890445566',
      village: 'Saoner',
      address: 'Plot 12, Main Gram',
      creditLimit: 30000,
      khataBalance: 0,
    },
  ];

  for (const f of farmersData) {
    const existing = await prisma.farmer.findFirst({
      where: { shopId: shop.id, phone: f.phone },
    });
    if (!existing) {
      await prisma.farmer.create({
        data: {
          shopId: shop.id,
          ...f,
        },
      });
    }
  }
  console.log('✅ Farmers seeded');

  // 7. Create Sample Products & Batches
  let product1 = await prisma.product.findFirst({
    where: { shopId: shop.id, code: 'PROD-SEED-001' },
  });
  if (!product1) {
    product1 = await prisma.product.create({
      data: {
        shopId: shop.id,
        name: 'Hybrid Cotton Seed (BG-II)',
        code: 'PROD-SEED-001',
        hsnCode: '12099190',
        categoryId: categories['Seeds'].id,
        uom: 'packet',
        taxRate: 5,
        minStock: 10,
      },
    });

    await prisma.inventoryBatch.create({
      data: {
        shopId: shop.id,
        batchNumber: 'COT-2024-B1',
        productId: product1.id,
        supplierId: supplier.id,
        mfgDate: new Date('2024-01-15'),
        expiryDate: new Date('2026-12-31'),
        quantity: 50,
        purchasePrice: 650,
        mrp: 850,
        sellingPrice: 800,
      },
    });
  }

  let product2 = await prisma.product.findFirst({
    where: { shopId: shop.id, code: 'PROD-FERT-001' },
  });
  if (!product2) {
    product2 = await prisma.product.create({
      data: {
        shopId: shop.id,
        name: 'NPK 19:19:19 Water Soluble Fertilizer',
        code: 'PROD-FERT-001',
        hsnCode: '31052000',
        categoryId: categories['Fertilizers'].id,
        uom: 'bag',
        taxRate: 5,
        minStock: 20,
      },
    });

    await prisma.inventoryBatch.create({
      data: {
        shopId: shop.id,
        batchNumber: 'NPK-9081',
        productId: product2.id,
        supplierId: supplier.id,
        mfgDate: new Date('2024-02-01'),
        expiryDate: new Date('2027-02-01'),
        quantity: 100,
        purchasePrice: 1100,
        mrp: 1450,
        sellingPrice: 1350,
      },
    });
  }

  console.log('✅ Products & Inventory Batches seeded with shopId');

  // 8. Create Default Settings
  const settingsData = [
    { key: 'INVOICE_PREFIX', value: 'INV-AGRO-' },
    { key: 'TERMS_AND_CONDITIONS', value: 'Goods once sold will not be taken back without receipt. Keep chemical products away from children.' },
    { key: 'DEFAULT_TAX_RATE', value: '5' },
    { key: 'ENABLE_SMS_NOTIFICATIONS', value: 'false' },
  ];

  for (const s of settingsData) {
    const existing = await prisma.setting.findFirst({
      where: { shopId: shop.id, key: s.key },
    });
    if (!existing) {
      await prisma.setting.create({
        data: {
          shopId: shop.id,
          key: s.key,
          value: s.value,
        },
      });
    }
  }
  console.log('✅ Shop settings seeded');

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
