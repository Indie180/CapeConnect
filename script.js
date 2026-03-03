// Theme Toggle Functionality
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Update theme toggle icons
    const themeIcons = document.querySelectorAll('.theme-toggle i');
    themeIcons.forEach(icon => {
        icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    });
}

// Initialize theme from localStorage
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Set initial theme toggle icons
    const themeIcons = document.querySelectorAll('.theme-toggle i');
    themeIcons.forEach(icon => {
        icon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    });
}

// Toggle Mobile Menu
function toggleMobileMenu() {
    const nav = document.getElementById('main-nav');
    nav.classList.toggle('active');

    // Toggle icon
    const btnIcon = document.querySelector('.mobile-menu-btn i');
    if (nav.classList.contains('active')) {
        btnIcon.classList.remove('fa-bars');
        btnIcon.classList.add('fa-times');
    } else {
        btnIcon.classList.remove('fa-times');
        btnIcon.classList.add('fa-bars');
    }
}

// Page Navigation
function navigateTo(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Show the selected page
    document.getElementById(pageId).classList.add('active');

    // If navigating to dashboard, populate tickets
    if (pageId === 'dashboard') {
        populateTickets();
    }

    // If navigating to destination, initialize searchable dropdowns
    if (pageId === 'destination') {
        initializeSearchableDropdowns();
    }

    if (pageId === 'wallet') {
        loadWalletData();
    }

    // If navigating to profile, populate profile data
    if (pageId === 'profile') {
        populateProfileData();
    }

    // Scroll to top
    window.scrollTo(0, 0);
}

