const fs = require('fs');
const path = require('path');
const { prisma } = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { paginateThroughQuery } = require('../../utils/paginationLoop');

const EXPORTS_DIR = path.join(__dirname, '../../../uploads/exports');
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

// Convert Object Array to CSV String
function convertToCSV(dataArray) {
  if (!dataArray || dataArray.length === 0) return 'No data available';
  const headers = Object.keys(dataArray[0]);
  const csvRows = [headers.join(',')];

  for (const row of dataArray) {
    const values = headers.map((header) => {
      let val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

// Data Fetchers for all 11 export types using safe chunked pagination loop
async function fetchExportData(type, shopId, fromDate, toDate) {
  const dateFilter = {};
  if (fromDate) dateFilter.gte = new Date(fromDate);
  if (toDate) dateFilter.lte = new Date(toDate);

  const rows = [];
  const CHUNK_SIZE = 500;

  switch (type) {
    case 'SALES': {
      const where = { shopId };
      if (fromDate || toDate) where.createdAt = dateFilter;
      await paginateThroughQuery(prisma.invoice, {
        where,
        include: { farmer: { select: { name: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        chunkSize: CHUNK_SIZE,
        onBatch: (invoices) => {
          for (const inv of invoices) {
            rows.push({
              InvoiceNumber: inv.invoiceNumber,
              Date: inv.createdAt.toISOString().split('T')[0],
              FarmerName: inv.farmer ? inv.farmer.name : 'Walk-in Customer',
              FarmerPhone: inv.farmer ? inv.farmer.phone : '',
              TotalAmount: inv.totalAmount,
              PaidAmount: inv.paidAmount,
              DueAmount: inv.totalAmount - inv.paidAmount,
              PaymentMethod: inv.paymentMethod,
              PaymentStatus: inv.paymentStatus,
            });
          }
        },
      });
      return rows;
    }

    case 'PURCHASES': {
      const where = { shopId };
      if (fromDate || toDate) where.createdAt = dateFilter;
      await paginateThroughQuery(prisma.inventoryBatch, {
        where,
        include: {
          supplier: { select: { name: true, companyName: true } },
          product: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        chunkSize: CHUNK_SIZE,
        onBatch: (restocks) => {
          for (const b of restocks) {
            rows.push({
              BatchNumber: b.batchNumber,
              Date: b.createdAt.toISOString().split('T')[0],
              Supplier: b.supplier ? (b.supplier.companyName || b.supplier.name) : 'N/A',
              ProductName: b.product ? b.product.name : 'N/A',
              Quantity: b.quantity,
              PurchasePrice: b.purchasePrice,
              TotalValue: b.quantity * b.purchasePrice,
            });
          }
        },
      });
      return rows;
    }

    case 'FARMERS': {
      await paginateThroughQuery(prisma.farmer, {
        where: { shopId },
        orderBy: { name: 'asc' },
        chunkSize: CHUNK_SIZE,
        onBatch: (farmers) => {
          for (const f of farmers) {
            rows.push({
              FarmerID: f.id,
              Name: f.name,
              Phone: f.phone,
              Village: f.village || '',
              KhataBalanceDue: f.khataBalance,
              CreditLimit: f.creditLimit,
              JoinedDate: f.createdAt.toISOString().split('T')[0],
            });
          }
        },
      });
      return rows;
    }

    case 'SUPPLIERS': {
      await paginateThroughQuery(prisma.supplier, {
        where: { shopId },
        orderBy: { name: 'asc' },
        chunkSize: CHUNK_SIZE,
        onBatch: (suppliers) => {
          for (const s of suppliers) {
            rows.push({
              SupplierID: s.id,
              Name: s.name,
              CompanyName: s.companyName || '',
              Phone: s.phone,
              SuppliedProducts: s.suppliedProducts || '',
              KhataBalance: s.khataBalance,
            });
          }
        },
      });
      return rows;
    }

    case 'PRODUCTS': {
      await paginateThroughQuery(prisma.product, {
        where: { shopId },
        include: {
          category: { select: { name: true } },
          batches: true,
        },
        orderBy: { name: 'asc' },
        chunkSize: CHUNK_SIZE,
        onBatch: (products) => {
          for (const p of products) {
            const totalStock = p.batches.reduce((sum, b) => sum + b.quantity, 0);
            rows.push({
              ProductID: p.id,
              ProductName: p.name,
              ShortName: p.shortName || '',
              Code: p.code || '',
              Category: p.category ? p.category.name : '',
              CurrentStock: totalStock,
              MinimumStock: p.minStock,
              Status: p.isActive ? 'ACTIVE' : 'INACTIVE',
            });
          }
        },
      });
      return rows;
    }

    case 'INVENTORY': {
      await paginateThroughQuery(prisma.inventoryBatch, {
        where: { shopId },
        include: { product: { select: { name: true, shortName: true } } },
        orderBy: { createdAt: 'desc' },
        chunkSize: CHUNK_SIZE,
        onBatch: (batches) => {
          for (const b of batches) {
            rows.push({
              BatchID: b.id,
              BatchNumber: b.batchNumber,
              Product: b.product ? (b.product.shortName || b.product.name) : 'N/A',
              Quantity: b.quantity,
              PurchasePrice: b.purchasePrice,
              SellingPrice: b.sellingPrice,
              MRP: b.mrp,
              ExpiryDate: b.expiryDate ? b.expiryDate.toISOString().split('T')[0] : 'N/A',
            });
          }
        },
      });
      return rows;
    }

    case 'PAYMENTS': {
      const where = { shopId };
      if (fromDate || toDate) where.createdAt = dateFilter;
      await paginateThroughQuery(prisma.payment, {
        where,
        include: { farmer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        chunkSize: CHUNK_SIZE,
        onBatch: (payments) => {
          for (const p of payments) {
            rows.push({
              PaymentNumber: p.paymentNumber,
              Date: p.createdAt.toISOString().split('T')[0],
              FarmerName: p.farmer ? p.farmer.name : 'N/A',
              Amount: p.amount,
              Method: p.method,
              TxnRef: p.txnRef || '',
            });
          }
        },
      });
      return rows;
    }

    case 'CREDIT': {
      await paginateThroughQuery(prisma.invoice, {
        where: { shopId, paymentStatus: { in: ['UNPAID', 'PARTIAL'] } },
        include: { farmer: { select: { name: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        chunkSize: CHUNK_SIZE,
        onBatch: (invoices) => {
          for (const inv of invoices) {
            rows.push({
              InvoiceNumber: inv.invoiceNumber,
              Date: inv.createdAt.toISOString().split('T')[0],
              FarmerName: inv.farmer ? inv.farmer.name : 'N/A',
              FarmerPhone: inv.farmer ? inv.farmer.phone : 'N/A',
              TotalAmount: inv.totalAmount,
              PaidAmount: inv.paidAmount,
              OutstandingDue: inv.totalAmount - inv.paidAmount,
              Status: inv.paymentStatus,
            });
          }
        },
      });
      return rows;
    }

    case 'SALES_RETURNS': {
      await paginateThroughQuery(prisma.salesReturn, {
        where: { shopId },
        include: { farmer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        chunkSize: CHUNK_SIZE,
        onBatch: (returns) => {
          for (const r of returns) {
            rows.push({
              ReturnNumber: r.returnNumber,
              Date: r.createdAt.toISOString().split('T')[0],
              FarmerName: r.farmer ? r.farmer.name : 'N/A',
              ReturnAmount: r.returnAmount,
              Reason: r.reason,
              RefundMethod: r.refundMethod,
              Status: r.status,
            });
          }
        },
      });
      return rows;
    }

    case 'PURCHASE_RETURNS': {
      await paginateThroughQuery(prisma.purchaseReturn, {
        where: { shopId },
        include: { supplier: { select: { name: true, companyName: true } } },
        orderBy: { createdAt: 'desc' },
        chunkSize: CHUNK_SIZE,
        onBatch: (returns) => {
          for (const r of returns) {
            rows.push({
              ReturnNumber: r.returnNumber,
              Date: r.createdAt.toISOString().split('T')[0],
              Supplier: r.supplier ? (r.supplier.companyName || r.supplier.name) : 'N/A',
              ReturnAmount: r.returnAmount,
              Reason: r.reason,
              SettlementMethod: r.settlementMethod,
              Status: r.status,
            });
          }
        },
      });
      return rows;
    }

    case 'REPORTS':
    default: {
      const reportService = require('../reports/reports.service');
      const salesReport = await reportService.getSalesReport(shopId, { fromDate, toDate });
      return [
        { Metric: 'Total Gross Sales', Value: salesReport.totalSales },
        { Metric: 'Total Paid Received', Value: salesReport.totalPaid },
        { Metric: 'Total Credit Due Generated', Value: salesReport.totalDue },
        { Metric: 'Total Invoices Count', Value: salesReport.totalInvoices },
        { Metric: 'Total Sales Returns', Value: salesReport.salesReturnsAmount },
        { Metric: 'Net Sales Amount', Value: salesReport.netSales },
      ];
    }
  }
}

// Create & Record Export File
async function createExport(shopId, userId, data) {
  const { type, format = 'CSV', fromDate, toDate } = data;
  const rawData = await fetchExportData(type, shopId, fromDate, toDate);

  const timestamp = Date.now();
  const fileExt = format.toLowerCase() === 'json' ? 'json' : 'csv';
  const fileName = `${type.toLowerCase()}_${timestamp}.${fileExt}`;
  const filePath = path.join(EXPORTS_DIR, fileName);

  let fileContent = '';
  if (format.toUpperCase() === 'JSON') {
    fileContent = JSON.stringify(rawData, null, 2);
  } else {
    fileContent = convertToCSV(rawData);
  }

  fs.writeFileSync(filePath, fileContent, 'utf-8');
  const fileSize = fs.statSync(filePath).size;

  const exportLog = await prisma.exportLog.create({
    data: {
      shopId,
      userId,
      type,
      format: format.toUpperCase(),
      fileName,
      filePath,
      fileSize,
      status: 'COMPLETED',
    },
  });

  return exportLog;
}

// Get Export History
async function getExportHistory(shopId, query = {}) {
  const { page, limit, skip } = getPagination(query);
  const where = { shopId };
  if (query.type) where.type = query.type;
  if (query.format) where.format = query.format;

  const [total, logs] = await Promise.all([
    prisma.exportLog.count({ where }),
    prisma.exportLog.findMany({
      where,
      skip,
      take: limit,
      include: { user: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    exports: logs,
    pagination: getPaginationMeta(total, page, limit),
  };
}

// Get Export File Path for Download
async function getExportFile(shopId, exportId) {
  const log = await prisma.exportLog.findFirst({
    where: { id: exportId, shopId },
  });

  if (!log || !log.filePath || !fs.existsSync(log.filePath)) {
    const err = new Error('Export file not found');
    err.statusCode = 404;
    throw err;
  }

  return log;
}

module.exports = {
  createExport,
  getExportHistory,
  getExportFile,
};
