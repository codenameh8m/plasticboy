// PlasticBoy Admin Panel - ОПТИМИЗИРОВАННАЯ версия для максимальной скорости
let adminMap;
let adminMarkers = [];
let isAddMode = false;
let currentPassword = '';
let allPoints = [];
let currentQRCode = '';

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// КЭШИРОВАНИЕ для админа
const AdminCache = {
    key: 'plasticboy_admin_cache_v2',
    ttl: 60 * 1000, // 1 минута для админа
    
    save: function(data) {
        try {
            sessionStorage.setItem(this.key, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('⚠️ Admin cache save failed:', e);
        }
    },
    
    load: function() {
        try {
            const item = sessionStorage.getItem(this.key);
            if (!item) return null;
            
            const parsed = JSON.parse(item);
            const age = Date.now() - parsed.timestamp;
            
            if (age > this.ttl) {
                sessionStorage.removeItem(this.key);
                return null;
            }
            
            return parsed.data;
        } catch (e) {
            sessionStorage.removeItem(this.key);
            return null;
        }
    },
    
    clear: function() {
        sessionStorage.removeItem(this.key);
    }
};

// Инициализация админ панели
document.addEventListener('DOMContentLoaded', function() {
    console.log('🛡️ Admin panel - OPTIMIZED initialization');
    
    // Проверяем сохраненный пароль
    const savedPassword = sessionStorage.getItem('adminPassword');
    if (savedPassword) {
        currentPassword = savedPassword;
        showAdminPanel();
    }
    
    // Инициализируем кнопки и обработчики
    initAdminControlButtons();
    setupEventListeners();
});

// Инициализация кнопок управления админа
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

// Настройка обработчиков событий
function setupEventListeners() {
    // Enter в поле пароля
    const passwordInput = document.getElementById('adminPassword');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                adminLogin();
            }
        });
    }

    // Форма добавления точки
    const form = document.getElementById('addPointForm');
    if (form) {
        form.addEventListener('submit', handleAddPointSubmit);
    }

    // Закрытие модальных окон при клике вне
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

    // Обработка изменения размера окна для админ карты
    window.addEventListener('resize', function() {
        if (adminMap) {
            clearTimeout(window.adminResizeTimeout);
            window.adminResizeTimeout = setTimeout(() => {
                adminMap.invalidateSize();
            }, 150);
        }
    });

    // Горячие клавиши для админа
    document.addEventListener('keydown', function(event) {
        // Закрытие модальных окон с Escape
        if (event.key === 'Escape') {
            closeAddModal();
            closeQrModal();
        }
        
        // Получить местоположение с Ctrl+L
        if (event.ctrlKey && event.key === 'l') {
            const adminPanel = document.getElementById('adminPanel');
            if (adminPanel && adminPanel.style.display !== 'none') {
                event.preventDefault();
                getAdminLocation();
            }
        }
        
        // Переключить режим добавления с Ctrl+A
        if (event.ctrlKey && event.key === 'a') {
            const adminPanel = document.getElementById('adminPanel');
            if (adminPanel && adminPanel.style.display !== 'none') {
                event.preventDefault();
                toggleAddMode();
            }
        }
    });
}