// Show services function
function showServices() {
    navigateTo('dashboard');
    setTimeout(() => {
        document.getElementById('services').classList.remove('hidden-section');
        document.getElementById('services').scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

function handleWalletTopUp() {
    const amount = parseFloat(document.getElementById('topup-amount').value);
    const method = document.getElementById('topup-method').value;

    if (isNaN(amount) || amount < 10) {
        alert('Please enter a valid amount (minimum R10).');
        return;
    }

    // Simulate payment processing
    const user = JSON.parse(localStorage.getItem('capeConnectUser'));
    if (!user) return;

    user.walletBalance = (user.walletBalance || 0) + amount;

    // Add transaction record
    const transaction = {
        date: new Date().toISOString().split('T')[0],
        description: 'Wallet Top Up',
        amount: `+R${amount.toFixed(2)}`,
        status: 'Completed'
    };

    // Mock Transaction History in User Object (or separate storage)
    if (!user.transactions) user.transactions = [];
    user.transactions.unshift(transaction);

    localStorage.setItem('capeConnectUser', JSON.stringify(user));

    document.getElementById('topup-modal').style.display = 'none';
    alert(`Successfully added R${amount.toFixed(2)} to your wallet!`);

    // Refresh Wallet UI
    loadWalletData();
}

function loadWalletData() {
    const user = JSON.parse(localStorage.getItem('capeConnectUser'));
    if (!user) return;

    // Update Balance Display
    const balanceDisplays = document.querySelectorAll('#wallet-balance-display, #myciti-balance'); // Update multiple places if needed
    balanceDisplays.forEach(el => {
        if (el) el.textContent = `R ${(user.walletBalance || 0).toFixed(2)}`;
    });

    // Update Transaction History
    const historyBody = document.getElementById('transaction-history-body');
    if (historyBody && user.transactions) {
        historyBody.innerHTML = '';
        user.transactions.forEach(t => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${t.date}</td>
                <td>${t.description}</td>
                <td style="color: ${t.amount.startsWith('+') ? 'var(--success-color)' : 'var(--error-color)'}">${t.amount}</td>
                <td>${t.status}</td>
            `;
            historyBody.appendChild(row);
        });
    }

    // Update Saved Cards
    const savedCardsList = document.getElementById('saved-cards-list');
    if (savedCardsList && user.savedCards && user.savedCards.length > 0) {
        savedCardsList.innerHTML = '';
        user.savedCards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'saved-card-item';
            cardEl.style.cssText = 'padding: 10px; border: 1px solid var(--border-light); margin-bottom: 5px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;';
            cardEl.innerHTML = `
                <span><i class="fas fa-credit-card"></i> **** ${card.last4}</span>
                <span class="badge" style="background: #e6f7ee; color: #10b981; padding: 2px 5px; border-radius: 4px; font-size: 0.8rem;">Saved</span>
            `;
            savedCardsList.appendChild(cardEl);
        });

        // Also update top-up modal dropdown
        const topupMethod = document.getElementById('topup-method');
        if (topupMethod) {
            // Keep "New Card" option
            topupMethod.innerHTML = '<option value="new">New Card</option>';
            user.savedCards.forEach((card, index) => {
                const opt = document.createElement('option');
                opt.value = index;
                opt.textContent = `Saved Card (**** ${card.last4})`;
                topupMethod.appendChild(opt);
            });
        }
    }
}

// Handle book ticket button
function handleBookTicket() {
    const isLoggedIn = localStorage.getItem('capeConnectUser');
    const selectedBus = localStorage.getItem('selectedBus');

    if (selectedBus === 'myciti') {
        window.location.href = 'html.html';
        return;
    }

    if (isLoggedIn) {
        showServices();
    } else {
        navigateTo('login');
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function () {
    // Initialize theme
    initializeTheme();

    // Add event listeners to theme toggles
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('theme-toggle-user').addEventListener('click', toggleTheme);

    // Check if user is logged in (for demo purposes)
    const isLoggedIn = localStorage.getItem('capeConnectUser');

    if (isLoggedIn) {
        const user = JSON.parse(isLoggedIn);
        document.getElementById('auth-buttons').style.display = 'none';
        document.getElementById('user-menu').style.display = 'flex';
        document.getElementById('username').textContent = user.name;

        // Update welcome message based on user status
        updateWelcomeMessage(user.isNew);
    }

    // Populate timetable with sample data
    refreshTimetable();

    // Populate active tickets
    populateTickets();

    // Set minimum date for departure date
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const formattedDate = tomorrow.toISOString().split('T')[0];
    // Initialize Routes
    initRoutes();

    // Check admin access on load
    checkAdminAccess();
});

function checkAdminAccess() {
    const user = JSON.parse(localStorage.getItem('capeConnectUser'));
    if (user && user.role === 'admin') {
        const userMenu = document.getElementById('user-menu');
        if (userMenu && !document.getElementById('admin-portal-link')) {
            const adminLink = document.createElement('a');
            adminLink.id = 'admin-portal-link';
            adminLink.href = 'admin.html';
            adminLink.className = 'btn btn-outline';
            adminLink.style.borderColor = 'var(--accent-yellow)';
            adminLink.style.color = 'var(--accent-yellow)';
            adminLink.innerHTML = '<i class="fas fa-user-shield"></i> Admin Portal';
            userMenu.insertBefore(adminLink, userMenu.firstChild);
        }
    }
}

// Update welcome message based on user status
function updateWelcomeMessage(isNew) {
    const welcomeTitle = document.getElementById('welcome-title');
    const welcomeSubtitle = document.getElementById('welcome-subtitle');
    const welcomeBadge = document.getElementById('welcome-badge');

    if (isNew) {
        welcomeTitle.textContent = 'Welcome to CapeConnect!';
        welcomeSubtitle.textContent = 'We\'re excited to have you on board. Start your journey with us today!';
        welcomeBadge.style.display = 'block';
    } else {
        welcomeTitle.textContent = 'Welcome Back to CapeConnect!';
        welcomeSubtitle.textContent = 'Ready for your next journey? Check your active tickets or book a new one.';
        welcomeBadge.style.display = 'none';
    }
}

// Refresh timetable data
// Refresh timetable data
function refreshTimetable() {
    const timetableBody = document.getElementById('timetable-body');
    timetableBody.innerHTML = '';

    // Use routeDatabase but limited to first 5 for the "Next Departures" widget
    // In a real app we'd filter by time relative to now
    const upcomingRoutes = routeDatabase.slice(0, 5);

    upcomingRoutes.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
        <td>${item.name}</td>
        <td>${item.origin}</td>
        <td>${item.destination}</td>
        <td>${item.time}</td>
        <td class="status-on-time">On Time</td>
    `;
        timetableBody.appendChild(row);
    });
}

// Populate active tickets
function populateTickets() {
    const ticketsContainer = document.getElementById('tickets-container');

    // Get tickets from localStorage or use sample data
    let tickets = JSON.parse(localStorage.getItem('capeConnectTickets')) || [];

    // Clear existing content
    ticketsContainer.innerHTML = '';

    // If no tickets
    if (tickets.length === 0) {
        ticketsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-light);">
            <i class="fas fa-ticket-alt" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.3;"></i>
            <h3>No Active Tickets</h3>
            <p>You don't have any active tickets yet.</p>
            <a href="#" class="btn btn-primary" onclick="handleBookTicket()">Book Your First Ticket</a>
        </div>
    `;
        return;
    }

    // Populate with ticket data
    tickets.forEach(ticket => {
        const ticketCard = document.createElement('div');
        ticketCard.className = 'ticket-card';
        ticketCard.innerHTML = `
        <div class="ticket-header">
            <span class="ticket-route">${ticket.route}</span>
            <span class="ticket-status status-active">${ticket.status}</span>
        </div>
        <div class="ticket-details">
            <div class="ticket-detail">
                <span>From:</span>
                <span>${ticket.from}</span>
            </div>
            <div class="ticket-detail">
                <span>To:</span>
                <span>${ticket.to}</span>
            </div>
            <div class="ticket-detail">
                <span>Date:</span>
                <span>${ticket.date}</span>
            </div>
            <div class="ticket-detail">
                <span>Time:</span>
                <span>${ticket.time}</span>
            </div>
            <div class="ticket-detail">
                <span>Passengers:</span>
                <span>${ticket.passengers}</span>
            </div>
        </div>
        <div class="ticket-actions">
            <button class="btn btn-primary btn-small" onclick="viewTicketDetails('${ticket.id}')">View Details</button>
        </div>
    `;
        ticketsContainer.appendChild(ticketCard);
    });
}

// View ticket details
function viewTicketDetails(ticketId) {
    // Get tickets from localStorage
    const tickets = JSON.parse(localStorage.getItem('capeConnectTickets')) || [];
    const ticket = tickets.find(t => t.id === ticketId);

    if (!ticket) {
        alert('Ticket not found');
        return;
    }

    const modalContent = document.getElementById('ticket-modal-content');
    modalContent.innerHTML = `
    <div class="ticket-details" style="padding: 20px;">
        <div class="detail-row">
            <span class="detail-label">Ticket ID:</span>
            <span class="detail-value">${ticket.id}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Service:</span>
            <span class="detail-value">${ticket.service}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Route:</span>
            <span class="detail-value">${ticket.route}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">From:</span>
            <span class="detail-value">${ticket.from}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">To:</span>
            <span class="detail-value">${ticket.to}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Date:</span>
            <span class="detail-value">${ticket.date}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Time:</span>
            <span class="detail-value">${ticket.time}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Passengers:</span>
            <span class="detail-value">${ticket.passengers}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Ticket Type:</span>
            <span class="detail-value">${ticket.type}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Price:</span>
            <span class="detail-value">${ticket.price}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Booking Date:</span>
            <span class="detail-value">${ticket.bookingDate}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="detail-value status-active">${ticket.status}</span>
        </div>
    </div>
    <div class="ticket-barcode">
        <div class="barcode-container">
            <div class="barcode" id="barcode-${ticket.id}"></div>
        </div>
    </div>
`;

    // Generate barcode for the ticket
    generateBarcode(ticket.id);

    document.getElementById('ticket-modal').style.display = 'flex';
}

// Generate barcode for a ticket
function generateBarcode(ticketId) {
    const barcodeContainer = document.getElementById(`barcode-${ticketId}`);
    barcodeContainer.innerHTML = '';

    // Generate a simple barcode using div elements
    for (let i = 0; i < 20; i++) {
        const bar = document.createElement('div');
        // Random width for each bar to simulate a barcode
        const width = Math.floor(Math.random() * 4) + 1;
        bar.className = 'barcode-line';
        bar.style.width = `${width}px`;
        barcodeContainer.appendChild(bar);
    }
}

// Close ticket modal
function closeTicketModal() {
    document.getElementById('ticket-modal').style.display = 'none';
}

// Service selection functions
function selectMyCiTiOption(option) {
    // This would typically update UI to show the selected option
    document.querySelectorAll('#myciti-option input').forEach(radio => {
        radio.checked = false;
    });
    document.querySelector(`#myciti-${option}-option`).checked = true;
}

function selectGoldenArrowOption(option) {
    // This would typically update UI to show the selected option
    document.querySelectorAll('.radio-option input').forEach(radio => {
        radio.checked = false;
    });
    document.querySelector(`input[value="${option}"]`).checked = true;
}

// Select MyCiTi service
function selectMyCiTiService() {
    const topupAmount = document.getElementById('myciti-topup').value;
    const monthlySelected = document.getElementById('myciti-monthly-option').checked;

    if (!topupAmount && !monthlySelected) {
        alert('Please select a top-up amount or monthly ticket');
        return;
    }

    // Store service selection
    localStorage.setItem('selectedService', 'myciti');

    if (monthlySelected) {
        localStorage.setItem('selectedTicketType', 'monthly');
        localStorage.setItem('selectedAmount', 'R 1000.00');
    } else {
        localStorage.setItem('selectedTicketType', 'topup');
        localStorage.setItem('selectedAmount', `R ${topupAmount}.00`);
    }

    navigateTo('destination');
}

// Select Golden Arrow service

function selectGoldenArrowService() {
    const selectedOption = document.querySelector('input[name="golden-arrow-option"]:checked');

    if (!selectedOption) {
        alert('Please select a ticket type');
        return;
    }

    // Store service selection
    localStorage.setItem('selectedService', 'golden-arrow');
    localStorage.setItem('selectedTicketType', selectedOption.value);

    // Set the amount based on the selection
    const amount = selectedOption.value === 'weekly' ? 'R 240.00' : 'R 1050.00';
    localStorage.setItem('selectedAmount', amount);

    // Monthly Ticket Logic (Rule 9)
    if (selectedOption.value === 'monthly') {
        if (confirm("Confirm purchase of Golden Arrow Monthly Ticket? This will be linked to your account.")) {
            const user = JSON.parse(localStorage.getItem('capeConnectUser'));
            if (user) {
                user.monthlyTicketActive = true;
                // Simulate deducting R1050 from Wallet if redundant, but here we go to payment page anyway?
                // Let's assume we proceed to payment to PAY for the monthly ticket.
                localStorage.setItem('capeConnectUser', JSON.stringify(user));
                // Note: Ideally we only activate AFTER payment.
            }
        }
    }

    navigateTo('destination');
}

// Card type selection
function selectCardType(type) {
    document.querySelectorAll('.card-icon').forEach(icon => {
        icon.classList.remove('active');
    });
    document.querySelector(`.card-icon[data-type="${type}"]`).classList.add('active');
}

// Logout function
function logout() {
    localStorage.removeItem('capeConnectUser');
    document.getElementById('auth-buttons').style.display = 'flex';
    document.getElementById('user-menu').style.display = 'none';

    // Hide services section when logging out
    document.getElementById('services').classList.add('hidden-section');

    navigateTo('dashboard');
}

// Form handling
document.getElementById('login-form')?.addEventListener('submit', function (e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value; // In a real app, hash this!

    // Special Admin Login
    if (email === 'admin@capeconnect.co.za') {
        const adminUser = {
            name: 'Admin User',
            email: email,
            role: 'admin',
            isVerified: true,
            walletBalance: 0
        };
        localStorage.setItem('capeConnectUser', JSON.stringify(adminUser));
        window.location.href = 'admin.html'; // Direct to admin portal
        return;
    }

    // Get User Database
    const userDatabase = JSON.parse(localStorage.getItem('userDatabase')) || [];
    const user = userDatabase.find(u => u.email === email);

    if (user) {
        // Check Status
        if (user.status === 'blocked') {
            alert("Your account has been blocked. Please contact support.");
            return;
        }
        if (user.status === 'deactivated') {
            alert("Your account is deactivated. Please contact support to reactivate.");
            return;
        }
        if (user.status === 'blacklisted') {
            alert("Your account has been blacklisted.");
            return;
        }

        // Verify Password (Simple check for demo)
        if (user.password !== password) {
            alert("Invalid password.");
            return;
        }

        // Login Successful
        localStorage.setItem('capeConnectUser', JSON.stringify(user));

        // Update UI
        document.getElementById('auth-buttons').style.display = 'none';
        document.getElementById('user-menu').style.display = 'flex';
        document.getElementById('username').textContent = user.name;

        // Update Welcome Message
        updateWelcomeMessage(false);
        navigateTo('dashboard');

    } else {
        alert("User not found. Please register.");
    }
});

// Handle Forgot Password
document.getElementById('forgot-password-form')?.addEventListener('submit', function (e) {
    e.preventDefault();
    const email = document.getElementById('reset-email').value;
    alert(`A password reset link has been sent to ${email}. Link expires in 30 minutes.`);
    navigateTo('login');
});

const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        const email = document.getElementById('register-email').value;

        if (password !== confirmPassword) {
            document.getElementById('password-match-error').style.display = 'block';
            return;
        }

        // Check availability
        const userDatabase = JSON.parse(localStorage.getItem('userDatabase')) || [];
        if (userDatabase.find(u => u.email === email)) {
            alert("Email already registered.");
            return;
        }

        const newUser = {
            name: document.getElementById('register-name').value + ' ' + document.getElementById('register-surname').value,
            email: email,
            password: password, // Store password for demo login check
            role: 'user',
            status: 'active', // Default status
            walletBalance: 0,
            transactions: [],
            savedCards: [],
            points: 0,
            joinDate: new Date().toISOString().split('T')[0]
        };

        // Add to DB
        userDatabase.push(newUser);
        localStorage.setItem('userDatabase', JSON.stringify(userDatabase));

        // Auto Login
        localStorage.setItem('capeConnectUser', JSON.stringify(newUser));

        alert("Registration successful! Welcome to CapeConnect.");

        document.getElementById('auth-buttons').style.display = 'none';
        document.getElementById('user-menu').style.display = 'flex';
        document.getElementById('username').textContent = newUser.name;

        updateWelcomeMessage(true);
        navigateTo('dashboard');
    });
}

