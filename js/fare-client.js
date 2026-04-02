/**
 * CapeConnect Fare Client Service
 * Centralized fare pricing fetched from backend /api/prices
 * Single source of truth: database-backed route + global prices
 */
(function() {
  'use strict';

  class FareClientService {
    constructor(apiClient) {
      this.apiClient = apiClient;
      this.cache = new Map();
      this.cacheExpiry = 15 * 60 * 1000; // 15 minutes for pricing data
      this.initialized = false;
      this.init();
    }

    init() {
      if (this.initialized) return;
      if (!this.apiClient) {
        setTimeout(() => this.init(), 100);
        return;
      }
      this.initialized = true;
      console.log('Fare client service initialized');
    }

    normalizeOperator(operator) {
      const raw = String(operator || "").toLowerCase().trim();
      if (raw === "ga" || raw === "golden_arrow" || raw === "golden arrow" || raw === "golden-arrow") return "Golden Arrow";
      if (raw === "myciti") return "MyCiTi";
      return "";
    }

    getCacheKey(operator) {
      return `prices_${this.normalizeOperator(operator)}`;
    }

    getFromCache(key) {
      const cached = this.cache.get(key);
      if (!cached) return null;
      if (Date.now() > cached.expiresAt) {
        this.cache.delete(key);
        return null;
      }
      return cached.data;
    }

    setCache(key, data) {
      this.cache.set(key, {
        data,
        expiresAt: Date.now() + this.cacheExpiry
      });
    }

    /**
     * Fetch all prices for an operator (global + route-specific)
     * @param {string} operator - MyCiTi or Golden Arrow
     * @returns {Promise<Object>} { globalProducts, routePrices }
     */
    async getPrices(operator) {
      const normalizedOp = this.normalizeOperator(operator);
      if (!normalizedOp) throw new Error("Invalid operator");

      const cacheKey = this.getCacheKey(operator);
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      try {
        const response = await this.apiClient.get(`/prices?operator=${encodeURIComponent(normalizedOp)}`);
        const data = {
          globalProducts: response.globalProducts || [],
          routePrices: response.routePrices || []
        };
        this.setCache(cacheKey, data);
        return data;
      } catch (error) {
        console.error('Failed to fetch prices:', error);
        throw {
          type: 'FARE_FETCH_ERROR',
          message: 'Failed to load fare pricing',
          originalError: error
        };
      }
    }

    /**
     * Get global product price by key
     * @param {string} operator - Operator name
     * @param {string} productKey - e.g., "day1", "weekly", "five_ride"
     * @returns {Promise<number|null>} Price in cents or null if not found
     */
    async getGlobalProductPrice(operator, productKey) {
      const prices = await this.getPrices(operator);
      const product = prices.globalProducts.find(p => 
        p.product_key.toLowerCase() === String(productKey || "").toLowerCase()
      );
      return product ? Number(product.price_cents) : null;
    }

    /**
     * Get route-specific price
     * @param {string} operator - Operator name
     * @param {string} fromStop - From stop name
     * @param {string} toStop - To stop name
     * @param {string} productKey - e.g., "five_ride", "weekly", "monthly"
     * @returns {Promise<number|null>} Price in cents or null if not found
     */
    async getRoutePrice(operator, fromStop, toStop, productKey) {
      const prices = await this.getPrices(operator);
      const routePrice = prices.routePrices.find(rp =>
        rp.from_stop_name && rp.to_stop_name &&
        rp.from_stop_name.toLowerCase() === String(fromStop || "").toLowerCase() &&
        rp.to_stop_name.toLowerCase() === String(toStop || "").toLowerCase() &&
        rp.product_key && rp.product_key.toLowerCase() === String(productKey || "").toLowerCase()
      );
      return routePrice ? Number(routePrice.price_cents) : null;
    }

    /**
     * Get all route prices for operator (flattened)
     * @param {string} operator - Operator name
     * @returns {Promise<Array>} Array of { from_stop_name, to_stop_name, product_key, price_cents }
     */
    async getAllRoutePrices(operator) {
      const prices = await this.getPrices(operator);
      return prices.routePrices;
    }

    /**
     * Resolve a product name to its key and price
     * Tries product_key first, then label match
     * @param {string} operator - Operator name
     * @param {string} productType - e.g., "day1", "weekly"
     * @param {string} productName - e.g., "1 Day Pass", "Weekly Ticket"
     * @returns {Promise<Object|null>} { key, label, price_cents } or null
     */
    async resolveProductPrice(operator, productType, productName) {
      const prices = await this.getPrices(operator);
      
      // Try by key first
      if (productType) {
        const byKey = prices.globalProducts.find(p =>
          p.product_key.toLowerCase() === String(productType || "").toLowerCase()
        );
        if (byKey) return byKey;
      }

      // Try by label
      if (productName) {
        const byLabel = prices.globalProducts.find(p =>
          p.label.toLowerCase() === String(productName || "").toLowerCase()
        );
        if (byLabel) return byLabel;
      }

      return null;
    }

    /**
     * Get price for a ticket (prefers route-specific, falls back to global product)
     * @param {string} operator - Operator name
     * @param {string} productType - e.g., "day1", "weekly"
     * @param {string} productName - e.g., "1 Day Pass", "Weekly Ticket"
     * @param {string} routeFrom - Optional: from stop
     * @param {string} routeTo - Optional: to stop
     * @returns {Promise<number|null>} Price in cents or null
     */
    async getTicketPrice(operator, productType, productName, routeFrom, routeTo) {
      // Route-specific price takes precedence
      if (routeFrom && routeTo && productType) {
        const routePrice = await this.getRoutePrice(operator, routeFrom, routeTo, productType);
        if (routePrice !== null) return routePrice;
      }

      // Fall back to global product
      const product = await this.resolveProductPrice(operator, productType, productName);
      return product ? Number(product.price_cents) : null;
    }
  }

  // Export to global scope
  window.FareClientService = FareClientService;
  
  // Auto-instantiate if CCApi exists
  if (window.CCApi) {
    window.fareClient = new FareClientService(window.CCApi);
  } else {
    // Wait for CCApi to be available
    const interval = setInterval(() => {
      if (window.CCApi) {
        clearInterval(interval);
        window.fareClient = new FareClientService(window.CCApi);
      }
    }, 100);
  }
})();
