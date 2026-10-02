const posService = require('./pos.service');
const { successResponse, errorResponse } = require('../../utils/response');

function resolveShopId(req) {
  if (req.user && req.user.role === 'SUPER_ADMIN') {
    return req.query.shopId || req.body.shopId || req.user.shopId;
  }
  return req.user ? req.user.shopId : null;
}

/**
 * Single-Scan Fast Lookup (Barcode / Shortcode / QR Payload)
 * Route: GET /api/v1/pos/scan?code=...
 */
async function handleScanLookup(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const { code } = req.query;
    if (!code || !String(code).trim()) {
      return errorResponse(res, 'Barcode or product code parameter "code" is required', 400);
    }

    const result = await posService.scanProductByCode(shopId, code);
    return successResponse(res, result, 'Product scanned successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * Paginated Products for Counter Catalogue Generation (Keyset Cursor & Offset)
 * Route: GET /api/v1/pos/catalogue?cursor=...&limit=18&categoryId=...
 */
async function handleGetCatalogue(req, res, next) {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return errorResponse(res, 'Shop ID is required', 400);
    }

    const result = await posService.getCatalogue(shopId, req.query);
    return successResponse(res, result, 'POS catalogue retrieved successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleScanLookup,
  handleGetCatalogue,
};