document.getElementById('destination-form')?.addEventListener('submit', function (e) {
    e.preventDefault();

    const passengers = parseInt(document.getElementById('passengers').value);

    // Strict Booking Rule 8: Max 2 passengers
    if (passengers > 2) {
        alert("Maximum number of passengers allowed is 2.");
        return;
    }

    // Store destination data
    const destinationData = {
        from: document.getElementById('from-location').value,
        to: document.getElementById('to-location').value,
        date: document.getElementById('departure-date').value,
        passengers: passengers
    };

    localStorage.setItem('destinationData', JSON.stringify(destinationData));

    // Calculate Fare Preview
    // For demo, we just auto-select a "Mock Route" or use the data if available.
    // Ideally we match `from` and `to` with `routeDatabase`.
    const matchedRoute = routeDatabase.find(r => r.origin === destinationData.from && r.destination === destinationData.to) || routeDatabase[0];

    const fare = matchedRoute ? matchedRoute.cost : 20.00; // Default fallback
    const totalFare = fare * passengers;

    // Check if user has Monthly Ticket (Golden Arrow)
    const service = localStorage.getItem('selectedService'); // 'myciti' or 'golden-arrow'
    const user = JSON.parse(localStorage.getItem('capeConnectUser'));
    let finalFare = totalFare;
    let isCoveredByPass = false;

    if (service === 'golden-arrow' && user && user.monthlyTicketActive) {
        finalFare = 0;
        isCoveredByPass = true;
    }

    localStorage.setItem('calculatedFare', finalFare);
    localStorage.setItem('isCoveredByPass', isCoveredByPass);
    localStorage.setItem('matchedRouteId', matchedRoute ? matchedRoute.id : 'CUSTOM');

    navigateTo('payment');

    // Update Payment Page UI to show Fare
    // Ideally add an element in HTML for this, or just alert?
    // Let's assume we update the 'subtitle' or inject a summary
    setTimeout(() => {
        const subtitle = document.querySelector('#payment .subtitle');
        if (subtitle) {
            subtitle.innerHTML = `Total to Pay: <b>R${finalFare.toFixed(2)}</b>` + (isCoveredByPass ? " (Covered by Monthly Ticket)" : "");
        }
    }, 100);
});

