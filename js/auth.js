// CapeConnect Authentication
window.CCAuth = (function() {
  const { STORAGE_KEYS, API_BASE_URL } = window.CCConfig;
  
  function isAuthenticated() {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    return !!token;
  }
  
  function getUser() {
    const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    return userData ? JSON.parse(userData) : null;
  }
  
  function getToken() {
    return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  }
  
  async function login(email, password, operator, role = 'USER') {
    try {
      // Demo mode - accept any credentials
      const demoUser = {
        id: 1,
        email: email,
        role: role,
        operator: operator === 'myciti' ? 'MYCITI' : 'GOLDEN_ARROW',
        name: email.split('@')[0]
      };
      
      const demoToken = btoa(JSON.stringify({ userId: 1, operator, role, exp: Date.now() + 86400000 }));
      
      // Store auth data
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, demoToken);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(demoUser));
      localStorage.setItem(STORAGE_KEYS.OPERATOR, operator);
      
      return { success: true, user: demoUser, token: demoToken };
      
      // Production code (commented out for demo):
      /*
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, operator, role })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }
      
      const data = await response.json();
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.token);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
      localStorage.setItem(STORAGE_KEYS.OPERATOR, operator);
      
      return { success: true, user: data.user, token: data.token };
      */
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }
  
  async function signup(email, password, name, operator) {
    try {
      // Demo mode
      return await login(email, password, operator, 'USER');
      
      // Production code:
      /*
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, operator })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Signup failed');
      }
      
      const data = await response.json();
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.token);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
      localStorage.setItem(STORAGE_KEYS.OPERATOR, operator);
      
      return { success: true, user: data.user, token: data.token };
      */
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: error.message };
    }
  }
  
  function logout() {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    localStorage.removeItem(STORAGE_KEYS.OPERATOR);
    window.CCRouter.navigate('/');
  }
  
  async function verifyToken() {
    const token = getToken();
    if (!token) return false;
    
    // Demo mode - always valid
    return true;
    
    // Production code:
    /*
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.ok;
    } catch {
      return false;
    }
    */
  }
  
  return {
    isAuthenticated,
    getUser,
    getToken,
    login,
    signup,
    logout,
    verifyToken
  };
})();
