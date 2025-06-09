// PlasticBoy v2.0 - Fixed version with improved loading and Telegram integration
(function() {
    'use strict';
    
    console.log('🎯 PlasticBoy - Script initialization');
    
    // Global variables
    let map = null;
    let markers = [];
    let isInitialized = false;
    let initAttempts = 0;
    const MAX_INIT_ATTEMPTS = 10;
    
    // Almaty coordinates
    const ALMATY_CENTER = [43.2220, 76.8512];
    
    // Caching system
    const Cache = {
        key: 'plasticboy_points_v2',
        ttl: 5 * 60 * 1000, // 5 minutes
        
        save: function(data) {
            try {
                const item = {
                    data: data,
                    timestamp: Date.now()
                };
                localStorage.setItem(this.key, JSON.stringify(item));
                console.log('💾 Saved ' + data.length + ' points to cache');
            } catch (e) {
                console.warn('⚠️ Cache save error:', e);
            }
        },
        
        load: function() {
            try {
                const item = localStorage.getItem(this.key);
                if (!item) return null;
                
                const parsed = JSON.parse(item);
                const age = Date.now() - parsed.timestamp;
                
                if (age > this.ttl) {
                    console.log('⏰ Cache expired');
                    return null;
                }
                
                console.log('📦 Loaded ' + parsed.data.length + ' points from cache');
                return parsed.data;
            } catch (e) {
                console.warn('⚠️ Cache read error:', e);
                return null;
            }
        },
        
        clear: function() {
            localStorage.removeItem(this.key);
            console.log('🗑️ Cache cleared');
        }
    };
    
    // Wait for DOM ready
    function waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }
    
    // Check Leaflet loading
    function waitForLeaflet() {
        return new Promise((resolve, reject) => {
            const checkLeaflet = () => {
                if (typeof L !== 'undefined' && L.map) {
                    console.log('✅ Leaflet loaded');
                    resolve();
                } else {
                    setTimeout(checkLeaflet, 100);
                }
            };
            
            checkLeaflet();
            
            // Timeout for Leaflet loading
            setTimeout(() => {
                if (typeof L === 'undefined') {
                    console.error('❌ Leaflet failed to load in 10 seconds');
                    reject(new Error('Leaflet timeout'));
                }
            }, 10000);
        });
    }
    
    // Main initialization
    async function init() {
        try {
            console.log('🚀 Starting PlasticBoy initialization');
            
            // Wait for DOM
            await waitForDOM();
            console.log('✅ DOM ready');
            
            // Notify loader about DOM readiness
            if (window.AppLoader && window.AppLoader.updateLoader) {
                window.AppLoader.updateLoader();
            }
            
            // Wait for Leaflet
            await waitForLeaflet();
            
            // Notify loader about Leaflet readiness
            if (window.AppLoader && window.AppLoader.onLeafletReady) {
                window.AppLoader.onLeafletReady();
            }
            
            // Initialize map
            await initMap();
            
            // Load points
            await loadPoints();
            
            console.log('🎉 PlasticBoy successfully initialized');
            
        } catch (error) {
            console.error('❌ Initialization error:', error);
            
            // Try to reinitialize after 2 seconds
            if (initAttempts < MAX_INIT_ATTEMPTS) {
                initAttempts++;
                console.log(`🔄 Reinitialization attempt ${initAttempts}/${MAX_INIT_ATTEMPTS}`);
                setTimeout(init, 2000);
            } else {
                console.error('💥 Maximum initialization attempts exceeded');
                showErrorMessage('Failed to load application. Try refreshing the page.');
            }
        }
    }
    
    // Map initialization
    function initMap() {
        return new Promise((resolve, reject) => {
            if (isInitialized) {
                resolve();
                return;
            }
            
            const mapElement = document.getElementById('map');
            if (!mapElement) {
                reject(new Error('Map element not found'));
                return;
            }
            
            try {
                console.log('🗺️ Creating map');
                
                // Check that Leaflet is actually available
                if (typeof L === 'undefined' || !L.map) {
                    throw new Error('Leaflet not loaded');
                }
                
                map = L.map('map', {
                    center: ALMATY_CENTER,
                    zoom: 13,
                    zoomControl: true,
                    preferCanvas: true // Improve performance on mobile
                });
                
                // Add tiles
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 18,
                    tileSize: 256,
                    crossOrigin: true
                }).addTo(map);
                
                // Add styles
                addMapStyles();
                
                // Notify loader about map readiness
                if (window.AppLoader && window.AppLoader.onMapReady) {
                    window.AppLoader.onMapReady();
                }
                
                // Wait for full map loading
                map.whenReady(() => {
                    setTimeout(() => {
                        map.invalidateSize();
                        console.log('✅ Map ready');
                        isInitialized = true;
                        
                        // Auto-update every 30 seconds
                        setInterval(loadPoints, 30000);
                        
                        resolve();
                    }, 200);
                });
                
            } catch (error) {
                console.error('❌ Map creation error:', error);
                reject(error);
            }
        });
    }
    
    // Add styles
    function addMapStyles() {
        if (document.getElementById('map-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'map-styles';
        style.textContent = `
            .marker-icon {
                background: none !important;
                border: none !important;
            }
            
            .marker-dot {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: 0 3px 8px rgba(0,0,0,0.3);
                transition: transform 0.2s ease;
                cursor: pointer;
            }
            
            .marker-dot:hover {
                transform: scale(1.2);
            }
            
            .marker-dot.available {
                background: linear-gradient(45deg, #4CAF50, #45a049);
            }
            
            .marker-dot.collected {
                background: linear-gradient(45deg, #f44336, #e53935);
            }
            
            .user-marker {
                background: none !important;
                border: none !important;
            }
            
            .user-dot {
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background: linear-gradient(45deg, #007bff, #0056b3);
                border: 2px solid white;
                box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                position: relative;
            }
            
            .user-dot::after {
                content: '';
                position: absolute;
                top: -4px;
                left: -4px;
                right: -4px;
                bottom: -4px;
                border-radius: 50%;
                border: 2px solid #007bff;
                opacity: 0.3;
                animation: userPulse 2s infinite;
            }
            
            @keyframes userPulse {
                0% { transform: scale(1); opacity: 0.7; }
                50% { opacity: 0.2; }
                100% { transform: scale(2); opacity: 0; }
            }

            /* Styles for Telegram data in popup */
            .telegram-user-info {
                background: linear-gradient(135deg, #0088cc, #00a0ff);
                color: white;
                padding: 12px;
                border-radius: 10px;
                margin: 10px 0;
                text-align: center;
                box-shadow: 0 3px 10px rgba(0, 136, 204, 0.3);
            }

            .telegram-avatar {
                width: 50px;
                height: 50px;
                border-radius: 50%;
                border: 2px solid white;
                margin: 0 auto 8px;
                display: block;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }

            .telegram-name {
                font-weight: 600;
                font-size: 1rem;
                margin-bottom: 4px;
            }

            .telegram-username {
                font-size: 0.85rem;
                opacity: 0.9;
                text-decoration: none;
                color: white;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                transition: all 0.3s;
                padding: 4px 8px;
                border-radius: 15px;
                background: rgba(255,255,255,0.1);
            }

            .telegram-username:hover {
                background: rgba(255,255,255,0.2);
                transform: translateY(-1px);
            }

            .telegram-icon {
                font-size: 0.8rem;
            }

            .collector-info-enhanced {
                background: #f8f9fa;
                padding: 12px;
                border-radius: 10px;
                margin: 10px 0;
                border-left: 4px solid #4CAF50;
            }

            .collector-info-enhanced h4 {
                margin: 0 0 8px 0;
                color: #333;
                font-size: 0.95rem;
            }

            .collector-detail {
                margin: 4px 0;
                font-size: 0.9rem;
                color: #666;
            }

            .popup-collector-name {
                font-weight: 600;
                color: #333;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Load points
    function loadPoints() {
        return new Promise((resolve) => {
            console.log('📍 Loading points');
            
            // First check cache
            const cachedPoints = Cache.load();
            if (cachedPoints) {
                updateMap(cachedPoints);
                updateStats(cachedPoints);
                
                // Notify loader
                if (window.AppLoader && window.AppLoader.onPointsLoaded) {
                    window.AppLoader.onPointsLoaded();
                }
                
                // Update in background
                setTimeout(() => fetchPointsFromServer(false), 1000);
                resolve();
                return;
            }
            
            // Load from server
            fetchPointsFromServer(true).then(resolve);
        });
    }
    
    // Load from server
    function fetchPointsFromServer(notifyLoader = true) {
        return new Promise((resolve) => {
            console.log('🌐 Loading points from server');
            
            fetch('/api/points', {
                method: 'GET',
                headers: { 
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                cache: 'no-cache'
            })
            .then(response => {
                console.log('📡 Server response:', response.status);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                return response.json();
            })
            .then(points => {
                console.log('✅ Loaded ' + points.length + ' points from server');
                
                // Save to cache
                Cache.save(points);
                
                // Update map
                updateMap(points);
                updateStats(points);
                
                // Notify loader
                if (notifyLoader && window.AppLoader && window.AppLoader.onPointsLoaded) {
                    window.AppLoader.onPointsLoaded();
                }
                
                resolve();
            })
            .catch(error => {
                console.error('❌ Points loading error:', error);
                
                // Try to load from cache as fallback
                const cachedPoints = Cache.load();
                if (cachedPoints) {
                    console.log('📦 Using cached data as fallback');
                    updateMap(cachedPoints);
                    updateStats(cachedPoints);
                }
                
                // Notify loader even on error
                if (notifyLoader && window.AppLoader && window.AppLoader.onPointsLoaded) {
                    window.AppLoader.onPointsLoaded();
                }
                
                resolve();
            });
        });
    }
    
    // Update map
    function updateMap(points) {
        if (!map || !points) {
            console.warn('⚠️ Map or points not ready for update');
            return;
        }
        
        console.log('🗺️ Map update (' + points.length + ' points)');
        
        try {
            // Clear old markers
            markers.forEach(marker => {
                if (map.hasLayer(marker)) {
                    map.removeLayer(marker);
                }
            });
            markers = [];
            
            // Add new markers
            points.forEach(point => {
                try {
                    const isAvailable = point.status === 'available';
                    
                    const icon = L.divIcon({
                        className: 'marker-icon',
                        html: `<div class="marker-dot ${isAvailable ? 'available' : 'collected'}"></div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    });
                    
                    const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon: icon });
                    
                    // Create popup content with enhanced Telegram support
                    const popupContent = createPopupContent(point, isAvailable);
                    marker.bindPopup(popupContent);
                    
                    marker.addTo(map);
                    markers.push(marker);
                } catch (error) {
                    console.error('❌ Marker addition error:', error, point);
                }
            });
            
            console.log('✅ Added ' + markers.length + ' markers');
            
        } catch (error) {
            console.error('❌ Map update error:', error);
        }
    }
    
    // Create popup content with Telegram support
    function createPopupContent(point, isAvailable) {
        let popupContent = '<div style="min-width: 200px;">';
        popupContent += `<h3 style="margin: 0 0 10px 0;">${point.name}</h3>`;
        popupContent += `<p style="font-weight: 600; color: ${isAvailable ? '#4CAF50' : '#f44336'};">`;
        popupContent += isAvailable ? '🟢 Available for collection' : '🔴 Already collected';
        popupContent += '</p>';
        
        if (!isAvailable && point.collectorInfo) {
            popupContent += '<div class="collector-info-enhanced">';
            popupContent += '<h4>Collector information:</h4>';
            
            // If user is authorized via Telegram
            if (point.collectorInfo.authMethod === 'telegram' && point.collectorInfo.telegramData) {
                const tgData = point.collectorInfo.telegramData;
                
                popupContent += '<div class="telegram-user-info">';
                
                // User avatar
                if (tgData.photo_url) {
                    popupContent += `<img src="${tgData.photo_url}" alt="Avatar" class="telegram-avatar" 
                                      onerror="this.style.display='none';">`;
                }
                
                // User name
                const fullName = [tgData.first_name, tgData.last_name].filter(Boolean).join(' ');
                popupContent += `<div class="telegram-name">${fullName}</div>`;
                
                // Telegram profile link
                if (tgData.username) {
                    popupContent += `<a href="https://t.me/${tgData.username}" 
                                      target="_blank" class="telegram-username">
                                      <span class="telegram-icon">✈️</span>
                                      @${tgData.username}
                                    </a>`;
                } else {
                    // If no username, show Telegram ID
                    popupContent += `<div class="telegram-username" style="cursor: default;">
                                      <span class="telegram-icon">🆔</span>
                                      ID: ${tgData.id}
                                    </div>`;
                }
                
                popupContent += '</div>';
                
                // Additional information
                if (point.collectorInfo.signature) {
                    popupContent += `<div class="collector-detail">
                                      <strong>Message:</strong> ${point.collectorInfo.signature}
                                    </div>`;
                }
            } else {
                // Regular collector (manual input)
                popupContent += `<div class="collector-detail">
                                  <span class="popup-collector-name">${point.collectorInfo.name}</span>
                                </div>`;
                
                if (point.collectorInfo.signature) {
                    popupContent += `<div class="collector-detail">
                                      <strong>Message:</strong> ${point.collectorInfo.signature}
                                    </div>`;
                }
            }
            
            popupContent += `<div class="collector-detail">
                              <strong>Collection time:</strong> ${new Date(point.collectedAt).toLocaleString('en-US')}
                            </div>`;
            
            // Add selfie if available
            if (point.collectorInfo.selfie) {
                popupContent += '<div style="margin: 10px 0; text-align: center;">';
                popupContent += `<img src="${point.collectorInfo.selfie}" 
                                  style="max-width: 150px; max-height: 120px; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" 
                                  onclick="showFullImage('${point.collectorInfo.selfie}', '${point.name}')" 
                                  title="Click to enlarge">`;
                popupContent += '</div>';
            }
            
            popupContent += '</div>';
        }
        
        popupContent += '</div>';
        return popupContent;
    }
    
    // Update statistics
    function updateStats(points) {
        const available = points.filter(p => p.status === 'available').length;
        const collected = points.filter(p => p.status === 'collected').length;
        
        const availableEl = document.getElementById('availableCount');
        const collectedEl = document.getElementById('collectedCount');
        
        if (availableEl) {
            animateNumber(availableEl, available);
        }
        if (collectedEl) {
            animateNumber(collectedEl, collected);
        }
        
        console.log('📊 Statistics: ' + available + ' available, ' + collected + ' collected');
    }
    
    // Number animation
    function animateNumber(element, targetValue) {
        const currentValue = parseInt(element.textContent) || 0;
        if (currentValue === targetValue) return;
        
        const duration = 500;
        const steps = 10;
        const stepValue = (targetValue - currentValue) / steps;
        const stepDuration = duration / steps;
        
        let current = currentValue;
        let step = 0;
        
        const timer = setInterval(() => {
            step++;
            current += stepValue;
            
            if (step >= steps) {
                element.textContent = targetValue;
                clearInterval(timer);
            } else {
                element.textContent = Math.round(current);
            }
        }, stepDuration);
    }
    
    // Show error
    function showErrorMessage(message) {
        const container = document.querySelector('.container');
        if (container) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                background: rgba(244, 67, 54, 0.1);
                border: 1px solid #f44336;
                border-radius: 12px;
                padding: 20px;
                margin: 20px 0;
                text-align: center;
                color: #f44336;
                font-weight: 600;
            `;
            errorDiv.innerHTML = `
                <h3>❌ Loading error</h3>
                <p>${message}</p>
                <button onclick="window.location.reload()" style="
                    background: #f44336;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    margin-top: 10px;
                ">Refresh page</button>
            `;
            container.appendChild(errorDiv);
        }
    }
    
    // Global functions
    window.getCurrentLocation = function() {
        const btn = document.querySelector('.location-btn');
        if (!navigator.geolocation || !map) {
            console.warn('⚠️ Geolocation unavailable');
            return;
        }
        
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Locating...';
        btn.disabled = true;
        
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                // Remove old marker
                if (window.userMarker && map.hasLayer(window.userMarker)) {
                    map.removeLayer(window.userMarker);
                }
                
                // Create new marker
                const userIcon = L.divIcon({
                    className: 'user-marker',
                    html: '<div class="user-dot"></div>',
                    iconSize: [22, 22],
                    iconAnchor: [11, 11]
                });
                
                window.userMarker = L.marker([lat, lng], { icon: userIcon })
                    .addTo(map)
                    .bindPopup('<div style="text-align: center;"><strong>📍 Your location</strong></div>');
                
                map.flyTo([lat, lng], 16);
                console.log('✅ Location found');
                
                btn.innerHTML = originalText;
                btn.disabled = false;
            },
            function(error) {
                console.error('❌ Geolocation error:', error);
                btn.innerHTML = originalText;
                btn.disabled = false;
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    };
    
    // Show full image
    window.showFullImage = function(imageSrc, title) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 3000;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        `;
        
        modal.innerHTML = `
            <div style="
                max-width: 90%;
                max-height: 90%;
                background: white;
                border-radius: 12px;
                overflow: hidden;
                cursor: default;
            " onclick="event.stopPropagation()">
                <div style="padding: 15px; background: #f8f9fa; text-align: center; font-weight: 600;">
                    ${title}
                </div>
                <img src="${imageSrc}" style="max-width: 100%; max-height: 70vh; display: block;">
            </div>
        `;
        
        modal.onclick = () => modal.remove();
        document.body.appendChild(modal);
    };
    
    // Event handlers
    window.addEventListener('resize', function() {
        if (map) {
            setTimeout(() => map.invalidateSize(), 100);
        }
    });
    
    // Start initialization
    init();
    
    console.log('🚀 PlasticBoy script loaded');
})();