document.getElementById('payment-form')?.addEventListener('submit', function (e) {
    e.preventDefault();

    const user = JSON.parse(localStorage.getItem('capeConnectUser'));
    const fare = parseFloat(localStorage.getItem('calculatedFare'));
    const isCoveredByPass = localStorage.getItem('isCoveredByPass') === 'true';
    const saveCard = document.getElementById('save-card')?.checked;

    // Validate card details (basic check)
    // ... (Existing validation logic can stay or be simplified if auto-deduct)

    // Auto-Deduct Logic (Rule 5) implementation
    let paymentMethodUsed = 'Credit Card';

    // If NOT covered by pass, check wallet
    if (!isCoveredByPass) {
        // Check if user has enough balance in wallet
        if (user && user.walletBalance >= fare) {
            // Auto-deduct from wallet
            user.walletBalance -= fare;
            paymentMethodUsed = 'Wallet';
        } else {
            // Use Card
            paymentMethodUsed = 'Credit Card';
        }
    } else {
        paymentMethodUsed = 'Monthly Ticket';
    }

    if (saveCard && user) {
        if (!user.savedCards) user.savedCards = [];
        const cardNum = document.getElementById('cardNumber').value;
        user.savedCards.push({
            last4: cardNum.slice(-4),
            expiry: document.getElementById('expiry').value
        });
        localStorage.setItem('capeConnectUser', JSON.stringify(user));
    }

    // Deduct from Wallet simulation if we want to simulate "Auto Deduction" later
    // For now, let's just confirm booking.

    // Calculate Points (Rule 7)
    // Golden Arrow: 1 point per trip? MyCiTi: 1 point per R10?
    // Let's define: GA = 10 pts per trip. MyCiTi = 1 pt per R1 spent.
    const service = localStorage.getItem('selectedService');
    let pointsEarned = 0;
    if (service === 'golden-arrow') {
        pointsEarned = 10;
    } else {
        pointsEarned = Math.floor(fare);
    }

    if (user) {
        user.points = (user.points || 0) + pointsEarned;
        // Also deduct from wallet if we decide this flow replaces card charge
        // For this distinct "Payment Form", it's a card charge.

        // Add transaction
        if (fare > 0) {
            if (!user.transactions) user.transactions = [];
            user.transactions.unshift({
                date: new Date().toISOString().split('T')[0],
                description: `Ticket Purchase (${service}) - ${paymentMethodUsed}`,
                amount: `-R${fare.toFixed(2)}`,
                status: 'Completed'
            });
        }
        localStorage.setItem('capeConnectUser', JSON.stringify(user));
    }

    // Store booking data for confirmation page
    const ticketType = localStorage.getItem('selectedTicketType');
    const destinationData = JSON.parse(localStorage.getItem('destinationData'));

    const bookingData = {
        service: service,
        ticketType: ticketType || 'Single',
        from: destinationData.from,
        to: destinationData.to,
        date: destinationData.date,
        passengers: destinationData.passengers,
        amount: `R${fare.toFixed(2)}`
    };

    localStorage.setItem('lastBooking', JSON.stringify(bookingData));

    // Generate a new ticket
    generateTicket(bookingData);

    navigateTo('confirmation');

    // Update confirmation page with booking details
    setTimeout(() => {
        const booking = JSON.parse(localStorage.getItem('lastBooking'));
        if (booking) {
            document.getElementById('booking-service').textContent =
                booking.service === 'myciti' ? 'MyCiTi Bus' : 'Golden Arrow';
            document.getElementById('booking-from').textContent = booking.from;
            document.getElementById('booking-to').textContent = booking.to;
            document.getElementById('booking-date').textContent = `${booking.date} at 08:15 AM`;
            document.getElementById('booking-passengers').textContent = booking.passengers;
            document.getElementById('booking-amount').textContent = booking.amount;
            document.getElementById('booking-ref').textContent = 'CT' + Math.random().toString(36).substr(2, 9).toUpperCase();

            // Show points earned
            // Inject points message
            const msg = document.getElementById('confirmation-message');
            msg.innerHTML += `<br><br><strong style="color: var(--primary-blue);">You earned ${pointsEarned} loyalty points!</strong>`;
        }
    }, 100);
});

