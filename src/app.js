const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const env = require('./config/env');
const swaggerSpec = require('./config/swagger');
const { errorHandler } = require('./middleware/error.middleware');
const { apiLimiter } = require('./middleware/rateLimit.middleware');
const { errorResponse, successResponse } = require('./utils/response');

// Import Module Routes
const authRoutes = require('./modules/auth/auth.routes');
const shopRoutes = require('./modules/shops/shops.routes');
const userRoutes = require('./modules/users/users.routes');
const farmerRoutes = require('./modules/farmers/farmers.routes');
const productRoutes = require('./modules/products/products.routes');
const productTypeRoutes = require('./modules/product-types/product-types.routes');
const categoryRoutes = require('./modules/categories/categories.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const supplierRoutes = require('./modules/suppliers/suppliers.routes');
const restockRoutes = require('./modules/restocks/restocks.routes');
const billingRoutes = require('./modules/billing/billing.routes');
const paymentRoutes = require('./modules/payments/payments.routes');
const khataRoutes = require('./modules/khata/khata.routes');
const cashClosingRoutes = require('./modules/cash-closing/cash-closing.routes');
const reportRoutes = require('./modules/reports/reports.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const settingRoutes = require('./modules/settings/settings.routes');

const { i18nMiddleware } = require('./middleware/i18n.middleware');

const app = express();

// Global Middlewares
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(i18nMiddleware);

if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use(apiLimiter);

// Root API Welcome Page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Agro Shop Backend API</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: #1e293b; padding: 2.5rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 500px; width: 90%; }
        h1 { color: #22c55e; margin-bottom: 0.5rem; }
        p { color: #94a3b8; font-size: 1.05rem; }
        .badge { display: inline-block; background: #15803d; color: #fff; padding: 4px 12px; border-radius: 20px; font-weight: bold; margin-bottom: 1.5rem; }
        .btn-group { display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem; }
        .btn { background: #22c55e; color: #0f172a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; transition: background 0.2s; }
        .btn:hover { background: #16a34a; }
        .btn-secondary { background: #334155; color: #f8fafc; }
        .btn-secondary:hover { background: #475569; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🌾 Agro Shop Backend API</h1>
        <div class="badge">● Server Online</div>
        <p>Production-grade RESTful API service for Agro Shop Retail POS, Inventory Expiry, and Khata Ledger System.</p>
        <div class="btn-group">
          <a href="/api-docs" class="btn">📚 Open Swagger Docs</a>
          <a href="/health" class="btn btn-secondary">💚 Health Check</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  return successResponse(res, { status: 'UP', uptime: process.uptime() }, 'Agro Shop Backend API is running healthy');
});

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API v1 Routes Mount
const apiV1Router = express.Router();

const returnRoutes = require('./modules/returns/returns.routes');
const notificationRoutes = require('./modules/notifications/notification.routes');

apiV1Router.use('/auth', authRoutes);
apiV1Router.use('/shops', shopRoutes);
apiV1Router.use('/users', userRoutes);
apiV1Router.use('/farmers', farmerRoutes);
apiV1Router.use('/products', productRoutes);
apiV1Router.use('/product-types', productTypeRoutes);
apiV1Router.use('/categories', categoryRoutes);
apiV1Router.use('/inventory', inventoryRoutes);
apiV1Router.use('/suppliers', supplierRoutes);
apiV1Router.use('/restocks', restockRoutes);
apiV1Router.use('/billing', billingRoutes);
apiV1Router.use('/bills', billingRoutes);
apiV1Router.use('/returns', returnRoutes);
apiV1Router.use('/sales-returns', returnRoutes);
apiV1Router.use('/purchase-returns', returnRoutes);
apiV1Router.use('/notifications', notificationRoutes);
apiV1Router.use('/payments', paymentRoutes);
apiV1Router.use('/khata', khataRoutes);
apiV1Router.use('/cash-closing', cashClosingRoutes);
apiV1Router.use('/reports', reportRoutes);
apiV1Router.use('/dashboard', dashboardRoutes);
const exportRoutes = require('./modules/exports/export.routes');
const backupRoutes = require('./modules/exports/backup.routes');
const auditRoutes = require('./modules/audit-logs/audit.routes');

apiV1Router.use('/exports', exportRoutes);
apiV1Router.use('/backups', backupRoutes);
apiV1Router.use('/settings', settingRoutes);
apiV1Router.use('/audit-logs', auditRoutes);

const farmerCreditRoutes = require('./modules/farmer-credit/farmer-credit.routes');
apiV1Router.use('/farmer-credit', farmerCreditRoutes);

const reminderRoutes = require('./modules/reminders/reminders.routes');
apiV1Router.use('/reminders', reminderRoutes);

const salesHistoryRoutes = require('./modules/sales-history/sales-history.routes');
apiV1Router.use('/sales-history', salesHistoryRoutes);

const posRoutes = require('./modules/pos/pos.routes');
apiV1Router.use('/pos', posRoutes);

const expensesRoutes = require('./modules/expenses/expenses.routes');
apiV1Router.use('/expenses', expensesRoutes);

const revenueRoutes = require('./modules/revenue/revenue.routes');
apiV1Router.use('/revenue', revenueRoutes);

const i18nRoutes = require('./modules/i18n/i18n.routes');
apiV1Router.use('/i18n', i18nRoutes);

app.use('/api/v1', apiV1Router);
app.use('/api/pos', posRoutes);

// 404 Route Handler
app.use((req, res) => {
  return errorResponse(res, `Route not found - ${req.originalUrl}`, 404);
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
