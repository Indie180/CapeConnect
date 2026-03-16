// CapeConnect Pages - Rendering logic for all pages
window.CCPages = (function() {
  const app = () => document.getElementById('app');
  
  // Landing Page
  function renderLanding() {
    app().innerHTML = `
      <div class="landing">
        <div class="landing-header">
          <div class="landing-logo">Cape Town Transit</div>
          <div class="landing-title">
            Cape<span>Connect</span>
          </div>
          <div class="landing-subtitle">Digital ticketing & wallet management · Choose your operator</div>
        </div>

        <div class="operator-grid">
          <div class="op-card op-card-myciti" onclick="window.CCPages.selectOperator('myciti')">
            <div class="op-card-pattern">🚌</div>
            <div class="op-card-inner">
              <div class="op-card-badge myciti-badge">BRT Network</div>
              <div class="op-card-name">MyCiTi</div>
              <div class="op-card-tagline">Cape Town's Bus Rapid Transit</div>
              <div class="op-stats-row">
                <div>
                  <div class="op-mini-stat-num">42</div>
                  <div class="op-mini-stat-label">Routes</div>
                </div>
                <div>
                  <div class="op-mini-stat-num">136</div>
                  <div class="op-mini-stat-label">Stops</div>
                </div>
              </div>
              <div class="op-card-cta">
                <span>Select MyCiTi</span>
                <span class="op-card-cta-arrow">→</span>
              </div>
            </div>
          </div>

          <div class="op-card op-card-ga" onclick="window.CCPages.selectOperator('ga')">
            <div class="op-card-pattern">🚍</div>
            <div class="op-card-inner">
              <div class="op-card-badge ga-badge">City & Regional</div>
              <div class="op-card-name">Golden Arrow</div>
              <div class="op-card-tagline">Connecting Communities Since 1861</div>
              <div class="op-stats-row">
                <div>
                  <div class="op-mini-stat-num">96</div>
                  <div class="op-mini-stat-label">Routes</div>
                </div>
                <div>
                  <div class="op-mini-stat-num">2,400+</div>
                  <div class="op-mini-stat-label">Stops</div>
                </div>
              </div>
              <div class="op-card-cta">
                <span>Select Golden Arrow</span>
                <span class="op-card-cta-arrow">→</span>
              </div>
            </div>
          </div>
        </div>

        <p style="position: relative; z-index: 1; margin-top: 40px; font-size: 11px; color: rgba(255,255,255,0.16);">
          Admin login available after selecting an operator
        </p>
      </div>
    `;
  }
  
  function selectOperator(operator) {
    window.CCRouter.setOperator(operator);
    window.CCRouter.navigate('/login');
  }
  
  // Login Page
  function renderLogin(operator) {
    if (!operator) {
      window.CCRouter.navigate('/');
      return;
    }
    
    const operatorData = operator === 'myciti' 
      ? window.CCConfig.OPERATORS.MYCITI 
      : window.CCConfig.OPERATORS.GOLDEN_ARROW;
    
    const bgGradient = operator === 'myciti'
      ? 'linear-gradient(135deg, #002f5c, #005DAA, #0073d4)'
      : 'linear-gradient(135deg, #0d3d22, #1E7F43, #27a057)';
    
    const fares = operator === 'myciti'
      ? [{ price: 'R14', type: 'ADULT', color: '#E2231A' }, { price: 'R9', type: 'STUDENT', color: '#E2231A' }, { price: 'R7', type: 'CHILD', color: '#E2231A' }, { price: 'R7', type: 'SENIOR', color: '#E2231A' }]
      : [{ price: 'R10', type: 'ADULT', color: '#FFB300' }, { price: 'R7', type: 'STUDENT', color: '#FFB300' }, { price: 'R5', type: 'CHILD', color: '#FFB300' }, { price: 'R5', type: 'SENIOR', color: '#FFB300' }];
    
    app().innerHTML = `
      <div class="auth-page">
        <div class="auth-left" style="background: ${bgGradient};">
          <div class="auth-circles">
            <div class="auth-circle"></div>
            <div class="auth-circle"></div>
          </div>
          <div class="auth-brand">
            <a href="/" class="back-btn">← Choose operator</a>
            <div class="auth-logo">${operatorData.icon}</div>
            <div class="auth-name">${operatorData.displayName}</div>
            <div class="auth-tagline">${operatorData.tagline}</div>
          </div>
          <div class="fare-breakdown">
            <div class="fare-label">Fare breakdown</div>
            <div class="fare-grid">
              ${fares.map(f => `
                <div class="fare-item">
                  <div class="fare-price" style="color: ${f.color};">${f.price}</div>
                  <div class="fare-type">${f.type}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="auth-right">
          <div class="auth-form-container">
            <div class="tab-switcher">
              <button class="tab-btn active" style="background: ${operatorData.color};" onclick="window.CCPages.switchAuthTab('passenger', this, '${operatorData.color}')">Passenger</button>
              <button class="tab-btn" onclick="window.CCPages.switchAuthTab('admin', this, '${operatorData.color}')">Admin</button>
            </div>
            
            <div id="passenger-form">
              <h2 class="form-title">Welcome back</h2>
              <p class="form-subtitle">Sign in to your ${operatorData.displayName} account</p>
              <form onsubmit="window.CCPages.handleLogin(event, '${operator}', 'USER')">
                <div class="form-group">
                  <label class="form-label">Email</label>
                  <input type="email" class="form-input" placeholder="you@example.com" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Password</label>
                  <input type="password" class="form-input" placeholder="••••••••" required>
                </div>
                <button type="submit" class="btn-primary" style="background: ${operatorData.color};">Sign In</button>
              </form>
            </div>
            
            <div id="admin-form" class="hidden">
              <h2 class="form-title">Admin Portal</h2>
              <p class="form-subtitle">${operatorData.displayName} operator management</p>
              <form onsubmit="window.CCPages.handleLogin(event, '${operator}', 'ADMIN')">
                <div class="form-group">
                  <label class="form-label">Admin Email</label>
                  <input type="email" class="form-input" placeholder="admin@capeconnect.co.za" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Password</label>
                  <input type="password" class="form-input" placeholder="••••••••" required>
                </div>
                <button type="submit" class="btn-primary" style="background: ${operatorData.color};">Enter Admin Portal</button>
              </form>
            </div>
            
            <p class="demo-note">Demo: any email · Password: any</p>
          </div>
        </div>
      </div>
    `;
  }
  
  function switchAuthTab(tab, element, color) {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => {
      btn.classList.remove('active');
      btn.style.background = 'transparent';
    });
    element.classList.add('active');
    element.style.background = color;
    
    document.getElementById('passenger-form').classList.toggle('hidden', tab !== 'passenger');
    document.getElementById('admin-form').classList.toggle('hidden', tab !== 'admin');
  }
  
  async function handleLogin(event, operator, role) {
    event.preventDefault();
    const form = event.target;
    const email = form.querySelector('input[type="email"]').value;
    const password = form.querySelector('input[type="password"]').value;
    
    const result = await window.CCAuth.login(email, password, operator, role);
    
    if (result.success) {
      window.CCComponents.showToast('Login successful!', 'success');
      setTimeout(() => {
        if (role === 'ADMIN') {
          window.CCRouter.navigate('/admin/dashboard');
        } else {
          window.CCRouter.navigate('/dashboard');
        }
      }, 500);
    } else {
      window.CCComponents.showToast(result.error || 'Login failed', 'error');
    }
  }
  
  // Dashboard Page
  function renderDashboard() {
    const user = window.CCAuth.getUser();
    const operator = window.CCRouter.getCurrentOperator();
    
    app().innerHTML = `
      ${window.CCComponents.createNavbar(operator)}
      <div class="container" style="padding: 2rem 20px;">
        <div style="margin-bottom: 2rem;">
          <h1 style="font-size: 2.5rem; font-weight: 800; margin-bottom: 0.5rem;">Welcome back, ${user.name || user.email.split('@')[0]}</h1>
          <p style="color: var(--text-secondary);">Manage your tickets and wallet</p>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
          <div class="card-dark" style="cursor: pointer;" onclick="window.CCRouter.navigate('/tickets')">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎫</div>
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem;">My Tickets</h3>
            <p style="font-size: 0.875rem; color: rgba(255,255,255,0.5);">View and manage your tickets</p>
          </div>
          
          <div class="card-dark" style="cursor: pointer;" onclick="window.CCRouter.navigate('/wallet')">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">💳</div>
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem;">Wallet</h3>
            <p style="font-size: 0.875rem; color: rgba(255,255,255,0.5);">Add funds and view balance</p>
          </div>
          
          <div class="card-dark" style="cursor: pointer;" onclick="window.CCRouter.navigate('/booking')">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🚌</div>
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem;">Book Ticket</h3>
            <p style="font-size: 0.875rem; color: rgba(255,255,255,0.5);">Purchase new tickets</p>
          </div>
          
          <div class="card-dark" style="cursor: pointer;" onclick="window.CCRouter.navigate('/timetable')">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">📅</div>
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem;">Timetables</h3>
            <p style="font-size: 0.875rem; color: rgba(255,255,255,0.5);">View route schedules</p>
          </div>
        </div>
        
        <div id="recent-tickets">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">Recent Tickets</h2>
          <div id="tickets-container"></div>
        </div>
      </div>
    `;
    
    loadRecentTickets();
  }
  
  function loadRecentTickets() {
    const tickets = JSON.parse(localStorage.getItem(window.CCConfig.STORAGE_KEYS.TICKETS) || '[]');
    const container = document.getElementById('tickets-container');
    
    if (tickets.length === 0) {
      container.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center; padding: 2rem;">No tickets yet. Book your first ticket!</p>';
      return;
    }
    
    container.innerHTML = tickets.slice(0, 3).map(ticket => 
      window.CCComponents.createTicketCard(ticket)
    ).join('');
  }
  
  // Tickets Page
  function renderTickets() {
    const operator = window.CCRouter.getCurrentOperator();
    
    app().innerHTML = `
      ${window.CCComponents.createNavbar(operator)}
      <div class="container" style="padding: 2rem 20px;">
        <h1 style="font-size: 2.5rem; font-weight: 800; margin-bottom: 2rem;">My Tickets</h1>
        <div id="tickets-container"></div>
      </div>
    `;
    
    const tickets = JSON.parse(localStorage.getItem(window.CCConfig.STORAGE_KEYS.TICKETS) || '[]');
    const container = document.getElementById('tickets-container');
    
    if (tickets.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem;">
          <div style="font-size: 4rem; margin-bottom: 1rem;">🎫</div>
          <h2 style="font-size: 1.5rem; margin-bottom: 0.5rem;">No tickets yet</h2>
          <p style="color: rgba(255,255,255,0.5); margin-bottom: 2rem;">Book your first ticket to get started</p>
          <button onclick="window.CCRouter.navigate('/booking')" class="btn btn-primary">Book Ticket</button>
        </div>
      `;
      return;
    }
    
    container.innerHTML = tickets.map(ticket => 
      window.CCComponents.createTicketCard(ticket)
    ).join('');
  }
  
  // Wallet Page
  function renderWallet() {
    const operator = window.CCRouter.getCurrentOperator();
    const wallet = JSON.parse(localStorage.getItem(window.CCConfig.STORAGE_KEYS.WALLET) || '{"balance": 0}');
    
    app().innerHTML = `
      ${window.CCComponents.createNavbar(operator)}
      <div class="container" style="padding: 2rem 20px;">
        <h1 style="font-size: 2.5rem; font-weight: 800; margin-bottom: 2rem;">Wallet</h1>
        ${window.CCComponents.createWalletCard(wallet.balance, operator)}
        
        <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">Recent Transactions</h2>
        <div id="transactions-container">
          <p style="color: rgba(255,255,255,0.5); text-align: center; padding: 2rem;">No transactions yet</p>
        </div>
      </div>
    `;
  }
  
  // Booking Page
  function renderBooking() {
    const operator = window.CCRouter.getCurrentOperator();
    
    if (operator === 'ga') {
      window.CCRouter.navigate('/ga-route-calculator');
      return;
    }
    
    app().innerHTML = `
      ${window.CCComponents.createNavbar(operator)}
      <div class="container" style="padding: 2rem 20px;">
        <h1 style="font-size: 2.5rem; font-weight: 800; margin-bottom: 2rem;">Book Ticket</h1>
        <p style="color: rgba(255,255,255,0.5);">Booking flow coming soon...</p>
      </div>
    `;
  }
  
  // Admin Pages
  function renderAdmin(path) {
    const operator = window.CCRouter.getCurrentOperator();
    
    app().innerHTML = `
      ${window.CCComponents.createNavbar(operator)}
      <div class="container" style="padding: 2rem 20px;">
        <h1 style="font-size: 2.5rem; font-weight: 800; margin-bottom: 2rem;">Admin Dashboard</h1>
        <p style="color: rgba(255,255,255,0.5);">Admin features coming soon...</p>
      </div>
    `;
  }
  
  // Golden Arrow Flow
  function renderGAFlow(path) {
    // Load existing GA HTML files
    if (path.includes('ga-payment')) {
      loadHTMLFile('ga-payment.html');
    } else if (path.includes('ga-results')) {
      loadHTMLFile('ga-results.html');
    } else if (path.includes('ga-choose-fare')) {
      loadHTMLFile('ga-choose-fare.html');
    } else if (path.includes('ga-route-calculator')) {
      loadHTMLFile('ga-route-calculator.html');
    } else {
      loadHTMLFile('ga-booking.html');
    }
  }
  
  function loadHTMLFile(filename) {
    fetch(filename)
      .then(res => res.text())
      .then(html => {
        // Extract body content
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const body = doc.body.innerHTML;
        app().innerHTML = body;
        
        // Execute scripts
        const scripts = doc.querySelectorAll('script');
        scripts.forEach(script => {
          if (script.src) {
            const newScript = document.createElement('script');
            newScript.src = script.src;
            document.body.appendChild(newScript);
          } else if (script.textContent) {
            eval(script.textContent);
          }
        });
      })
      .catch(err => {
        console.error('Failed to load page:', err);
        app().innerHTML = '<div style="text-align:center;padding:60px;"><h1>Page not found</h1></div>';
      });
  }
  
  // 404 Page
  function render404() {
    app().innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center;">
        <div>
          <h1 style="font-size: 6rem; font-weight: 800; margin-bottom: 1rem;">404</h1>
          <p style="font-size: 1.25rem; color: rgba(255,255,255,0.5); margin-bottom: 2rem;">Page not found</p>
          <button onclick="window.CCRouter.navigate('/')" class="btn btn-primary">Go Home</button>
        </div>
      </div>
    `;
  }
  
  return {
    renderLanding,
    selectOperator,
    renderLogin,
    switchAuthTab,
    handleLogin,
    renderDashboard,
    renderTickets,
    renderWallet,
    renderBooking,
    renderAdmin,
    renderGAFlow,
    render404
  };
})();