// Generate a new ticket
function generateTicket(bookingData) {
    // Get existing tickets from localStorage
    let tickets = JSON.parse(localStorage.getItem('capeConnectTickets')) || [];

    // Create a new ticket
    const newTicket = {
        id: 'CT' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        service: bookingData.service === 'myciti' ? 'MyCiTi Bus' : 'Golden Arrow',
        route: `${bookingData.from} to ${bookingData.to}`,
        from: bookingData.from,
        to: bookingData.to,
        date: bookingData.date,
        time: '08:15 AM',
        passengers: bookingData.passengers,
        status: 'Active',
        type: bookingData.ticketType,
        price: bookingData.amount,
        bookingDate: new Date().toISOString().split('T')[0]
    };

    // Add the new ticket
    tickets.push(newTicket);

    // Save back to localStorage
    localStorage.setItem('capeConnectTickets', JSON.stringify(tickets));

    return newTicket;
}

// Password validation for registration form
const passwordInput = document.getElementById('register-password');
if (passwordInput) {
    passwordInput.addEventListener('input', function () {
        const password = this.value;
        const lengthReq = document.getElementById('length-req');
        const numberReq = document.getElementById('number-req');
        const specialReq = document.getElementById('special-req');

        // Check length
        if (password.length >= 8) {
            lengthReq.classList.remove('requirement-not-met');
            lengthReq.classList.add('requirement-met');
        } else {
            lengthReq.classList.remove('requirement-met');
            lengthReq.classList.add('requirement-not-met');
        }

        // Check for number
        if (/\d/.test(password)) {
            numberReq.classList.remove('requirement-not-met');
            numberReq.classList.add('requirement-met');
        } else {
            numberReq.classList.remove('requirement-met');
            numberReq.classList.add('requirement-not-met');
        }

        // Check for special character
        if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            specialReq.classList.remove('requirement-not-met');
            specialReq.classList.add('requirement-met');
        } else {
            specialReq.classList.remove('requirement-met');
            specialReq.classList.add('requirement-not-met');
        }
    });
}

// Format card number input
document.getElementById('cardNumber')?.addEventListener('input', function (e) {
    let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    let matches = value.match(/\d{4,16}/g);
    let match = matches && matches[0] || '';
    let parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
        parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
        e.target.value = parts.join(' ');
    } else {
        e.target.value = value;
    }
});

// Format expiry date input
document.getElementById('expiry')?.addEventListener('input', function (e) {
    let value = e.target.value.replace(/\D/g, '');

    if (value.length > 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }

    e.target.value = value;
});

