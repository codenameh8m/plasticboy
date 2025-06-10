// Admin panel variables
let adminMap;
let adminMarkers = [];
let isAddMode = false;
let currentPassword = '';
let allPoints = [];
let currentQRCode = '';

// Almaty coordinates
const ALMATY_CENTER = [43.2220, 76.8512];

// Admin panel initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('🛡️ Admin panel - initialization');
    
    // Check saved password
    const savedPassword = sessionStorage.getItem('adminPassword');
    if (savedPassword) {
        currentPassword = savedPassword;
        showAdminPanel();
    }
    
    // Initialize admin buttons
    initAdminControlButtons();
    
    // Add event handlers
    setupEventListeners();
});

// Initialize admin control buttons
function initAdminControlButtons() {
    const checkAdminPanel = setInterval(() => {
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel && adminPanel.style.display !== 'none') {
            const locationBtn = document.querySelector('.location-btn');
            
            if (locationBtn) {
                locationBtn.addEventListener('mousedown', function() {
                    this.style.transform = 'translateY(-1px)';
                });
                
                locationBtn.addEventListener('mouseup', function() {
                    this.style.transform = '';
                });
                
                clearInterval(checkAdminPanel);
            }
        }
    }, 100);
}

// Setup event listeners
function setupEventListeners() {
    // Enter handler in password field
    const passwordInput = document.getElementById('adminPassword');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                adminLogin();
            }
        });
    }

    // Add point form handler
    const form = document.getElementById('addPointForm');
    if (form) {
        form.addEventListener('submit', handleAddPointSubmit);
    }

    // Close modal windows when clicking outside
    window.addEventListener('click', function(event) {
        const addModal = document.getElementById('addPointModal');
        const qrModal = document.getElementById('qrModal');
        
        if (event.target === addModal) {
            closeAddModal();
        }
        
        if (event.target === qrModal) {
            closeQrModal();
        }
    });

    // Handle window resize for admin map
    window.addEventListener('resize', function() {
        if (adminMap) {
            clearTimeout(window.adminResizeTimeout);
            window.adminResizeTimeout = setTimeout(() => {
                adminMap.invalidateSize();
            }, 150);
        }
    });

    // Enhanced key handling for admin
    document.addEventListener('keydown', function(event) {
        // Close modal windows with Escape
        if (event.key === 'Escape') {
            closeAddModal();
            closeQrModal();
        }
        
        // Get location with Ctrl+L
        if (event.ctrlKey && event.key === 'l') {
            const adminPanel = document.getElementById('adminPanel');
            if (adminPanel && adminPanel.style.display !== 'none') {
                event.preventDefault();
                getAdminLocation();
            }
        }
        
        // Toggle add mode with Ctrl+A
        if (event.ctrlKey && event.key === 'a') {
            const adminPanel = document.getElementById('adminPanel');
            if (adminPanel && adminPanel.style.display !== 'none') {
                event.preventDefault();
                toggleAddMode();
            }
        }
    });
}

// БЫСТРАЯ проверка пароля - только проверяем валидность, без загрузки данных
async function quickPasswordCheck(password) {
    try {
        console.log('🔐 Quick password validation...');
        
        // Создаем минимальный запрос только для проверки пароля
        const response = await fetch('/api/admin/points', {
            method: 'HEAD', // HEAD запрос - только проверяем доступ без получения данных
            headers: {
                'Authorization': password
            }
        });
        
        console.log('📡 Password check response:', response.status);
        return response.status === 200;
        
    } catch (error) {
        console.error('❌ Quick password check error:', error);
        return false;
    }
}

// Admin panel login - ОПТИМИЗИРОВАННЫЙ
async function adminLogin() {
    const password = document.getElementById('adminPassword').value;
    
    if (!password) {
        showNotification('Enter password', 'error');
        return;
    }
    
    console.log('🔐 Starting fast admin login...');
    
    // Показываем загрузку
    const passwordInput = document.getElementById('adminPassword');
    const originalPlaceholder = passwordInput.placeholder;
    passwordInput.disabled = true;
    passwordInput.placeholder = 'Checking password...';
    
    try {
        // БЫСТРАЯ проверка пароля без загрузки данных
        const isValid = await quickPasswordCheck(password);
        
        if (!isValid) {
            showNotification('Invalid administrator password', 'error');
            passwordInput.disabled = false;
            passwordInput.placeholder = originalPlaceholder;
            passwordInput.value = '';
            return;
        }
        
        // Пароль верный - сохраняем и показываем панель
        currentPassword = password;
        sessionStorage.setItem('adminPassword', password);
        
        console.log('✅ Password correct, showing admin panel');
        showAdminPanel();
        
    } catch (error) {
        console.error('❌ Admin login error:', error);
        showNotification('Server connection error', 'error');
        passwordInput.disabled = false;
        passwordInput.placeholder = originalPlaceholder;
    }
}

