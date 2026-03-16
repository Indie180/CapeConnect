// CapeConnect - Main Application
(function() {
  // Initialize app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  function init() {
    console.log('🚌 CapeConnect initializing...');
    
    // Initialize router
    window.CCRouter.init();
    
    // Check authentication status
    checkAuth();
    
    console.log('✅ CapeConnect ready');
  }
  
  async function checkAuth() {
    if (window.CCAuth.isAuthenticated()) {
      const isValid = await window.CCAuth.verifyToken();
      if (!isValid) {
        window.CCAuth.logout();
      }
    }
  }
})();