// МОЛНИЕНОСНАЯ проверка пароля - только валидация без загрузки данных
async function lightningFastPasswordCheck(password) {
    try {
        console.log('⚡ Lightning fast password validation...');
        
        // Создаем минимальный HEAD запрос - только статус без данных
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 секунды таймаут
        
        const response = await fetch('/api/admin/points', {
            method: 'HEAD', // HEAD запрос - никаких данных, только статус
            headers: {
                'Authorization': password
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log('📡 Password check response:', response.status);
        
        return response.status === 200;
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('❌ Password check timeout');
            return false;
        }
        console.error('❌ Lightning password check error:', error);
        return false;
    }
}

// МГНОВЕННЫЙ админ логин
async function adminLogin() {
    const passwordInput = document.getElementById('adminPassword');
    const password = passwordInput.value;
    
    if (!password) {
        showNotification('Enter password', 'error');
        passwordInput.focus();
        return;
    }
    
    console.log('⚡ Starting LIGHTNING FAST admin login...');
    
    // Показываем мгновенную обратную связь
    passwordInput.disabled = true;
    passwordInput.style.opacity = '0.7';
    passwordInput.placeholder = '⚡ Checking...';
    
    const startTime = performance.now();
    
    try {
        // МГНОВЕННАЯ проверка пароля
        const isValid = await lightningFastPasswordCheck(password);
        
        const checkTime = performance.now() - startTime;
        console.log(`🔥 Password check completed in ${checkTime.toFixed(2)}ms`);
        
        if (!isValid) {
            showNotification('Invalid administrator password', 'error');
            
            // Восстанавливаем поле ввода
            passwordInput.disabled = false;
            passwordInput.style.opacity = '';
            passwordInput.placeholder = 'Administrator password';
            passwordInput.value = '';
            passwordInput.focus();
            return;
        }
        
        // Пароль верный - МГНОВЕННО сохраняем и показываем панель
        currentPassword = password;
        sessionStorage.setItem('adminPassword', password);
        
        console.log(`✅ Password correct! Total time: ${(performance.now() - startTime).toFixed(2)}ms`);
        
        // МГНОВЕННЫЙ переход к админ панели
        showAdminPanelInstantly();
        
    } catch (error) {
        console.error('❌ Admin login error:', error);
        showNotification('Connection error', 'error');
        
        // Восстанавливаем поле ввода
        passwordInput.disabled = false;
        passwordInput.style.opacity = '';
        passwordInput.placeholder = 'Administrator password';
    }
}

// МГНОВЕННЫЙ показ админ панели
function showAdminPanelInstantly() {
    console.log('🚀 Showing admin panel INSTANTLY...');
    
    // МГНОВЕННО скрываем форму логина и показываем панель
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    
    // Показываем успешное уведомление
    showNotification('✅ Admin access granted!', 'success');
    
    // Запускаем инициализацию в фоне БЕЗ ожидания
    setTimeout(() => {
        initializeAdminPanelBackground();
    }, 50); // Минимальная задержка для плавности UI
}

// Фоновая инициализация админ панели
async function initializeAdminPanelBackground() {
    try {
        console.log('🔄 Background initialization started...');
        
        // Показываем статус загрузки
        showNotification('Loading admin components...', 'info');
        
        // 1. Инициализируем карту в фоне
        console.log('🗺️ Initializing map in background...');
        await initAdminMapBackground();
        
        // 2. Загружаем точки в фоне
        console.log('📍 Loading points in background...');
        await loadAdminPointsBackground();
        
        // Все готово!
        showNotification('✅ Admin panel fully loaded!', 'success');
        console.log('🎉 Admin panel fully ready!');
        
    } catch (error) {
        console.error('❌ Background initialization error:', error);
        showNotification('⚠️ Some components failed to load', 'warning');
    }
}

// Фоновая инициализация карты
function initAdminMapBackground() {
    return new Promise((resolve) => {
        try {
            if (adminMap) {
                adminMap.remove();
                adminMap = null;
            }
            
            console.log('🗺️ Quick background map initialization');
            
            // Проверяем доступность Leaflet
            if (typeof L === 'undefined') {
                console.warn('⚠️ Leaflet not loaded yet, will retry...');
                setTimeout(() => initAdminMapBackground().then(resolve), 300);
                return;
            }
            
            const mapElement = document.getElementById('adminMap');
            if (!mapElement) {
                console.warn('⚠️ Map element not found');
                resolve();
                return;
            }
            
            adminMap = L.map('adminMap', {
                center: ALMATY_CENTER,
                zoom: 13,
                zoomControl: true,
                preferCanvas: true,
                renderer: L.canvas({ padding: 0.5 })
            });
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18,
                keepBuffer: 2,
                updateWhenIdle: true
            }).addTo(adminMap);
            
            // Добавляем обработчик кликов
            adminMap.on('click', function(e) {
                if (isAddMode) {
                    openAddPointModal(e.latlng);
                }
            });
            
            // Быстрая готовность карты
            setTimeout(() => {
                if (adminMap) {
                    adminMap.invalidateSize();
                    console.log('✅ Background map ready');
                    resolve();
                }
            }, 50); // Очень быстро
            
        } catch (error) {
            console.error('❌ Background map initialization error:', error);
            resolve(); // Не блокируем на ошибке
        }
    });
}

