// CapeConnect Router - Client-side routing
window.CCRouter = (function() {
  let currentRoute = null;
  let currentOperator = null;
  
  function init() {
    // Handle browser back/forward
    window.addEventListener('popstate', handleRoute);
    
    // Handle initial load
    handleRoute();
    
    // Intercept link clicks
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="/"], a[href^="#/"]');
      if (link && !link.hasAttribute('target')) {
        e.preventDefault();
        const href = link.getAttribute('href');
        navigate(href);
      }
    });
  }
  
  function navigate(path, replace = false) {
    if (replace) {
      window.history.replaceState({}, '', path);
    } else {
      window.history.pushState({}, '', path);
    }
    handleRoute();
  }
  
  function handleRoute() {
    const path = window.location.pathname;
    const hash = window.location.hash;
    currentRoute = path;
    
    // Get operator from storage
    currentOperator = localStorage.getItem(window.CCConfig.STORAGE_KEYS.OPERATOR);
    
    // Route to appropriate page
    if (path === '/' || path === '/index.html' || path === '') {
      showLanding();
    } else if (path === '/login' || path.includes('login')) {
      showLogin();
    } else if (path === '/dashboard' || path.includes('dashboard')) {
      requireAuth(() => showDashboard());
    } else if (path === '/tickets' || path.includes('tickets')) {
      requireAuth(() => showTickets());
    } else if (path === '/wallet' || path.includes('wallet')) {
      requireAuth(() => showWallet());
    } else if (path === '/booking' || path.includes('booking')) {
      requireAuth(() => showBooking());
    } else if (path.includes('/admin')) {
      requireAdmin(() => showAdmin(path));
    } else if (path.includes('ga-')) {
      requireAuth(() => showGAFlow(path));
    } else {
      // Try to match existing HTML files
      loadExistingPage(path);
    }
  }
  
  function requireAuth(callback) {
    const token = localStorage.getItem(window.CCConfig.STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
      navigate('/login');
      return;
    }
    callback();
  }
  
  function requireAdmin(callback) {
    const user = JSON.parse(localStorage.getItem(window.CCConfig.STORAGE_KEYS.USER_DATA) || '{}');
    if (user.role !== 'ADMIN') {
      navigate('/dashboard');
      return;
    }
    callback();
  }
  
  function showLanding() {
    if (window.CCPages && window.CCPages.renderLanding) {
      window.CCPages.renderLanding();
    }
  }
  
  function showLogin() {
    if (window.CCPages && window.CCPages.renderLogin) {
      window.CCPages.renderLogin(currentOperator);
    }
  }
  
  function showDashboard() {
    if (window.CCPages && window.CCPages.renderDashboard) {
      window.CCPages.renderDashboard();
    }
  }
  
  function showTickets() {
    if (window.CCPages && window.CCPages.renderTickets) {
      window.CCPages.renderTickets();
    }
  }
  
  function showWallet() {
    if (window.CCPages && window.CCPages.renderWallet) {
      window.CCPages.renderWallet();
    }
  }
  
  function showBooking() {
    if (window.CCPages && window.CCPages.renderBooking) {
      window.CCPages.renderBooking();
    }
  }
  
  function showAdmin(path) {
    if (window.CCPages && window.CCPages.renderAdmin) {
      window.CCPages.renderAdmin(path);
    }
  }
  
  function showGAFlow(path) {
    if (window.CCPages && window.CCPages.renderGAFlow) {
      window.CCPages.renderGAFlow(path);
    }
  }
  
  function loadExistingPage(path) {
    // Fallback: try to load existing HTML file
    const filename = path.replace(/^\//, '') + '.html';
    fetch(filename)
      .then(res => res.ok ? res.text() : null)
      .then(html => {
        if (html) {
          document.getElementById('app').innerHTML = html;
        } else {
          show404();
        }
      })
      .catch(() => show404());
  }
  
  function show404() {
    if (window.CCPages && window.CCPages.render404) {
      window.CCPages.render404();
    } else {
      document.getElementById('app').innerHTML = '<div style="text-align:center;padding:60px;"><h1>404 - Page Not Found</h1></div>';
    }
  }
  
  function getCurrentRoute() {
    return currentRoute;
  }
  
  function getCurrentOperator() {
    return currentOperator;
  }
  
  function setOperator(operator) {
    currentOperator = operator;
    localStorage.setItem(window.CCConfig.STORAGE_KEYS.OPERATOR, operator);
  }
  
  return {
    init,
    navigate,
    getCurrentRoute,
    getCurrentOperator,
    setOperator
  };
})();
