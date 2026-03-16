// CapeConnect Reusable Components
window.CCComponents = (function() {
  
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} fade-in`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
  
  function showSpinner(container) {
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.style.margin = '40px auto';
    container.innerHTML = '';
    container.appendChild(spinner);
  }
  
  function createNavbar(operator = null) {
    const user = window.CCAuth.getUser();
    const isAdmin = user?.role === 'ADMIN';
    const operatorData = operator ? window.CCConfig.OPERATORS[operator.toUpperCase()] : null;
    
    return `
      <nav style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 1rem 2rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; max-width: 1400px; margin: 0 auto;">
          <div style="display: flex; align-items: center; gap: 2rem;">
            <a href="/" style="font-family: 'Barlow Condensed', sans-serif; font-size: 1.5rem; font-weight: 800; color: white; text-decoration: none;">
              CapeConnect
            </a>
            ${operatorData ? `<span style="font-size: 0.875rem; color: rgba(255,255,255,0.5);">${operatorData.icon} ${operatorData.displayName}</span>` : ''}
          </div>
          
          <div style="display: flex; align-items: center; gap: 1.5rem;">
            ${user ? `
              ${!isAdmin ? `
                <a href="/dashboard" class="nav-link">Dashboard</a>
                <a href="/booking" class="nav-link">Book Ticket</a>
                <a href="/tickets" class="nav-link">My Tickets</a>
                <a href="/wallet" class="nav-link">Wallet</a>
              ` : `
                <a href="/admin/dashboard" class="nav-link">Admin</a>
                <a href="/admin/tickets" class="nav-link">Tickets</a>
                <a href="/admin/users" class="nav-link">Users</a>
                <a href="/admin/wallets" class="nav-link">Wallets</a>
              `}
              <button onclick="window.CCAuth.logout()" class="btn btn-sm btn-secondary">Logout</button>
            ` : `
              <a href="/login" class="btn btn-sm btn-primary">Login</a>
            `}
          </div>
        </div>
      </nav>
      <style>
        .nav-link {
          color: rgba(255,255,255,0.7);
          text-decoration: none;
          font-size: 0.875rem;
          font-weight: 600;
          transition: color 0.2s;
        }
        .nav-link:hover {
          color: white;
        }
      </style>
    `;
  }
  
  function createTicketCard(ticket) {
    const statusColors = {
      'Active': 'success',
      'PAID': 'success',
      'Used': 'info',
      'USED': 'info',
      'Expired': 'danger',
      'EXPIRED': 'danger'
    };
    
    return `
      <div class="card fade-in" style="margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
          <div>
            <h3 style="font-size: 1.125rem; font-weight: 700; margin-bottom: 0.25rem;">${ticket.route || ticket.service}</h3>
            <p style="font-size: 0.875rem; color: var(--text-secondary);">${ticket.operator || ticket.service}</p>
          </div>
          <span class="badge badge-${statusColors[ticket.status] || 'info'}">${ticket.status}</span>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Date</div>
            <div style="font-weight: 600;">${ticket.date}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Time</div>
            <div style="font-weight: 600;">${ticket.time}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Type</div>
            <div style="font-weight: 600; text-transform: capitalize;">${ticket.type}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Total</div>
            <div style="font-weight: 700; color: var(--myciti-primary);">${ticket.total}</div>
          </div>
        </div>
        
        ${ticket.remainingUses ? `
          <div style="padding: 0.75rem; background: var(--bg-light); border-radius: 0.5rem; font-size: 0.875rem;">
            <strong>${ticket.remainingUses}</strong> of <strong>${ticket.journeysIncluded}</strong> journeys remaining
          </div>
        ` : ''}
        
        ${ticket.status === 'Active' || ticket.status === 'PAID' ? `
          <button onclick="window.CCComponents.showTicketQR('${ticket.id}')" class="btn btn-primary" style="margin-top: 1rem;">
            Show QR Code
          </button>
        ` : ''}
      </div>
    `;
  }
  
  function showTicketQR(ticketId) {
    const tickets = JSON.parse(localStorage.getItem(window.CCConfig.STORAGE_KEYS.TICKETS) || '[]');
    const ticket = tickets.find(t => t.id === ticketId);
    
    if (!ticket) {
      showToast('Ticket not found', 'error');
      return;
    }
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    modal.innerHTML = `
      <div class="card" style="max-width: 400px; width: 90%; text-align: center;">
        <h2 style="margin-bottom: 1rem;">Ticket QR Code</h2>
        <div style="background: white; padding: 2rem; border-radius: 0.5rem; margin-bottom: 1rem;">
          <div style="font-size: 4rem;">📱</div>
          <p style="color: #666; margin-top: 1rem; font-size: 0.875rem;">QR Code: ${ticket.id}</p>
        </div>
        <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1rem;">
          ${ticket.route} - ${ticket.remainingUses || 0} uses remaining
        </p>
        <button onclick="this.closest('[style*=fixed]').remove()" class="btn btn-primary">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  function createWalletCard(balance, operator) {
    const operatorData = window.CCConfig.OPERATORS[operator?.toUpperCase()] || window.CCConfig.OPERATORS.MYCITI;
    
    return `
      <div class="card" style="background: linear-gradient(135deg, ${operatorData.color}, ${operatorData.accentColor}); color: white; margin-bottom: 2rem;">
        <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Available Balance</div>
        <div style="font-size: 3rem; font-weight: 800; font-family: 'Barlow Condensed', sans-serif; margin-bottom: 1rem;">
          R${(balance / 100).toFixed(2)}
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <button onclick="window.CCComponents.showAddFunds()" class="btn btn-secondary">Add Funds</button>
          <button onclick="window.CCRouter.navigate('/booking')" class="btn btn-secondary">Buy Ticket</button>
        </div>
      </div>
    `;
  }
  
  function showAddFunds() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    modal.innerHTML = `
      <div class="card" style="max-width: 400px; width: 90%;">
        <h2 style="margin-bottom: 1rem;">Add Funds</h2>
        <form onsubmit="window.CCComponents.handleAddFunds(event)">
          <div class="form-group">
            <label class="form-label">Amount (R)</label>
            <input type="number" name="amount" class="form-input" min="10" max="5000" step="10" required placeholder="100">
          </div>
          <div class="form-group">
            <label class="form-label">Payment Method</label>
            <select name="method" class="form-input" required>
              <option value="card">Credit/Debit Card</option>
              <option value="eft">EFT</option>
              <option value="instant_eft">Instant EFT</option>
            </select>
          </div>
          <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;">
            <button type="button" onclick="this.closest('[style*=fixed]').remove()" class="btn btn-secondary" style="flex: 1;">Cancel</button>
            <button type="submit" class="btn btn-primary" style="flex: 1;">Add Funds</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  function handleAddFunds(event) {
    event.preventDefault();
    const form = event.target;
    const amount = parseFloat(form.amount.value);
    
    // Demo: just add to local storage
    const walletKey = window.CCConfig.STORAGE_KEYS.WALLET;
    const wallet = JSON.parse(localStorage.getItem(walletKey) || '{"balance": 0}');
    wallet.balance += amount * 100; // Convert to cents
    localStorage.setItem(walletKey, JSON.stringify(wallet));
    
    form.closest('[style*=fixed]').remove();
    showToast(`R${amount.toFixed(2)} added to wallet`, 'success');
    
    // Reload page to show updated balance
    setTimeout(() => window.location.reload(), 500);
  }
  
  return {
    showToast,
    showSpinner,
    createNavbar,
    createTicketCard,
    showTicketQR,
    createWalletCard,
    showAddFunds,
    handleAddFunds
  };
})();
