// CapeConnect Ticket Status Manager
// Handles automatic ticket expiry and status updates

(function() {
    'use strict';
    
    /**
     * Ticket Status Manager Class
     * Manages ticket lifecycle, expiry, and real-time status updates
     */
    class TicketStatusManager {
        constructor(ticketService) {
            this.ticketService = ticketService;
            this.updateInterval = 60000; // 1 minute
            this.intervalId = null;
            this.listeners = new Map();
            this.initialized = false;
            this.init();
        }
        
        init() {
            if (this.initialized) return;
            
            // Wait for ticket service to be available
            if (!this.ticketService) {
                setTimeout(() => this.init(), 100);
                return;
            }
            
            this.initialized = true;
            this.startStatusUpdates();
            console.log('Ticket status manager initialized');
        }
        
        /**
         * Start automatic status updates
         */
        startStatusUpdates() {
            if (this.intervalId) {
                clearInterval(this.intervalId);
            }
            
            this.intervalId = setInterval(() => {
                this.updateTicketStatuses();
            }, this.updateInterval);
            
            // Also update immediately
            this.updateTicketStatuses();
        }
        
        /**
         * Stop automatic status updates
         */
        stopStatusUpdates() {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
        }
        
        /**
         * Update ticket statuses
         */
        async updateTicketStatuses() {
            try {
                // Get all tickets
                const tickets = await this.ticketService.getTickets();
                
                let hasUpdates = false;
                const updatedTickets = [];
                
                for (const ticket of tickets) {
                    const previousStatus = ticket.status;
                    const previousIsActive = ticket.isActive;
                    
                    // Check for status changes
                    const updatedTicket = this.checkTicketStatus(ticket);
                    
                    if (updatedTicket.status !== previousStatus || 
                        updatedTicket.isActive !== previousIsActive) {
                        hasUpdates = true;
                        updatedTickets.push({
                            ticket: updatedTicket,
                            previousStatus,
                            statusChanged: updatedTicket.status !== previousStatus
                        });
                        
                        // Notify listeners
                        this.notifyStatusChange(updatedTicket, previousStatus);
                    }
                }
                
                if (hasUpdates) {
                    console.log(`Updated ${updatedTickets.length} ticket statuses`);
                    
                    // Clear ticket service cache to force refresh
                    if (this.ticketService.clearCache) {
                        this.ticketService.clearCache();
                    }
                    
                    // Notify global listeners
                    this.notifyGlobalUpdate(updatedTickets);
                }
                
            } catch (error) {
                console.error('Failed to update ticket statuses:', error);
            }
        }
        
        /**
         * Check and update a single ticket's status
         * @param {Object} ticket - Ticket to check
         * @returns {Object} Updated ticket
         */
        checkTicketStatus(ticket) {
            const updatedTicket = { ...ticket };
            
            // Check expiry
            if (this.isTicketExpired(ticket)) {
                updatedTicket.status = 'EXPIRED';
                updatedTicket.isActive = false;
                updatedTicket.isExpired = true;
            }
            
            // Check if fully used
            else if (this.isTicketFullyUsed(ticket)) {
                updatedTicket.status = 'USED';
                updatedTicket.isActive = false;
                updatedTicket.isUsed = true;
            }
            
            // Update computed properties
            updatedTicket.isActive = this.isTicketActive(updatedTicket);
            updatedTicket.isExpired = this.isTicketExpired(updatedTicket);
            updatedTicket.isUsed = this.isTicketFullyUsed(updatedTicket);
            updatedTicket.remainingJourneys = this.getRemainingJourneys(updatedTicket);
            
            return updatedTicket;
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
        isTicketFullyUsed(ticket) {
            if (!ticket.journeysIncluded) return false;
            return (ticket.journeysUsed || 0) >= ticket.journeysIncluded;
        }
        
        /**
         * Check if a ticket is active (can be used)
         * @param {Object} ticket - Ticket object
         * @returns {boolean} Whether ticket is active
         */
        isTicketActive(ticket) {
            if (ticket.status !== 'PAID') return false;
            if (this.isTicketExpired(ticket)) return false;
            if (this.isTicketFullyUsed(ticket)) return false;
            return true;
        }
        
        /**
         * Get remaining journeys for a ticket
         * @param {Object} ticket - Ticket object
         * @returns {number} Remaining journeys
         */
        getRemainingJourneys(ticket) {
            if (!ticket.journeysIncluded) return 0;
            return Math.max(0, ticket.journeysIncluded - (ticket.journeysUsed || 0));
        }
        
        /**
         * Get time until ticket expires
         * @param {Object} ticket - Ticket object
         * @returns {Object} Time until expiry
         */
        getTimeUntilExpiry(ticket) {
            if (!ticket.validUntil) {
                return { expired: false, timeLeft: null, formatted: 'No expiry' };
            }
            
            const expiryTime = new Date(ticket.validUntil).getTime();
            const currentTime = Date.now();
            const timeLeft = expiryTime - currentTime;
            
            if (timeLeft <= 0) {
                return { expired: true, timeLeft: 0, formatted: 'Expired' };
            }
            
            const days = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
            const hours = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            
            let formatted;
            if (days > 0) {
                formatted = `${days} day${days > 1 ? 's' : ''} left`;
            } else if (hours > 0) {
                formatted = `${hours} hour${hours > 1 ? 's' : ''} left`;
            } else if (minutes > 0) {
                formatted = `${minutes} minute${minutes > 1 ? 's' : ''} left`;
            } else {
                formatted = 'Expires soon';
            }
            
            return { expired: false, timeLeft, formatted };
        }
        
        /**
         * Get tickets expiring soon
         * @param {number} hoursThreshold - Hours threshold for "soon"
         * @returns {Promise<Array>} Tickets expiring soon
         */
        async getTicketsExpiringSoon(hoursThreshold = 24) {
            try {
                const tickets = await this.ticketService.getActiveTickets();
                const threshold = hoursThreshold * 60 * 60 * 1000; // Convert to milliseconds
                
                return tickets.filter(ticket => {
                    if (!ticket.validUntil) return false;
                    
                    const expiryTime = new Date(ticket.validUntil).getTime();
                    const currentTime = Date.now();
                    const timeLeft = expiryTime - currentTime;
                    
                    return timeLeft > 0 && timeLeft <= threshold;
                });
            } catch (error) {
                console.error('Failed to get tickets expiring soon:', error);
                return [];
            }
        }
        
        /**
         * Add status change listener
         * @param {string} ticketId - Ticket ID to listen for
         * @param {Function} callback - Callback function
         */
        addStatusListener(ticketId, callback) {
            if (!this.listeners.has(ticketId)) {
                this.listeners.set(ticketId, new Set());
            }
            this.listeners.get(ticketId).add(callback);
        }
        
        /**
         * Remove status change listener
         * @param {string} ticketId - Ticket ID
         * @param {Function} callback - Callback function
         */
        removeStatusListener(ticketId, callback) {
            if (this.listeners.has(ticketId)) {
                this.listeners.get(ticketId).delete(callback);
                if (this.listeners.get(ticketId).size === 0) {
                    this.listeners.delete(ticketId);
                }
            }
        }
        
        /**
         * Add global update listener
         * @param {Function} callback - Callback function
         */
        addGlobalListener(callback) {
            if (!this.listeners.has('global')) {
                this.listeners.set('global', new Set());
            }
            this.listeners.get('global').add(callback);
        }
        
        /**
         * Remove global update listener
         * @param {Function} callback - Callback function
         */
        removeGlobalListener(callback) {
            if (this.listeners.has('global')) {
                this.listeners.get('global').delete(callback);
            }
        }
        
        /**
         * Notify status change listeners
         * @param {Object} ticket - Updated ticket
         * @param {string} previousStatus - Previous status
         */
        notifyStatusChange(ticket, previousStatus) {
            if (this.listeners.has(ticket.id)) {
                this.listeners.get(ticket.id).forEach(callback => {
                    try {
                        callback(ticket, previousStatus);
                    } catch (error) {
                        console.error('Status listener error:', error);
                    }
                });
            }
        }
        
        /**
         * Notify global update listeners
         * @param {Array} updatedTickets - Array of updated tickets
         */
        notifyGlobalUpdate(updatedTickets) {
            if (this.listeners.has('global')) {
                this.listeners.get('global').forEach(callback => {
                    try {
                        callback(updatedTickets);
                    } catch (error) {
                        console.error('Global listener error:', error);
                    }
                });
            }
        }
        
        /**
         * Force update a specific ticket
         * @param {string} ticketId - Ticket ID
         */
        async forceUpdateTicket(ticketId) {
            try {
                const tickets = await this.ticketService.getTickets();
                const ticket = tickets.find(t => t.id === ticketId);
                
                if (ticket) {
                    const previousStatus = ticket.status;
                    const updatedTicket = this.checkTicketStatus(ticket);
                    
                    if (updatedTicket.status !== previousStatus) {
                        this.notifyStatusChange(updatedTicket, previousStatus);
                        
                        // Clear cache
                        if (this.ticketService.clearCache) {
                            this.ticketService.clearCache();
                        }
                    }
                    
                    return updatedTicket;
                }
            } catch (error) {
                console.error('Failed to force update ticket:', error);
            }
            
            return null;
        }
        
        /**
         * Get ticket status summary
         * @returns {Promise<Object>} Status summary
         */
        async getStatusSummary() {
            try {
                const tickets = await this.ticketService.getTickets();
                const expiringSoon = await this.getTicketsExpiringSoon();
                
                const summary = {
                    total: tickets.length,
                    active: 0,
                    expired: 0,
                    used: 0,
                    expiringSoon: expiringSoon.length,
                    byStatus: {},
                    alerts: []
                };
                
                tickets.forEach(ticket => {
                    const status = ticket.status || 'UNKNOWN';
                    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
                    
                    if (ticket.isActive) summary.active++;
                    else if (ticket.isExpired) summary.expired++;
                    else if (ticket.isUsed) summary.used++;
                });
                
                // Generate alerts
                if (expiringSoon.length > 0) {
                    summary.alerts.push({
                        type: 'warning',
                        message: `${expiringSoon.length} ticket${expiringSoon.length > 1 ? 's' : ''} expiring soon`,
                        tickets: expiringSoon.map(t => t.id)
                    });
                }
                
                return summary;
            } catch (error) {
                console.error('Failed to get status summary:', error);
                return {
                    total: 0,
                    active: 0,
                    expired: 0,
                    used: 0,
                    expiringSoon: 0,
                    byStatus: {},
                    alerts: []
                };
            }
        }
        
        /**
         * Cleanup resources
         */
        destroy() {
            this.stopStatusUpdates();
            this.listeners.clear();
            this.initialized = false;
        }
    }
    
    // Initialize ticket status manager when ticket service is available
    function initializeStatusManager() {
        if (window.ticketService) {
            window.ticketStatusManager = new TicketStatusManager(window.ticketService);
            console.log('Ticket status manager initialized globally');
        } else {
            setTimeout(initializeStatusManager, 100);
        }
    }
    
    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', initializeStatusManager);
    
    // Also initialize immediately if DOM is already loaded
    if (document.readyState === 'loading') {
        // DOM is still loading
    } else {
        // DOM is already loaded
        initializeStatusManager();
    }
    
    // Export for module systems
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TicketStatusManager;
    }
    
})();