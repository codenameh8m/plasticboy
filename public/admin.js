// Admin panel variables - OPTIMIZED VERSION
let adminMap;
let adminMarkers = [];
let isAddMode = false;
let currentPassword = '';
let allPoints = [];
let currentQRCode = '';

// Almaty coordinates
const ALMATY_CENTER = [43.2220, 76.8512];

// БЫСТРЫЙ КЭШ ДЛЯ АДМИНКИ
class AdminCache {
    constructor() {
        this.cache = new Map();
        this.ttl = 60 * 1000; // 1 минута для админки
    }
    
    set(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
    
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return item.data;
    }
    
    clear() {
        this.cache.clear();
    }
}

const adminCache = new AdminCache();

// ДЕБАУНС ДЛЯ АДМИНСКИХ ОПЕРАЦИЙ
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// БЫСТРАЯ ИНИЦИАЛИЗАЦИЯ АДМИНКИ
document.addEventListener('DOMContentLoaded', function() {
    console.log('🛡️ Admin panel - optimized initialization');
    
    // Проверяем сохраненный пароль
    const savedPassword = sessionStorage.getItem('adminPassword');
    if (savedPassword) {
        currentPassword = savedPassword;
        showAdminPanel();
    }
    
    // Инициализируем элементы управления
    initAdminControlButtons();
    
    // Добавляем обработчики событий
    setupEventListeners();
});

// Инициализация кнопок управления
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

    // Ресайз карты
    window.addEventListener('resize', debounce(function() {
        if (adminMap) {
            adminMap.invalidateSize();
        }
    }, 150));

    // Горячие клавиши
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeAddModal();
            closeQrModal();
        }
        
        if (event.ctrlKey && event.key === 'l') {
            const adminPanel = document.getElementById('adminPanel');
            if (adminPanel && adminPanel.style.display !== 'none') {
                event.preventDefault();
                getAdminLocation();
            }
        }
        
        if (event.ctrlKey && event.key === 'a') {
            const adminPanel = document.getElementById('adminPanel');
            if (adminPanel && adminPanel.style.display !== 'none') {
                event.preventDefault();
                toggleAddMode();
            }
        }
    });
}

// МОЛНИЕНОСНАЯ проверка пароля - ТОЛЬКО статус
async function lightningPasswordCheck(password) {
    try {
        console.log('⚡ Lightning password validation...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 секунды
        
        const response = await fetch('/api/admin/points', {
            method: 'HEAD',
            headers: { 'Authorization': password },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log('📡 Password check:', response.status, 'in', Math.round(performance.now()), 'ms');
        
        return response.status === 200;
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('❌ Password check timeout');
        } else {
            console.error('❌ Password check error:', error);
        }
        return false;
    }
}

// МГНОВЕННЫЙ админ логин
async function adminLogin() {
    const passwordInput = document.getElementById('adminPassword');
    const password = passwordInput.value;
    
    if (!password) {
        showNotificationFast('Enter password', 'error');
        passwordInput.focus();
        return;
    }
    
    console.log('⚡ Starting LIGHTNING admin login...');
    
    // Мгновенная обратная связь
    passwordInput.disabled = true;
    passwordInput.style.opacity = '0.7';
    passwordInput.placeholder = '⚡ Checking...';
    
    const startTime = performance.now();
    
    try {
        // МОЛНИЕНОСНАЯ проверка
        const isValid = await lightningPasswordCheck(password);
        
        const checkTime = performance.now() - startTime;
        console.log(`🔥 Password check: ${checkTime.toFixed(2)}ms`);
        
        if (!isValid) {
            showNotificationFast('Invalid administrator password', 'error');
            
            passwordInput.disabled = false;
            passwordInput.style.opacity = '';
            passwordInput.placeholder = 'Administrator password';
            passwordInput.value = '';
            passwordInput.focus();
            return;
        }
        
        // Сохраняем и показываем панель
        currentPassword = password;
        sessionStorage.setItem('adminPassword', password);
        
        console.log(`✅ Password correct! Total: ${(performance.now() - startTime).toFixed(2)}ms`);
        
        showAdminPanelInstantly();
        
    } catch (error) {
        console.error('❌ Admin login error:', error);
        showNotificationFast('Connection error', 'error');
        
        passwordInput.disabled = false;
        passwordInput.style.opacity = '';
        passwordInput.placeholder = 'Administrator password';
    }
}

// МГНОВЕННЫЙ показ админ панели
function showAdminPanelInstantly() {
    console.log('🚀 Showing admin panel INSTANTLY...');
    
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    
    showNotificationFast('✅ Admin access granted!', 'success');
    
    // Запускаем инициализацию в фоне
    setTimeout(() => {
        initializeAdminPanelBackground();
    }, 50); // Минимальная задержка
}

// Фоновая инициализация
async function initializeAdminPanelBackground() {
    try {
        console.log('🔄 Background initialization...');
        
        showNotificationFast('Loading admin components...', 'info');
        
        // Инициализируем карту
        await initAdminMapBackground();
        
        // Загружаем точки
        await loadAdminPointsBackground();
        
        showNotificationFast('✅ Admin panel ready!', 'success');
        console.log('🎉 Admin panel fully ready!');
        
    } catch (error) {
        console.error('❌ Background initialization error:', error);
        showNotificationFast('⚠️ Some components failed to load', 'warning');
    }
}

// Быстрая инициализация карты
function initAdminMapBackground() {
    return new Promise((resolve) => {
        try {
            if (adminMap) {
                adminMap.remove();
                adminMap = null;
            }
            
            console.log('🗺️ Quick admin map initialization');
            
            if (typeof L === 'undefined') {
                console.warn('⚠️ Leaflet not loaded, retrying...');
                setTimeout(() => initAdminMapBackground().then(resolve), 500);
                return;
            }
            
            const mapElement = document.getElementById('adminMap');
            if (!mapElement) {
                console.warn('⚠️ Admin map element not found');
                resolve();
                return;
            }
            
            adminMap = L.map('adminMap', {
                center: ALMATY_CENTER,
                zoom: 13,
                preferCanvas: true,
                renderer: L.canvas()
            });
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: 18,
                updateWhenIdle: true,
                keepBuffer: 2
            }).addTo(adminMap);
            
            // Обработчик кликов
            adminMap.on('click', function(e) {
                if (isAddMode) {
                    openAddPointModal(e.latlng);
                }
            });
            
            setTimeout(() => {
                if (adminMap) {
                    adminMap.invalidateSize();
                    console.log('✅ Admin map ready');
                    resolve();
                }
            }, 50);
            
        } catch (error) {
            console.error('❌ Admin map error:', error);
            resolve();
        }
    });
}