// Фоновая загрузка точек с кэшированием
async function loadAdminPointsBackground() {
    try {
        console.log('🔄 Loading admin points in background...');
        
        // Проверяем кэш
        let cachedPoints = AdminCache.load();
        if (cachedPoints) {
            allPoints = cachedPoints;
            updateAdminMap();
            updateAdminStats();
            updatePointsList();
            console.log('📦 Loaded from admin cache:', allPoints.length);
            
            // Обновляем в фоне
            setTimeout(() => fetchAdminPointsFromServer(), 500);
            return;
        }
        
        // Загружаем с сервера
        await fetchAdminPointsFromServer();
        
    } catch (error) {
        console.error('❌ Background points loading error:', error);
        showNotification(`Data loading error: ${error.message}`, 'error');
    }
}

// Загрузка точек с сервера для админа
async function fetchAdminPointsFromServer() {
    try {
        const response = await fetch('/api/admin/points', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': currentPassword
            }
        });
        
        console.log('📡 Admin points response:', response.status);
        
        if (!response.ok) {
            if (response.status === 401) {
                showNotification('Session expired', 'error');
                sessionStorage.removeItem('adminPassword');
                setTimeout(() => location.reload(), 2000);
                return;
            }
            throw new Error(`Server error: ${response.status}`);
        }
        
        allPoints = await response.json();
        console.log('✅ Loaded admin points:', allPoints.length);
        
        // Сохраняем в кэш
        AdminCache.save(allPoints);
        
        // Обновляем UI
        updateAdminMap();
        updateAdminStats();
        updatePointsList();
        
    } catch (error) {
        console.error('❌ Admin points fetch error:', error);
        throw error;
    }
}

// Обновление карты админа
function updateAdminMap() {
    if (!adminMap || !allPoints) {
        console.warn('⚠️ Admin map or points not ready for update');
        return;
    }
    
    // Очищаем существующие маркеры
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
            
            let iconColor = '#4CAF50'; // зеленый для доступных
            if (isCollected) iconColor = '#f44336'; // красный для собранных
            else if (isScheduled) iconColor = '#ff9800'; // оранжевый для запланированных
            
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
            console.error('❌ Admin marker addition error:', error, point);
        }
    });
    
    addAdminMarkerStyles();
}

function getStatusText(point, isScheduled) {
    if (point.status === 'collected') return '🔴 Collected';
    if (isScheduled) return '🟡 Scheduled';
    return '🟢 Available';
}

// Обновление статистики админа
function updateAdminStats() {
    const now = new Date();
    const total = allPoints.length;
    const scheduled = allPoints.filter(p => new Date(p.scheduledTime) > now && p.status !== 'collected').length;
    const active = allPoints.filter(p => new Date(p.scheduledTime) <= now && p.status === 'available').length;
    
    // Анимированное обновление
    animateAdminNumber(document.getElementById('totalPoints'), total);
    animateAdminNumber(document.getElementById('activePoints'), active);
    animateAdminNumber(document.getElementById('scheduledPoints'), scheduled);
}

function animateAdminNumber(element, targetValue) {
    if (!element) return;
    
    const currentValue = parseInt(element.textContent) || 0;
    if (currentValue === targetValue) return;
    
    // Быстрая анимация для админа
    element.textContent = targetValue;
    element.style.transform = 'scale(1.1)';
    element.style.transition = 'transform 0.2s ease';
    
    setTimeout(() => {
        element.style.transform = 'scale(1)';
    }, 200);
}

// Обновление списка точек
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

function openAddPointModal(latlng) {
    window.tempCoordinates = latlng;
    const modal = document.getElementById('addPointModal');
    const input = document.getElementById('modelName');
    
    if (modal && input) {
        modal.style.display = 'block';
        input.focus();
    }
}

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

