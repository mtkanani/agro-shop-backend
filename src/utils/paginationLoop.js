/**
 * Universal Memory-Safe Pagination Loop / Chunk Iterator Utility
 * Iterates through large database tables in bounded batches,
 * eliminating full-table memory loading and Node.js heap exhaustion.
 */

/**
 * Paginate sequentially through a Prisma model query in bounded chunks.
 *
 * @param {Object} modelDelegate - Prisma model delegate (e.g., prisma.invoice, prisma.product)
 * @param {Object} options
 * @param {Object} [options.where={}] - Prisma where filter
 * @param {Object} [options.select] - Prisma select fields
 * @param {Object} [options.include] - Prisma include relations
 * @param {Object} [options.orderBy={ id: 'asc' }] - Sorting order
 * @param {number} [options.chunkSize=500] - Batch size per loop iteration
 * @param {Function} [options.onBatch] - Callback invoked for each batch: async (records, meta) => void
 * @returns {Promise<{ totalProcessed: number, batchesCount: number }>}
 */
async function paginateThroughQuery(modelDelegate, options = {}) {
  const {
    where = {},
    select,
    include,
    orderBy = { id: 'asc' },
    chunkSize = 500,
    onBatch,
  } = options;

  let skip = 0;
  let hasMore = true;
  let totalProcessed = 0;
  let batchesCount = 0;

  while (hasMore) {
    const queryArgs = {
      where,
      orderBy,
      skip,
      take: chunkSize,
    };

    if (select) queryArgs.select = select;
    else if (include) queryArgs.include = include;

    const batch = await modelDelegate.findMany(queryArgs);

    if (!batch || batch.length === 0) {
      break;
    }

    batchesCount += 1;
    totalProcessed += batch.length;

    if (onBatch) {
      await onBatch(batch, {
        skip,
        chunkSize,
        batchIndex: batchesCount - 1,
        isLastBatch: batch.length < chunkSize,
      });
    }

    if (batch.length < chunkSize) {
      hasMore = false;
    } else {
      skip += chunkSize;
    }
  }

  return { totalProcessed, batchesCount };
}

module.exports = {
  paginateThroughQuery,
};
