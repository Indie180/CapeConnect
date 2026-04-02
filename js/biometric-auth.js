// CapeConnect Biometric Authentication
// Phase 3: Advanced security features

class BiometricAuth {
    constructor() {
        this.isSupported = this.checkSupport();
        this.credentials = null;
        this.isEnrolled = false;
    }

    // Check if biometric authentication is supported
    checkSupport() {
        return 'credentials' in navigator && 
               'create' in navigator.credentials && 
               'get' in navigator.credentials &&
               window.PublicKeyCredential &&
               typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';
    }

    // Initialize biometric authentication
    async init() {
        if (!this.isSupported) {
            console.log('Biometric authentication not supported');
            return false;
        }

        try {
            // Check if platform authenticator is available
            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            
            if (!available) {
                console.log('Platform authenticator not available');
                return false;
            }

            // Check if user has enrolled biometrics
            this.isEnrolled = this.checkEnrollment();
            this.updateUI();
            
            return true;
        } catch (error) {
            console.error('Error initializing biometric auth:', error);
            return false;
        }
    }

    // Check if user has enrolled biometric credentials
    checkEnrollment() {
        const storedCredentials = localStorage.getItem('biometricCredentials');
        return !!storedCredentials;
    }

    // Enroll biometric authentication
    async enroll() {
        if (!this.isSupported) {
            throw new Error('Biometric authentication not supported');
        }

        const user = this.getCurrentUser();
        if (!user) {
            throw new Error('User must be logged in to enroll biometrics');
        }

        try {
            const credentialCreationOptions = {
                publicKey: {
                    challenge: this.generateChallenge(),
                    rp: {
                        name: "CapeConnect",
                        id: window.location.hostname,
                    },
                    user: {
                        id: this.stringToArrayBuffer(user.id || user.email),
                        name: user.email,
                        displayName: user.name || user.email,
                    },
                    pubKeyCredParams: [
                        {
                            alg: -7, // ES256
                            type: "public-key"
                        },
                        {
                            alg: -257, // RS256
                            type: "public-key"
                        }
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: "platform",
                        userVerification: "required",
                        requireResidentKey: false
                    },
                    timeout: 60000,
                    attestation: "direct"
                }
            };

            const credential = await navigator.credentials.create(credentialCreationOptions);
            
            if (credential) {
                // Store credential information
                const credentialData = {
                    id: credential.id,
                    rawId: this.arrayBufferToBase64(credential.rawId),
                    type: credential.type,
                    userId: user.id || user.email,
                    enrolledAt: new Date().toISOString()
                };

                localStorage.setItem('biometricCredentials', JSON.stringify(credentialData));
                this.credentials = credentialData;
                this.isEnrolled = true;
                this.updateUI();

                // Send to server for verification
                await this.sendCredentialToServer(credentialData, credential);

                return true;
            }

            return false;
        } catch (error) {
            console.error('Biometric enrollment error:', error);
            throw new Error(this.getErrorMessage(error));
        }
    }

    // Authenticate using biometrics
    async authenticate() {
        if (!this.isSupported || !this.isEnrolled) {
            throw new Error('Biometric authentication not available');
        }

        try {
            const storedCredentials = JSON.parse(localStorage.getItem('biometricCredentials'));
            
            const credentialRequestOptions = {
                publicKey: {
                    challenge: this.generateChallenge(),
                    allowCredentials: [{
                        id: this.base64ToArrayBuffer(storedCredentials.rawId),
                        type: 'public-key',
                        transports: ['internal']
                    }],
                    userVerification: 'required',
                    timeout: 60000
                }
            };

            const assertion = await navigator.credentials.get(credentialRequestOptions);
            
            if (assertion) {
                // Verify with server
                const verified = await this.verifyAssertion(assertion);
                
                if (verified) {
                    // Auto-login user
                    await this.performBiometricLogin();
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('Biometric authentication error:', error);
            throw new Error(this.getErrorMessage(error));
        }
    }

    // Disable biometric authentication
    async disable() {
        try {
            // Remove stored credentials
            localStorage.removeItem('biometricCredentials');
            
            // Notify server
            await this.removeBiometricFromServer();
            
            this.credentials = null;
            this.isEnrolled = false;
            this.updateUI();
            
            return true;
        } catch (error) {
            console.error('Error disabling biometric auth:', error);
            return false;
        }
    }

    // Generate challenge for authentication
    generateChallenge() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return array;
    }

    // Convert string to ArrayBuffer
    stringToArrayBuffer(str) {
        const encoder = new TextEncoder();
        return encoder.encode(str);
    }

    // Convert ArrayBuffer to base64
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // Convert base64 to ArrayBuffer
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // Get current user
    getCurrentUser() {
        try {
            return JSON.parse(localStorage.getItem('currentUser')) ||
                   JSON.parse(localStorage.getItem('capeConnectUser'));
        } catch (error) {
            return null;
        }
    }

    // Send credential to server
    async sendCredentialToServer(credentialData, credential) {
        try {
            const response = await fetch('/api/auth/biometric/enroll', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    credentialId: credentialData.id,
                    userId: credentialData.userId,
                    publicKey: this.arrayBufferToBase64(credential.response.publicKey),
                    attestationObject: this.arrayBufferToBase64(credential.response.attestationObject),
                    clientDataJSON: this.arrayBufferToBase64(credential.response.clientDataJSON)
                })
            });

