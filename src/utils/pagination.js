function getPagination(query) {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

function getPaginationMeta(totalCount, page, limit) {
  const totalPages = Math.ceil(totalCount / limit);
  return {
    totalItems: totalCount,
    totalRecords: totalCount,
    currentPage: page,
    page,
    itemsPerPage: limit,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

module.exports = {
  getPagination,
  getPaginationMeta,
};
