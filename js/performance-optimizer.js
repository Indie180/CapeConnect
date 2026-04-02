// CapeConnect Performance Optimizer
// Phase 4: Performance enhancements for mobile app

(function() {
    'use strict';
    
    // Performance configuration
    const PERF_CONFIG = {
        lazyLoadOffset: 100,
        debounceDelay: 250,
        cacheExpiry: 5 * 60 * 1000, // 5 minutes
        maxCacheSize: 50,
        enablePreloading: true,
        enableImageOptimization: true
    };
    
    // Performance metrics
    let performanceMetrics = {
        pageLoadTime: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0,
        cumulativeLayoutShift: 0,
        firstInputDelay: 0
    };
    
    // Cache management
    const memoryCache = new Map();
    
    // Initialize performance optimizations
    function initializePerformanceOptimizer() {
        measurePerformanceMetrics();
        setupLazyLoading();
        setupImageOptimization();
        setupResourcePreloading();
        setupCacheManagement();
        setupNetworkOptimization();
        setupMemoryOptimization();
        
        console.log('Performance Optimizer: Initialized');
    }
    
    // Measure performance metrics
    function measurePerformanceMetrics() {
        // Page load time
        window.addEventListener('load', () => {
            const navigation = performance.getEntriesByType('navigation')[0];
            performanceMetrics.pageLoadTime = navigation.loadEventEnd - navigation.loadEventStart;
            
            // Report metrics
            reportPerformanceMetrics();
        });
        
        // Web Vitals
        if ('PerformanceObserver' in window) {
            // First Contentful Paint
            new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.name === 'first-contentful-paint') {
                        performanceMetrics.firstContentfulPaint = entry.startTime;
                    }
                }
            }).observe({ entryTypes: ['paint'] });
            
            // Largest Contentful Paint
            new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                performanceMetrics.largestContentfulPaint = lastEntry.startTime;
            }).observe({ entryTypes: ['largest-contentful-paint'] });
            
            // Cumulative Layout Shift
            new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) {
                        performanceMetrics.cumulativeLayoutShift += entry.value;
                    }
                }
            }).observe({ entryTypes: ['layout-shift'] });
            
            // First Input Delay
            new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    performanceMetrics.firstInputDelay = entry.processingStart - entry.startTime;
                }
            }).observe({ entryTypes: ['first-input'] });
        }
    }
    
    // Report performance metrics
    function reportPerformanceMetrics() {
        console.log('Performance Metrics:', performanceMetrics);
        
        // Send to analytics (in a real app)
        if (window.gtag) {
            gtag('event', 'page_performance', {
                page_load_time: Math.round(performanceMetrics.pageLoadTime),
                first_contentful_paint: Math.round(performanceMetrics.firstContentfulPaint),
                largest_contentful_paint: Math.round(performanceMetrics.largestContentfulPaint)
            });
        }
    }
    
    // Setup lazy loading for images and content
    function setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const lazyImageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.classList.remove('lazy');
                            img.classList.add('loaded');
                            lazyImageObserver.unobserve(img);
                        }
                    }
                });
            }, {
                rootMargin: `${PERF_CONFIG.lazyLoadOffset}px`
            });
            
            // Observe all lazy images
            document.querySelectorAll('img[data-src]').forEach(img => {
                lazyImageObserver.observe(img);
            });
            
            // Setup lazy loading for dynamically added images
            window.observeLazyImage = function(img) {
                lazyImageObserver.observe(img);
            };
        }
    }
    
    // Setup image optimization
    function setupImageOptimization() {
        if (!PERF_CONFIG.enableImageOptimization) return;
        
        // Convert images to WebP if supported
        const supportsWebP = checkWebPSupport();
        
        if (supportsWebP) {
            document.querySelectorAll('img').forEach(img => {
                if (img.src && !img.src.includes('.webp')) {
                    const webpSrc = img.src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
                    
                    // Check if WebP version exists
                    checkImageExists(webpSrc).then(exists => {
                        if (exists) {
                            img.src = webpSrc;
                        }
                    });
                }
            });
        }
    }
    
    // Check WebP support
    function checkWebPSupport() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }
    
    // Check if image exists
    function checkImageExists(src) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = src;
        });
    }
    
    // Setup resource preloading
    function setupResourcePreloading() {
        if (!PERF_CONFIG.enablePreloading) return;
        
        // Preload critical resources
        const criticalResources = [
            { href: '/css/mobile-responsive.css', as: 'style' },
            { href: '/js/cc-utils.js', as: 'script' },
            { href: '/manifest.json', as: 'manifest' }
        ];
        
        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource.href;
            link.as = resource.as;
            document.head.appendChild(link);
        });
        
        // Prefetch likely next pages
        const prefetchPages = [
            '/choose-fare.html',
            '/dashboard.html',
            '/profile.html'
        ];
        
        // Prefetch on idle
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                prefetchPages.forEach(page => {
                    const link = document.createElement('link');
                    link.rel = 'prefetch';
                    link.href = page;
                    document.head.appendChild(link);
                });
            });
        }
    }
    
    // Setup cache management
    function setupCacheManagement() {
        // Clean expired cache entries
        setInterval(cleanExpiredCache, 60000); // Every minute
        
        // Limit cache size
        if (memoryCache.size > PERF_CONFIG.maxCacheSize) {
            const oldestKey = memoryCache.keys().next().value;
            memoryCache.delete(oldestKey);
        }
    }
    
    // Clean expired cache entries
    function cleanExpiredCache() {
        const now = Date.now();
        
        for (const [key, value] of memoryCache.entries()) {
            if (now - value.timestamp > PERF_CONFIG.cacheExpiry) {
                memoryCache.delete(key);
            }
        }
    }
    
    // Cache API responses
    function cacheResponse(key, data) {
        memoryCache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }
    
    // Get cached response
    function getCachedResponse(key) {
        const cached = memoryCache.get(key);
        
        if (cached && Date.now() - cached.timestamp < PERF_CONFIG.cacheExpiry) {
            return cached.data;
        }
        
        return null;
    }
    
    // Setup network optimization
    function setupNetworkOptimization() {
        // Monitor network conditions
        if ('connection' in navigator) {
            const connection = navigator.connection;
            
            // Adjust behavior based on connection
            if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                // Reduce image quality, disable animations
                document.body.classList.add('slow-connection');
                PERF_CONFIG.enableImageOptimization = false;
            }
            
            // Listen for connection changes
            connection.addEventListener('change', () => {
                console.log('Connection changed:', connection.effectiveType);
                adjustForConnection(connection);
            });
        }
    }
    
    // Adjust for connection type
    function adjustForConnection(connection) {
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
            // Slow connection optimizations
            document.body.classList.add('slow-connection');
            
            // Disable non-essential animations
            document.querySelectorAll('.loading, .fa-spin').forEach(el => {
                el.style.animation = 'none';
            });
            
        } else {
            // Fast connection - enable all features
            document.body.classList.remove('slow-connection');
        }
    }
    
    // Setup memory optimization
    function setupMemoryOptimization() {
        // Clean up event listeners on page unload
        window.addEventListener('beforeunload', () => {
            // Clear caches
            memoryCache.clear();
            
            // Remove event listeners
            document.querySelectorAll('*').forEach(el => {
                el.removeEventListener?.();
            });
        });
        
        // Monitor memory usage
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                
                if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.9) {
                    console.warn('High memory usage detected');
                    // Trigger garbage collection if possible
                    if (window.gc) {
                        window.gc();
                    }
                }
            }, 30000); // Every 30 seconds
        }
    }
    
    // Debounce function for performance
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Throttle function for performance
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // Optimize scroll performance
    function optimizeScrollPerformance() {
        const scrollHandler = throttle(() => {
            // Handle scroll events efficiently
            requestAnimationFrame(() => {
                // Update scroll-dependent UI
                updateScrollDependentElements();
            });
        }, 16); // ~60fps
        
        window.addEventListener('scroll', scrollHandler, { passive: true });
    }
    
    // Update scroll-dependent elements
    function updateScrollDependentElements() {
        // Update navigation state, parallax effects, etc.
        const scrollY = window.scrollY;
        
        // Example: Update navigation background
        const nav = document.querySelector('.mobile-nav, .desktop-nav');
        if (nav) {
            if (scrollY > 50) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
        }
    }
    
    // Public API
    window.PerformanceOptimizer = {
        init: initializePerformanceOptimizer,
        cache: {
            set: cacheResponse,
            get: getCachedResponse,
            clear: () => memoryCache.clear()
        },
        utils: {
            debounce: debounce,
            throttle: throttle
        },
        metrics: performanceMetrics,
        observeLazyImage: window.observeLazyImage
    };
    
    // Auto-initialize if DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePerformanceOptimizer);
    } else {
        initializePerformanceOptimizer();
    }
    
})();