// Comprehensive list of Cape Town suburbs and settlements
const capeTownSuburbs = [
    // City Bowl
    "Cape Town City Centre", "Bo-Kaap", "De Waterkant", "Devil's Peak", "District Six", "Foreshore",
    "Gardens", "Higgovale", "Oranjezicht", "Schotsche Kloof", "Tamboerskloof", "University Estate", "Vredehoek", "Walmer Estate", "Woodstock", "Zonnebloem",

    // Atlantic Seaboard
    "Bakoven", "Bantry Bay", "Camps Bay", "Clifton", "Fresnaye", "Green Point", "Llandudno", "Mouille Point", "Sea Point", "Three Anchor Bay",

    // Southern Suburbs
    "Bishopscourt", "Claremont", "Constantia", "Diep River", "Heathfield", "Kenilworth", "Mowbray", "Newlands", "Observatory", "Plumstead", "Retreat", "Rondebosch", "Rosebank", "Salt River", "Steenberg", "Tokai", "Wetton", "Wynberg",

    // Northern Suburbs
    "Bellville", "Bothasig", "Brackenfell", "Brooklyn", "Century City", "Durbanville", "Edgemead", "Elsies River", "Goodwood", "Kensington", "Kraaifontein", "Kuils River", "Maitland", "Monte Vista", "Panorama", "Parow", "Richwood", "Thornton", "Tygerberg", "Tyger Valley",

    // South Peninsula
    "Fish Hoek", "Glencairn", "Hout Bay", "Imizamo Yethu", "Kalk Bay", "Kommetjie", "Masiphumelele", "Muizenberg", "Noordhoek", "Ocean View", "Scarborough", "Simon's Town", "St James", "Sun Valley",

    // West Coast
    "Atlantis", "Bloubergstrand", "Melkbosstrand", "Milnerton", "Table View", "West Beach",

    // Cape Flats
    "Athlone", "Bishop Lavis", "Blue Downs", "Bonnie Brook", "Bontheuwel", "Crawford", "Crossroads", "Delft", "Eerste River", "Elsies River", "Gugulethu", "Hanover Park", "Heideveld", "Kewtown", "Khayelitsha", "Langa", "Lavender Hill", "Lotus River", "Macassar", "Manenberg", "Mitchells Plain", "Nyanga", "Ottery", "Philippi", "Strandfontein", "Valhalla Park",

    // Helderberg
    "Gordon's Bay", "Somerset West", "Strand"
];

// Initialize searchable dropdowns
function initializeSearchableDropdowns() {
    const fromInput = document.getElementById('from-location');
    const toInput = document.getElementById('to-location');
    const fromOptions = document.getElementById('from-options');
    const toOptions = document.getElementById('to-options');

    // Populate dropdowns with all suburbs initially
    populateDropdownOptions(fromOptions, capeTownSuburbs);
    populateDropdownOptions(toOptions, capeTownSuburbs);

    // Add event listeners for search functionality
    fromInput.addEventListener('input', function () {
        filterDropdownOptions(this.value, fromOptions);
    });

    toInput.addEventListener('input', function () {
        filterDropdownOptions(this.value, toOptions);
    });

    // Show dropdown when input is focused
    fromInput.addEventListener('focus', function () {
        fromOptions.classList.add('active');
    });

    toInput.addEventListener('focus', function () {
        toOptions.classList.add('active');
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', function (e) {
        if (!fromInput.contains(e.target) && !fromOptions.contains(e.target)) {
            fromOptions.classList.remove('active');
        }
        if (!toInput.contains(e.target) && !toOptions.contains(e.target)) {
            toOptions.classList.remove('active');
        }
    });
}

// Populate dropdown with options
function populateDropdownOptions(dropdown, options) {
    dropdown.innerHTML = '';

    options.forEach(option => {
        const optionElement = document.createElement('div');
        optionElement.className = 'dropdown-option';
        optionElement.textContent = option;
        optionElement.addEventListener('click', function () {
            // Find the input associated with this dropdown
            const inputId = dropdown.id === 'from-options' ? 'from-location' : 'to-location';
            document.getElementById(inputId).value = option;
            dropdown.classList.remove('active');
        });
        dropdown.appendChild(optionElement);
    });
}

// Filter dropdown options based on search input
function filterDropdownOptions(searchTerm, dropdown) {
    const filteredOptions = capeTownSuburbs.filter(suburb =>
        suburb.toLowerCase().includes(searchTerm.toLowerCase())
    );

    populateDropdownOptions(dropdown, filteredOptions);
    dropdown.classList.add('active');
}

// Toggle FAQ Accordion
function toggleFaq(element) {
    const answer = element.nextElementSibling;
    const icon = element.querySelector('i');

    // Close other open FAQs
    /* 
    // Optional: Uncomment to have accordion-style behavior (only one open at a time)
    document.querySelectorAll('.faq-answer').forEach(item => {
        if (item !== answer && item.style.display === 'block') {
            item.style.display = 'none';
            item.previousElementSibling.querySelector('i').style.transform = 'rotate(0deg)';
        }
    });
    */

    if (answer.style.display === 'block') {
        answer.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    } else {
        answer.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
    }
}

// Handle Contact Form Submit (Demo)
function handleContactSubmit(event) {
    event.preventDefault();
    const btn = event.target.querySelector('button');
    const originalText = btn.innerText;

    btn.innerText = 'Sending...';
    btn.disabled = true;
    btn.style.opacity = '0.7';

    // Simulate API call
    setTimeout(() => {
        btn.innerText = 'Message Sent!';
        btn.style.backgroundColor = 'var(--success-color)';

        setTimeout(() => {
            btn.innerText = originalText;
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.backgroundColor = 'var(--primary-blue)';
            event.target.reset();
            alert("Thank you for contacting us! We'll get back to you shortly."); // Will replace with toast later
        }, 2000);
    }, 1000);
}

// Populate Profile Data
function populateProfileData() {
    const user = JSON.parse(localStorage.getItem('capeConnectUser'));
    if (user) {
        document.getElementById('profile-name').value = user.name || '';
        document.getElementById('profile-email').value = user.email || '';
        document.getElementById('profile-phone').value = user.phone || '';

        document.getElementById('profile-name-display').textContent = user.name || 'User';
        document.getElementById('profile-email-display').textContent = user.email || '';
    }
}

