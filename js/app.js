/**
 * Shared Application Logic
 */

const App = {
    // State management
    state: {
        verificationCode: null,
        tempUserData: null,
        theme: 'dark'
    },

    // Initialization
    init() {
        console.log("App Initialized");
        this.loadTheme();
        this.trackUsage();

        // Auto-Login / Session Persistence
        const currentUser = this.storage.get('currentUser');
        const selectedBus = this.storage.get('selectedBus');
        const pathname = (window.location.pathname || "").toLowerCase();
        const isPublicPage = [
            "/login", "/login.html",
            "/signup", "/signup.html",
            "/index", "/index.html", "/",
            "/forgot-password", "/forgot-password.html",
            "/verification", "/verification.html"
        ].some(p => pathname === p || pathname.endsWith(p));

        if (currentUser && isPublicPage && !window.location.pathname.includes('verification.html')) {
            if (selectedBus) {
                window.location.href = 'dashboard.html';
            } else {
                window.location.href = 'choose-bus.html';
            }
            return;
        }

        this.applyBusTheme();

        // Global Back Button Listener
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.onclick = () => this.goBack();
        });

        // Password Requirement Check
        const pwInput = document.getElementById('password');
        if (pwInput) {
            pwInput.addEventListener('input', () => {
                const val = pwInput.value;

                // Requirement checks
                const isLen = val.length >= 8;
                const isNum = /\d/.test(val);
                const isSpec = /[!@#$%^&*(),.?":{}|<>]/.test(val);

                // Update UI hints
                App.ui.toggleRequirement('req-len', isLen);
                App.ui.toggleRequirement('req-num', isNum);
                App.ui.toggleRequirement('req-spec', isSpec);
            });
        }
    },

    trackUsage() {
        const user = this.storage.get('currentUser');
        if (user) {
            const usageKey = `usage_${user.email || user.phone}`;
            let count = parseInt(localStorage.getItem(usageKey)) || 0;
            count++;
            localStorage.setItem(usageKey, count);
        }
    },

    // Validation patterns
    utils: {
        isValidEmail(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        isValidPhone(phone) {
            return /^\d{10}$/.test(phone.replace(/\D/g, ''));
        },
        isValidAuth(input) {
            return this.isValidEmail(input) || this.isValidPhone(input);
        },
        isValidStrongPassword(password) {
            return password.length >= 8 &&
                /\d/.test(password) &&
                /[!@#$%^&*(),.?":{}|<>]/.test(password);
        }
    },

    // LocalStorage wrappers
    storage: {
        save(key, value) {
            localStorage.setItem(key, JSON.stringify(value));
        },
        get(key) {
            const data = localStorage.getItem(key);
            if (data === null) return null;
            try {
                return JSON.parse(data);
            } catch (_) {
                // Backward compatibility for plain-string localStorage values
                return data;
            }
        }
    },

    // UI Helpers
    ui: {
        showError(id, show) {
            const el = document.getElementById(id);
            if (el) el.style.display = show ? 'block' : 'none';
        },
        toggleInvalid(id, isInvalid) {
            const el = document.getElementById(id);
            if (el) {
                if (isInvalid) el.classList.add('input-invalid');
                else el.classList.remove('input-invalid');
            }
        },
        toggleRequirement(id, isValid) {
            const el = document.getElementById(id);
            if (el) {
                if (isValid) el.classList.add('valid');
                else el.classList.remove('valid');
            }
        }
    },

    // Theme Logic
    toggleTheme() {
        const body = document.body;
        const isLight = body.classList.toggle('light-mode');
        this.state.theme = isLight ? 'light' : 'dark';
        this.storage.save('theme', this.state.theme);

        // Update icon
        const icon = document.querySelector('.theme-toggle i');
        if (icon) {
            icon.className = isLight ? 'fas fa-moon' : 'fas fa-sun';
        }
    },

    loadTheme() {
        const savedTheme = this.storage.get('theme') || 'dark';
        this.state.theme = savedTheme;
        if (savedTheme === 'light') {
            document.body.classList.add('light-mode');
            const icon = document.querySelector('.theme-toggle i');
            if (icon) icon.className = 'fas fa-moon';
        }
    },

    applyBusTheme() {
        const selectedBus = this.storage.get('selectedBus');
        if (selectedBus) {
            document.body.classList.remove('bus-ga', 'bus-myciti');
            document.body.classList.add(`bus-${selectedBus}`);
        }
    },

    // Navigation
    goBack() {
        window.history.back();
    },

    confirmLogout() {
        if (confirm("Are you sure you want to log out?")) {
            const finish = () => {
                App.storage.save('currentUser', null);
                App.storage.save('selectedBus', null);
                window.location.href = 'login.html';
            };
            if (window.CCApi && typeof window.CCApi.logout === 'function') {
                window.CCApi.logout().finally(finish);
                return;
            }
            finish();
        }
    },

    // Card Management
    saveCard(event) {
        event.preventDefault();
        const cardNumberRaw = document.getElementById('card-number').value;
        const cardHolder = document.getElementById('card-holder').value;
        const expiryDate = document.getElementById('expiry-date').value;
        const cvv = document.getElementById('cvv').value;

        // Basic validation (add more robust validation as needed)
        if (!cardNumberRaw || !cardHolder || !expiryDate || !cvv) {
            alert('Please fill in all card details.');
            return;
        }

        const digits = String(cardNumberRaw || "").replace(/\D/g, "");
        const last4 = digits.slice(-4);
        const maskedNumber = last4 ? `**** **** **** ${last4}` : "****";
        const newCard = { cardHolder, expiryDate, maskedNumber, last4 };
        let savedCards = App.storage.get('savedCards') || [];
        savedCards.push(newCard);
        App.storage.save('savedCards', savedCards);

        alert('Card saved successfully!');
        // Optionally redirect or update UI
        window.location.href = 'payment.html';
    },

    selectBus(type) {
        this.storage.save('selectedBus', type);
        // Apply theme immediately so header/logo update is visible before navigation
        this.applyBusTheme();
        // Update header color immediately
        try{
            const header = document.querySelector('header');
            if(header){
                if(type === 'ga') header.style.background = '#007A33';
                else if(type === 'myciti') header.style.background = '#E2231A';
            }
            // Replace logo icon with brand image where present
            const logo = document.querySelector('.logo');
            if(logo){
                if(type === 'ga') logo.innerHTML = `<img class="logo-img" src="pictures/Golden_Arrow-removebg-preview.png" alt="Golden Arrow"><span class="logo-text">CapeConnect</span>`;
                if(type === 'myciti') logo.innerHTML = `<img class="logo-img" src="pictures/myciti-removebg-preview.png" alt="MyCiti"><span class="logo-text">MyCiti</span>`;
            }
        }catch(e){}
        // Navigate to dashboard
        window.location.href = 'dashboard.html';
    },

    switchBus(type) {
        if (confirm("Are you sure you want to switch your primary bus service?")) {
            this.storage.save('selectedBus', type);
            this.applyBusTheme();
            location.reload();
        }
    },
};

function setInlineError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    if (message) {
        el.textContent = message;
        el.classList.remove("hidden");
    } else {
        el.classList.add("hidden");
    }
}

