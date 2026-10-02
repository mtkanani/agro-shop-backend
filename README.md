# Agro Shop Backend Service

Production-grade, modular Node.js & Express RESTful API with Prisma ORM designed for Agro Shop POS Billing, Inventory Expiry Management, Farmer Credit Khata Ledger, and Multi-Branch Operations.

## 🚀 Features

- **Authentication & RBAC**: Secure JWT authentication with strict Role-Based Access Control (`SUPER_ADMIN`, `SHOP_OWNER`, `MANAGER`).
- **Multi-Shop Management**: Single or multi-branch store support with customizable GSTIN, Fertilizer & Pesticide license numbers.
- **Product & Category Catalog**: Tailored for agricultural retail (Seeds, Fertilizers, Pesticides, Growth Promoters) with HSN codes, UOM (kg, ltr, bag, packet), and GST tax rates.
- **Inventory & Expiry Tracking**: Batch stock intake, manufacturing/expiry date tracking, near-expiry alerts, and low stock threshold alerts.
- **POS Billing & Invoicing**: Automatic stock deduction per batch, tax calculation (CGST/SGST), payment mode selection (Cash, UPI, Khata credit), and invoice printing data.
- **Farmer Khata Ledger**: Track credit balance, record payments, calculate outstanding debts, and generate statements.
- **Supplier / Distributor Ledger**: Track supplier purchase bills, payment history, and balances.
- **Daily Counter Cash Closing**: Tally opening drawer cash, cash sales, cash expenses, and closing balance discrepancies.
- **Reports & Analytics**: Daily sales summary, inventory valuation report, GST tax reports, and Khata aging breakdown.
- **Interactive OpenAPI Documentation**: Built-in Swagger UI at `/api-docs`.

---

## 🛠️ Project Structure

```
agro-shop-backend/
├── src/
│   ├── config/          # Database connection, env validation, swagger docs
│   ├── middleware/      # Auth, RBAC, error handling, validation, rate limiting
│   ├── utils/           # JWT, password hashing, OTP generation, response standardizer
│   ├── modules/         # 15 domain modules (auth, shops, users, farmers, products, etc.)
│   ├── app.js           # Express app setup
│   └── server.js        # Server listener
├── prisma/
│   ├── schema.prisma    # Database schema models
│   └── seed.js          # Seed default admin, shop, categories, products
├── tests/               # Test suites
├── .env                 # Local env settings
└── package.json
```

---

## 💻 Getting Started

### 1. Installation

```bash
cd agro-shop-backend
npm install
```

### 2. Database Setup & Migration

Generate Prisma Client and push the schema to SQLite/PostgreSQL:

```bash
npx prisma generate
npx prisma db push
```

### 3. Seed Initial Data

Populate default Super Admin, sample Shop, Categories, Products, and Farmers:

```bash
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

The API server will run at `http://localhost:5000`.

---

## 📚 API Documentation

Once the server is running, access the interactive Swagger UI at:
👉 **`http://localhost:5000/api-docs`**

---

## 🔑 Default Credentials (Seeded)

- **Super Admin**: `admin@agroshop.com` / `Admin@123`
- **Shop Owner**: `owner@agroshop.com` / `Owner@123`
- **Manager**: `manager@agroshop.com` / `Manager@123`