// Быстрая загрузка точек
async function loadAdminPointsBackground() {
    try {
        console.log('🔄 Loading admin points...');
        
        // Проверяем кэш
        const cached = adminCache.get('admin_points');
        if (cached) {
            allPoints = cached;
            updateAdminMap();
            updateAdminStats();
            updatePointsList();
            console.log('📦 Loaded from cache:', allPoints.length, 'points');
            
            // Обновляем в фоне
            setTimeout(() => fetchAdminPointsFromServer(), 1000);
            return;
        }
        
        await fetchAdminPointsFromServer();
        
    } catch (error) {
        console.error('❌ Admin points fetch error:', error);
        showNotificationFast(`Data loading error: ${error.message}`, 'error');
    }
}

// ОПТИМИЗИРОВАННОЕ обновление админ карты
function updateAdminMap() {
    if (!adminMap || !allPoints) {
        console.warn('⚠️ Admin map or points not ready');
        return;
    }
    
    console.log('🗺️ Updating admin map with', allPoints.length, 'points');
    
    // Быстрая очистка маркеров
    adminMarkers.forEach(marker => {
        if (adminMap.hasLayer(marker)) {
            adminMap.removeLayer(marker);
        }
    });
    adminMarkers.length = 0;
    
    // Добавляем маркеры пакетами для лучшей производительности
    const batchSize = 5;
    let processed = 0;
    
    const processBatch = () => {
        const batch = allPoints.slice(processed, processed + batchSize);
        
        batch.forEach(point => {
            try {
                addAdminMarker(point);
            } catch (error) {
                console.warn('⚠️ Admin marker error:', error, point.id);
            }
        });
        
        processed += batchSize;
        
        if (processed < allPoints.length) {
            requestAnimationFrame(processBatch);
        } else {
            console.log('✅ Admin map updated with', adminMarkers.length, 'markers');
        }
    };
    
    processBatch();
    addAdminMarkerStyles();
}

// Быстрое добавление админского маркера
function addAdminMarker(point) {
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
    
    // Создаем popup с оптимизацией
    const popupContent = createAdminPopupContent(point, isScheduled, isCollected);
    marker.bindPopup(popupContent);
    
    adminMarkers.push(marker);
}