// Show admin panel - БЫСТРЫЙ показ без ожидания загрузки данных
async function showAdminPanel() {
    try {
        console.log('🛡️ Showing admin panel...');
        
        // Сразу показываем панель
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        
        // Показываем состояние загрузки
        showNotification('Loading admin panel...', 'info');
        
        // Инициализируем карту в фоне
        initAdminMap().then(() => {
            console.log('✅ Admin map ready');
            // Загружаем точки в фоне
            return loadAdminPoints();
        }).then(() => {
            showNotification('Admin panel loaded successfully!', 'success');
        }).catch(error => {
            console.error('❌ Admin panel initialization error:', error);
            showNotification('Error loading admin data', 'error');
        });
        
    } catch (error) {
        console.error('❌ Admin panel display error:', error);
        showNotification('Panel initialization error', 'error');
        
        // Return to login form on error
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
        sessionStorage.removeItem('adminPassword');
        currentPassword = '';
    }
}

// Admin map initialization - БЫСТРАЯ инициализация
function initAdminMap() {
    return new Promise((resolve, reject) => {
        try {
            if (adminMap) {
                adminMap.remove();
                adminMap = null;
            }
            
            console.log('🗺️ Quick admin map initialization');
            
            // Check Leaflet availability
            if (typeof L === 'undefined') {
                throw new Error('Leaflet not loaded');
            }
            
            const mapElement = document.getElementById('adminMap');
            if (!mapElement) {
                throw new Error('Map element not found');
            }
            
            adminMap = L.map('adminMap').setView(ALMATY_CENTER, 13);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(adminMap);
            
            // Add click handler for adding points
            adminMap.on('click', function(e) {
                if (isAddMode) {
                    openAddPointModal(e.latlng);
                }
            });
            
            // БЫСТРАЯ готовность карты
            setTimeout(() => {
                if (adminMap) {
                    adminMap.invalidateSize();
                    console.log('✅ Admin map ready quickly');
                    resolve();
                }
            }, 100); // Уменьшили с 200 до 100
            
        } catch (error) {
            console.error('❌ Admin map initialization error:', error);
            reject(error);
        }
    });
}

// Load points for admin - БЕЗ блокировки UI
async function loadAdminPoints() {
    try {
        console.log('🔄 Loading points for admin in background...');
        
        const response = await fetch('/api/admin/points', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': currentPassword
            }
        });
        
        console.log('📡 Server response for admin points:', response.status);
        
        if (!response.ok) {
            if (response.status === 401) {
                showNotification('Session expired', 'error');
                sessionStorage.removeItem('adminPassword');
                
                // Return to login form
                document.getElementById('adminPanel').style.display = 'none';
                document.getElementById('loginForm').style.display = 'block';
                document.getElementById('adminPassword').value = '';
                currentPassword = '';
                
                return;
            }
            const errorText = await response.text();
            console.error('❌ Server response error:', errorText);
            throw new Error(`Server error: ${response.status}`);
        }
        
        allPoints = await response.json();
        console.log('✅ Loaded points for admin:', allPoints.length);
        
        updateAdminMap();
        updateAdminStats();
        updatePointsList();
        
    } catch (error) {
        console.error('❌ Admin points loading error:', error);
        showNotification(`Data loading error: ${error.message}`, 'error');
    }
}

