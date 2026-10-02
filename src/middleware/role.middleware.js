const { errorResponse } = require('../utils/response');

// Granular Role-to-Permissions Mapping Table
const ROLE_PERMISSIONS = {
  SUPER_ADMIN: ['*'],
  OWNER: ['*'],
  ADMIN: [
    'FARMER_VIEW', 'FARMER_CREATE', 'FARMER_UPDATE', 'FARMER_DELETE',
    'PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE',
    'CATEGORY_VIEW', 'CATEGORY_CREATE', 'CATEGORY_UPDATE', 'CATEGORY_DELETE',
    'INVENTORY_VIEW', 'INVENTORY_MANAGE',
    'SUPPLIER_VIEW', 'SUPPLIER_CREATE', 'SUPPLIER_UPDATE', 'SUPPLIER_DELETE',
    'BILL_VIEW', 'BILL_CREATE', 'BILL_CANCEL',
    'PAYMENT_VIEW', 'PAYMENT_CREATE',
    'KHATA_VIEW', 'KHATA_MANAGE',
    'CASH_VIEW', 'CASH_MANAGE',
    'REPORT_VIEW',
    'SETTING_VIEW', 'SETTING_MANAGE',
    'REMINDER_VIEW', 'REMINDER_MANAGE',
    'SALES_HISTORY_VIEW', 'SALES_HISTORY_EXPORT',
    'EXPENSE_VIEW', 'EXPENSE_MANAGE', 'REVENUE_VIEW',
  ],
  BILLING_STAFF: [
    'FARMER_VIEW', 'FARMER_CREATE', 'FARMER_UPDATE',
    'PRODUCT_VIEW',
    'CATEGORY_VIEW',
    'INVENTORY_VIEW',
    'BILL_VIEW', 'BILL_CREATE', 'BILLING_VIEW', 'BILLING_CREATE',
    'PAYMENT_VIEW', 'PAYMENT_CREATE',
    'REMINDER_VIEW', 'REMINDER_MANAGE',
    'SALES_HISTORY_VIEW',
  ],
  ACCOUNTANT: [
    'PAYMENT_VIEW', 'PAYMENT_CREATE',
    'KHATA_VIEW', 'KHATA_MANAGE',
    'CASH_VIEW', 'CASH_MANAGE',
    'REPORT_VIEW',
    'BILL_VIEW',
    'SUPPLIER_VIEW',
    'REMINDER_VIEW', 'REMINDER_MANAGE',
    'SALES_HISTORY_VIEW', 'SALES_HISTORY_EXPORT',
    'EXPENSE_VIEW', 'EXPENSE_MANAGE', 'REVENUE_VIEW',
  ],
  VIEWER: [
    'FARMER_VIEW',
    'PRODUCT_VIEW',
    'CATEGORY_VIEW',
    'INVENTORY_VIEW',
    'SUPPLIER_VIEW',
    'BILL_VIEW',
    'PAYMENT_VIEW',
    'KHATA_VIEW',
    'CASH_VIEW',
    'REPORT_VIEW',
    'SETTING_VIEW',
    'REMINDER_VIEW',
    'SALES_HISTORY_VIEW',
    'EXPENSE_VIEW', 'REVENUE_VIEW',
  ],
};

function hasPermission(userRole, requiredPermission) {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  if (permissions.includes('*')) {
    return true;
  }
  return permissions.includes(requiredPermission);
}

/**
 * Middleware enforcing specific user role(s) e.g. OWNER, ADMIN, BILLING_STAFF, ACCOUNTANT, VIEWER
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401);
    }

    if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'OWNER') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(res, 'You do not have permission to perform this action', 403);
    }

    next();
  };
}

/**
 * Middleware enforcing specific granular permission(s) e.g. FARMER_CREATE, BILL_CREATE, REPORT_VIEW
 */
function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401);
    }

    const userRole = req.user.role;

    const isAuthorized = requiredPermissions.every((perm) => hasPermission(userRole, perm));

    if (!isAuthorized) {
      return errorResponse(res, 'You do not have permission to perform this action', 403);
    }

    next();
  };
}

module.exports = {
  ROLE_PERMISSIONS,
  hasPermission,
  requireRole,
  requirePermission,
  authorize: requireRole,
  roleMiddleware: requireRole,
};