// Handle Profile Update
function handleProfileUpdate(event) {
    event.preventDefault();
    const name = document.getElementById('profile-name').value;
    const email = document.getElementById('profile-email').value;
    const phone = document.getElementById('profile-phone').value;

    const userData = JSON.parse(localStorage.getItem('capeConnectUser')) || {};
    userData.name = name;
    userData.email = email;
    userData.phone = phone;

    localStorage.setItem('capeConnectUser', JSON.stringify(userData));

    // Update UI elements
    document.getElementById('username').textContent = name;
    document.getElementById('profile-name-display').textContent = name;
    document.getElementById('profile-email-display').textContent = email;

    alert('Profile updated successfully!');
}

// Map Variable - REMOVED
// let map;
// let markers = [];

// Route Database (Shared via LocalStorage)
let routeDatabase = [];

// Initialize Routes
function initRoutes() {
    // Check LocalStorage first
    const storedRoutes = localStorage.getItem('routeDatabase');

    if (storedRoutes) {
        routeDatabase = JSON.parse(storedRoutes);
    } else {
        // First run: Initialize with Mock Data
        routeDatabase = [
            { id: 'R001', name: 'T01', origin: 'Cape Town Station', destination: 'Dunoon', type: 'formal', cost: 18.50, time: '07:00' },
            { id: 'R002', name: 'T01', origin: 'Dunoon', destination: 'Cape Town Station', type: 'formal', cost: 18.50, time: '08:15' },
            { id: 'R003', name: 'Khayelitsha Exp', origin: 'Khayelitsha', destination: 'Cape Town Station', type: 'informal', cost: 25.00, time: '06:30' },
            { id: 'R004', name: 'Khayelitsha Exp', origin: 'Cape Town Station', destination: 'Khayelitsha', type: 'informal', cost: 25.00, time: '17:30' },
            { id: 'R005', name: '101', origin: 'Bellville', destination: 'Cape Town Station', type: 'formal', cost: 15.20, time: '07:45' },
            { id: 'R006', name: 'Southern Suburbs', origin: 'Wynberg', destination: 'Cape Town Station', type: 'informal', cost: 18.00, time: '08:00' },
            { id: 'R007', name: 'Hout Bay Route', origin: 'Hout Bay', destination: 'Cape Town Station', type: 'formal', cost: 22.00, time: '08:10' },
            { id: 'R008', name: 'Mitchells Plain', origin: 'Mitchells Plain', destination: 'Claremont', type: 'informal', cost: 20.00, time: '07:30' },
            { id: 'R009', name: 'Century City', origin: 'Cape Town Station', destination: 'Century City', type: 'formal', cost: 12.50, time: '09:00' },
            { id: 'R010', name: 'Sea Point Shuttle', origin: 'Sea Point', destination: 'Civic Centre', type: 'formal', cost: 10.00, time: '08:45' },
            { id: 'R011', name: 'Stellenbosch Link', origin: 'Somerset West', destination: 'Stellenbosch', type: 'informal', cost: 18.00, time: '07:15' },
            { id: 'R012', name: 'Airport Shuttle', origin: 'Airport', destination: 'Civic Centre', type: 'formal', cost: 60.00, time: '10:00' },
            { id: 'R013', name: 'West Coast Local', origin: 'Table View', destination: 'Melkbosstrand', type: 'formal', cost: 14.50, time: '09:30' },
            { id: 'R014', name: 'Cape Flats Exp', origin: 'Mitchells Plain', destination: 'Century City', type: 'informal', cost: 22.00, time: '06:45' },
            { id: 'R015', name: 'Mowbray Link', origin: 'Mowbray', destination: 'UCT Lower Campus', type: 'formal', cost: 9.50, time: '08:20' },
            { id: 'R016', name: 'Hout Bay Exp', origin: 'Hout Bay', destination: 'Camps Bay', type: 'informal', cost: 18.00, time: '10:15' },
            { id: 'R017', name: 'Langa Local', origin: 'Langa', destination: 'Athlone', type: 'informal', cost: 12.00, time: '11:00' },
            { id: 'R018', name: 'Blue Downs Route', origin: 'Blue Downs', destination: 'Bellville', type: 'informal', cost: 16.50, time: '07:10' },
            { id: 'R019', name: 'Simons Town Scenic', origin: 'Simon\'s Town', destination: 'Fish Hoek', type: 'formal', cost: 13.00, time: '12:00' },
            { id: 'R020', name: 'CBD Loop', origin: 'Cape Town Station', destination: 'Gardens', type: 'formal', cost: 9.00, time: '09:15' }
        ];
        localStorage.setItem('routeDatabase', JSON.stringify(routeDatabase));
    }

    renderRouteList(routeDatabase);

    // Add event listeners for search
    document.getElementById('route-search')?.addEventListener('input', function (e) {
        const term = e.target.value.toLowerCase();
        const filtered = routeDatabase.filter(r =>
            r.name.toLowerCase().includes(term) ||
            r.origin.toLowerCase().includes(term) ||
            r.destination.toLowerCase().includes(term)
        );
        renderRouteList(filtered);
    });
}

