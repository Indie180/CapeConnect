// Authentication Integration
// Bridges the new API client with existing authentication pages

(function() {
    'use strict';
    
    // Enhanced authentication manager that integrates with existing auth-pages.js
    class AuthIntegration {
        constructor() {
            this.apiClient = window.apiClient;
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
            this.setupGlobalMethods();
            console.log('Auth integration initialized');
        }
        
        setupGlobalMethods() {
            // Create CCApi compatibility layer for existing auth-pages.js
            window.CCApi = {
                login: this.login.bind(this),
                register: this.register.bind(this),
                logout: this.logout.bind(this),
                me: this.getCurrentUser.bind(this),
                updateMe: this.updateProfile.bind(this),
                readAuthSession: this.getAuthSession.bind(this),
                clearAuthSession: this.clearAuthSession.bind(this)
            };
            
            // Override existing login handler for mobile pages
            if (window.handleMobileLogin) {
                window.originalHandleLogin = window.handleMobileLogin;
            }
            window.handleMobileLogin = this.handleMobileLogin.bind(this);
        }
        
        async login(email, password, rememberMe = false) {
            try {
                const result = await this.apiClient.auth.login(email, password);
                
                if (result.success && result.user) {
                    // Store session data in format expected by auth-pages.js
                    const authSession = {
                        token: this.apiClient.auth.getAccessToken(),
                        refreshToken: this.apiClient.auth.getRefreshToken(),
                        user: result.user
                    };
                    
                    sessionStorage.setItem('ccAuthSession', JSON.stringify(authSession));
                    
                    if (rememberMe) {
                        localStorage.setItem('rememberUser', 'true');
                    }
                    
                    return {
                        success: true,
                        token: authSession.token,
                        refreshToken: authSession.refreshToken,
                        user: result.user
                    };
                } else {
                    throw new Error('Login failed');
                }
            } catch (error) {
                console.error('Login error:', error);
                throw {
                    message: this.getErrorMessage(error),
                    type: error.type || 'AUTH_ERROR'
                };
            }
        }
        
        async register(userData, autoLogin = false) {
            try {
                const result = await this.apiClient.auth.register(userData);
                
                if (result.success && result.user) {
                    if (autoLogin) {
                        // Store session data
                        const authSession = {
                            token: this.apiClient.auth.getAccessToken(),
                            refreshToken: this.apiClient.auth.getRefreshToken(),
                            user: result.user
                        };
                        
                        sessionStorage.setItem('ccAuthSession', JSON.stringify(authSession));
                    }
                    
                    return {
                        success: true,
                        token: autoLogin ? this.apiClient.auth.getAccessToken() : null,
                        refreshToken: autoLogin ? this.apiClient.auth.getRefreshToken() : null,
                        user: result.user
                    };
                } else {
                    throw new Error('Registration failed');
                }
            } catch (error) {
                console.error('Registration error:', error);
                throw {
                    message: this.getErrorMessage(error),
                    type: error.type || 'AUTH_ERROR'
                };
            }
        }
        
        async logout() {
            try {
                await this.apiClient.auth.logout();
                this.clearAuthSession();
                return { success: true };
            } catch (error) {
                console.error('Logout error:', error);
                // Always clear local session even if server logout fails
                this.clearAuthSession();
                return { success: true };
            }
        }
        
        async getCurrentUser() {
            try {
                const session = this.getAuthSession();
                if (!session?.token) {
                    throw new Error('No active session');
                }
                
                // For now, return the user from session
                // In a real implementation, this would make an API call to get fresh user data
                return {
                    success: true,
                    user: session.user
                };
            } catch (error) {
                console.error('Get current user error:', error);
                throw {
                    message: this.getErrorMessage(error),
                    type: error.type || 'AUTH_ERROR'
                };
            }
        }
        
        async updateProfile(updates) {
            try {
                // This would make an API call to update user profile
                // For now, update the session data
                const session = this.getAuthSession();
                if (session && session.user) {
                    session.user = { ...session.user, ...updates };
                    sessionStorage.setItem('ccAuthSession', JSON.stringify(session));
                    
                    return {
                        success: true,
                        user: session.user
                    };
                } else {
                    throw new Error('No active session');
                }
            } catch (error) {
                console.error('Update profile error:', error);
                throw {
                    message: this.getErrorMessage(error),
                    type: error.type || 'AUTH_ERROR'
                };
            }
        }
        
        getAuthSession() {
            try {
                const sessionData = sessionStorage.getItem('ccAuthSession');
                return sessionData ? JSON.parse(sessionData) : null;
            } catch (error) {
                console.error('Error reading auth session:', error);
                return null;
            }
        }
        
        clearAuthSession() {
            try {
                sessionStorage.removeItem('ccAuthSession');
                localStorage.removeItem('rememberUser');
                console.log('Auth session cleared');
            } catch (error) {
                console.error('Error clearing auth session:', error);
            }
        }
        
        async handleMobileLogin(email, password, rememberMe = false) {
            try {
                const result = await this.login(email, password, rememberMe);
                return result.success;
            } catch (error) {
                console.error('Mobile login error:', error);
                throw error;
            }
        }
        
        getErrorMessage(error) {
            if (error.type === window.ERROR_TYPES?.AUTH) {
                return 'Invalid credentials. Please check your email and password.';
            } else if (error.type === window.ERROR_TYPES?.NETWORK) {
                return 'Network error. Please check your connection and try again.';
            } else if (error.type === window.ERROR_TYPES?.TIMEOUT) {
                return 'Request timeout. Please try again.';
            } else if (error.type === window.ERROR_TYPES?.VALIDATION) {
                return error.message || 'Please check your input and try again.';
            } else {
                return error.message || 'An error occurred. Please try again.';
            }
        }
        
        // Check if user is authenticated
        isAuthenticated() {
            const session = this.getAuthSession();
            return !!(session?.token && this.apiClient?.auth?.isUserAuthenticated());
        }
        
        // Get current user data
        getUser() {
            const session = this.getAuthSession();
            return session?.user || null;
        }
    }
    
    // Initialize auth integration when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        window.authIntegration = new AuthIntegration();
    });
    
    // Also initialize immediately if DOM is already loaded
    if (document.readyState === 'loading') {
        // DOM is still loading
    } else {
        // DOM is already loaded
        window.authIntegration = new AuthIntegration();
    }
    
})();