function setSubmitLoading(formId, isLoading, loadingText) {
    const form = document.getElementById(formId);
    if (!form) return;
    const btn = form.querySelector("button[type='submit']");
    if (!btn) return;
    if (!btn.dataset.defaultText) btn.dataset.defaultText = btn.textContent.trim();
    btn.disabled = Boolean(isLoading);
    btn.textContent = isLoading ? loadingText : btn.dataset.defaultText;
}

function markTouched(input) {
    if (input) input.dataset.touched = "true";
}

function isTouched(input) {
    return Boolean(input && input.dataset.touched === "true");
}

function setupPasswordToggle(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const wrapper = input.closest(".input-wrapper");
    if (!wrapper) return;
    const toggle = wrapper.querySelector(`[data-toggle-password="${inputId}"]`);
    if (!toggle) return;
    toggle.addEventListener("click", () => {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        toggle.textContent = show ? "Hide" : "Show";
        toggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
}

function initAuthUX() {
    setupPasswordToggle("password");
    setupPasswordToggle("confirm-password");

    const email = document.getElementById("email");
    const confirm = document.getElementById("confirm-password");
    const password = document.getElementById("password");

    if (email && document.getElementById("email-error")) {
        const isForgotPage = Boolean(document.getElementById("forgot-password-form"));
        const isEmailValidForPage = (value) => isForgotPage ? App.utils.isValidEmail(value) : App.utils.isValidAuth(value);
        const validateEmail = () => {
            if (!isTouched(email)) return;
            const value = email.value.trim();
            if (!value) {
                setInlineError("email-error", isForgotPage ? "Please enter your email address." : "Please enter your email or phone number.");
                return;
            }
            if (!isEmailValidForPage(value)) {
                setInlineError("email-error", isForgotPage ? "Please enter a valid email address." : "Please enter a valid email or 10-digit phone number.");
            } else {
                setInlineError("email-error", "");
            }
        };
        email.addEventListener("blur", () => {
            markTouched(email);
            validateEmail();
        });
        email.addEventListener("input", () => {
            markTouched(email);
            validateEmail();
        });
    }

    if (confirm && document.getElementById("confirm-error")) {
        const validateConfirm = () => {
            if (!isTouched(confirm)) return;
            if (!confirm.value.trim()) {
                setInlineError("confirm-error", "");
                return;
            }
            if (password && password.value !== confirm.value) {
                setInlineError("confirm-error", "Passwords do not match");
            } else {
                setInlineError("confirm-error", "");
            }
        };
        confirm.addEventListener("blur", () => {
            markTouched(confirm);
            validateConfirm();
        });
        confirm.addEventListener("input", () => {
            markTouched(confirm);
            validateConfirm();
        });
        if (password) {
            password.addEventListener("input", validateConfirm);
        }
    }
}

// Signup Flow Logic
function handleSignup(event) {
    event.preventDefault();
    setSubmitLoading("signup-form", true, "Creating account...");

    const name = document.getElementById('name').value.trim();
    const surname = document.getElementById('surname').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm-password').value;
    const agree = document.getElementById('agree').checked;

    let isValid = true;

    // Validate fields
    if (!name) { App.ui.showError('name-error', true); isValid = false; } else App.ui.showError('name-error', false);
    if (!surname) { App.ui.showError('surname-error', true); isValid = false; } else App.ui.showError('surname-error', false);

    if (!App.utils.isValidAuth(email)) {
        setInlineError("email-error", "Please enter a valid email or 10-digit phone number.");
        App.ui.toggleInvalid('email', true);
        isValid = false;
    } else {
        // Check for duplicate user
        const existingUsers = App.storage.get('users') || [];
        const isDuplicate = existingUsers.some(u =>
            (u.email && u.email === email) ||
            (u.phone && u.phone === email)
        );

        if (isDuplicate) {
            setInlineError("email-error", "An account with this email/phone already exists.");
            App.ui.toggleInvalid('email', true);
            isValid = false;
        } else {
            setInlineError("email-error", "");
            App.ui.toggleInvalid('email', false);
        }
    }

    if (!App.utils.isValidStrongPassword(password)) {
        setInlineError("password-error", "Use at least 8 characters, one number, and one special character.");
        App.ui.toggleInvalid('password', true);
        isValid = false;
    } else {
        setInlineError("password-error", "");
        App.ui.toggleInvalid('password', false);
    }

    if (confirm.trim() && password !== confirm) {
        setInlineError("confirm-error", "Passwords do not match");
        App.ui.toggleInvalid('confirm-password', true);
        isValid = false;
    } else {
        setInlineError("confirm-error", "");
        App.ui.toggleInvalid('confirm-password', false);
    }

    if (!agree) {
        alert("You must agree to the Terms and Privacy Policy.");
        isValid = false;
    }

    if (!isValid) {
        setSubmitLoading("signup-form", false, "Creating account...");
        return;
    }

    if (isValid) {
        // Store both as 'email' or 'phone' depending on format (simplified for mock)
        const allowLocalAuth = window.CC_ALLOW_LOCAL_FALLBACK === true;
        if (!allowLocalAuth) {
            alert("Signup is currently API-only. Local credential storage is disabled for security.");
            setSubmitLoading("signup-form", false, "Creating account...");
            return;
        }

        const isEmail = email.includes('@');
        const tempUserData = {
            name,
            surname,
            email: isEmail ? email : null,
            phone: isEmail ? null : email,
            password
        };

        // Persist to storage for next page
        App.storage.save('tempUserData', tempUserData);
        sendVerificationCode(email);
    }
}

function sendVerificationCode(email) {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    App.storage.save('verificationCode', code);

    // Redirect to verification page
    window.location.href = `verification.html?email=${encodeURIComponent(email)}`;
}

function verifyCode() {
    const input = document.getElementById('verification-input').value;
    const savedCode = App.storage.get('verificationCode');
    const tempUserData = App.storage.get('tempUserData');

    if (input === savedCode) {
        if (!tempUserData) {
            alert("Registration session expired. Please sign up again.");
            window.location.href = 'signup.html';
            return;
        }
        // Success
        let allUsers = App.storage.get('users') || [];
        allUsers.push(tempUserData);
        App.storage.save('users', allUsers);

        // Set the current user immediately
        App.storage.save('currentUser', tempUserData);

        // Clean up temp data
        localStorage.removeItem('verificationCode');
        localStorage.removeItem('tempUserData');

        window.location.href = 'choose-bus.html';
    } else {
        App.ui.showError('verify-error', true);
    }
}

function resendCode() {
    const tempUserData = App.storage.get('tempUserData');
    if (tempUserData) {
        sendVerificationCode(tempUserData.email || tempUserData.phone);
        alert("New code sent!");
    }
}

// Authentication Flow Logic
function handleLogin(event) {
    event.preventDefault();
    setSubmitLoading("login-form", true, "Signing in...");
    const authInput = document.getElementById('email').value.trim(); // Renamed from loginInput
    const password = document.getElementById('password').value;
    setInlineError("password-error", "");

    if (!App.utils.isValidAuth(authInput)) {
        setInlineError("email-error", "Please enter a valid email or 10-digit phone number.");
        App.ui.toggleInvalid("email", true);
        setSubmitLoading("login-form", false, "Signing in...");
        return;
    }
    setInlineError("email-error", "");
    App.ui.toggleInvalid("email", false);

    const loginWithLocalFallback = () => {
        if (window.CC_ALLOW_LOCAL_FALLBACK !== true) {
            setInlineError("password-error", "API login failed and local fallback is disabled.");
            App.ui.toggleInvalid("password", true);
            setSubmitLoading("login-form", false, "Signing in...");
            return;
        }
        const existingUsers = App.storage.get('users') || [];
        const user = existingUsers.find(u => u.email === authInput || u.phone === authInput);

        if (user && user.password === password) {
            App.storage.save('currentUser', user);
            const selectedBus = App.storage.get('selectedBus');
            if (selectedBus) {
                window.location.href = 'dashboard.html';
            } else {
                window.location.href = 'choose-bus.html';
            }
            return;
        }

        setInlineError("password-error", "Invalid credentials. Check your email/phone and password.");
        App.ui.toggleInvalid("password", true);
        setSubmitLoading("login-form", false, "Signing in...");
    };

    if (window.CCApi && App.utils.isValidEmail(authInput)) {
        window.CCApi.login(authInput, password, true)
            .then((result) => {
                const apiUser = result?.user || {};
                const profile = {
                    id: apiUser.id || null,
                    email: apiUser.email || authInput,
                    name: apiUser.fullName || authInput.split('@')[0] || "User",
                    role: apiUser.role || "USER"
                };
                App.storage.save('currentUser', profile);
                const selectedBus = App.storage.get('selectedBus');
                if (selectedBus) {
                    window.location.href = 'dashboard.html';
                } else {
                    window.location.href = 'choose-bus.html';
                }
            })
            .catch(() => {
                loginWithLocalFallback();
            });
        return;
    }

    loginWithLocalFallback();
}

function handleForgotPassword(event) {
    event.preventDefault();
    setSubmitLoading("forgot-password-form", true, "Sending link...");
    const email = document.getElementById('email').value.trim();

    if (App.utils.isValidEmail(email)) {
        setInlineError("email-error", "");
        alert(`A password reset link has been sent to ${email} (Mock)`);
        window.location.href = 'login.html';
    } else {
        setInlineError("email-error", "Please enter a valid email address.");
        App.ui.toggleInvalid("email", true);
        setSubmitLoading("forgot-password-form", false, "Sending link...");
    }
}

// Bus Selection Logic
function selectBus(type) {
    document.querySelectorAll('.bus-card').forEach(card => card.classList.remove('selected'));
    document.getElementById(`${type}-card`).classList.add('selected');

    const busName = type === 'ga' ? 'Golden Arrow' : 'MyCiti';
    document.getElementById('selection-text').textContent = `You selected: ${busName}`;

    const continueBtn = document.getElementById('continue-btn');
    continueBtn.classList.remove('btn-disabled');
    continueBtn.onclick = () => App.selectBus(type);
}

document.addEventListener('DOMContentLoaded', () => {
    App.init();
    initAuthUX();

    // Attach event listeners
    const backButton = document.querySelector('.back-button');
    if (backButton) backButton.addEventListener('click', App.goBack);

    const logoutButton = document.querySelector('.logout-button');
    if (logoutButton) logoutButton.addEventListener('click', App.confirmLogout);

    const saveCardForm = document.getElementById('add-card-form');
    if (saveCardForm) saveCardForm.addEventListener('submit', App.saveCard);

    // Auto-update logo links
    const logos = document.querySelectorAll('.logo');
    logos.forEach(logo => {
        if (logo.parentElement.tagName !== 'A') {
            const link = document.createElement('a');
            link.href = 'index.html';
            link.style.textDecoration = 'none';
            logo.parentNode.insertBefore(link, logo);
            link.appendChild(logo);
        }
    });
});
