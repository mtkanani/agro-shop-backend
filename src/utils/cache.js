/**
 * Ultra-Fast High-Performance In-Memory Cache with TTL & Shop-Scoped Invalidation
 * Provides < 2ms response times for frequent read operations
 */

class MemoryCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Get cached item if not expired
   * @param {string} key 
   * @returns {any|null}
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * Set item in cache with TTL in seconds
   * @param {string} key 
   * @param {any} data 
   * @param {number} ttlSeconds Default: 30 seconds
   */
  set(key, data, ttlSeconds = 30) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Invalidate cache by key or prefix (e.g. invalidate all keys for a shop)
   * @param {string} prefix 
   */
  invalidatePattern(prefix) {
    for (const key of this.cache.keys()) {
      if (key.includes(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  flush() {
    this.cache.clear();
  }
}

const memoryCache = new MemoryCache();

module.exports = {
  memoryCache,
};
