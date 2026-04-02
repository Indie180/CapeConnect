// CapeConnect Push Notifications
// Phase 4: Push notification system for mobile PWA

(function() {
    'use strict';
    
    // Notification configuration
    const NOTIFICATION_CONFIG = {
        vapidPublicKey: 'BEl62iUYgUivxIkv69yViEuiBIa40HI6YrrfuWt7jmt7YfhHSBm5prNfwQoMacSBBHNEdHSaQVNlVkqaVGa4Xck',
        serverEndpoint: '/api/notifications/subscribe',
        enabledByDefault: false,
        retryAttempts: 3,
        retryDelay: 5000
    };
    
    // Notification types
    const NOTIFICATION_TYPES = {
        TICKET_REMINDER: 'ticket_reminder',
        ROUTE_UPDATE: 'route_update',
        WALLET_LOW: 'wallet_low',
        PAYMENT_SUCCESS: 'payment_success',
        SYSTEM_ALERT: 'system_alert'
    };
    
    let isSupported = false;
    let isSubscribed = false;
    let subscription = null;
    let retryCount = 0;
    
    // Initialize push notifications
    function initializePushNotifications() {
        checkSupport();
        
        if (isSupported) {
            checkExistingSubscription();
            setupNotificationHandlers();
            console.log('Push Notifications: Initialized');
        } else {
            console.warn('Push Notifications: Not supported');
        }
    }
    
    // Check if push notifications are supported
    function checkSupport() {
        isSupported = 'serviceWorker' in navigator && 
                     'PushManager' in window && 
                     'Notification' in window;
    }
    
    // Check for existing subscription
    async function checkExistingSubscription() {
        try {
            const registration = await navigator.serviceWorker.ready;
            subscription = await registration.pushManager.getSubscription();
            isSubscribed = subscription !== null;
            
            if (isSubscribed) {
                console.log('Push Notifications: Already subscribed');
                updateSubscriptionStatus(true);
            }
        } catch (error) {
            console.error('Error checking subscription:', error);
        }
    }
    
    // Request notification permission
    async function requestPermission() {
        if (!isSupported) {
            throw new Error('Push notifications not supported');
        }
        
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            console.log('Notification permission granted');
            return true;
        } else if (permission === 'denied') {
            console.log('Notification permission denied');
            showPermissionDeniedMessage();
            return false;
        } else {
            console.log('Notification permission dismissed');
            return false;
        }
    }
    
    // Subscribe to push notifications
    async function subscribeToPush() {
        try {
            const hasPermission = await requestPermission();
            if (!hasPermission) {
                return false;
            }
            
            const registration = await navigator.serviceWorker.ready;
            
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(NOTIFICATION_CONFIG.vapidPublicKey)
            });
            
            // Send subscription to server
            const success = await sendSubscriptionToServer(subscription);
            
            if (success) {
                isSubscribed = true;
                updateSubscriptionStatus(true);
                showSubscriptionSuccessMessage();
                console.log('Push subscription successful');
                return true;
            } else {
                throw new Error('Failed to register subscription on server');
            }
            
        } catch (error) {
            console.error('Error subscribing to push:', error);
            showSubscriptionErrorMessage(error.message);
            
            // Retry logic
            if (retryCount < NOTIFICATION_CONFIG.retryAttempts) {
                retryCount++;
                setTimeout(() => {
                    subscribeToPush();
                }, NOTIFICATION_CONFIG.retryDelay);
            }
            
            return false;
        }
    }
    
    // Unsubscribe from push notifications
    async function unsubscribeFromPush() {
        try {
            if (subscription) {
                await subscription.unsubscribe();
                await removeSubscriptionFromServer(subscription);
                
                subscription = null;
                isSubscribed = false;
                updateSubscriptionStatus(false);
                showUnsubscriptionSuccessMessage();
                console.log('Push unsubscription successful');
                return true;
            }
        } catch (error) {
            console.error('Error unsubscribing from push:', error);
            return false;
        }
    }
    
    // Send subscription to server
    async function sendSubscriptionToServer(subscription) {
        try {
            const response = await fetch(NOTIFICATION_CONFIG.serverEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subscription: subscription,
                    userAgent: navigator.userAgent,
                    timestamp: Date.now()
                })
            });
            
            return response.ok;
        } catch (error) {
            console.error('Error sending subscription to server:', error);
            return false;
        }
    }
    
    // Remove subscription from server
    async function removeSubscriptionFromServer(subscription) {
        try {
            const response = await fetch(NOTIFICATION_CONFIG.serverEndpoint, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subscription: subscription
                })
            });
            
            return response.ok;
        } catch (error) {
            console.error('Error removing subscription from server:', error);
            return false;
        }
    }
    
    // Setup notification event handlers
    function setupNotificationHandlers() {
        // Handle notification clicks
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', event => {
                if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
                    handleNotificationClick(event.data.notification);
                }
            });
        }
    }
    
    // Handle notification click
    function handleNotificationClick(notificationData) {
        console.log('Notification clicked:', notificationData);
        
        // Navigate based on notification type
        switch (notificationData.type) {
            case NOTIFICATION_TYPES.TICKET_REMINDER:
                window.location.href = '/dashboard.html';
                break;
            case NOTIFICATION_TYPES.ROUTE_UPDATE:
                window.location.href = '/dashboard.html';
                break;
            case NOTIFICATION_TYPES.WALLET_LOW:
                window.location.href = '/profile.html';
                break;
            case NOTIFICATION_TYPES.PAYMENT_SUCCESS:
                window.location.href = '/dashboard.html';
                break;
            default:
                window.location.href = '/dashboard.html';
        }
    }
    
    // Show local notification
    function showLocalNotification(title, options = {}) {
        if (!isSupported || Notification.permission !== 'granted') {
            console.warn('Cannot show notification: permission not granted');
            return;
        }
        
        const defaultOptions = {
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-72x72.png',
            vibrate: [200, 100, 200],
            requireInteraction: false,
            silent: false
        };
        
        const notificationOptions = { ...defaultOptions, ...options };
        
        const notification = new Notification(title, notificationOptions);
        
        notification.onclick = () => {
            notification.close();
            if (options.onClick) {
                options.onClick();
            }
        };
        
        // Auto-close after 5 seconds
        setTimeout(() => {
            notification.close();
        }, 5000);
        
        return notification;
    }
    
    // Schedule local notifications
    function scheduleNotification(title, options, delay) {
        setTimeout(() => {
            showLocalNotification(title, options);
        }, delay);
    }
    
    // Update subscription status in UI
    function updateSubscriptionStatus(subscribed) {
        const statusElements = document.querySelectorAll('[data-notification-status]');
        
        statusElements.forEach(element => {
            if (subscribed) {
                element.textContent = 'Notifications Enabled';
                element.classList.add('enabled');
                element.classList.remove('disabled');
            } else {
                element.textContent = 'Notifications Disabled';
                element.classList.add('disabled');
                element.classList.remove('enabled');
            }
        });
        
        // Update toggle buttons
        const toggleButtons = document.querySelectorAll('[data-notification-toggle]');
        toggleButtons.forEach(button => {
            button.textContent = subscribed ? 'Disable Notifications' : 'Enable Notifications';
            button.onclick = subscribed ? unsubscribeFromPush : subscribeToPush;
        });
    }
    
    // Show permission denied message
    function showPermissionDeniedMessage() {
        showToast('Notifications blocked. Enable in browser settings to receive updates.', 'warning');
    }
    
    // Show subscription success message
    function showSubscriptionSuccessMessage() {
        showToast('Notifications enabled! You\'ll receive important updates.', 'success');
    }
    
    // Show subscription error message
    function showSubscriptionErrorMessage(error) {
        showToast(`Failed to enable notifications: ${error}`, 'error');
    }
    
    // Show unsubscription success message
    function showUnsubscriptionSuccessMessage() {
        showToast('Notifications disabled successfully.', 'info');
    }
    
    // Show toast message
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast-message toast-${type}`;
        toast.textContent = message;
        
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            z-index: 1001;
            box-shadow: 0 4px 16px rgba(0,0,0,0.1);
            max-width: 90%;
            text-align: center;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 4000);
    }
    
    // Convert VAPID key
    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        
        return outputArray;
    }
    
    // Notification templates
    const notificationTemplates = {
        ticketReminder: (ticketInfo) => ({
            title: 'Ticket Reminder',
            body: `Your ${ticketInfo.type} expires soon!`,
            icon: '/icons/ticket-icon.png',
            data: { type: NOTIFICATION_TYPES.TICKET_REMINDER, ticketId: ticketInfo.id }
        }),
        
        routeUpdate: (routeInfo) => ({
            title: 'Route Update',
            body: `${routeInfo.route} - ${routeInfo.message}`,
            icon: '/icons/route-icon.png',
            data: { type: NOTIFICATION_TYPES.ROUTE_UPDATE, routeId: routeInfo.id }
        }),
        
        walletLow: (balance) => ({
            title: 'Low Wallet Balance',
            body: `Your balance is ${balance}. Top up to continue using services.`,
            icon: '/icons/wallet-icon.png',
            data: { type: NOTIFICATION_TYPES.WALLET_LOW }
        }),
        
        paymentSuccess: (amount) => ({
            title: 'Payment Successful',
            body: `${amount} has been added to your wallet.`,
            icon: '/icons/success-icon.png',
            data: { type: NOTIFICATION_TYPES.PAYMENT_SUCCESS }
        })
    };
    
    // Public API
    window.PushNotifications = {
        init: initializePushNotifications,
        subscribe: subscribeToPush,
        unsubscribe: unsubscribeFromPush,
        showLocal: showLocalNotification,
        schedule: scheduleNotification,
        isSupported: () => isSupported,
        isSubscribed: () => isSubscribed,
        templates: notificationTemplates,
        types: NOTIFICATION_TYPES
    };
    
    // Auto-initialize if DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePushNotifications);
    } else {
        initializePushNotifications();
    }
    
})();