// Создание popup контента для админа
function createAdminPopupContent(point, isScheduled, isCollected) {
    let popupContent = `
        <div class="admin-popup">
            <h3>${escapeHtml(point.name)}</h3>
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
            <p><strong>Collector:</strong> ${escapeHtml(point.collectorInfo.name)}</p>
        `;
    }
    
    popupContent += `
            <div style="margin-top: 12px;">
                <button onclick="showQRCode('${point.id}')" class="admin-btn">Show QR</button>
                <button onclick="deletePoint('${point.id}')" class="admin-btn delete-btn">Delete</button>
            </div>
        </div>
    `;
    
    return popupContent;
}

// Быстрое экранирование HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStatusText(point, isScheduled) {
    if (point.status === 'collected') return '🔴 Collected';
    if (isScheduled) return '🟡 Scheduled';
    return '🟢 Available';
}

// БЫСТРОЕ обновление статистики
function updateAdminStats() {
    const now = new Date();
    const total = allPoints.length;
    const scheduled = allPoints.filter(p => new Date(p.scheduledTime) > now && p.status !== 'collected').length;
    const active = allPoints.filter(p => new Date(p.scheduledTime) <= now && p.status === 'available').length;
    
    // Быстрое обновление без анимации для админки
    requestAnimationFrame(() => {
        const totalEl = document.getElementById('totalPoints');
        const activeEl = document.getElementById('activePoints');
        const scheduledEl = document.getElementById('scheduledPoints');
        
        if (totalEl) totalEl.textContent = total;
        if (activeEl) activeEl.textContent = active;
        if (scheduledEl) scheduledEl.textContent = scheduled;
    });
}

