// CapeConnect API Client
window.CCAPI = (function() {
  const { API_BASE_URL } = window.CCConfig;
  
  async function request(endpoint, options = {}) {
    const token = window.CCAuth.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }
  
  // Tickets
  async function getTickets(status = null) {
    const query = status ? `?status=${status}` : '';
    return request(`/api/tickets${query}`);
  }
  
  async function purchaseTicket(routeId, price, metadata = {}) {
    return request('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ route_id: routeId, price, ...metadata })
    });
  }
  
  async function getTicket(ticketId) {
    return request(`/api/tickets/${ticketId}`);
  }
  
  async function useTicket(ticketId) {
    return request(`/api/tickets/${ticketId}/use`, {
      method: 'POST'
    });
  }
  
  // Wallet
  async function getWallet() {
    return request('/api/wallets/me');
  }
  
  async function addFunds(amount, paymentMethod) {
    return request('/api/wallets/me/add', {
      method: 'POST',
      body: JSON.stringify({ amount, payment_method: paymentMethod })
    });
  }
  
  async function getTransactions(limit = 50) {
    return request(`/api/wallets/me/transactions?limit=${limit}`);
  }
  
  // Routes
  async function getRoutes(operator = null) {
    const query = operator ? `?operator=${operator}` : '';
    return request(`/api/routes${query}`);
  }
  
  async function getRoute(routeId) {
    return request(`/api/routes/${routeId}`);
  }
  
  async function searchRoutes(from, to, operator = null) {
    const params = new URLSearchParams({ from, to });
    if (operator) params.append('operator', operator);
    return request(`/api/routes/search?${params}`);
  }
  
  // Admin
  async function getAllUsers(page = 1, limit = 50) {
    return request(`/api/admin/users?page=${page}&limit=${limit}`);
  }
  
  async function getAllTickets(page = 1, limit = 50, filters = {}) {
    const params = new URLSearchParams({ page, limit, ...filters });
    return request(`/api/admin/tickets?${params}`);
  }
  
  async function getAllWallets(page = 1, limit = 50) {
    return request(`/api/admin/wallets?page=${page}&limit=${limit}`);
  }
  
  async function getAuditLogs(page = 1, limit = 50) {
    return request(`/api/admin/audit?page=${page}&limit=${limit}`);
  }
  
  async function updatePrices(operator, prices) {
    return request('/api/admin/prices', {
      method: 'PUT',
      body: JSON.stringify({ operator, prices })
    });
  }
  
  async function updateTimetable(routeId, timetable) {
    return request(`/api/admin/timetables/${routeId}`, {
      method: 'PUT',
      body: JSON.stringify(timetable)
    });
  }
  
  return {
    request,
    // Tickets
    getTickets,
    purchaseTicket,
    getTicket,
    useTicket,
    // Wallet
    getWallet,
    addFunds,
    getTransactions,
    // Routes
    getRoutes,
    getRoute,
    searchRoutes,
    // Admin
    getAllUsers,
    getAllTickets,
    getAllWallets,
    getAuditLogs,
    updatePrices,
    updateTimetable
  };
})();
