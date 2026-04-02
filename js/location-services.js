// CapeConnect Location Services
// Phase 3: Advanced GPS and location features

class LocationServices {
    constructor() {
        this.isSupported = 'geolocation' in navigator;
        this.currentPosition = null;
        this.watchId = null;
        this.locationHistory = [];
        this.nearbyStops = [];
        this.options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
        };
    }

    // Initialize location services
    async init() {
        if (!this.isSupported) {
            console.log('Geolocation not supported');
            return false;
        }

        try {
            // Check permission status
            if ('permissions' in navigator) {
                const permission = await navigator.permissions.query({ name: 'geolocation' });
                console.log('Geolocation permission:', permission.state);
                
                permission.addEventListener('change', () => {
                    console.log('Geolocation permission changed:', permission.state);
                    this.updateLocationUI(permission.state);
                });
            }

            return true;
        } catch (error) {
            console.error('Error initializing location services:', error);
            return false;
        }
    }

    // Get current position
    async getCurrentPosition() {
        if (!this.isSupported) {
            throw new Error('Geolocation not supported');
        }

        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentPosition = position;
                    this.addToLocationHistory(position);
                    resolve(position);
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    reject(this.getLocationError(error));
                },
                this.options
            );
        });
    }

    // Start watching position
    startWatching() {
        if (!this.isSupported || this.watchId) {
            return false;
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.currentPosition = position;
                this.addToLocationHistory(position);
                this.onLocationUpdate(position);
            },
            (error) => {
                console.error('Location watch error:', error);
                this.onLocationError(error);
            },
            this.options
        );

        return true;
    }

    // Stop watching position
    stopWatching() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            return true;
        }
        return false;
    }

    // Add position to history
    addToLocationHistory(position) {
        const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
            address: null // Will be filled by reverse geocoding
        };

        this.locationHistory.unshift(locationData);
        
        // Keep only last 50 locations
        if (this.locationHistory.length > 50) {
            this.locationHistory = this.locationHistory.slice(0, 50);
        }

        // Reverse geocode the location
        this.reverseGeocode(locationData);
    }

    // Reverse geocode coordinates to address
    async reverseGeocode(locationData) {
        try {
            // Use a geocoding service (example with OpenStreetMap Nominatim)
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${locationData.latitude}&lon=${locationData.longitude}&zoom=18&addressdetails=1`
            );
            
            if (response.ok) {
                const data = await response.json();
                locationData.address = this.formatAddress(data);
                
                // Update UI if this is the current location
                if (this.currentPosition && 
                    this.currentPosition.coords.latitude === locationData.latitude &&
                    this.currentPosition.coords.longitude === locationData.longitude) {
                    this.updateCurrentLocationUI(locationData.address);
                }
            }
        } catch (error) {
            console.error('Reverse geocoding error:', error);
        }
    }

    // Format address from geocoding response
    formatAddress(geocodeData) {
        const address = geocodeData.address || {};
        const parts = [];

        if (address.house_number && address.road) {
            parts.push(`${address.house_number} ${address.road}`);
        } else if (address.road) {
            parts.push(address.road);
        }

        if (address.suburb || address.neighbourhood) {
            parts.push(address.suburb || address.neighbourhood);
        }

        if (address.city || address.town) {
            parts.push(address.city || address.town);
        }

        return parts.join(', ') || geocodeData.display_name || 'Unknown location';
    }

    // Find nearby transit stops
    async findNearbyStops(radius = 1000) {
        if (!this.currentPosition) {
            await this.getCurrentPosition();
        }

        const { latitude, longitude } = this.currentPosition.coords;

        try {
            // Query transit stops API
            const response = await fetch(`/api/stops/nearby?lat=${latitude}&lng=${longitude}&radius=${radius}`);
            
            if (response.ok) {
                this.nearbyStops = await response.json();
                this.updateNearbyStopsUI(this.nearbyStops);
                return this.nearbyStops;
            } else {
                // Fallback: Use mock data for demo
                this.nearbyStops = this.getMockNearbyStops(latitude, longitude);
                this.updateNearbyStopsUI(this.nearbyStops);
                return this.nearbyStops;
            }
        } catch (error) {
            console.error('Error finding nearby stops:', error);
            return [];
        }
    }

    // Get mock nearby stops for demo
    getMockNearbyStops(lat, lng) {
        return [
            {
                id: 'stop_001',
                name: 'Cape Town Station',
                service: 'MyCiTi',
                distance: 250,
                latitude: lat + 0.002,
                longitude: lng + 0.001,
                routes: ['Route 1', 'Route 2', 'Route 3']
            },
            {
                id: 'stop_002',
                name: 'Civic Centre',
                service: 'MyCiTi',
                distance: 450,
                latitude: lat - 0.003,
                longitude: lng + 0.002,
                routes: ['Route 2', 'Route 4']
            },
            {
                id: 'stop_003',
                name: 'Bellville Station',
                service: 'Golden Arrow',
                distance: 680,
                latitude: lat + 0.005,
                longitude: lng - 0.003,
                routes: ['GA Route 101', 'GA Route 205']
            }
        ];
    }

    // Calculate distance between two points
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in meters
    }

    // Get location error message
    getLocationError(error) {
        const errors = {
            1: 'Location access denied. Please enable location services in your browser settings.',
            2: 'Location unavailable. Please check your GPS connection.',
            3: 'Location request timed out. Please try again.',
            default: 'Unable to get your location. Please try again.'
        };

        return {
            code: error.code,
            message: errors[error.code] || errors.default
        };
    }

    // Event handlers
    onLocationUpdate(position) {
        console.log('Location updated:', position);
        
        // Update nearby stops if location changed significantly
        if (this.hasLocationChangedSignificantly(position)) {
            this.findNearbyStops();
        }

        // Trigger custom event
        document.dispatchEvent(new CustomEvent('locationUpdate', {
            detail: { position, nearbyStops: this.nearbyStops }
        }));
    }

    onLocationError(error) {
        console.error('Location error:', error);
        
        // Trigger custom event
        document.dispatchEvent(new CustomEvent('locationError', {
            detail: this.getLocationError(error)
        }));
    }

    // Check if location changed significantly
    hasLocationChangedSignificantly(newPosition) {
        if (this.locationHistory.length < 2) return true;

        const lastPosition = this.locationHistory[1]; // Previous position
        const distance = this.calculateDistance(
            lastPosition.latitude,
            lastPosition.longitude,
            newPosition.coords.latitude,
            newPosition.coords.longitude
        );

        return distance > 100; // 100 meters threshold
    }

    // UI update methods
    updateLocationUI(permissionState) {
        const locationBtn = document.getElementById('location-btn');
        const locationStatus = document.getElementById('location-status');

        if (locationBtn) {
            locationBtn.disabled = permissionState === 'denied';
            locationBtn.textContent = permissionState === 'granted' ? 'Get Location' : 'Enable Location';
        }

        if (locationStatus) {
            locationStatus.textContent = permissionState === 'granted' ? 
                'Location services available' : 
                'Location services disabled';
            locationStatus.className = `location-status ${permissionState}`;
        }
    }

    updateCurrentLocationUI(address) {
        const locationDisplay = document.getElementById('current-location');
        if (locationDisplay) {
            locationDisplay.textContent = address || 'Location detected';
            locationDisplay.classList.add('location-found');
        }
    }

    updateNearbyStopsUI(stops) {
        const stopsContainer = document.getElementById('nearby-stops');
        if (!stopsContainer) return;

        if (stops.length === 0) {
            stopsContainer.innerHTML = '<p class="no-stops">No transit stops found nearby</p>';
            return;
        }

        const stopsHTML = stops.map(stop => `
            <div class="nearby-stop" data-stop-id="${stop.id}">
                <div class="stop-info">
                    <h4 class="stop-name">${stop.name}</h4>
                    <p class="stop-service">${stop.service}</p>
                    <p class="stop-distance">${stop.distance}m away</p>
                </div>
                <div class="stop-routes">
                    ${stop.routes.map(route => `<span class="route-tag">${route}</span>`).join('')}
                </div>
                <button class="btn btn-sm btn-primary" onclick="selectStop('${stop.id}')">
                    Select Stop
                </button>
            </div>
        `).join('');

        stopsContainer.innerHTML = stopsHTML;
    }

    // Utility methods for forms
    fillLocationInput(inputId) {
        const input = document.getElementById(inputId);
        if (!input || !this.currentPosition) return;

        const { latitude, longitude } = this.currentPosition.coords;
        const recentLocation = this.locationHistory[0];
        
        if (recentLocation && recentLocation.address) {
            input.value = recentLocation.address;
        } else {
            input.value = `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
        }

        // Add visual feedback
        input.classList.add('location-filled');
        setTimeout(() => input.classList.remove('location-filled'), 2000);
    }

    // Get saved locations
    getSavedLocations() {
        try {
            return JSON.parse(localStorage.getItem('savedLocations') || '[]');
        } catch (error) {
            return [];
        }
    }

    // Save location
    saveLocation(name, address, coordinates) {
        const savedLocations = this.getSavedLocations();
        const location = {
            id: Date.now().toString(),
            name,
            address,
            coordinates,
            savedAt: new Date().toISOString()
        };

        savedLocations.unshift(location);
        
        // Keep only last 20 saved locations
        if (savedLocations.length > 20) {
            savedLocations.splice(20);
        }

        localStorage.setItem('savedLocations', JSON.stringify(savedLocations));
        return location;
    }
}

// Global functions for use in HTML
function getCurrentLocation(fieldPrefix) {
    if (window.locationServices) {
        window.locationServices.getCurrentPosition()
            .then(() => {
                window.locationServices.fillLocationInput(fieldPrefix + 'Location');
            })
            .catch(error => {
                alert(error.message || 'Unable to get your location');
            });
    }
}

function selectStop(stopId) {
    const stop = window.locationServices?.nearbyStops.find(s => s.id === stopId);
    if (stop) {
        // Fill the appropriate input field
        const activeInput = document.querySelector('input[type="text"]:focus') || 
                           document.getElementById('fromLocation') ||
                           document.getElementById('toLocation');
        
        if (activeInput) {
            activeInput.value = stop.name;
            activeInput.classList.add('location-filled');
            setTimeout(() => activeInput.classList.remove('location-filled'), 2000);
        }
    }
}

// Initialize location services when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.locationServices = new LocationServices();
    window.locationServices.init();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocationServices;
}