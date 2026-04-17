// CapeConnect API Client
// Core API integration infrastructure with authentication and error handling

(function() {
    'use strict';

    function isLoopbackHostname(hostname) {
        const value = String(hostname || '').toLowerCase().trim();
        return value === 'localhost' || value === '127.0.0.1';
    }

    function readApiBaseOverride() {
        const keys = ['ccApiBaseUrl', 'CC_API_BASE_URL'];
        try {
            const fromGlobal = window.CapeConnectConfig && window.CapeConnectConfig.apiBaseUrl;
            if (fromGlobal) return fromGlobal;
        } catch (_error) {
            // Ignore global config access errors.
        }
        try {
            const fromMeta = document.querySelector('meta[name="capeconnect-api-base"]');
            const content = fromMeta && fromMeta.getAttribute('content');
            if (content) return content;
        } catch (_error) {
            // Ignore DOM lookup errors.
        }
        for (const key of keys) {
            try {
                const fromSession = sessionStorage.getItem(key);
                if (fromSession) return fromSession;
            } catch (_error) {
                // Ignore storage access errors.
            }
            try {
                const fromLocal = localStorage.getItem(key);
                if (fromLocal) return fromLocal;
            } catch (_error) {
                // Ignore storage access errors.
            }
        }
        return '';
    }

    function normalizeBaseUrl(rawBaseUrl) {
        const value = String(rawBaseUrl || '').trim().replace(/\/+$/, '');
        if (!value) return '';
        return value.endsWith('/api') ? value : `${value}/api`;
    }

    function alignLoopbackHostname(rawBaseUrl) {
        const value = String(rawBaseUrl || '').trim();
        if (!value || !isLoopbackHostname(window.location.hostname)) return value;

        try {
            const parsed = new URL(value);
            if (!isLoopbackHostname(parsed.hostname) || parsed.hostname === window.location.hostname) {
                return value;
            }

            parsed.hostname = window.location.hostname;
            return parsed.toString().replace(/\/+$/, '');
        } catch (_error) {
            return value;
        }
    }

    function resolveApiBaseUrl() {
        const override = normalizeBaseUrl(alignLoopbackHostname(readApiBaseOverride()));
        if (override) return override;
        if (isLoopbackHostname(window.location.hostname)) {
            return `${window.location.protocol}//${window.location.hostname}:4000/api`;
        }
        // Production default: use Render backend
        return 'https://capeconnect-backend.onrender.com/api';
    }
    
    // API Configuration
    const API_CONFIG = {
        baseURL: resolveApiBaseUrl(),
        timeout: 10000, // 10 seconds
        retryAttempts: 3,
        retryDelay: 1000, // Base delay in ms
        tokenRefreshBuffer: 60000 // Refresh token 1 minute before expiry
    };
    
    // Error types for classification
    const ERROR_TYPES = {
        NETWORK: 'NETWORK_ERROR',
        TIMEOUT: 'TIMEOUT_ERROR',
        AUTH: 'AUTH_ERROR',
        VALIDATION: 'VALIDATION_ERROR',
        SERVER: 'SERVER_ERROR',
        UNKNOWN: 'UNKNOWN_ERROR'
    };
    
    /**
     * Secure Token Storage Manager
     * Handles JWT token storage with security best practices
     */
    class SecureTokenStorage {
        static ACCESS_TOKEN_KEY = 'cc_access_token';
        static REFRESH_TOKEN_KEY = 'cc_refresh_token';
        static USER_DATA_KEY = 'cc_user_data';
        
        static storeTokens(accessToken, refreshToken, userData = null) {
            try {
                // Store access token in sessionStorage (cleared on tab close)
                sessionStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
                
                // Store refresh token in localStorage (persists across sessions)
                localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
                
                // Store user data if provided
                if (userData) {
                    sessionStorage.setItem(this.USER_DATA_KEY, JSON.stringify(userData));
                }
                
                console.log('Tokens stored securely');
            } catch (error) {
                console.error('Failed to store tokens:', error);
                throw new Error('Token storage failed');
            }
        }
        
        static getAccessToken() {
            try {
                return sessionStorage.getItem(this.ACCESS_TOKEN_KEY);
            } catch (error) {
                console.error('Failed to retrieve access token:', error);
                return null;
            }
        }
        
        static getRefreshToken() {
            try {
                return localStorage.getItem(this.REFRESH_TOKEN_KEY);
            } catch (error) {
                console.error('Failed to retrieve refresh token:', error);
                return null;
            }
        }
        
        static getUserData() {
            try {
                const userData = sessionStorage.getItem(this.USER_DATA_KEY);
                return userData ? JSON.parse(userData) : null;
            } catch (error) {
                console.error('Failed to retrieve user data:', error);
                return null;
            }
        }
        
        static clearTokens() {
            try {
                sessionStorage.removeItem(this.ACCESS_TOKEN_KEY);
                localStorage.removeItem(this.REFRESH_TOKEN_KEY);
                sessionStorage.removeItem(this.USER_DATA_KEY);
                console.log('Tokens cleared');
            } catch (error) {
                console.error('Failed to clear tokens:', error);
            }
        }
        
        static hasValidTokens() {
            return !!(this.getAccessToken() && this.getRefreshToken());
        }
    }
    
    /**
     * Authentication Manager
     * Handles JWT token lifecycle and authentication state
     */
    class AuthenticationManager {
        constructor(apiClient) {
            this.apiClient = apiClient;
            this.tokenRefreshPromise = null;
            this.user = SecureTokenStorage.getUserData();
            this.isAuthenticated = SecureTokenStorage.hasValidTokens();
            
            // Set up automatic token refresh
            this.setupTokenRefresh();
        }
        
        async login(email, password) {
            try {
                const response = await this.apiClient.request('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                });
                
                if (response.token && response.refreshToken && response.user) {
                    SecureTokenStorage.storeTokens(
                        response.token,
                        response.refreshToken,
                        response.user
                    );
                    
                    this.user = response.user;
                    this.isAuthenticated = true;
                    
                    // Set up token refresh for new session
                    this.setupTokenRefresh();
                    
                    console.log('Login successful');
                    return {
                        success: true,
                        user: response.user
                    };
                } else {
                    throw new Error('Invalid login response format');
                }
            } catch (error) {
                console.error('Login failed:', error);
                throw this.createAuthError(error);
            }
        }
        
        async register(userData) {
            try {
                const response = await this.apiClient.request('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify(userData)
                });
                
                if (response.token && response.refreshToken && response.user) {
                    SecureTokenStorage.storeTokens(
                        response.token,
                        response.refreshToken,
                        response.user
                    );
                    
                    this.user = response.user;
                    this.isAuthenticated = true;
                    
                    this.setupTokenRefresh();
                    
                    console.log('Registration successful');
                    return {
                        success: true,
                        user: response.user
                    };
                } else {
                    throw new Error('Invalid registration response format');
                }
            } catch (error) {
                console.error('Registration failed:', error);
                throw this.createAuthError(error);
            }
        }
        
        async refreshAccessToken() {
            // Prevent multiple simultaneous refresh attempts
            if (this.tokenRefreshPromise) {
                return this.tokenRefreshPromise;
            }
            
            const refreshToken = SecureTokenStorage.getRefreshToken();
            if (!refreshToken) {
                throw new Error('No refresh token available');
            }
            
            this.tokenRefreshPromise = this.performTokenRefresh(refreshToken);
            
            try {
                const result = await this.tokenRefreshPromise;
                return result;
            } finally {
                this.tokenRefreshPromise = null;
            }
        }
        
        async performTokenRefresh(refreshToken) {
            try {
                const response = await this.apiClient.request('/auth/refresh', {
                    method: 'POST',
                    body: JSON.stringify({ refreshToken })
                });
                
                if (response.token && response.refreshToken) {
                    SecureTokenStorage.storeTokens(
                        response.token,
                        response.refreshToken,
                        response.user || this.user
                    );
                    
                    if (response.user) {
                        this.user = response.user;
                    }
                    
                    console.log('Token refresh successful');
                    return response.token;
                } else {
                    throw new Error('Invalid refresh response format');
                }
            } catch (error) {
                console.error('Token refresh failed:', error);
                // Clear invalid tokens
                this.logout();
                throw this.createAuthError(error);
            }
        }
        
        async logout() {
            try {
                const refreshToken = SecureTokenStorage.getRefreshToken();
                
                // Attempt to revoke tokens on server
                if (refreshToken) {
                    await this.apiClient.request('/auth/logout', {
                        method: 'POST',
                        body: JSON.stringify({ refreshToken })
                    }).catch(error => {
                        // Log but don't throw - logout should always succeed locally
                        console.warn('Server logout failed:', error);
                    });
                }
            } finally {
                // Always clear local tokens
                SecureTokenStorage.clearTokens();
                this.user = null;
                this.isAuthenticated = false;
                this.tokenRefreshPromise = null;
                
                console.log('Logout completed');
            }
        }
        
        async requestPasswordReset(email) {
            try {
                await this.apiClient.request('/auth/forgot-password', {
                    method: 'POST',
                    body: JSON.stringify({ email })
                });
                
                return { success: true };
            } catch (error) {
                console.error('Password reset request failed:', error);
                throw this.createAuthError(error);
            }
        }
        
        setupTokenRefresh() {
            // Clear any existing refresh timer
            if (this.refreshTimer) {
                clearTimeout(this.refreshTimer);
            }
            
            const accessToken = SecureTokenStorage.getAccessToken();
            if (!accessToken) return;
            
            try {
                // Decode JWT to get expiry (simple base64 decode)
                const payload = JSON.parse(atob(accessToken.split('.')[1]));
                const expiryTime = payload.exp * 1000; // Convert to milliseconds
                const currentTime = Date.now();
                const timeUntilRefresh = expiryTime - currentTime - API_CONFIG.tokenRefreshBuffer;
                
                if (timeUntilRefresh > 0) {
                    this.refreshTimer = setTimeout(() => {
                        this.refreshAccessToken().catch(error => {
                            console.error('Automatic token refresh failed:', error);
                        });
                    }, timeUntilRefresh);
                }
            } catch (error) {
                console.error('Failed to setup token refresh:', error);
            }
        }
        
        createAuthError(originalError) {
            return {
                type: ERROR_TYPES.AUTH,
                message: originalError.message || 'Authentication failed',
                originalError
            };
        }
        
        getUser() {
            return this.user;
        }
        
        isUserAuthenticated() {
            return this.isAuthenticated && SecureTokenStorage.hasValidTokens();
        }

        getAccessToken() {
            return SecureTokenStorage.getAccessToken();
        }

        getRefreshToken() {
            return SecureTokenStorage.getRefreshToken();
        }
    }
    
    /**
     * Core API Client
     * Handles HTTP requests with authentication, retries, and error handling
     */
    class APIClient {
        constructor() {
            this.timeout = API_CONFIG.timeout;
            this.retryAttempts = API_CONFIG.retryAttempts;
            this.retryDelay = API_CONFIG.retryDelay;
            this.requestQueue = [];
            this.isOnline = navigator.onLine;
            
            // Initialize authentication manager
            this.auth = new AuthenticationManager(this);
            
            // Set up network status monitoring
            this.setupNetworkMonitoring();
            
            console.log('API Client initialized');
        }

        getBaseURL() {
            return resolveApiBaseUrl();
        }
        
        setupNetworkMonitoring() {
            window.addEventListener('online', () => {
                this.isOnline = true;
                console.log('Network connection restored');
                this.processQueuedRequests();
            });
            
            window.addEventListener('offline', () => {
                this.isOnline = false;
                console.log('Network connection lost');
            });
        }
        
        async request(endpoint, options = {}) {
            const url = endpoint.startsWith('http') ? endpoint : `${this.getBaseURL()}${endpoint}`;
            
            const requestOptions = {
                method: 'GET',
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...(options.headers || {})
                }
            };
            
            // Add request ID for tracking
            const requestId = this.generateRequestId();
            requestOptions.headers['X-Request-ID'] = requestId;
            
            return this.executeWithRetry(url, requestOptions, requestId);
        }
        
        async authenticatedRequest(endpoint, options = {}) {
            const token = SecureTokenStorage.getAccessToken();
            
            if (!token) {
                throw {
                    type: ERROR_TYPES.AUTH,
                    message: 'No authentication token available',
                    code: 'NO_TOKEN'
                };
            }
            
            const requestOptions = {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `Bearer ${token}`
                }
            };
            
            try {
                return await this.request(endpoint, requestOptions);
            } catch (error) {
                // Handle token expiry
                if (error.status === 401 && error.code !== 'REFRESH_FAILED') {
                    try {
                        console.log('Token expired, attempting refresh...');
                        await this.auth.refreshAccessToken();
                        
                        // Retry with new token
                        const newToken = SecureTokenStorage.getAccessToken();
                        requestOptions.headers.Authorization = `Bearer ${newToken}`;
                        
                        return await this.request(endpoint, requestOptions);
                    } catch (refreshError) {
                        console.error('Token refresh failed:', refreshError);
                        throw {
                            type: ERROR_TYPES.AUTH,
                            message: 'Authentication failed',
                            code: 'REFRESH_FAILED',
                            originalError: refreshError
                        };
                    }
                }
                
                throw error;
            }
        }
        
        async executeWithRetry(url, options, requestId, attempt = 1) {
            try {
                const response = await this.performRequest(url, options);
                return await this.handleResponse(response, requestId);
            } catch (error) {
                if (attempt < this.retryAttempts && this.isRetryableError(error)) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                    console.log(`Request ${requestId} failed, retrying in ${delay}ms (attempt ${attempt}/${this.retryAttempts})`);
                    
                    await this.delay(delay);
                    return this.executeWithRetry(url, options, requestId, attempt + 1);
                }
                
                throw this.createAPIError(error, requestId);
            }
        }
        
        async performRequest(url, options) {
            // Check network connectivity
            if (!this.isOnline) {
                throw {
                    type: ERROR_TYPES.NETWORK,
                    message: 'No network connection available'
                };
            }
            
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            
            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                return response;
            } catch (error) {
                clearTimeout(timeoutId);
                
                if (error.name === 'AbortError') {
                    throw {
                        type: ERROR_TYPES.TIMEOUT,
                        message: 'Request timeout'
                    };
                }
                
                throw {
                    type: ERROR_TYPES.NETWORK,
                    message: error.message || 'Network request failed',
                    originalError: error
                };
            }
        }
        
        async handleResponse(response, requestId) {
            const contentType = response.headers.get('content-type');
            const isJSON = contentType && contentType.includes('application/json');
            
            let data;
            try {
                data = isJSON ? await response.json() : await response.text();
            } catch (error) {
                throw {
                    type: ERROR_TYPES.SERVER,
                    message: 'Invalid response format',
                    status: response.status
                };
            }
            
            if (!response.ok) {
                throw {
                    type: this.getErrorTypeFromStatus(response.status),
                    message: data.error || data.message || `HTTP ${response.status}`,
                    status: response.status,
                    code: data.code,
                    details: data.details,
                    requestId
                };
            }
            
            return data;
        }
        
        createAPIError(error, requestId) {
            return {
                type: error.type || ERROR_TYPES.UNKNOWN,
                message: error.message || 'Unknown error occurred',
                status: error.status,
                code: error.code,
                details: error.details,
                requestId,
                timestamp: new Date().toISOString(),
                originalError: error.originalError
            };
        }
        
        getErrorTypeFromStatus(status) {
            if (status === 401 || status === 403) return ERROR_TYPES.AUTH;
            if (status === 400 || status === 422) return ERROR_TYPES.VALIDATION;
            if (status >= 500) return ERROR_TYPES.SERVER;
            return ERROR_TYPES.UNKNOWN;
        }
        
        isRetryableError(error) {
            return error.type === ERROR_TYPES.NETWORK ||
                   error.type === ERROR_TYPES.TIMEOUT ||
                   (error.status >= 500 && error.status < 600);
        }
        
        async processQueuedRequests() {
            // Process any queued requests when network comes back online
            // This would be implemented with the offline sync manager
            console.log('Processing queued requests...');
        }
        
        generateRequestId() {
            return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        
        // Convenience methods
        async get(endpoint, options = {}) {
            return this.request(endpoint, { ...options, method: 'GET' });
        }
        
        async post(endpoint, data, options = {}) {
            return this.request(endpoint, {
                ...options,
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
        
        async patch(endpoint, data, options = {}) {
            return this.request(endpoint, {
                ...options,
                method: 'PATCH',
                body: JSON.stringify(data)
            });
        }
        
        async delete(endpoint, options = {}) {
            return this.request(endpoint, { ...options, method: 'DELETE' });
        }
        
        // Authenticated convenience methods
        async authGet(endpoint, options = {}) {
            return this.authenticatedRequest(endpoint, { ...options, method: 'GET' });
        }
        
        async authPost(endpoint, data, options = {}) {
            return this.authenticatedRequest(endpoint, {
                ...options,
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
        
        async authPatch(endpoint, data, options = {}) {
            return this.authenticatedRequest(endpoint, {
                ...options,
                method: 'PATCH',
                body: JSON.stringify(data)
            });
        }
        
        async authDelete(endpoint, options = {}) {
            return this.authenticatedRequest(endpoint, { ...options, method: 'DELETE' });
        }
    }
    
    // Create global API client instance
    const apiClient = new APIClient();
    
    // Export to global scope
    window.APIClient = APIClient;
    window.apiClient = apiClient;
    window.SecureTokenStorage = SecureTokenStorage;
    window.ERROR_TYPES = ERROR_TYPES;

    function readAuthSession() {
        const token = SecureTokenStorage.getAccessToken();
        const refreshToken = SecureTokenStorage.getRefreshToken();
        const user = SecureTokenStorage.getUserData();
        if (!token || !refreshToken) return null;
        return { token, refreshToken, user };
    }

    function clearAuthSession() {
        SecureTokenStorage.clearTokens();
        try {
            sessionStorage.removeItem('ccAuthSession');
        } catch (_error) {
            // Ignore storage cleanup errors.
        }
    }

    function syncCompatSession(userOverride = null) {
        const session = {
            token: SecureTokenStorage.getAccessToken(),
            refreshToken: SecureTokenStorage.getRefreshToken(),
            user: userOverride || SecureTokenStorage.getUserData()
        };
        try {
            sessionStorage.setItem('ccAuthSession', JSON.stringify(session));
        } catch (_error) {
            // Ignore storage sync errors.
        }
        return session;
    }

    window.CCApi = {
        async login(email, password, rememberMe = false) {
            const response = await apiClient.request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            SecureTokenStorage.storeTokens(response.token, response.refreshToken, response.user || null);
            syncCompatSession(response.user || null);
            if (rememberMe) {
                try {
                    localStorage.setItem('rememberUser', 'true');
                } catch (_error) {
                    // Ignore remember-me storage failures.
                }
            }
            return response;
        },

        async register(userData, autoLogin = false) {
            const response = await apiClient.request('/auth/register', {
                method: 'POST',
                body: JSON.stringify(userData)
            });
            if (autoLogin && response.token && response.refreshToken) {
                SecureTokenStorage.storeTokens(response.token, response.refreshToken, response.user || null);
                syncCompatSession(response.user || null);
            }
            return response;
        },

        async logout() {
            const refreshToken = SecureTokenStorage.getRefreshToken();
            try {
                const token = SecureTokenStorage.getAccessToken();
                if (token) {
                    await apiClient.request('/auth/logout', {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify(refreshToken ? { refreshToken } : {})
                    });
                }
            } finally {
                clearAuthSession();
            }
            return { ok: true };
        },

        async me() {
            const response = await apiClient.authGet('/auth/me');
            if (response?.user) {
                SecureTokenStorage.storeTokens(
                    SecureTokenStorage.getAccessToken(),
                    SecureTokenStorage.getRefreshToken(),
                    response.user
                );
                syncCompatSession(response.user);
            }
            return response;
        },

        async updateMe(updates) {
            const response = await apiClient.authPatch('/auth/me', updates || {});
            if (response?.user) {
                SecureTokenStorage.storeTokens(
                    SecureTokenStorage.getAccessToken(),
                    SecureTokenStorage.getRefreshToken(),
                    response.user
                );
                syncCompatSession(response.user);
            }
            return response;
        },

        async changePassword(payload) {
            return apiClient.authPost('/auth/change-password', payload || {});
        },

        async forgotPassword(payload) {
            return apiClient.request('/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify(payload || {})
            });
        },

        async resetPassword(payload) {
            return apiClient.request('/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify(payload || {})
            });
        },

        readAuthSession,
        clearAuthSession,

        getToken() {
            return SecureTokenStorage.getAccessToken();
        },

        getRefreshToken() {
            return SecureTokenStorage.getRefreshToken();
        },

        async getWalletMe() {
            return apiClient.authGet('/wallets/me');
        },

        async walletTopup(payload) {
            return apiClient.authPost('/wallets/topup', payload || {});
        },

        async walletSpend(payload) {
            return apiClient.authPost('/wallets/spend', payload || {});
        },

        async getTickets(query = {}) {
            const params = new URLSearchParams();
            Object.entries(query || {}).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    params.set(key, String(value));
                }
            });
            const suffix = params.toString() ? `?${params.toString()}` : '';
            return apiClient.authGet(`/tickets${suffix}`);
        },

        async createTicket(payload) {
            return apiClient.authPost('/tickets', payload || {});
        },

        async useTicket(id) {
            return apiClient.authPost(`/tickets/${encodeURIComponent(id)}/use`, {});
        },

        async verifyQr(payload) {
            return apiClient.authPost('/tickets/verify-qr', payload || {});
        },

        async getRoutes(query = {}) {
            const params = new URLSearchParams();
            Object.entries(query || {}).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    params.set(key, String(value));
                }
            });
            const suffix = params.toString() ? `?${params.toString()}` : '';
            return apiClient.get(`/routes${suffix}`);
        },

        async getStops(query = {}) {
            const params = new URLSearchParams();
            Object.entries(query || {}).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    params.set(key, String(value));
                }
            });
            const suffix = params.toString() ? `?${params.toString()}` : '';
            return apiClient.get(`/routes/stops${suffix}`);
        },

        async getTimetables(query = {}) {
            const params = new URLSearchParams();
            Object.entries(query || {}).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    params.set(key, String(value));
                }
            });
            const suffix = params.toString() ? `?${params.toString()}` : '';
            return apiClient.get(`/timetables${suffix}`);
        },

        async getPrices(query = {}) {
            const params = new URLSearchParams();
            Object.entries(query || {}).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    params.set(key, String(value));
                }
            });
            const suffix = params.toString() ? `?${params.toString()}` : '';
            return apiClient.get(`/prices${suffix}`);
        },

        async initiatePayment(amount) {
            return apiClient.authPost('/payments/topup/initiate', { amount });
        },

        async getPaymentStatus(paymentId) {
            return apiClient.authGet(`/payments/status/${encodeURIComponent(paymentId)}`);
        },

        redirectToPayment(paymentUrl, paymentData) {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = paymentUrl;
            Object.entries(paymentData || {}).forEach(([key, value]) => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = String(value);
                form.appendChild(input);
            });
            document.body.appendChild(form);
            form.submit();
        }
    };
    
    console.log('CapeConnect API Client loaded');
    
})();