// Остальные функции остаются теми же...
// Update admin map with enhanced markers
function updateAdminMap() {
    if (!adminMap || !allPoints) {
        console.warn('⚠️ Map or points not ready for update');
        return;
    }
    
    // Clear existing markers
    adminMarkers.forEach(marker => {
        if (adminMap.hasLayer(marker)) {
            adminMap.removeLayer(marker);
        }
    });
    adminMarkers = [];
    
    allPoints.forEach(point => {
        try {
            const now = new Date();
            const isScheduled = new Date(point.scheduledTime) > now;
            const isCollected = point.status === 'collected';
            
            let iconColor = '#4CAF50'; // green for available
            if (isCollected) iconColor = '#f44336'; // red for collected
            else if (isScheduled) iconColor = '#ff9800'; // orange for scheduled
            
            const icon = L.divIcon({
                className: 'admin-marker',
                html: `<div class="admin-marker-dot" style="background: ${iconColor};">
                         ${isScheduled ? '⏱️' : (isCollected ? '✅' : '📦')}
                       </div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });
            
            const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon })
                .addTo(adminMap);
            
            // Enhanced popup for admin
            let popupContent = `
                <div class="admin-popup">
                    <h3>${point.name}</h3>
                    <p><strong>ID:</strong> ${point.id}</p>
                    <p><strong>Status:</strong> ${getStatusText(point, isScheduled)}</p>
                    <p><strong>Created:</strong> ${new Date(point.createdAt).toLocaleString('en-US')}</p>
            `;
            
            if (isScheduled) {
                popupContent += `<p><strong>Will appear:</strong> ${new Date(point.scheduledTime).toLocaleString('en-US')}</p>`;
            }
            
            if (point.status === 'collected') {
                popupContent += `
                    <p><strong>Collected:</strong> ${new Date(point.collectedAt).toLocaleString('en-US')}</p>
                    <p><strong>Collector:</strong> ${point.collectorInfo.name}</p>
                `;
            }
            
            popupContent += `
                    <div style="margin-top: 12px;">
                        <button onclick="showQRCode('${point.id}')" class="admin-btn">Show QR</button>
                        <button onclick="deletePoint('${point.id}')" class="admin-btn delete-btn">Delete</button>
                    </div>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            adminMarkers.push(marker);
        } catch (error) {
            console.error('❌ Marker addition error:', error, point);
        }
    });
    
    addAdminMarkerStyles();
}

// Get status text
function getStatusText(point, isScheduled) {
    if (point.status === 'collected') return '🔴 Collected';
    if (isScheduled) return '🟡 Scheduled';
    return '🟢 Available';
}

// Update admin statistics with animation
function updateAdminStats() {
    const now = new Date();
    const total = allPoints.length;
    const scheduled = allPoints.filter(p => new Date(p.scheduledTime) > now && p.status !== 'collected').length;
    const active = allPoints.filter(p => new Date(p.scheduledTime) <= now && p.status === 'available').length;
    
    // Animated update
    animateAdminNumber(document.getElementById('totalPoints'), total);
    animateAdminNumber(document.getElementById('activePoints'), active);
    animateAdminNumber(document.getElementById('scheduledPoints'), scheduled);
}

// Number animation for admin panel
function animateAdminNumber(element, targetValue) {
    if (!element) return;
    
    const currentValue = parseInt(element.textContent) || 0;
    if (currentValue === targetValue) return;
    
    const duration = 600;
    const steps = 20;
    const stepValue = (targetValue - currentValue) / steps;
    const stepDuration = duration / steps;
    
    let current = currentValue;
    let step = 0;
    
    element.style.transform = 'scale(1.1)';
    element.style.transition = 'transform 0.3s ease';
    
    const timer = setInterval(() => {
        step++;
        current += stepValue;
        
        if (step >= steps) {
            element.textContent = targetValue;
            element.style.transform = 'scale(1)';
            clearInterval(timer);
        } else {
            element.textContent = Math.round(current);
        }
    }, stepDuration);
}

// Update points list
function updatePointsList() {
    const container = document.getElementById('pointsList');
    
    if (!container) {
        console.warn('⚠️ Points list container not found');
        return;
    }
    
    if (allPoints.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No points created</p>';
        return;
    }
    
    const sortedPoints = [...allPoints].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    container.innerHTML = sortedPoints.map(point => {
        const now = new Date();
        const isScheduled = new Date(point.scheduledTime) > now;
        const statusClass = point.status === 'collected' ? 'collected' : (isScheduled ? 'scheduled' : 'available');
        
        return `
            <div class="point-item ${statusClass}">
                <div class="point-header">
                    <h4>${point.name}</h4>
                    <span class="point-status">${getStatusText(point, isScheduled)}</span>
                </div>
                <p><strong>ID:</strong> ${point.id}</p>
                <p><strong>Coordinates:</strong> ${point.coordinates.lat.toFixed(6)}, ${point.coordinates.lng.toFixed(6)}</p>
                <p><strong>Created:</strong> ${new Date(point.createdAt).toLocaleString('en-US')}</p>
                ${isScheduled ? `<p><strong>Will appear:</strong> ${new Date(point.scheduledTime).toLocaleString('en-US')}</p>` : ''}
                ${point.status === 'collected' ? `
                    <p><strong>Collected:</strong> ${new Date(point.collectedAt).toLocaleString('en-US')}</p>
                    <p><strong>Collector:</strong> ${point.collectorInfo.name}</p>
                ` : ''}
                <div class="point-actions">
                    <button onclick="showQRCode('${point.id}')" class="admin-btn">QR code</button>
                    <button onclick="deletePoint('${point.id}')" class="admin-btn delete-btn">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// Get geolocation for admin
function getAdminLocation() {
    const locationBtn = document.querySelector('.location-btn');
    
    if (!navigator.geolocation) {
        showNotification('Geolocation not supported', 'error');
        return;
    }
    
    if (!adminMap) {
        showNotification('Map not ready', 'error');
        return;
    }
    
    const originalText = locationBtn.innerHTML;
    locationBtn.innerHTML = '⏳ Locating...';
    locationBtn.disabled = true;
    locationBtn.style.opacity = '0.8';
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Create enhanced user marker for admin
            const userIcon = L.divIcon({
                className: 'admin-user-location-marker',
                html: `<div style="
                    background: linear-gradient(45deg, #667eea, #764ba2);
                    width: 26px; 
                    height: 26px; 
                    border-radius: 50%; 
                    border: 3px solid white; 
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                    position: relative;
                    transition: all 0.3s ease;
                ">
                    <div style="
                        position: absolute;
                        top: -6px;
                        left: -6px;
                        right: -6px;
                        bottom: -6px;
                        border-radius: 50%;
                        border: 2px solid #667eea;
                        opacity: 0.3;
                        animation: adminUserPulse 2s infinite;
                    "></div>
                </div>`,
                iconSize: [26, 26],
                iconAnchor: [13, 13]
            });
            
            // Add pulse animation styles for admin
            addAdminUserPulseStyles();
            
            // Remove previous admin marker if exists
            if (window.adminUserMarker) {
                adminMap.removeLayer(window.adminUserMarker);
            }
            
            // Add new marker
            window.adminUserMarker = L.marker([lat, lng], { icon: userIcon })
                .addTo(adminMap)
                .bindPopup(`
                    <div style="text-align: center; min-width: 150px;">
                        <strong>🛡️ Admin location</strong><br>
                        <small style="color: #666;">
                            ${lat.toFixed(6)}, ${lng.toFixed(6)}
                        </small>
                    </div>
                `);
            
            // Smoothly center map on admin
            adminMap.flyTo([lat, lng], 16, {
                duration: 1.5,
                easeLinearity: 0.5
            });
            
            showNotification('Location determined', 'success');
            
            // Restore button
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
            locationBtn.style.opacity = '';
        },
        function(error) {
            console.error('Geolocation error:', error);
            let errorMessage = 'Could not determine location';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Geolocation access denied';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Location unavailable';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Timeout exceeded';
                    break;
            }
            
            showNotification(errorMessage, 'error');
            
            // Restore button
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
            locationBtn.style.opacity = '';
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        }
    );
}

// Add pulse animation styles for admin
function addAdminUserPulseStyles() {
    if (!document.getElementById('admin-user-pulse-styles')) {
        const style = document.createElement('style');
        style.id = 'admin-user-pulse-styles';
        style.textContent = `
            @keyframes adminUserPulse {
                0% {
                    transform: scale(1);
                    opacity: 0.7;
                }
                50% {
                    opacity: 0.2;
                }
                100% {
                    transform: scale(2.2);
                    opacity: 0;
                }
            }
            
            .admin-user-location-marker:hover > div {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(0,0,0,0.4);
            }
        `;
        document.head.appendChild(style);
    }
}

// Toggle add mode
function toggleAddMode() {
    isAddMode = !isAddMode;
    const btn = document.getElementById('addModeBtn');
    
    if (!btn) {
        console.warn('⚠️ Add mode button not found');
        return;
    }
    
    if (isAddMode) {
        btn.textContent = 'Add mode: ON';
        btn.classList.add('active');
        if (adminMap) {
            adminMap.getContainer().style.cursor = 'crosshair';
        }
        showNotification('Click on map to add point', 'info');
    } else {
        btn.textContent = 'Add mode: OFF';
        btn.classList.remove('active');
        if (adminMap) {
            adminMap.getContainer().style.cursor = '';
        }
    }
}

// Open add point modal window
function openAddPointModal(latlng) {
    window.tempCoordinates = latlng;
    const modal = document.getElementById('addPointModal');
    const input = document.getElementById('modelName');
    
    if (modal && input) {
        modal.style.display = 'block';
        input.focus();
    }
}

// Close add modal window
function closeAddModal() {
    const modal = document.getElementById('addPointModal');
    const form = document.getElementById('addPointForm');
    
    if (modal) {
        modal.style.display = 'none';
    }
    if (form) {
        form.reset();
    }
}

// Handle add point form
async function handleAddPointSubmit(e) {
    e.preventDefault();
    
    console.log('🚀 Starting point creation...');
    
    const name = document.getElementById('modelName').value;
    const delayMinutes = document.getElementById('delayMinutes').value;
    
    console.log('📝 Form data:', { name, delayMinutes });
    
    if (!window.tempCoordinates) {
        console.error('❌ No coordinates');
        showNotification('Coordinates error', 'error');
        return;
    }
    
    console.log('📍 Coordinates:', window.tempCoordinates);
    
    if (!name || !name.trim()) {
        console.error('❌ Point name empty');
        showNotification('Enter model name', 'error');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalHTML = submitBtn.innerHTML;
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span style="animation: spin 1s linear infinite;">⏳</span> Creating...';
    submitBtn.style.opacity = '0.8';

    try {
        const requestData = {
            name: name.trim(),
            coordinates: {
                lat: parseFloat(window.tempCoordinates.lat),
                lng: parseFloat(window.tempCoordinates.lng)
            },
            delayMinutes: delayMinutes ? parseInt(delayMinutes) : 0
        };

        console.log('📤 Sending data:', requestData);
        console.log('🔑 Admin password:', currentPassword ? 'set' : 'not set');

        const response = await fetch('/api/admin/points', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': currentPassword
            },
            body: JSON.stringify(requestData)
        });
        
        console.log('📡 Server response:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
        });
        
        let responseData;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            const textResponse = await response.text();
            console.error('❌ Server returned non-JSON:', textResponse);
            throw new Error(`Server returned invalid response: ${textResponse.substring(0, 100)}`);
        }
        
        console.log('📥 Response data:', responseData);
        
        if (!response.ok) {
            if (response.status === 401) {
                console.error('❌ Invalid admin password');
                showNotification('Invalid administrator password', 'error');
                sessionStorage.removeItem('adminPassword');
                
                // Return to login form
                document.getElementById('adminPanel').style.display = 'none';
                document.getElementById('loginForm').style.display = 'block';
                document.getElementById('adminPassword').value = '';
                currentPassword = '';
                
                setTimeout(() => location.reload(), 2000);
                return;
            }
            
            const errorMessage = responseData.error || `HTTP ${response.status}: ${response.statusText}`;
            console.error('❌ Server error:', errorMessage);
            throw new Error(errorMessage);
        }
        
        console.log('✅ Point successfully created:', responseData);
        
        closeAddModal();
        showNotification('Point successfully created!', 'success');
        
        // Show QR code for new point
        if (responseData.qrCode) {
            showQRCodeForNewPoint(responseData);
        }
        
        // Update data
        await loadAdminPoints();
        
    } catch (error) {
        console.error('❌ Point creation error:', error);
        console.error('❌ Stack trace:', error.stack);
        
        // Show detailed error
        let errorMessage = 'Unknown error';
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Could not connect to server. Check connection.';
        } else if (error.message.includes('NetworkError')) {
            errorMessage = 'Network error. Try again later.';
        } else if (error.message.includes('Invalid')) {
            errorMessage = 'Invalid data: ' + error.message;
        } else {
            errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
    } finally {
        // Restore button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
        submitBtn.style.opacity = '';
    }
}

// Show QR code for newly created point
function showQRCodeForNewPoint(point) {
    currentQRCode = point.qrCode;
    
    const qrDisplay = document.getElementById('qrCodeDisplay');
    if (qrDisplay) {
        qrDisplay.innerHTML = `
            <img src="${point.qrCode}" alt="QR code for ${point.name}" style="max-width: 280px; border-radius: 12px;">
            <p style="font-weight: 600; margin-top: 15px;"><strong>${point.name}</strong></p>
            <p style="color: #666;">ID: ${pointId}</p>
        `;
    }
    
    const modal = document.getElementById('qrModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Close QR modal window
function closeQrModal() {
    const modal = document.getElementById('qrModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Download QR code
function downloadQR() {
    if (!currentQRCode) return;
    
    const link = document.createElement('a');
    link.download = `plasticboy-qr-${Date.now()}.png`;
    link.href = currentQRCode;
    link.click();
}

// Delete point
async function deletePoint(pointId) {
    if (!confirm('Are you sure you want to delete this point?')) {
        return;
    }
    
    try {
        console.log('🗑️ Deleting point:', pointId);
        
        const response = await fetch(`/api/admin/points/${pointId}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': currentPassword
            }
        });
        
        console.log('📡 Delete response:', response.status);
        
        if (!response.ok) {
            if (response.status === 401) {
                showNotification('Invalid administrator password', 'error');
                sessionStorage.removeItem('adminPassword');
                location.reload();
                return;
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete point');
        }
        
        showNotification('Point deleted', 'success');
        await loadAdminPoints();
        
    } catch (error) {
        console.error('❌ Point deletion error:', error);
        showNotification('Point deletion error: ' + error.message, 'error');
    }
}

// Add enhanced styles for admin markers
function addAdminMarkerStyles() {
    if (!document.getElementById('admin-marker-styles')) {
        const style = document.createElement('style');
        style.id = 'admin-marker-styles';
        style.textContent = `
            .admin-marker {
                background: none !important;
                border: none !important;
            }
            
            .admin-marker-dot {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 3px solid white;
                box-shadow: 0 4px 15px rgba(0,0,0,0.25);
                font-size: 16px;
                color: white;
                font-weight: bold;
                transition: all 0.3s ease;
                cursor: pointer;
            }
            
            .admin-marker-dot:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(0,0,0,0.35);
            }
            
            .admin-popup {
                min-width: 220px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .admin-popup h3 {
                margin: 0 0 12px 0;
                color: #333;
                font-size: 1.1rem;
                font-weight: 600;
            }
            
            .admin-popup p {
                margin: 6px 0;
                font-size: 0.9rem;
            }
            
            .admin-btn {
                background: linear-gradient(45deg, #667eea, #764ba2);
                color: white;
                border: none;
                padding: 8px 14px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.85rem;
                margin: 6px 6px 0 0;
                min-width: 90px;
                transition: all 0.3s;
                font-weight: 500;
            }
            
            .admin-btn:hover {
                background: linear-gradient(45deg, #5a67d8, #6b46c1);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            }
            
            .delete-btn {
                background: linear-gradient(45deg, #f44336, #e53935) !important;
            }
            
            .delete-btn:hover {
                background: linear-gradient(45deg, #d32f2f, #c62828) !important;
                box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3) !important;
            }
            
            .point-item {
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 16px;
                background: white;
                box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                transition: all 0.3s ease;
            }
            
            .point-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0,0,0,0.12);
            }
            
            .point-item.available {
                border-left: 4px solid #4CAF50;
            }
            
            .point-item.collected {
                border-left: 4px solid #f44336;
            }
            
            .point-item.scheduled {
                border-left: 4px solid #ff9800;
            }
            
            .point-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            
            .point-header h4 {
                margin: 0;
                color: #333;
                font-size: 1.1rem;
                font-weight: 600;
            }
            
            .point-status {
                font-size: 0.9rem;
                font-weight: 600;
                padding: 4px 8px;
                border-radius: 12px;
                background: rgba(255,255,255,0.8);
            }
            
            .point-actions {
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid #eee;
            }
        `;
        document.head.appendChild(style);
    }
}

// Enhanced notification function for admin
function showNotification(message, type = 'info') {
    console.log(`🔔 Notification: ${type} - ${message}`);
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${getNotificationIcon(type)} ${message}</span>
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 2000;
                background: rgba(255, 255, 255, 0.98);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                backdrop-filter: blur(10px);
                padding: 16px;
                min-width: 280px;
                max-width: 400px;
                animation: slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                border: 1px solid rgba(255,255,255,0.2);
                font-weight: 500;
            }
            
            .notification.error {
                border-left: 4px solid #f44336;
                background: linear-gradient(135deg, rgba(244, 67, 54, 0.05), rgba(255, 255, 255, 0.98));
            }
            
            .notification.success {
                border-left: 4px solid #4CAF50;
                background: linear-gradient(135deg, rgba(76, 175, 80, 0.05), rgba(255, 255, 255, 0.98));
            }
            
            .notification.info {
                border-left: 4px solid #2196F3;
                background: linear-gradient(135deg, rgba(33, 150, 243, 0.05), rgba(255, 255, 255, 0.98));
            }
            
            .notification.warning {
                border-left: 4px solid #ff9800;
                background: linear-gradient(135deg, rgba(255, 152, 0, 0.05), rgba(255, 255, 255, 0.98));
            }
            
            .notification-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .notification-content button {
                background: none;
                border: none;
                font-size: 1.3rem;
                cursor: pointer;
                color: #999;
                padding: 0;
                margin: 0;
                width: auto;
                margin-left: 12px;
                transition: color 0.3s;
            }
            
            .notification-content button:hover {
                color: #666;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%) scale(0.9);
                    opacity: 0;
                }
                to {
                    transform: translateX(0) scale(1);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Get notification icon
function getNotificationIcon(type) {
    const icons = {
        error: '❌',
        success: '✅',
        info: 'ℹ️',
        warning: '⚠️'
    };
    return icons[type] || icons.info;
}

// Debug function to check state
function debugAdminState() {
    console.log('🔍 Admin panel state debug:', {
        currentPassword: currentPassword ? 'set' : 'not set',
        isAddMode: isAddMode,
        allPointsCount: allPoints.length,
        adminMapReady: !!adminMap,
        tempCoordinates: window.tempCoordinates
    });
}

// Export functions for global use (if needed)
window.adminLogin = adminLogin;
window.toggleAddMode = toggleAddMode;
window.getAdminLocation = getAdminLocation;
window.showQRCode = showQRCode;
window.deletePoint = deletePoint;
window.closeAddModal = closeAddModal;
window.closeQrModal = closeQrModal;
window.downloadQR = downloadQR;
window.debugAdminState = debugAdminState;');
    if (qrDisplay) {
        qrDisplay.innerHTML = `
            <img src="${point.qrCode}" alt="QR code for ${point.name}" style="max-width: 280px; border-radius: 12px;">
            <p style="font-weight: 600; margin-top: 15px;"><strong>${point.name}</strong></p>
            <p style="color: #666;">ID: ${point.id}</p>
        `;
    }
    
    const modal = document.getElementById('qrModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Show QR code for existing points
function showQRCode(pointId, qrCodeData = null) {
    // If ready QR code passed (for new points), use it
    if (qrCodeData) {
        currentQRCode = qrCodeData;
        const qrDisplay = document.getElementById('qrCodeDisplay');
        if (qrDisplay) {
            qrDisplay.innerHTML = `
                <img src="${qrCodeData}" alt="QR code" style="max-width: 280px; border-radius: 12px;">
                <p style="color: #666; margin-top: 15px;">ID: ${pointId}</p>
            `;
        }
        const modal = document.getElementById('qrModal');
        if (modal) {
            modal.style.display = 'block';
        }
        return;
    }
    
    // For existing points search in list
    const point = allPoints.find(p => p.id === pointId);
    if (!point) {
        showNotification('Point not found', 'error');
        return;
    }
    
    currentQRCode = point.qrCode;
    
    const qrDisplay = document.getElementById('qrCodeDisplay