// Render Route Directory (User View)
function renderRouteList(routes) {
    const container = document.getElementById('route-list-container');
    if (!container) return;

    container.innerHTML = '';

    if (routes.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-light);">No routes found matching your search.</div>';
        return;
    }

    routes.forEach(route => {
        const card = document.createElement('div');
        card.className = 'route-card';
        card.style.cssText = 'background: white; padding: 15px; margin-bottom: 10px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border-left: 4px solid ' + (route.type === 'formal' ? '#10b981' : '#fbbf24') + '; display: flex; justify-content: space-between; align-items: center;';

        card.innerHTML = `
            <div>
                <h4 style="margin: 0 0 5px 0; color: var(--text-dark);">${route.name}</h4>
                <div style="font-size: 0.9rem; color: var(--text-light);">
                    <i class="fas fa-map-marker-alt" style="width: 15px;"></i> ${route.origin} &nbsp; <i class="fas fa-arrow-right"></i> &nbsp; ${route.destination}
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: bold; color: var(--primary-blue);">R${parseFloat(route.cost).toFixed(2)}</div>
                <div style="font-size: 0.8rem; color: var(--text-light);">${route.time}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Render Admin Route Table
function renderAdminRouteList(routes) {
    const tbody = document.getElementById('admin-route-list');
    if (!tbody) return;

    tbody.innerHTML = '';

    routes.forEach(route => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${route.name}</td>
            <td>${route.origin}</td>
            <td>${route.destination}</td>
            <td><span class="${route.type === 'formal' ? 'status-on-time' : 'status-delayed'}">${route.type}</span></td>
            <td>R${parseFloat(route.cost).toFixed(2)}</td>
            <td>
                <button class="btn btn-outline btn-small" style="color: var(--primary-blue); border-color: var(--primary-blue); margin-right: 5px;" onclick="openEditRouteModal('${route.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-outline btn-small" style="color: var(--error-color); border-color: var(--error-color);" onclick="deleteRoute('${route.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Admin logic
function showAdminTab(tabName) {
    if (tabName === 'routes') {
        document.getElementById('admin-routes-tab').style.display = 'block';
        document.getElementById('admin-users-tab').style.display = 'none';
    } else {
        document.getElementById('admin-routes-tab').style.display = 'none';
        document.getElementById('admin-users-tab').style.display = 'block';
    }
}

function openAddRouteModal() {
    document.getElementById('add-route-modal').style.display = 'flex';
}

function closeAddRouteModal() {
    document.getElementById('add-route-modal').style.display = 'none';
}

document.getElementById('add-route-form')?.addEventListener('submit', function (e) {
    e.preventDefault();

    const newRoute = {
        id: 'R' + (routeDatabase.length + 1).toString().padStart(3, '0'),
        name: document.getElementById('new-route-name').value,
        origin: document.getElementById('new-route-origin').value,
        destination: document.getElementById('new-route-dest').value,
        type: document.getElementById('new-route-type').value,
        cost: parseFloat(document.getElementById('new-route-cost').value),
        time: document.getElementById('new-route-time').value
    };

    routeDatabase.push(newRoute);

    // Refresh lists
    renderRouteList(routeDatabase);
    renderAdminRouteList(routeDatabase);
    refreshTimetable(); // Update dashboard

    closeAddRouteModal();
    e.target.reset();
    alert('Route added successfully!');
});

function openEditRouteModal(id) {
    const route = routeDatabase.find(r => r.id === id);
    if (!route) return;

    document.getElementById('edit-route-id').value = route.id;
    document.getElementById('edit-route-name').value = route.name;
    document.getElementById('edit-route-origin').value = route.origin;
    document.getElementById('edit-route-dest').value = route.destination;
    document.getElementById('edit-route-type').value = route.type;
    document.getElementById('edit-route-cost').value = route.cost;
    document.getElementById('edit-route-time').value = route.time;

    document.getElementById('edit-route-modal').style.display = 'flex';
}

function closeEditRouteModal() {
    document.getElementById('edit-route-modal').style.display = 'none';
}

document.getElementById('edit-route-form')?.addEventListener('submit', function (e) {
    e.preventDefault();

    const id = document.getElementById('edit-route-id').value;
    const routeIndex = routeDatabase.findIndex(r => r.id === id);

    if (routeIndex !== -1) {
        routeDatabase[routeIndex] = {
            id: id,
            name: document.getElementById('edit-route-name').value,
            origin: document.getElementById('edit-route-origin').value,
            destination: document.getElementById('edit-route-dest').value,
            type: document.getElementById('edit-route-type').value,
            cost: parseFloat(document.getElementById('edit-route-cost').value),
            time: document.getElementById('edit-route-time').value
        };

        // Refresh lists
        renderRouteList(routeDatabase);
        renderAdminRouteList(routeDatabase);
        refreshTimetable(); // Update dashboard

        closeEditRouteModal();
        alert('Route updated successfully!');
    }
});

function deleteRoute(id) {
    if (confirm('Are you sure you want to delete this route?')) {
        routeDatabase = routeDatabase.filter(r => r.id !== id);
        renderRouteList(routeDatabase);
        renderAdminRouteList(routeDatabase);
        refreshTimetable();
    }
}

// Ensure Admin Dashboard is accessible if admin
function checkAdminAccess() {
    const user = JSON.parse(localStorage.getItem('capeConnectUser'));
    if (user && user.role === 'admin') {
        // Show Admin Link in Nav or just show the section if we are on it?
        // Ideally we add a menu item. For now, let's just make sure the section is visible if we navigate to it.
        // We can add a "Admin Panel" button in the User Menu

        // Check if button already exists
        if (!document.getElementById('admin-panel-btn')) {
            const userMenu = document.getElementById('user-menu');
            const adminBtn = document.createElement('button');
            adminBtn.id = 'admin-panel-btn';
            adminBtn.className = 'btn btn-outline';
            adminBtn.innerText = 'Admin';
            adminBtn.onclick = function () { navigateTo('admin-dashboard'); };
            adminBtn.style.marginRight = '10px';
            userMenu.insertBefore(adminBtn, userMenu.firstChild);
        }
    }
}

// Initial Map -> Replaced by initRoutes
// function initMap() ... REMOVED

// Modified View Services/Timetable to init map -> Just show section
function showTimetable() {
    navigateTo('dashboard');
    setTimeout(() => {
        const timetableSection = document.getElementById('timetable');
        timetableSection.classList.remove('hidden-section');
        timetableSection.scrollIntoView({ behavior: 'smooth' });
    }, 100);
}