async function handleAddPointSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('modelName').value;
    const delayMinutes = document.getElementById('delayMinutes').value;
    
    if (!window.tempCoordinates) {
        showNotification('Coordinates error', 'error');
        return;
    }
    
    if (!name || !name.trim()) {
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

        const response = await fetch('/api/admin/points', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': currentPassword
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create point');
        }
        
        const responseData = await response.json();
        
        closeAddModal();
        showNotification('Point successfully created!', 'success');
        
        if (responseData.qrCode) {
            showQRCodeForNewPoint(responseData);
        }
        
        // Очищаем кэш и перезагружаем
        AdminCache.clear();
        await loadAdminPointsBackground();
        
    } catch (error) {
        console.error('❌ Point creation error:', error);
        showNotification('Point creation error: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
        submitBtn.style.opacity = '';
    }
}

function showQRCodeForNewPoint(point) {
    currentQRCode = point.qrCode;
    
    const qrDisplay = document.getElementById('qrCodeDisplay');
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

function showQRCode(pointId) {
    const point = allPoints.find(p => p.id === pointId);
    if (!point) {
        showNotification('Point not found', 'error');
        return;
    }
    
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

function closeQrModal() {
    const modal = document.getElementById('qrModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function downloadQR() {
    if (!currentQRCode) return;
    
    const link = document.createElement('a');
    link.download = `plasticboy-qr-${Date.now()}.png`;
    link.href = currentQRCode;
    link.click();
}

async function deletePoint(pointId) {
    if (!confirm('Are you sure you want to delete this point?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/points/${pointId}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': currentPassword
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete point');
        }
        
        showNotification('Point deleted', 'success');
        
        // Очищаем кэш и перезагружаем
        AdminCache.clear();
        await loadAdminPointsBackground();
        
    } catch (error) {
        console.error('❌ Point deletion error:', error);
        showNotification('Point deletion error: ' + error.message, 'error');
    }
}

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
            
            addAdminUserPulseStyles();
            
            if (window.adminUserMarker) {
                adminMap.removeLayer(window.adminUserMarker);
            }
            
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
            
            adminMap.flyTo([lat, lng], 16, {
                duration: 1.2,
                easeLinearity: 0.3
            });
            
            showNotification('Location determined', 'success');
            
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
            locationBtn.style.opacity = '';
        },
        function(error) {
            console.error('Geolocation error:', error);
            showNotification('Could not determine location', 'error');
            
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
            locationBtn.style.opacity = '';
        },
        {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 300000
        }
    );
}

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

// УЛЬТРА БЫСТРАЯ система уведомлений
function showNotification(message, type = 'info') {
    console.log(`🔔 ${type.toUpperCase()}: ${message}`);
    
    // Удаляем предыдущие уведомления того же типа
    const existingNotifications = document.querySelectorAll(`.notification.${type}`);
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${getNotificationIcon(type)} ${message}</span>
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Добавляем стили если их нет
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
                animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                border: 1px solid rgba(255,255,255,0.2);
                font-weight: 500;
                transform: translateX(100%);
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
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Мгновенная анимация появления
    requestAnimationFrame(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
    });
    
    // Автоматическое скрытие
    const hideTimeout = type === 'error' ? 5000 : (type === 'success' ? 2000 : 3000);
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, hideTimeout);
}

function getNotificationIcon(type) {
    const icons = {
        error: '❌',
        success: '✅',
        info: 'ℹ️',
        warning: '⚠️'
    };
    return icons[type] || icons.info;
}

// Debug function
function debugAdminState() {
    console.log('🔍 Admin panel state debug:', {
        currentPassword: currentPassword ? 'set' : 'not set',
        isAddMode: isAddMode,
        allPointsCount: allPoints.length,
        adminMapReady: !!adminMap,
        tempCoordinates: window.tempCoordinates,
        cacheSize: AdminCache.load()?.length || 0
    });
}

// Export functions for global use
window.adminLogin = adminLogin;
window.toggleAddMode = toggleAddMode;
window.getAdminLocation = getAdminLocation;
window.showQRCode = showQRCode;
window.deletePoint = deletePoint;
window.closeAddModal = closeAddModal;
window.closeQrModal = closeQrModal;
window.downloadQR = downloadQR;
window.debugAdminState = debugAdminState;