// ОПТИМИЗИРОВАННОЕ обновление списка точек
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
    
    // Сортируем точки один раз
    const sortedPoints = [...allPoints].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Создаем HTML одним блоком для лучшей производительности
    const htmlParts = sortedPoints.map(point => {
        const now = new Date();
        const isScheduled = new Date(point.scheduledTime) > now;
        const statusClass = point.status === 'collected' ? 'collected' : (isScheduled ? 'scheduled' : 'available');
        
        return `
            <div class="point-item ${statusClass}">
                <div class="point-header">
                    <h4>${escapeHtml(point.name)}</h4>
                    <span class="point-status">${getStatusText(point, isScheduled)}</span>
                </div>
                <p><strong>ID:</strong> ${point.id}</p>
                <p><strong>Coordinates:</strong> ${point.coordinates.lat.toFixed(6)}, ${point.coordinates.lng.toFixed(6)}</p>
                <p><strong>Created:</strong> ${new Date(point.createdAt).toLocaleString('en-US')}</p>
                ${isScheduled ? `<p><strong>Will appear:</strong> ${new Date(point.scheduledTime).toLocaleString('en-US')}</p>` : ''}
                ${point.status === 'collected' ? `
                    <p><strong>Collected:</strong> ${new Date(point.collectedAt).toLocaleString('en-US')}</p>
                    <p><strong>Collector:</strong> ${escapeHtml(point.collectorInfo.name)}</p>
                ` : ''}
                <div class="point-actions">
                    <button onclick="showQRCode('${point.id}')" class="admin-btn">QR code</button>
                    <button onclick="deletePoint('${point.id}')" class="admin-btn delete-btn">Delete</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = htmlParts.join('');
}

// Переключение режима добавления
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
        showNotificationFast('Click on map to add point', 'info');
    } else {
        btn.textContent = 'Add mode: OFF';
        btn.classList.remove('active');
        if (adminMap) {
            adminMap.getContainer().style.cursor = '';
        }
    }
}

// Открытие модального окна добавления точки
function openAddPointModal(latlng) {
    window.tempCoordinates = latlng;
    const modal = document.getElementById('addPointModal');
    const input = document.getElementById('modelName');
    
    if (modal && input) {
        modal.style.display = 'block';
        input.focus();
    }
}

// Закрытие модального окна добавления
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

// ОПТИМИЗИРОВАННАЯ обработка добавления точки
async function handleAddPointSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('modelName').value;
    const delayMinutes = document.getElementById('delayMinutes').value;
    
    if (!window.tempCoordinates) {
        showNotificationFast('Coordinates error', 'error');
        return;
    }
    
    if (!name || !name.trim()) {
        showNotificationFast('Enter model name', 'error');
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
        showNotificationFast('Point successfully created!', 'success');
        
        if (responseData.qrCode) {
            showQRCodeForNewPoint(responseData);
        }
        
        // Очищаем кэш и перезагружаем
        adminCache.clear();
        await loadAdminPointsBackground();
        
    } catch (error) {
        console.error('❌ Point creation error:', error);
        showNotificationFast('Point creation error: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
        submitBtn.style.opacity = '';
    }
}

// Показ QR кода для новой точки
function showQRCodeForNewPoint(point) {
    currentQRCode = point.qrCode;
    
    const qrDisplay = document.getElementById('qrCodeDisplay');
    if (qrDisplay) {
        qrDisplay.innerHTML = `
            <img src="${point.qrCode}" alt="QR code for ${escapeHtml(point.name)}" style="max-width: 280px; border-radius: 12px;">
            <p style="font-weight: 600; margin-top: 15px;"><strong>${escapeHtml(point.name)}</strong></p>
            <p style="color: #666;">ID: ${point.id}</p>
        `;
    }
    
    const modal = document.getElementById('qrModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Показ QR кода существующей точки
function showQRCode(pointId) {
    const point = allPoints.find(p => p.id === pointId);
    if (!point) {
        showNotificationFast('Point not found', 'error');
        return;
    }
    
    currentQRCode = point.qrCode;
    
    const qrDisplay = document.getElementById('qrCodeDisplay');
    if (qrDisplay) {
        qrDisplay.innerHTML = `
            <img src="${point.qrCode}" alt="QR code for ${escapeHtml(point.name)}" style="max-width: 280px; border-radius: 12px;">
            <p style="font-weight: 600; margin-top: 15px;"><strong>${escapeHtml(point.name)}</strong></p>
            <p style="color: #666;">ID: ${pointId}</p>
        `;
    }
    
    const modal = document.getElementById('qrModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Закрытие QR модального окна
function closeQrModal() {
    const modal = document.getElementById('qrModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Скачивание QR кода
function downloadQR() {
    if (!currentQRCode) return;
    
    const link = document.createElement('a');
    link.download = `plasticboy-qr-${Date.now()}.png`;
    link.href = currentQRCode;
    link.click();
}

// ОПТИМИЗИРОВАННОЕ удаление точки
async function deletePoint(pointId) {
    if (!confirm('Are you sure you want to delete this point?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/points/${pointId}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Authorization': currentPassword
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete point');
        }
        
        showNotificationFast('Point deleted', 'success');
        
        // Очищаем кэш и перезагружаем
        adminCache.clear();
        await loadAdminPointsBackground();
        
    } catch (error) {
        console.error('❌ Point deletion error:', error);
        showNotificationFast('Point deletion error: ' + error.message, 'error');
    }
}

// БЫСТРОЕ определение местоположения админа
const getAdminLocation = debounce(function() {
    const locationBtn = document.querySelector('.location-btn');
    
    if (!navigator.geolocation) {
        showNotificationFast('Geolocation not supported', 'error');
        return;
    }
    
    if (!adminMap) {
        showNotificationFast('Map not ready', 'error');
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
                    width: 26px; height: 26px; border-radius: 50%; 
                    border: 3px solid white; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                    position: relative; transition: all 0.3s ease;
                ">
                    <div style="
                        position: absolute; top: -6px; left: -6px; right: -6px; bottom: -6px;
                        border-radius: 50%; border: 2px solid #667eea; opacity: 0.3;
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
                duration: 1.0
            });
            
            showNotificationFast('Location determined', 'success');
            
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
            locationBtn.style.opacity = '';
        },
        function(error) {
            console.error('Geolocation error:', error);
            showNotificationFast('Could not determine location', 'error');
            
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
            locationBtn.style.opacity = '';
        },
        {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 120000
        }
    );
}, 1000);

// Добавление стилей для пульса пользователя
function addAdminUserPulseStyles() {
    if (!document.getElementById('admin-user-pulse-styles')) {
        const style = document.createElement('style');
        style.id = 'admin-user-pulse-styles';
        style.textContent = `
            @keyframes adminUserPulse {
                0% { transform: scale(1); opacity: 0.7; }
                50% { opacity: 0.2; }
                100% { transform: scale(2.2); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Добавление стилей для админских маркеров
function addAdminMarkerStyles() {
    if (!document.getElementById('admin-marker-styles')) {
        const style = document.createElement('style');
        style.id = 'admin-marker-styles';
        style.textContent = `
            .admin-marker { background: none !important; border: none !important; }
            .admin-marker-dot {
                width: 32px; height: 32px; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                border: 3px solid white; box-shadow: 0 4px 15px rgba(0,0,0,0.25);
                font-size: 16px; color: white; font-weight: bold;
                transition: all 0.3s ease; cursor: pointer;
            }
            .admin-marker-dot:hover {
                transform: scale(1.1); box-shadow: 0 6px 20px rgba(0,0,0,0.35);
            }
            .admin-popup { min-width: 220px; }
            .admin-popup h3 { margin: 0 0 12px 0; color: #333; font-size: 1.1rem; font-weight: 600; }
            .admin-popup p { margin: 6px 0; font-size: 0.9rem; }
            .admin-btn {
                background: linear-gradient(45deg, #667eea, #764ba2); color: white;
                border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer;
                font-size: 0.85rem; margin: 6px 6px 0 0; min-width: 90px;
                transition: all 0.3s; font-weight: 500;
            }
            .admin-btn:hover {
                background: linear-gradient(45deg, #5a67d8, #6b46c1);
                transform: translateY(-1px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            }
            .delete-btn { background: linear-gradient(45deg, #f44336, #e53935) !important; }
            .delete-btn:hover {
                background: linear-gradient(45deg, #d32f2f, #c62828) !important;
                box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3) !important;
            }
        `;
        document.head.appendChild(style);
    }
}

// БЫСТРАЯ система уведомлений
function showNotificationFast(message, type = 'info') {
    console.log(`🔔 ${type.toUpperCase()}: ${message}`);
    
    // Удаляем старые уведомления того же типа
    document.querySelectorAll(`.notification-fast.${type}`).forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification-fast ${type}`;
    notification.innerHTML = `
        <div class="notification-content-fast">
            <span>${getNotificationIcon(type)} ${message}</span>
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Добавляем стили если их нет
    if (!document.getElementById('notification-styles-fast')) {
        const style = document.createElement('style');
        style.id = 'notification-styles-fast';
        style.textContent = `
            .notification-fast {
                position: fixed; top: 20px; right: 20px; z-index: 2000;
                background: rgba(255, 255, 255, 0.98); border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.15); backdrop-filter: blur(10px);
                padding: 16px; min-width: 280px; max-width: 400px;
                animation: slideInFast 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                border: 1px solid rgba(255,255,255,0.2); font-weight: 500;
            }
            .notification-fast.error { border-left: 4px solid #f44336; }
            .notification-fast.success { border-left: 4px solid #4CAF50; }
            .notification-fast.info { border-left: 4px solid #2196F3; }
            .notification-fast.warning { border-left: 4px solid #ff9800; }
            .notification-content-fast {
                display: flex; justify-content: space-between; align-items: center;
            }
            .notification-content-fast button {
                background: none; border: none; font-size: 1.3rem; cursor: pointer;
                color: #999; padding: 0; margin: 0; width: auto; margin-left: 12px;
                transition: color 0.3s;
            }
            .notification-content-fast button:hover { color: #666; }
            @keyframes slideInFast {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Автоматическое скрытие
    const hideTimeout = type === 'error' ? 5000 : (type === 'success' ? 2000 : 3000);
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideInFast 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, hideTimeout);
}

function getNotificationIcon(type) {
    const icons = { error: '❌', success: '✅', info: 'ℹ️', warning: '⚠️' };
    return icons[type] || icons.info;
}

// ГЛОБАЛЬНЫЕ ФУНКЦИИ для использования в HTML
window.adminLogin = adminLogin;
window.toggleAddMode = toggleAddMode;
window.getAdminLocation = getAdminLocation;
window.showQRCode = showQRCode;
window.deletePoint = deletePoint;
window.closeAddModal = closeAddModal;
window.closeQrModal = closeQrModal;
window.downloadQR = downloadQR;
}

// Загрузка с сервера
async function fetchAdminPointsFromServer() {
    try {
        const response = await fetch('/api/admin/points', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': currentPassword
            }
        });
        
        console.log('📡 Admin points response:', response.status);
        
        if (!response.ok) {
            if (response.status === 401) {
                showNotificationFast('Session expired', 'error');
                sessionStorage.removeItem('adminPassword');
                setTimeout(() => location.reload(), 2000);
                return;
            }
            throw new Error(`Server error: ${response.status}`);
        }
        
        allPoints = await response.json();
        console.log('✅ Loaded admin points:', allPoints.length);
        
        // Кэшируем
        adminCache.set('admin_points', allPoints);
        
        // Обновляем UI
        updateAdminMap();
        updateAdminStats();
        updatePointsList();
        
    } catch
