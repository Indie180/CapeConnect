// CapeConnect Ticket Service
// Handles ticket management with backend API integration

(function() {
    'use strict';
    
    /**
     * Ticket Service Class
     * Manages ticket operations including purchase, retrieval, usage, and QR code handling
     */
    class TicketService {
        constructor(apiClient) {
            this.apiClient = apiClient;
            this.cache = new Map();
            this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
            this.initialized = false;
            this.init();
        }
        
        init() {
            if (this.initialized) return;
            
            // Wait for API client to be available
            if (!this.apiClient) {
                setTimeout(() => this.init(), 100);
                return;
            }
            
            this.initialized = true;
            console.log('Ticket service initialized');
        }
        
        /**
         * Purchase a new ticket
         * @param {Object} ticketData - Ticket purchase data
         * @returns {Promise<Object>} Created ticket with QR code
         */
        async purchaseTicket(ticketData) {
            try {
                const {
                    operator,
                    productType,
                    productName,
                    journeysIncluded,
                    routeFrom,
                    routeTo,
                    amountCents,
                    currency = 'ZAR',
                    validFrom,
                    validUntil,
                    paymentMethod,
                    cardAlias,
                    meta = {}
                } = ticketData;
                
                // Validate required fields
                if (!operator || !productType || !productName || !amountCents || !paymentMethod) {
                    throw new Error('Missing required ticket fields');
                }
                
                const response = await this.apiClient.authPost('/tickets', {
                    operator,
                    productType,
                    productName,
                    journeysIncluded,
                    routeFrom,
                    routeTo,
                    amountCents,
                    currency,
                    validFrom,
                    validUntil,
                    paymentMethod,
                    cardAlias,
                    meta
                });
                
                if (response.ticket) {
                    // Clear cache to force refresh
                    this.clearCache();
                    
                    // Process the ticket
                    const processedTicket = this.processTicket(response.ticket);
                    
                    console.log('Ticket purchased successfully:', processedTicket.id);
                    return {
                        success: true,
                        ticket: processedTicket
                    };
                } else {
                    throw new Error('Invalid ticket purchase response');
                }
            } catch (error) {
                console.error('Ticket purchase failed:', error);
                throw {
                    type: error.type || 'TICKET_PURCHASE_ERROR',
                    message: error.message || 'Failed to purchase ticket',
                    originalError: error
                };
            }
        }
        
        /**
         * Get user's tickets with optional filtering
         * @param {Object} filters - Filter options
         * @returns {Promise<Array>} Array of tickets
         */
        async getTickets(filters = {}) {
            try {
                const cacheKey = this.getCacheKey('tickets', filters);
                const cached = this.getFromCache(cacheKey);
                
                if (cached) {
                    return cached;
                }
                
                const queryParams = new URLSearchParams();
                
                if (filters.status) queryParams.append('status', filters.status);
                if (filters.operator) queryParams.append('operator', filters.operator);
                if (filters.from) queryParams.append('from', filters.from);
                if (filters.to) queryParams.append('to', filters.to);
                
                const endpoint = `/tickets${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
                const response = await this.apiClient.authGet(endpoint);
                
                if (response.tickets) {
                    const processedTickets = response.tickets.map(ticket => this.processTicket(ticket));
                    
                    // Cache the results
                    this.setCache(cacheKey, processedTickets);
                    
                    return processedTickets;
                } else {
                    return [];
                }
            } catch (error) {
                console.error('Failed to get tickets:', error);
                throw {
                    type: error.type || 'TICKET_FETCH_ERROR',
                    message: error.message || 'Failed to retrieve tickets',
                    originalError: error
                };
            }
        }
        
        /**
         * Get active (valid) tickets
         * @param {Object} filters - Additional filters
         * @returns {Promise<Array>} Array of active tickets
         */
        async getActiveTickets(filters = {}) {
            const allTickets = await this.getTickets({ ...filters, status: 'PAID' });
            return allTickets.filter(ticket => this.isTicketActive(ticket));
        }
        
        /**
         * Use a ticket (mark journey as used)
         * @param {string} ticketId - Ticket ID
         * @returns {Promise<Object>} Updated ticket
         */
        async useTicket(ticketId) {
            try {
                if (!ticketId) {
                    throw new Error('Ticket ID is required');
                }
                
                const response = await this.apiClient.authPost(`/tickets/${ticketId}/use`);
                
                if (response.ticket) {
                    // Clear cache to force refresh
                    this.clearCache();
                    
                    const processedTicket = this.processTicket(response.ticket);
                    
                    console.log('Ticket used successfully:', ticketId);
                    return {
                        success: true,
                        ticket: processedTicket
                    };
                } else {
                    throw new Error('Invalid ticket use response');
                }
            } catch (error) {
                console.error('Failed to use ticket:', error);
                throw {
                    type: error.type || 'TICKET_USE_ERROR',
                    message: error.message || 'Failed to use ticket',
                    originalError: error
                };
            }
        }
        
        /**
         * Verify a QR code
         * @param {string} qrData - QR code data
         * @returns {Promise<Object>} Verification result
         */
        async verifyQRCode(qrData, options = {}) {
            try {
                if (!qrData) {
                    throw new Error('QR data is required');
                }
                
                const response = await this.apiClient.authPost('/tickets/verify-qr', {
                    qrData,
                    consume: Boolean(options.consume),
                    scanSource: options.scanSource || 'manual',
                    deviceId: options.deviceId || null,
                    location: options.location || null
                });
                
                return {
                    valid: response.valid,
                    ticket: response.ticket,
                    message: response.message,
                    consumed: Boolean(response.consumed),
                    action: response.action || 'verify'
                };
            } catch (error) {
                console.error('QR verification failed:', error);
                throw {
                    type: error.type || 'QR_VERIFICATION_ERROR',
                    message: error.message || 'Failed to verify QR code',
                    originalError: error
                };
            }
        }
        
        /**
         * Get QR data for a ticket (for testing)
         * @param {string} ticketId - Ticket ID
         * @returns {Promise<string>} QR data
         */
        async getQRData(ticketId) {
            try {
                if (!ticketId) {
                    throw new Error('Ticket ID is required');
                }
                
                const response = await this.apiClient.authPost('/tickets/get-qr-data', { ticketId });
                
                return response.qrData;
            } catch (error) {
                console.error('Failed to get QR data:', error);
                throw {
                    type: error.type || 'QR_DATA_ERROR',
                    message: error.message || 'Failed to get QR data',
                    originalError: error
                };
            }
        }
        
        /**
         * Process a raw ticket from the API
         * @param {Object} rawTicket - Raw ticket data
         * @returns {Object} Processed ticket
         */
        processTicket(rawTicket) {
            const ticket = {
                id: rawTicket.id,
                operator: rawTicket.operator,
                productType: rawTicket.product_type,
                productName: rawTicket.product_name,
                journeysIncluded: rawTicket.journeys_included,
                journeysUsed: rawTicket.journeys_used,
                routeFrom: rawTicket.route_from,
                routeTo: rawTicket.route_to,
                amountCents: rawTicket.amount_cents,
                currency: rawTicket.currency,
                status: rawTicket.status,
                purchasedAt: rawTicket.purchased_at,
                validFrom: rawTicket.valid_from,
                validUntil: rawTicket.valid_until,
                paymentMethod: rawTicket.payment_method,
                cardAlias: rawTicket.card_alias,
                meta: rawTicket.meta,
                qrCode: rawTicket.qrCode,
                qrCodeSVG: rawTicket.qrCodeSVG,
                updatedAt: rawTicket.updated_at
            };
            
            // Add computed properties
            ticket.isActive = this.isTicketActive(ticket);
            ticket.isExpired = this.isTicketExpired(ticket);
            ticket.isUsed = this.isTicketUsed(ticket);
            ticket.remainingJourneys = this.getRemainingJourneys(ticket);
            ticket.formattedAmount = this.formatAmount(ticket.amountCents, ticket.currency);
            ticket.formattedValidUntil = this.formatDate(ticket.validUntil);
            ticket.formattedPurchasedAt = this.formatDate(ticket.purchasedAt);
            
            return ticket;
        }
        
        /**
         * Check if a ticket is active (can be used)
         * @param {Object} ticket - Ticket object
         * @returns {boolean} Whether ticket is active
         */
        isTicketActive(ticket) {
            if (ticket.status !== 'PAID') return false;
            if (this.isTicketExpired(ticket)) return false;
            if (this.isTicketUsed(ticket)) return false;
            return true;
        }
        
        /**
         * Check if a ticket is expired
         * @param {Object} ticket - Ticket object
         * @returns {boolean} Whether ticket is expired
         */
        isTicketExpired(ticket) {
            if (!ticket.validUntil) return false;
            return new Date(ticket.validUntil).getTime() <= Date.now();
        }
        
        /**
         * Check if a ticket is fully used
         * @param {Object} ticket - Ticket object
         * @returns {boolean} Whether ticket is fully used
         */
        isTicketUsed(ticket) {
            if (!ticket.journeysIncluded) return false;
            return ticket.journeysUsed >= ticket.journeysIncluded;
        }
        
        /**
         * Get remaining journeys for a ticket
         * @param {Object} ticket - Ticket object
         * @returns {number} Remaining journeys
         */
        getRemainingJourneys(ticket) {
            if (!ticket.journeysIncluded) return 0;
            return Math.max(0, ticket.journeysIncluded - ticket.journeysUsed);
        }
        
        /**
         * Format amount in cents to currency string
         * @param {number} amountCents - Amount in cents
         * @param {string} currency - Currency code
         * @returns {string} Formatted amount
         */
        formatAmount(amountCents, currency = 'ZAR') {
            const amount = amountCents / 100;
            return new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: currency
            }).format(amount);
        }
        
        /**
         * Format date string
         * @param {string} dateString - ISO date string
         * @returns {string} Formatted date
         */
        formatDate(dateString) {
            if (!dateString) return '';
            
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '';
            
            return new Intl.DateTimeFormat('en-ZA', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
        }
        
        /**
         * Get tickets by operator
         * @param {string} operator - Operator name (myciti, ga)
         * @returns {Promise<Array>} Filtered tickets
         */
        async getTicketsByOperator(operator) {
            return this.getTickets({ operator });
        }
        
        /**
         * Get tickets by status
         * @param {string} status - Ticket status (PAID, USED, EXPIRED, REFUNDED)
         * @returns {Promise<Array>} Filtered tickets
         */
        async getTicketsByStatus(status) {
            return this.getTickets({ status });
        }
        
        /**
         * Get ticket statistics
         * @returns {Promise<Object>} Ticket statistics
         */
        async getTicketStats() {
            try {
                const allTickets = await this.getTickets();
                
                const stats = {
                    total: allTickets.length,
                    active: 0,
                    used: 0,
                    expired: 0,
                    totalSpent: 0,
                    byOperator: {},
                    byStatus: {}
                };
                
                allTickets.forEach(ticket => {
                    // Count by status
                    if (ticket.isActive) stats.active++;
                    else if (ticket.isExpired) stats.expired++;
                    else if (ticket.isUsed) stats.used++;
                    
                    // Count by operator
                    const operator = ticket.operator || 'Unknown';
                    stats.byOperator[operator] = (stats.byOperator[operator] || 0) + 1;
                    
                    // Count by status
                    const status = ticket.status || 'Unknown';
                    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
                    
                    // Total spent
                    stats.totalSpent += ticket.amountCents || 0;
                });
                
                stats.formattedTotalSpent = this.formatAmount(stats.totalSpent);
                
                return stats;
            } catch (error) {
                console.error('Failed to get ticket stats:', error);
                return {
                    total: 0,
                    active: 0,
                    used: 0,
                    expired: 0,
                    totalSpent: 0,
                    formattedTotalSpent: 'R0.00',
                    byOperator: {},
                    byStatus: {}
                };
            }
        }
        
        // Cache management methods
        getCacheKey(type, params = {}) {
            return `${type}_${JSON.stringify(params)}`;
        }
        
        getFromCache(key) {
            const cached = this.cache.get(key);
            if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
                return cached.data;
            }
            this.cache.delete(key);
            return null;
        }
        
        setCache(key, data) {
            this.cache.set(key, {
                data,
                timestamp: Date.now()
            });
        }
        
        clearCache() {
            this.cache.clear();
        }
        
        // Utility methods for ticket types
        getTicketTypeInfo(productType, productName) {
            const info = {
                type: productType,
                name: productName,
                category: 'single',
                description: productName
            };
            
            const combined = `${productType} ${productName}`.toLowerCase();
            
            if (combined.includes('day3')) {
                info.category = 'multi-day';
                info.description = '3-Day Pass';
            } else if (combined.includes('day7') || combined.includes('weekly')) {
                info.category = 'multi-day';
                info.description = '7-Day Pass';
            } else if (combined.includes('monthly')) {
                info.category = 'monthly';
                info.description = 'Monthly Pass';
            } else if (combined.includes('topup') || combined.includes('mover')) {
                info.category = 'stored-value';
                info.description = 'Stored Value Card';
            }
            
            return info;
        }
    }
    
    // Initialize ticket service when API client is available
    function initializeTicketService() {
        if (window.apiClient) {
            window.ticketService = new TicketService(window.apiClient);
            console.log('Ticket service initialized globally');
        } else {
            setTimeout(initializeTicketService, 100);
        }
    }
    
    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', initializeTicketService);
    
    // Also initialize immediately if DOM is already loaded
    if (document.readyState === 'loading') {
        // DOM is still loading
    } else {
        // DOM is already loaded
        initializeTicketService();
    }
    
    // Export for module systems
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TicketService;
    }
    
})();