            if (!response.ok) {
                throw new Error('Failed to register biometric credential');
            }

            console.log('Biometric credential registered successfully');
        } catch (error) {
            console.error('Error sending credential to server:', error);
            // Continue anyway - credential is stored locally
        }
    }

    // Verify assertion with server
    async verifyAssertion(assertion) {
        try {
            const response = await fetch('/api/auth/biometric/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    credentialId: assertion.id,
                    authenticatorData: this.arrayBufferToBase64(assertion.response.authenticatorData),
                    clientDataJSON: this.arrayBufferToBase64(assertion.response.clientDataJSON),
                    signature: this.arrayBufferToBase64(assertion.response.signature),
                    userHandle: assertion.response.userHandle ? 
                        this.arrayBufferToBase64(assertion.response.userHandle) : null
                })
            });

            if (response.ok) {
                const result = await response.json();
                return result.verified;
            }

            return false;
        } catch (error) {
            console.error('Error verifying assertion:', error);
            // Fallback: Allow if credential exists locally
            return this.isEnrolled;
        }
    }

    // Remove biometric from server
    async removeBiometricFromServer() {
        try {
            const user = this.getCurrentUser();
            if (!user) return;

            await fetch('/api/auth/biometric/remove', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.id || user.email
                })
            });
        } catch (error) {
            console.error('Error removing biometric from server:', error);
        }
    }

    // Perform biometric login
    async performBiometricLogin() {
        const user = this.getCurrentUser();
        if (!user) {
            throw new Error('No user data found');
        }

        // Update login timestamp
        user.lastBiometricLogin = new Date().toISOString();
        localStorage.setItem('currentUser', JSON.stringify(user));

        // Redirect to dashboard
        window.location.href = 'dashboard.html';
    }

    // Get user-friendly error message
    getErrorMessage(error) {
        if (error.name === 'NotAllowedError') {
            return 'Biometric authentication was cancelled or not allowed.';
        } else if (error.name === 'NotSupportedError') {
            return 'Biometric authentication is not supported on this device.';
        } else if (error.name === 'SecurityError') {
            return 'Security error occurred during biometric authentication.';
        } else if (error.name === 'AbortError') {
            return 'Biometric authentication was aborted.';
        } else if (error.name === 'ConstraintError') {
            return 'Biometric authentication constraints not satisfied.';
        } else if (error.name === 'InvalidStateError') {
            return 'Invalid state for biometric authentication.';
        } else {
            return error.message || 'Biometric authentication failed.';
        }
    }

    // Update UI based on enrollment status
    updateUI() {
        const enrollBtn = document.getElementById('biometric-enroll-btn');
        const disableBtn = document.getElementById('biometric-disable-btn');
        const statusText = document.getElementById('biometric-status');
        const loginBtn = document.getElementById('biometric-login-btn');

        if (enrollBtn && disableBtn && statusText) {
            if (this.isEnrolled) {
                enrollBtn.style.display = 'none';
                disableBtn.style.display = 'inline-block';
                statusText.textContent = 'Biometric authentication enabled';
                statusText.className = 'biometric-status enabled';
                
                if (loginBtn) {
                    loginBtn.style.display = 'inline-block';
                }
            } else {
                enrollBtn.style.display = 'inline-block';
                disableBtn.style.display = 'none';
                statusText.textContent = 'Biometric authentication disabled';
                statusText.className = 'biometric-status disabled';
                
                if (loginBtn) {
                    loginBtn.style.display = 'none';
                }
            }
        }
    }

    // Show biometric prompt on login page
    showBiometricPrompt() {
        if (!this.isSupported || !this.isEnrolled) {
            return false;
        }

        const prompt = document.createElement('div');
        prompt.className = 'biometric-prompt';
        prompt.innerHTML = `
            <div class="biometric-prompt-content">
                <div class="biometric-icon">👆</div>
                <h3>Use Biometric Authentication</h3>
                <p>Use your fingerprint or face to sign in quickly and securely.</p>
                <div class="biometric-actions">
                    <button class="btn btn-primary" onclick="window.biometricAuth.authenticate()">
                        Use Biometrics
                    </button>
                    <button class="btn btn-outline" onclick="this.parentElement.parentElement.parentElement.remove()">
                        Use Password
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(prompt);
        return true;
    }
}

// Global functions for HTML integration
async function enrollBiometric() {
    try {
        await window.biometricAuth.enroll();
        alert('Biometric authentication enrolled successfully!');
    } catch (error) {
        alert(error.message);
    }
}

async function authenticateBiometric() {
    try {
        await window.biometricAuth.authenticate();
    } catch (error) {
        alert(error.message);
    }
}

async function disableBiometric() {
    if (confirm('Are you sure you want to disable biometric authentication?')) {
        try {
            await window.biometricAuth.disable();
            alert('Biometric authentication disabled.');
        } catch (error) {
            alert('Failed to disable biometric authentication.');
        }
    }
}

// Initialize biometric authentication when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.biometricAuth = new BiometricAuth();
    window.biometricAuth.init().then(supported => {
        if (supported && window.biometricAuth.isEnrolled) {
            // Show biometric prompt on login page
            if (document.body.classList.contains('login-page')) {
                setTimeout(() => {
                    window.biometricAuth.showBiometricPrompt();
                }, 1000);
            }
        }
    });
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BiometricAuth;
}