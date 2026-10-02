const swaggerJSDoc = require('swagger-jsdoc');
const env = require('./env');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Agro Shop Backend API',
      version: '1.0.0',
      description: 'Production-Grade REST API for Agro Retail POS, Expiry Management, Khata Ledger, and Multi-Shop Operations.',
      contact: {
        name: 'Agro Tech Support',
        email: 'support@agroshop.com',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Active API Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your Bearer Token to authorize requests.',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      { name: 'Authentication', description: 'User registration, OTP verification, and login endpoints' },
      { name: 'Shops', description: 'Multi-branch shop management' },
      { name: 'Users', description: 'Staff user accounts & roles (SUPER_ADMIN, OWNER, BILLING_STAFF)' },
      { name: 'Farmers', description: 'Customer profiles, credit limits, and addresses' },
      { name: 'Categories', description: 'Product category taxonomy' },
      { name: 'Product Types', description: 'Packaging and product types master (Bottle, Bag, Packet, Box, Can)' },
      { name: 'Products', description: 'Agro catalog, variants, and pricing (Seeds, Fertilizers, Pesticides)' },
      { name: 'Inventory', description: 'Batch stock intake, expiry tracking, stock adjustment' },
      { name: 'Suppliers', description: 'Distributor profiles and purchase ledgers' },
      { name: 'Restock Management', description: 'Stock intake transactions, multi-product restocks, and supplier order history' },
      { name: 'POS Billing', description: 'Sales invoicing, tax calculation, stock auto-deduction' },
      { name: 'Payments', description: 'Payment records (Cash, UPI, Khata credit)' },
      { name: 'Khata Ledger', description: 'Farmer and supplier credit/debit account statements' },
      { name: 'Cash Closing', description: 'Daily counter cash register opening & tally closing' },
      { name: 'Reports & Analytics', description: 'Sales, GST, Inventory valuation, and Debtors aging reports' },
      { name: 'Dashboard', description: 'Real-time business KPI overview' },
      { name: 'Settings', description: 'Shop settings, invoice prefixes, and terms' },
    ],
    paths: {
      // 1. AUTHENTICATION
      '/auth/register': {
        post: {
          tags: ['Authentication'],
          summary: 'Initiate Shop Owner Registration (Step 1)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['shopName', 'fullName', 'mobile', 'email', 'password'],
                  properties: {
                    shopName: { type: 'string', example: 'Agro Care Store' },
                    fullName: { type: 'string', example: 'Ramesh Patel' },
                    mobile: { type: 'string', example: '+919876543210' },
                    email: { type: 'string', example: 'ramesh@agrocare.com' },
                    password: { type: 'string', example: 'Owner@123' },
                    confirmPassword: { type: 'string', example: 'Owner@123' },
                    address: { type: 'string', example: 'Main Market Road' },
                    villageCity: { type: 'string', example: 'Nagpur' },
                    state: { type: 'string', example: 'Maharashtra' },
                    pincode: { type: 'string', example: '440001' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'OTP sent successfully to email' },
            409: { description: 'Conflict - Email or Mobile already registered' },
          },
        },
      },
      '/auth/register/verify-otp': {
        post: {
          tags: ['Authentication'],
          summary: 'Verify Registration OTP & Create Shop + OWNER User (Step 2)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['otp'],
                  properties: {
                    verificationId: { type: 'string', example: 'verification-uuid-1234' },
                    email: { type: 'string', example: 'ramesh@agrocare.com' },
                    mobile: { type: 'string', example: '+919876543210' },
                    otp: { type: 'string', example: '483921' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Registration completed successfully (returns User, Shop, Access & Refresh tokens)' },
            400: { description: 'Invalid OTP' },
            429: { description: 'Too many incorrect attempts (OTP_ATTEMPTS_EXCEEDED)' },
          },
        },
      },
      '/auth/register/resend-otp': {
        post: {
          tags: ['Authentication'],
          summary: 'Resend Registration OTP',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    verificationId: { type: 'string', example: 'verification-uuid-1234' },
                    email: { type: 'string', example: 'ramesh@agrocare.com' },
                    mobile: { type: 'string', example: '+919876543210' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'A new OTP has been sent to your email' },
            429: { description: 'Too many OTP requests' },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'User Login (Email + Password OR Mobile + Password)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['password'],
                  properties: {
                    identifier: { type: 'string', example: 'admin@agroshop.com', description: 'Email address or mobile number' },
                    email: { type: 'string', example: 'admin@agroshop.com' },
                    mobile: { type: 'string', example: '+919000000003' },
                    password: { type: 'string', example: 'Admin@123' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Login successful, returning User, Shop, Permissions, and JWT tokens' } },
        },
      },
      '/auth/me': {
        get: {
          tags: ['Authentication'],
          summary: 'Get Current Authenticated User Profile (User + Shop + Role + Permissions)',
          responses: { 200: { description: 'Authenticated profile object' } },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Authentication'],
          summary: 'User Logout (Invalidate Refresh Token)',
          responses: { 200: { description: 'Logout successful' } },
        },
      },
      '/auth/forgot-password': {
        post: {
          tags: ['Authentication'],
          summary: 'Generate Password Reset OTP',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', example: 'ramesh@agrocare.com' },
                    mobile: { type: 'string', example: '+919876543210' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'OTP generated and sent' } },
        },
      },
      '/auth/verify-otp': {
        post: {
          tags: ['Authentication'],
          summary: 'Verify Password Reset / Account OTP',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['otp'],
                  properties: {
                    email: { type: 'string', example: 'ramesh@agrocare.com' },
                    mobile: { type: 'string', example: '+919876543210' },
                    otp: { type: 'string', example: '123456' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'OTP verified successfully' } },
        },
      },
      '/auth/reset-password': {
        post: {
          tags: ['Authentication'],
          summary: 'Reset Password using Reset Token',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['resetToken', 'newPassword'],
                  properties: {
                    resetToken: { type: 'string', example: '7f8b9a0c1d2e3f4a5b6c7d8e9f0a1b2c' },
                    newPassword: { type: 'string', example: 'NewSecret@123' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Password reset successfully' } },
        },
      },
      '/auth/change-password': {
        post: {
          tags: ['Authentication'],
          summary: 'Change Password for Authenticated User',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['currentPassword', 'newPassword'],
                  properties: {
                    currentPassword: { type: 'string', example: 'Owner@123' },
                    newPassword: { type: 'string', example: 'NewOwnerPass@123' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Password changed successfully' } },
        },
      },

      // 2. SHOPS
      '/shops': {
        get: { tags: ['Shops'], summary: 'List All Shops' },
        post: { tags: ['Shops'], summary: 'Create New Shop' },
      },
      '/shops/{id}': {
        get: { tags: ['Shops'], summary: 'Get Shop Details' },
        put: { tags: ['Shops'], summary: 'Update Shop' },
        delete: { tags: ['Shops'], summary: 'Deactivate Shop' },
      },

      // 3. USERS
      '/users': {
        get: { tags: ['Users'], summary: 'List All User Accounts' },
        post: { tags: ['Users'], summary: 'Create User Account (Role: OWNER or ADMIN)' },
      },
      '/users/{id}': {
        get: { tags: ['Users'], summary: 'Get User Profile' },
        put: { tags: ['Users'], summary: 'Update User Profile' },
      },
      '/users/{id}/toggle-status': {
        patch: { tags: ['Users'], summary: 'Toggle Active/Inactive User Status' },
      },

      // 4. FARMERS
      '/farmers': {
        get: {
          tags: ['Farmers'],
          summary: 'List Farmers / Customers',
          parameters: [
            { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Search by name, phone, or village' },
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'Farmers list retrieved successfully' } },
        },
        post: {
          tags: ['Farmers'],
          summary: 'Create Farmer Profile',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'phone'],
                  properties: {
                    name: { type: 'string', example: 'Ramesh Patel' },
                    phone: { type: 'string', example: '+919876543210' },
                    village: { type: 'string', example: 'Nagpur' },
                    address: { type: 'string', example: 'Main Market Road' },
                    aadhaarNo: { type: 'string', example: '123456789012' },
                    creditLimit: { type: 'number', example: 50000, description: 'Optional credit limit (default 0)' },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Farmer created successfully' }, 409: { description: 'Phone number already registered' } },
        },
      },
      '/farmers/{id}': {
        get: {
          tags: ['Farmers'],
          summary: 'Get Farmer Details & Recent Invoices/Khata',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Farmer details & financial summary' }, 404: { description: 'Farmer not found' } },
        },
        put: {
          tags: ['Farmers'],
          summary: 'Update Farmer Profile',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', example: 'Ramesh Patel' },
                    phone: { type: 'string', example: '+919876543210' },
                    village: { type: 'string', example: 'Nagpur' },
                    address: { type: 'string', example: 'Main Market Road' },
                    creditLimit: { type: 'number', example: 75000 },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Farmer updated successfully' } },
        },
        delete: {
          tags: ['Farmers'],
          summary: 'Deactivate Farmer',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Farmer deactivated successfully' } },
        },
      },
      '/farmers/{id}/khata': {
        get: {
          tags: ['Farmers'],
          summary: 'Get Farmer Khata Ledger Statement & Transactions',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Khata ledger statement' } },
        },
      },
      '/farmers/{id}/bills': {
        get: {
          tags: ['Farmers'],
          summary: 'Get Farmer Invoice & POS Billing History',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Billing history' } },
        },
      },
      '/farmers/{id}/payments': {
        get: {
          tags: ['Farmers'],
          summary: 'Get Farmer Payment History',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Payment history' } },
        },
        post: {
          tags: ['Farmers'],
          summary: 'Record Farmer Dues Payment (Credits Khata Ledger & Reduces Outstanding Balance)',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['amount'],
                  properties: {
                    amount: { type: 'number', example: 2500 },
                    method: { type: 'string', example: 'CASH', enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'] },
                    txnRef: { type: 'string', example: 'UPI123456789' },
                    notes: { type: 'string', example: 'Paid counter dues' },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Payment recorded and Khata ledger credited' } },
        },
      },
      '/farmers/{id}/outstanding': {
        get: {
          tags: ['Farmers'],
          summary: 'Get Farmer Total Outstanding Khata Balance & Credit Limit Status',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Outstanding balance and credit status' } },
        },
      },

      // 5. CATEGORIES
      '/categories': {
        get: {
          tags: ['Categories'],
          summary: 'List Product Categories',
          parameters: [
            { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Filter categories by name' },
          ],
          responses: { 200: { description: 'Categories list retrieved with product counts' } },
        },
        post: {
          tags: ['Categories'],
          summary: 'Create Product Category',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string', example: 'Cotton Seeds' },
                    description: { type: 'string', example: 'Cotton seed varieties' },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Category created successfully' }, 409: { description: 'Category already exists in your shop' } },
        },
      },
      '/categories/{id}': {
        get: {
          tags: ['Categories'],
          summary: 'Get Category Details',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Category details & products list' }, 404: { description: 'Category not found' } },
        },
        put: {
          tags: ['Categories'],
          summary: 'Update Category',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', example: 'Cotton Seeds & Seedlings' },
                    description: { type: 'string', example: 'Cotton seeds and hybrid varieties' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Category updated successfully' }, 409: { description: 'Category name conflict' } },
        },
        delete: {
          tags: ['Categories'],
          summary: 'Delete / Deactivate Category',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Category deleted/deactivated successfully' } },
        },
      },

      // 5.5 PRODUCT TYPES
      '/product-types': {
        get: {
          tags: ['Product Types'],
          summary: 'List Master Product Types (Bottle, Bag, Packet, Box, Can, Drum, Pouch)',
          parameters: [
            { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Search product types by name' },
          ],
          responses: { 200: { description: 'Product types list retrieved' } },
        },
        post: {
          tags: ['Product Types'],
          summary: 'Create Master Product Type',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string', example: 'Bottle' },
                    shortName: { type: 'string', example: 'BTL' },
                    description: { type: 'string', example: 'Liquid bottle packaging' },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Product Type created successfully' }, 409: { description: 'Product Type already exists in your shop' } },
        },
      },
      '/product-types/{id}': {
        get: {
          tags: ['Product Types'],
          summary: 'Get Product Type Details',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Product Type details' }, 404: { description: 'Product Type not found' } },
        },
        put: {
          tags: ['Product Types'],
          summary: 'Update Product Type',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', example: 'Bottle' },
                    shortName: { type: 'string', example: 'BTL' },
                    description: { type: 'string', example: 'Liquid bottle packaging' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Product Type updated' } },
        },
        delete: {
          tags: ['Product Types'],
          summary: 'Deactivate Product Type',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Product Type deactivated' } },
        },
      },

      // 6. PRODUCTS
      '/products': {
        get: {
          tags: ['Products'],
          summary: 'List Products Catalog & Variants',
          parameters: [
            { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Search by name, shortName, code, barcode, or SKU' },
            { in: 'query', name: 'categoryId', schema: { type: 'string' } },
            { in: 'query', name: 'productTypeId', schema: { type: 'string' } },
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'Products catalog retrieved with stock counts' } },
        },
        post: {
          tags: ['Products'],
          summary: 'Create Product & Manually Add Product Variants (100 ML, 500 ML, 1 L)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'shortName', 'categoryId'],
                  properties: {
                    name: { type: 'string', example: 'Bayer Confidor Insecticide' },
                    shortName: { type: 'string', example: 'Confidor' },
                    categoryId: { type: 'string', example: 'category-uuid' },
                    productTypeId: { type: 'string', example: 'product-type-uuid' },
                    brand: { type: 'string', example: 'Bayer' },
                    barcode: { type: 'string', example: '8901234567890' },
                    variants: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['variantName'],
                        properties: {
                          variantName: { type: 'string', example: '500 ML' },
                          shortName: { type: 'string', example: 'Confidor 500ML' },
                          sku: { type: 'string', example: 'CONF-500ML' },
                          barcode: { type: 'string', example: '8901234567891' },
                          unit: { type: 'string', example: 'ML' },
                          purchasePrice: { type: 'number', example: 1300 },
                          mrp: { type: 'number', example: 1700 },
                          sellingPrice: { type: 'number', example: 1550 },
                          taxRate: { type: 'number', example: 5 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Product and variants created successfully' }, 403: { description: 'Category or Product Type belongs to another shop' } },
        },
      },
      '/products/{id}': {
        get: {
          tags: ['Products'],
          summary: 'Get Product Details, Variants & Batch Stock',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Product details, variants list & batch stock' }, 404: { description: 'Product not found' } },
        },
        put: {
          tags: ['Products'],
          summary: 'Update Product Master Details',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Product updated' } },
        },
        delete: {
          tags: ['Products'],
          summary: 'Deactivate Product',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Product deactivated' } },
        },
      },

      // 7. INVENTORY & STOCK MANAGEMENT
      '/inventory/metrics': {
        get: {
          tags: ['Inventory'],
          summary: 'Get Dashboard Inventory Metrics Summary',
          responses: { 200: { description: 'Inventory metrics summary (total, low stock, out of stock, near expiry, expired)' } },
        },
      },
      '/inventory': {
        get: {
          tags: ['Inventory'],
          summary: 'List Overall Product Stock Summary',
          parameters: [
            { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Search by product name, shortName, code, brand, barcode' },
            { in: 'query', name: 'categoryId', schema: { type: 'string' } },
            { in: 'query', name: 'status', schema: { type: 'string', enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'] } },
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'Inventory stock summary list retrieved' } },
        },
      },
      '/inventory/low-stock': {
        get: {
          tags: ['Inventory'],
          summary: 'Get Low Stock & Out of Stock Alert Products',
          responses: { 200: { description: 'Low stock products list' } },
        },
      },
      '/inventory/near-expiry': {
        get: {
          tags: ['Inventory'],
          summary: 'Get Active Batches Expiring Soon (Default 30 Days)',
          parameters: [{ in: 'query', name: 'days', schema: { type: 'integer', default: 30 } }],
          responses: { 200: { description: 'Batches near expiry' } },
        },
      },
      '/inventory/expired': {
        get: {
          tags: ['Inventory'],
          summary: 'Get Expired Inventory Stock Batches',
          responses: { 200: { description: 'Expired stock batches' } },
        },
      },
      '/inventory/transactions': {
        get: {
          tags: ['Inventory'],
          summary: 'Get Stock Movement Transactions History',
          parameters: [
            { in: 'query', name: 'type', schema: { type: 'string', enum: ['RESTOCK', 'STOCK_IN', 'SALE', 'ADJUSTMENT', 'DAMAGE', 'RETURN'] } },
            { in: 'query', name: 'productId', schema: { type: 'string' } },
            { in: 'query', name: 'batchId', schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Stock movement transaction history' } },
        },
      },
      '/inventory/adjustments': {
        post: {
          tags: ['Inventory'],
          summary: 'Perform Stock Adjustment / Damage Write-Off',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['batchId', 'adjustmentQuantity', 'reason'],
                  properties: {
                    batchId: { type: 'string', example: 'batch-uuid' },
                    type: { type: 'string', enum: ['INCREASE', 'DECREASE'], default: 'DECREASE' },
                    adjustmentQuantity: { type: 'integer', example: 3 },
                    reason: { type: 'string', example: 'Physical stock shortage' },
                    notes: { type: 'string', example: 'Audit physical count on 22 Aug' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Stock adjusted successfully' },
            400: { description: 'Negative stock attempted or missing reason' },
            404: { description: 'Inventory batch not found in shop' },
          },
        },
      },
      '/inventory/product/{productId}': {
        get: {
          tags: ['Inventory'],
          summary: 'Get Product Inventory Profile & Batch Breakdown',
          parameters: [{ in: 'path', name: 'productId', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Product inventory profile' } },
        },
      },
      '/inventory/product/{productId}/batches': {
        get: {
          tags: ['Inventory'],
          summary: 'Get All Inventory Batches for a Specific Product',
          parameters: [{ in: 'path', name: 'productId', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Product batches list' } },
        },
      },

      // 8. SUPPLIERS
      '/suppliers': {
        get: {
          tags: ['Suppliers'],
          summary: 'List Distributors / Suppliers',
          parameters: [
            { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Search by name, company, phone, or products' },
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'Suppliers list retrieved' } },
        },
        post: {
          tags: ['Suppliers'],
          summary: 'Create Supplier Profile',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'phone'],
                  properties: {
                    name: { type: 'string', example: 'IFFCO Distributor' },
                    companyName: { type: 'string', example: 'IFFCO Agro Supplies' },
                    phone: { type: 'string', example: '+919876543210' },
                    alternatePhone: { type: 'string', example: '+919876543211' },
                    email: { type: 'string', example: 'iffco@agro.com' },
                    address: { type: 'string', example: 'Main Market Road, Nagpur' },
                    gstin: { type: 'string', example: '27AAAAA0000A1Z5' },
                    suppliedProducts: { type: 'string', example: 'Urea, DAP, NPK' },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Supplier created successfully' }, 409: { description: 'Phone number already registered in shop' } },
        },
      },
      '/suppliers/{id}': {
        get: {
          tags: ['Suppliers'],
          summary: 'Get Supplier Profile Details',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Supplier profile details' }, 404: { description: 'Supplier not found' } },
        },
        put: {
          tags: ['Suppliers'],
          summary: 'Update Supplier Profile',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Supplier profile updated' } },
        },
        delete: {
          tags: ['Suppliers'],
          summary: 'Deactivate Supplier Profile',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Supplier deactivated' } },
        },
      },
      '/suppliers/{id}/products': {
        get: {
          tags: ['Suppliers'],
          summary: 'Get Products Previously Supplied by Distributor',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Supplied products list with last restock price' } },
        },
      },
      '/suppliers/{id}/restocks': {
        get: {
          tags: ['Suppliers'],
          summary: 'Get Past Restock & Order History from Supplier',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Restock history records' } },
        },
      },

      // 8.5 RESTOCK MANAGEMENT
      '/restocks': {
        get: {
          tags: ['Restock Management'],
          summary: 'List Restock Stock Intake History',
          parameters: [
            { in: 'query', name: 'supplierId', schema: { type: 'string' } },
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'Restock stock intake records retrieved' } },
        },
        post: {
          tags: ['Restock Management'],
          summary: 'Perform Multi-Product Restock Stock Intake Transaction',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['supplierId', 'items'],
                  properties: {
                    supplierId: { type: 'string', example: 'supplier-uuid' },
                    restockDate: { type: 'string', format: 'date', example: '2026-08-22' },
                    notes: { type: 'string', example: 'Monthly fertilizer restock' },
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['productId', 'quantity', 'purchasePrice'],
                        properties: {
                          productId: { type: 'string', example: 'product-uuid' },
                          variantId: { type: 'string', example: 'variant-uuid' },
                          quantity: { type: 'integer', example: 50 },
                          purchasePrice: { type: 'number', example: 1200 },
                          mrp: { type: 'number', example: 1500 },
                          sellingPrice: { type: 'number', example: 1350 },
                          batchNumber: { type: 'string', example: 'UREA2026A' },
                          expiryDate: { type: 'string', format: 'date', example: '2028-08-20' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Stock restocked successfully and inventory updated' }, 403: { description: 'Supplier or Product belongs to another shop' } },
        },
      },
      '/restocks/{id}': {
        get: {
          tags: ['Restock Management'],
          summary: 'Get Restock Transaction Details',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Restock transaction details' }, 404: { description: 'Restock record not found' } },
        },
      },

      // 9. POS BILLING
      '/billing': {
        get: {
          tags: ['POS Billing'],
          summary: 'List POS Sales Invoices History',
          parameters: [
            { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Search by invoice number (e.g. INV-2026080001), farmer name, or mobile' },
            { in: 'query', name: 'farmerId', schema: { type: 'string' } },
            { in: 'query', name: 'paymentStatus', schema: { type: 'string', enum: ['PAID', 'PARTIAL', 'UNPAID', 'CANCELLED'] } },
            { in: 'query', name: 'paymentMethod', schema: { type: 'string' } },
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'Invoices list retrieved' } },
        },
        post: {
          tags: ['POS Billing'],
          summary: 'Generate POS Sales Invoice & Deduct Inventory Stock (Auto Sequence INV-YYYYMMDDDD, No Tax)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['items'],
                  properties: {
                    farmerId: { type: 'string', example: 'farmer-uuid' },
                    customerType: { type: 'string', enum: ['FARMER', 'WALK_IN_CUSTOMER'], default: 'FARMER' },
                    customerName: { type: 'string', example: 'Ramesh Patel' },
                    customerPhone: { type: 'string', example: '+919876543210' },
                    paymentMethod: { type: 'string', enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT'], default: 'CASH' },
                    amountReceived: { type: 'number', example: 5000 },
                    paidAmount: { type: 'number', example: 4956 },
                    billDiscount: { type: 'number', example: 100 },
                    notes: { type: 'string', example: 'Regular purchase' },
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['productId', 'quantity'],
                        properties: {
                          productId: { type: 'string', example: 'product-uuid-1' },
                          variantId: { type: 'string', example: 'variant-uuid-1' },
                          batchId: { type: 'string', example: 'batch-uuid-1' },
                          quantity: { type: 'integer', example: 2 },
                          unitPrice: { type: 'number', example: 1350 },
                          discount: { type: 'number', example: 0 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'POS Invoice generated successfully with sequence INV-YYYYMMDDDD and stock deducted' },
            400: { description: 'Insufficient stock or invalid input' },
            404: { description: 'Product or Farmer not found in shop' },
          },
        },
      },
      '/billing/summary': {
        get: {
          tags: ['POS Billing'],
          summary: 'Get Daily Sales & Payment Breakdown Summary',
          parameters: [{ in: 'query', name: 'date', schema: { type: 'string', format: 'date' }, description: 'Target date (YYYY-MM-DD)' }],
          responses: { 200: { description: 'Sales summary metrics' } },
        },
      },
      '/billing/{id}': {
        get: {
          tags: ['POS Billing'],
          summary: 'Get Full Invoice Details',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Invoice details retrieved' }, 404: { description: 'Invoice not found' } },
        },
      },
      '/billing/{id}/receipt': {
        get: {
          tags: ['POS Billing'],
          summary: 'Get Printable POS Receipt Payload',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Structured receipt layout payload' } },
        },
      },
      '/billing/{id}/cancel': {
        post: {
          tags: ['POS Billing'],
          summary: 'Cancel Invoice & Reversely Restock Inventory + Revert Khata',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['reason'],
                  properties: {
                    reason: { type: 'string', example: 'Customer cancelled purchase' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Invoice cancelled and stock reversed' } },
        },
      },

      // 9b. FARMER CREDIT & DUE MANAGEMENT
      '/farmer-credit': {
        get: {
          tags: ['Farmer Credit & Due'],
          summary: 'List Farmer Outstanding Dues Directory',
          parameters: [
            { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Search farmer by name, mobile, or village' },
            { in: 'query', name: 'status', schema: { type: 'string', enum: ['ALL', 'DUE', 'OVERDUE', 'NO_DUE'] } },
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'Farmer credit directory retrieved' } },
        },
      },
      '/farmer-credit/summary': {
        get: {
          tags: ['Farmer Credit & Due'],
          summary: 'Get Farmer Credit Dashboard Metrics Overview Summary',
          responses: { 200: { description: 'Total outstanding, total overdue, farmers with due, collection metrics' } },
        },
      },
      '/farmer-credit/overdue': {
        get: {
          tags: ['Farmer Credit & Due'],
          summary: 'List Overdue Unpaid Invoices Directory (>30 Days)',
          parameters: [
            { in: 'query', name: 'search', schema: { type: 'string' } },
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'Overdue invoices list with days overdue' } },
        },
      },
      '/farmer-credit/payments': {
        post: {
          tags: ['Farmer Credit & Due'],
          summary: 'Record Farmer Due Payment (Allocates to Oldest Dues First & Reduces Khata Balance)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['farmerId', 'amount'],
                  properties: {
                    farmerId: { type: 'string', example: 'farmer-uuid' },
                    invoiceId: { type: 'string', example: 'invoice-uuid-optional' },
                    amount: { type: 'number', example: 2000 },
                    method: { type: 'string', enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE'], default: 'CASH' },
                    txnRef: { type: 'string', example: 'UPI123456789' },
                    notes: { type: 'string', example: 'Partial due payment' },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Farmer payment recorded and khata balance updated' }, 400: { description: 'Payment exceeds outstanding balance' } },
        },
      },
      '/farmer-credit/invoices/{invoiceId}/settle': {
        patch: {
          tags: ['Farmer Credit & Due'],
          summary: 'Single-Click Pending Bill Status Settlement (Marks Invoice PAID & Decrements Khata Balance)',
          parameters: [{ in: 'path', name: 'invoiceId', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    paymentMethod: { type: 'string', enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE'], default: 'CASH' },
                    paymentRef: { type: 'string', example: 'UPI987654321' },
                    notes: { type: 'string', example: 'Settled pending bill in full' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Invoice status changed to PAID and khata balance cleared' } },
        },
      },
      '/farmer-credit/payments/{paymentId}/receipt': {
        get: {
          tags: ['Farmer Credit & Due'],
          summary: 'Get Printable POS Payment Receipt Payload',
          parameters: [{ in: 'path', name: 'paymentId', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Structured payment receipt layout' } },
        },
      },
      '/farmer-credit/payments/{paymentId}/reverse': {
        post: {
          tags: ['Farmer Credit & Due'],
          summary: 'Reverse Incorrect Payment & Restore Farmer Khata Balance (Audit Preserved)',
          parameters: [{ in: 'path', name: 'paymentId', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['reason'],
                  properties: {
                    reason: { type: 'string', example: 'Payment entered against wrong farmer account' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Payment reversed and balance restored' } },
        },
      },
      '/farmer-credit/farmers/{farmerId}/summary': {
        get: {
          tags: ['Farmer Credit & Due'],
          summary: 'Get Farmer Credit Profile Summary',
          parameters: [{ in: 'path', name: 'farmerId', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Farmer credit profile details' } },
        },
      },
      '/farmer-credit/farmers/{farmerId}/ledger': {
        get: {
          tags: ['Farmer Credit & Due'],
          summary: 'Get Farmer Ledger Account Statement with Running Balances',
          parameters: [
            { in: 'path', name: 'farmerId', required: true, schema: { type: 'string' } },
            { in: 'query', name: 'fromDate', schema: { type: 'string', format: 'date' } },
            { in: 'query', name: 'toDate', schema: { type: 'string', format: 'date' } },
          ],
          responses: { 200: { description: 'Farmer ledger statement retrieved' } },
        },
      },
      '/farmer-credit/farmers/{farmerId}/credit-limit': {
        patch: {
          tags: ['Farmer Credit & Due'],
          summary: 'Update Farmer Credit Limit (Owner Only)',
          parameters: [{ in: 'path', name: 'farmerId', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['creditLimit'],
                  properties: {
                    creditLimit: { type: 'number', example: 50000 },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Credit limit updated' }, 403: { description: 'Forbidden - Owner role required' } },
        },
      },

      // 10. PAYMENTS
      '/payments': {
        post: { tags: ['Payments'], summary: 'Record Payment against Invoice or Khata Ledger' },
        get: { tags: ['Payments'], summary: 'List Payments History' },
      },
      '/payments/{id}': {
        get: { tags: ['Payments'], summary: 'Get Payment Details' },
      },

      // 11. KHATA LEDGER
      '/khata/farmer/{farmerId}': {
        get: { tags: ['Khata Ledger'], summary: 'Get Farmer Ledger Account Statement' },
      },
      '/khata/supplier/{supplierId}': {
        get: { tags: ['Khata Ledger'], summary: 'Get Supplier Ledger Account Statement' },
      },
      '/khata/entry': {
        post: { tags: ['Khata Ledger'], summary: 'Add Manual Khata Debit/Credit Transaction' },
      },

      // 12. CASH CLOSING
      '/cash-closing/open': {
        post: { tags: ['Cash Closing'], summary: 'Open Daily Counter Cash Register' },
      },
      '/cash-closing/{id}/close': {
        post: { tags: ['Cash Closing'], summary: 'Tally & Close Daily Cash Counter' },
      },
      '/cash-closing': {
        get: { tags: ['Cash Closing'], summary: 'List Cash Closing History' },
      },
      '/cash-closing/{id}': {
        get: { tags: ['Cash Closing'], summary: 'Get Cash Counter Session Details' },
      },

      // 13. REPORTS & ANALYTICS
      '/reports/sales': {
        get: {
          tags: ['Reports & Analytics'],
          summary: 'Generate Sales Summary Report (Filters: today, yesterday, this_week, this_month, custom)',
          parameters: [
            { in: 'query', name: 'filter', schema: { type: 'string', enum: ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_year', 'custom'] } },
            { in: 'query', name: 'fromDate', schema: { type: 'string', format: 'date' } },
            { in: 'query', name: 'toDate', schema: { type: 'string', format: 'date' } },
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'Sales report summary and invoices list' } },
        },
      },
      '/reports/purchases': {
        get: {
          tags: ['Reports & Analytics'],
          summary: 'Generate Restock Purchases Report',
          parameters: [
            { in: 'query', name: 'filter', schema: { type: 'string' } },
            { in: 'query', name: 'fromDate', schema: { type: 'string', format: 'date' } },
            { in: 'query', name: 'toDate', schema: { type: 'string', format: 'date' } },
          ],
          responses: { 200: { description: 'Purchases report summary and batches list' } },
        },
      },
      '/reports/profit': {
        get: {
          tags: ['Reports & Analytics'],
          summary: 'Generate Gross Profit & Margin Report (COGS from Batch Purchase Price)',
          parameters: [{ in: 'query', name: 'filter', schema: { type: 'string' } }],
          responses: { 200: { description: 'Profit revenue, cost, gross profit, and margin percentage' } },
        },
      },
      '/reports/products/sales': {
        get: {
          tags: ['Reports & Analytics'],
          summary: 'Get Product Sales Report & Top Selling Products',
          parameters: [
            { in: 'query', name: 'sortBy', schema: { type: 'string', enum: ['quantity', 'revenue', 'profit'] } },
          ],
          responses: { 200: { description: 'Product-wise sales performance breakdown' } },
        },
      },
      '/reports/products/purchases': {
        get: {
          tags: ['Reports & Analytics'],
          summary: 'Get Product Purchase & Restock Cost Report',
          responses: { 200: { description: 'Product-wise restock purchase summary' } },
        },
      },
      '/reports/categories/sales': {
        get: {
          tags: ['Reports & Analytics'],
          summary: 'Get Category Sales Performance Report',
          responses: { 200: { description: 'Category-wise revenue and profit breakdown' } },
        },
      },
      '/reports/farmers/sales': {
        get: {
          tags: ['Reports & Analytics'],
          summary: 'Get Farmer Purchase History & Top Farmers Ranking',
          responses: { 200: { description: 'Farmer purchase history and top buyers' } },
        },
      },
      '/reports/suppliers/purchases': {
        get: {
          tags: ['Reports & Analytics'],
          summary: 'Get Supplier Purchase Value & Top Suppliers Ranking',
          responses: { 200: { description: 'Supplier restocks breakdown and top suppliers' } },
        },
      },
      '/reports/payments': {
        get: {
          tags: ['Reports & Analytics'],
          summary: 'Generate Payment Collection Breakdown Report by Method',
          responses: { 200: { description: 'Payments collected by CASH, UPI, CARD, CREDIT' } },
        },
      },
      '/reports/credit': {
        get: {
          tags: ['Reports & Analytics'],
          summary: 'Generate Farmer Credit & Due Balance Summary Report',
          responses: { 200: { description: 'Total credit sales, collections, outstanding, overdue' } },
        },
      },
      '/reports/inventory': {
        get: {
          tags: ['Reports & Analytics'],
          summary: 'Generate Stock Inventory Movement Report (In, Out, Adjustments)',
          responses: { 200: { description: 'Stock movement per product' } },
        },
      },
      '/reports/daily': {
        get: {
          tags: ['Reports & Analytics'],
          summary: 'Get Daily Business Summary Overview',
          parameters: [{ in: 'query', name: 'date', schema: { type: 'string', format: 'date' } }],
          responses: { 200: { description: 'Daily sales, purchases, profit, collection metrics' } },
        },
      },
      '/reports/monthly': {
        get: {
          tags: ['Reports & Analytics'],
          summary: 'Get Monthly Business Summary Overview',
          parameters: [
            { in: 'query', name: 'year', schema: { type: 'integer' } },
            { in: 'query', name: 'month', schema: { type: 'integer' } },
          ],
          responses: { 200: { description: 'Monthly aggregated business metrics' } },
        },
      },
      '/reports/sales/trend': {
        get: {
          tags: ['Reports & Analytics'],
          summary: 'Get Daily Sales Trend Array for Line/Bar Charts',
          responses: { 200: { description: 'Sales trend chart data' } },
        },
      },
      '/reports/purchases/trend': {
        get: {
          tags: ['Reports & Analytics'],
          summary: 'Get Daily Purchases Trend Array for Charts',
          responses: { 200: { description: 'Purchases trend chart data' } },
        },
      },
      '/reports/profit/trend': {
        get: {
          tags: ['Reports & Analytics'],
          summary: 'Get Daily Gross Profit Trend Array for Charts',
          responses: { 200: { description: 'Profit trend chart data' } },
        },
      },

      // 14. DASHBOARD
      '/dashboard/summary': {
        get: {
          tags: ['Dashboard'],
          summary: 'Get Real-time Owner Dashboard Business Summary (sales, purchases, profit, credit, farmers, products, inventory)',
          parameters: [
            { in: 'query', name: 'filter', schema: { type: 'string', enum: ['today', 'yesterday', 'this_week', 'this_month', 'custom'] } },
            { in: 'query', name: 'fromDate', schema: { type: 'string', format: 'date' } },
            { in: 'query', name: 'toDate', schema: { type: 'string', format: 'date' } },
          ],
          responses: { 200: { description: 'Real-time dashboard metrics overview' } },
        },
      },
      '/dashboard/sales-trend': {
        get: {
          tags: ['Dashboard'],
          summary: 'Get Dashboard Sales Trend Array for Chart Rendering',
          parameters: [{ in: 'query', name: 'filter', schema: { type: 'string' } }],
          responses: { 200: { description: 'Daily sales trend array' } },
        },
      },
      '/dashboard/top-products': {
        get: {
          tags: ['Dashboard'],
          summary: 'Get Top Selling Products Breakdown',
          parameters: [
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 5 } },
            { in: 'query', name: 'sortBy', schema: { type: 'string', enum: ['quantity', 'revenue', 'profit'] } },
          ],
          responses: { 200: { description: 'Top selling products array' } },
        },
      },
      '/dashboard/low-stock': {
        get: {
          tags: ['Dashboard'],
          summary: 'Get Low Stock & Out of Stock Inventory Alerts List',
          responses: { 200: { description: 'Low stock and out of stock products' } },
        },
      },
      '/dashboard/credit': {
        get: {
          tags: ['Dashboard'],
          summary: 'Get Farmer Credit & Outstanding Due Summary Widget',
          responses: { 200: { description: 'Total outstanding, overdue, farmers count, top due farmers' } },
        },
      },
      '/dashboard/recent-sales': {
        get: {
          tags: ['Dashboard'],
          summary: 'Get Recent Valid Sales Invoices (Latest 10)',
          parameters: [{ in: 'query', name: 'limit', schema: { type: 'integer', default: 10 } }],
          responses: { 200: { description: 'Latest sales invoices list' } },
        },
      },
      '/dashboard/recent-payments': {
        get: {
          tags: ['Dashboard'],
          summary: 'Get Recent Farmer Payments (Latest 10)',
          parameters: [{ in: 'query', name: 'limit', schema: { type: 'integer', default: 10 } }],
          responses: { 200: { description: 'Latest payments list' } },
        },
      },
      '/dashboard/recent-restocks': {
        get: {
          tags: ['Dashboard'],
          summary: 'Get Recent Restock Intake Orders (Latest 10)',
          parameters: [{ in: 'query', name: 'limit', schema: { type: 'integer', default: 10 } }],
          responses: { 200: { description: 'Latest restock orders list' } },
        },
      },

      // 15. SETTINGS
      '/settings': {
        get: { tags: ['Settings'], summary: 'Get All Shop Settings & Configurations (With Agricultural Defaults)' },
      },
      '/settings/shop': {
        put: { tags: ['Settings'], summary: 'Update Shop Profile (Name, Address, Licenses, Contact)' },
      },
      '/settings/profile': {
        put: { tags: ['Settings'], summary: 'Update Owner Profile (Full Name, Email, Mobile)' },
      },
      '/settings/billing': {
        put: { tags: ['Settings'], summary: 'Update Billing & POS Configurations (Credit Sales, Farmer Guard, Max Discount)' },
      },
      '/settings/tax': {
        put: { tags: ['Settings'], summary: 'Update Tax & GST Configurations (GSTIN, Tax Rate Default 0%)' },
      },
      '/settings/inventory': {
        put: { tags: ['Settings'], summary: 'Update Inventory Configurations (Negative Stock, Expiry Warning Days)' },
      },
      '/settings/credit': {
        put: { tags: ['Settings'], summary: 'Update Credit & Due Configurations (Credit Period, Max Credit Limit)' },
      },
      '/settings/regional': {
        put: { tags: ['Settings'], summary: 'Update Regional & Language Settings (Language, Currency INR, Timezone)' },
      },
      '/settings/invoice': {
        put: { tags: ['Settings'], summary: 'Update Invoice Layout Configurations (Prefix, Footer Message)' },
      },
      '/settings/audit-logs': {
        get: { tags: ['Settings'], summary: 'Get Business Activity & System Audit Log History' },
      },

      // 16. RETURNS MANAGEMENT
      '/returns/summary': {
        get: {
          tags: ['Returns Management'],
          summary: 'Get Returns Summary Metrics (Sales & Purchase Returns Counts & Amounts)',
          responses: { 200: { description: 'Returns summary metrics' } },
        },
      },
      '/returns/sales': {
        post: {
          tags: ['Returns Management'],
          summary: 'Create Sales Return (Stock IN for GOOD condition, Credit/Khata Adjustment)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['invoiceId', 'items', 'reason'],
                  properties: {
                    invoiceId: { type: 'string' },
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          invoiceItemId: { type: 'string' },
                          quantity: { type: 'integer' },
                          condition: { type: 'string', enum: ['GOOD', 'DAMAGED', 'EXPIRED'] },
                        },
                      },
                    },
                    reason: { type: 'string', enum: ['DAMAGED', 'DEFECTIVE', 'WRONG_PRODUCT', 'EXPIRED', 'CUSTOMER_CHANGED_MIND', 'WRONG_QUANTITY', 'QUALITY_ISSUE', 'OTHER'] },
                    refundMethod: { type: 'string', enum: ['STORE_CREDIT', 'CASH', 'UPI', 'BANK_TRANSFER', 'ADJUST_DUE'] },
                    notes: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Sales return created' } },
        },
        get: {
          tags: ['Returns Management'],
          summary: 'Get Sales Returns Directory & History List',
          responses: { 200: { description: 'Sales returns list' } },
        },
      },
      '/returns/sales/{id}': {
        get: {
          tags: ['Returns Management'],
          summary: 'Get Sales Return Details View',
          responses: { 200: { description: 'Sales return details' } },
        },
      },
      '/returns/sales/{id}/reverse': {
        post: {
          tags: ['Returns Management'],
          summary: 'Reverse Sales Return (Owner Only - Reverses Stock & Credit Reversal)',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { reason: { type: 'string' } } } } },
          },
          responses: { 200: { description: 'Sales return reversed' } },
        },
      },
      '/returns/purchases': {
        post: {
          tags: ['Returns Management'],
          summary: 'Create Purchase Return (Stock OUT, Supplier Khata Adjustment)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['items', 'reason'],
                  properties: {
                    restockId: { type: 'string' },
                    supplierId: { type: 'string' },
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          batchId: { type: 'string' },
                          quantity: { type: 'integer' },
                          condition: { type: 'string', enum: ['GOOD', 'DAMAGED', 'EXPIRED'] },
                        },
                      },
                    },
                    reason: { type: 'string', enum: ['DAMAGED', 'DEFECTIVE', 'EXPIRED', 'WRONG_SUPPLY', 'QUALITY_ISSUE', 'OTHER'] },
                    settlementMethod: { type: 'string', enum: ['SUPPLIER_CREDIT', 'SUPPLIER_REFUND', 'ADJUST_PAYABLE'] },
                    notes: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Purchase return created' } },
        },
        get: {
          tags: ['Returns Management'],
          summary: 'Get Purchase Returns Directory & History List',
          responses: { 200: { description: 'Purchase returns list' } },
        },
      },
      '/returns/purchases/{id}': {
        get: {
          tags: ['Returns Management'],
          summary: 'Get Purchase Return Details View',
          responses: { 200: { description: 'Purchase return details' } },
        },
      },
      '/returns/purchases/{id}/reverse': {
        post: {
          tags: ['Returns Management'],
          summary: 'Reverse Purchase Return (Owner Only - Reverses Stock OUT & Supplier Balance)',
          responses: { 200: { description: 'Purchase return reversed' } },
        },
      },

      // 17. NOTIFICATION & ALERTS
      '/notifications/unread-count': {
        get: {
          tags: ['Notification & Alerts'],
          summary: 'Get Unread Notifications Count for Navbar Bell Badge',
          responses: { 200: { description: 'Unread count object { count: number }' } },
        },
      },
      '/notifications': {
        get: {
          tags: ['Notification & Alerts'],
          summary: 'Get Paginated Notifications List with Filters (isRead, type, priority)',
          parameters: [
            { in: 'query', name: 'isRead', schema: { type: 'boolean' } },
            { in: 'query', name: 'type', schema: { type: 'string' } },
            { in: 'query', name: 'priority', schema: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] } },
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'Notifications list and pagination metadata' } },
        },
      },
      '/notifications/preferences': {
        get: {
          tags: ['Notification & Alerts'],
          summary: 'Get User Notification Alert Preferences',
          responses: { 200: { description: 'Notification settings preferences' } },
        },
        patch: {
          tags: ['Notification & Alerts'],
          summary: 'Update User Notification Alert Preferences',
          responses: { 200: { description: 'Updated preferences' } },
        },
      },
      '/notifications/read-all': {
        patch: {
          tags: ['Notification & Alerts'],
          summary: 'Mark All Unread Notifications as Read for Current User/Shop',
          responses: { 200: { description: 'All notifications marked as read' } },
        },
      },
      '/notifications/evaluate-alerts': {
        post: {
          tags: ['Notification & Alerts'],
          summary: 'Trigger Scan for Low Stock, Out of Stock, Overdue Credit, and Expiry Alerts',
          responses: { 200: { description: 'Alert evaluation completed' } },
        },
      },
      '/notifications/{id}': {
        get: {
          tags: ['Notification & Alerts'],
          summary: 'Get Notification Details View',
          responses: { 200: { description: 'Notification details' } },
        },
        delete: {
          tags: ['Notification & Alerts'],
          summary: 'Delete Notification Record',
          responses: { 200: { description: 'Notification deleted' } },
        },
      },
      '/notifications/{id}/read': {
        patch: {
          tags: ['Notification & Alerts'],
          summary: 'Mark Single Notification as Read',
          responses: { 200: { description: 'Notification marked as read' } },
        },
      },

      // 18. EXPORT & BACKUP MANAGEMENT
      '/exports': {
        post: {
          tags: ['Export & Backup Management'],
          summary: 'Generate Data Export File (CSV / JSON)',
          responses: { 201: { description: 'Export log created with file link' } },
        },
        get: {
          tags: ['Export & Backup Management'],
          summary: 'Get Export History List',
          responses: { 200: { description: 'Export history list' } },
        },
      },
      '/exports/{id}/download': {
        get: {
          tags: ['Export & Backup Management'],
          summary: 'Download Export File',
          responses: { 200: { description: 'File binary stream' } },
        },
      },
      '/backups': {
        post: {
          tags: ['Export & Backup Management'],
          summary: 'Create Database Logical JSON Backup File (Owner Only)',
          responses: { 201: { description: 'Backup log created' } },
        },
        get: {
          tags: ['Export & Backup Management'],
          summary: 'Get Backup History List (Owner Only)',
          responses: { 200: { description: 'Backup history list' } },
        },
      },
      '/backups/{id}/download': {
        get: {
          tags: ['Export & Backup Management'],
          summary: 'Download Backup File (Owner Only)',
          responses: { 200: { description: 'Backup file binary stream' } },
        },
      },
      '/backups/{id}': {
        delete: {
          tags: ['Export & Backup Management'],
          summary: 'Delete Backup File (Owner Only)',
          responses: { 200: { description: 'Backup file deleted' } },
        },
      },
      '/backups/{id}/restore': {
        post: {
          tags: ['Export & Backup Management'],
          summary: 'Controlled Safety Backup Restore (Owner Only - Creates Safety Backup First)',
          responses: { 200: { description: 'Backup safety restored' } },
        },
      },

      // 19. AUDIT LOGS
      '/audit-logs': {
        get: {
          tags: ['Audit Logs'],
          summary: 'Get System Audit Logs History with Filters (module, action, userId, date range)',
          parameters: [
            { in: 'query', name: 'module', schema: { type: 'string' } },
            { in: 'query', name: 'action', schema: { type: 'string' } },
            { in: 'query', name: 'userId', schema: { type: 'string' } },
            { in: 'query', name: 'fromDate', schema: { type: 'string', format: 'date' } },
            { in: 'query', name: 'toDate', schema: { type: 'string', format: 'date' } },
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
            { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
          ],
          responses: { 200: { description: 'Paginated audit logs list' } },
        },
      },
      '/audit-logs/{id}': {
        get: {
          tags: ['Audit Logs'],
          summary: 'Get Single Audit Log Details View',
          responses: { 200: { description: 'Audit log details object' } },
        },
      },
    },
  },
  apis: ['./src/modules/**/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
