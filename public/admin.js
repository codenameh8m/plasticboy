// БЫСТРАЯ АДМИН ПАНЕЛЬ - admin-fast.js
// Исправлены все проблемы с производительностью

console.log('🛡️ Fast Admin Panel - v3.0 Loading');

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let adminMap = null;
let adminMarkers = [];
let isAddMode = false;
let currentPassword = '';
let allPoints = [];
let currentQRCode = '';
let isInitialized = false;
let isLoading = false;

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// КЭШИРОВАНИЕ АДМИН ДАННЫХ
const AdminCache = {
    key: 'plasticboy_admin_cache',
    ttl: 2 * 60 * 1000, // 2 минуты для админ данных
    
    save: function(data) {
        try {
            const item = {
                data: data,
                timestamp: Date.now()
            };
            localStorage.setItem(this.key, JSON.stringify(item));
            console.log('💾 Admin cache saved:', data.length, 'points');
        } catch (e) {
            console.warn('⚠️ Admin cache save error:', e);
        }
    },
    
    load: function() {
        try {
            const item = localStorage.getItem(this.key);
            if (!item) return null;
            
            const parsed = JSON.parse(item);
            const age = Date.now() - parsed.timestamp;
            
            if (age > this.ttl) {
                console.log('⏰ Admin cache expired');
                return null;
            }
            
            console.log('📦 Admin cache loaded:', parsed.data.length, 'points');
            return parsed.data;
        } catch (e) {
            console.warn('⚠️ Admin cache read error:', e);
            return null;
        }
    },
    
    clear: function() {
        localStorage.removeItem(this.key);
        console.log('🗑️ Admin cache cleared');
    }
};

// === БЫСТРАЯ ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM ready, starting FAST admin panel');
    
    // Проверяем сохраненный пароль немедленно
    const savedPassword = sessionStorage.getItem('adminPassword');
    if (savedPassword) {
        console.log('🔑 Auto-login with saved password');
        currentPassword = savedPassword;
        
        // Показываем панель сразу
        showAdminPanelFast();
        
        // Проверяем пароль в фоне (без блокировки UI)
        setTimeout(() => {
            checkPasswordQuiet(savedPassword).then(isValid => {
                if (!isValid) {
                    console.log('❌ Saved password invalid, logout');
                    logout();
                }
            });
        }, 100);
    }
    
    setupEventListeners();
});

// === БЫСТРЫЙ ПОКАЗ АДМИН ПАНЕЛИ ===
function showAdminPanelFast() {
    console.log('🛡️ Fast admin panel show');
    
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    
    // Загружаем из кэша сначала
    const cachedPoints = AdminCache.load();
    if (cachedPoints) {
        allPoints = cachedPoints;
        updateAdminStats();
        updatePointsList();
        showNotification('Данные загружены из кэша', 'info');
    }
    
    // Инициализируем карту быстро
    initAdminMapFast().then(() => {
        if (cachedPoints) {
            updateAdminMap();
        }
        // Загружаем свежие данные в фоне
        loadAdminPointsBackground();
    }).catch(error => {
        console.error('❌ Fast map init failed:', error);
        showNotification('Ошибка инициализации карты', 'error');
    });
}

// === БЫСТРАЯ ИНИЦИАЛИЗАЦИЯ КАРТЫ ===
function initAdminMapFast() {
    return new Promise((resolve, reject) => {
        console.log('🗺️ Fast admin map init');
        
        // Проверяем Leaflet немедленно
        if (typeof L === 'undefined') {
            reject(new Error('Leaflet not loaded'));
            return;
        }
        
        const mapElement = document.getElementById('adminMap');
        if (!mapElement) {
            reject(new Error('Map element not found'));
            return;
        }
        
        try {
            // Удаляем старую карту если есть
            if (adminMap) {
                adminMap.remove();
                adminMap = null;
            }
            
            // Создаем карту с минимальными настройками
            adminMap = L.map('adminMap', {
                center: ALMATY_CENTER,
                zoom: 13,
                zoomControl: true,
                preferCanvas: true,
                attributionControl: false // Убираем attribution для скорости
            });
            
            // Добавляем тайлы
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
                tileSize: 256
            }).addTo(adminMap);
            
            // Клик для добавления точек
            adminMap.on('click', function(e) {
                if (isAddMode) {
                    openAddPointModal(e.latlng);
                }
            });
            
            // Быстрое разрешение без ожидания
            setTimeout(() => {
                if (adminMap) {
                    adminMap.invalidateSize();
                    isInitialized = true;
                    console.log('✅ Fast admin map ready');
                    resolve();
                }
            }, 100); // Минимальная задержка
            
        } catch (error) {
            console.error('❌ Fast map creation error:', error);
            reject(error);
        }
    });
}

// === БЫСТРЫЙ ВХОД ===
async function adminLogin() {
    const password = document.getElementById('adminPassword').value;
    const loginBtn = document.getElementById('loginBtn');
    
    if (!password) {
        showLoginError('Введите пароль');
        return;
    }
    
    loginBtn.disabled = true;
    loginBtn.textContent = 'Вход...';
    hideLoginError();
    
    console.log('🔐 Fast login attempt');
    
    try {
        // Сразу показываем панель для быстроты
        currentPassword = password;
        sessionStorage.setItem('adminPassword', password);
        showAdminPanelFast();
        
        // Проверяем пароль в фоне
        const isValid = await checkPasswordFast(password);
        
        if (!isValid) {
            // Если пароль неверный, возвращаемся к логину
            sessionStorage.removeItem('adminPassword');
            currentPassword = '';
            document.getElementById('adminPanel').style.display = 'none';
            document.getElementById('loginForm').style.display = 'block';
            showLoginError('Неверный пароль администратора');
        } else {
            console.log('✅ Fast login successful');
            showNotification('Добро пожаловать!', 'success');
        }
        
    } catch (error) {
        console.error('❌ Fast login error:', error);
        showLoginError('Ошибка входа: ' + error.message);
        
        // Возвращаемся к логину при ошибке
        sessionStorage.removeItem('adminPassword');
        currentPassword = '';
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Войти';
    }
}

// === БЫСТРАЯ ПРОВЕРКА ПАРОЛЯ ===
async function checkPasswordFast(password) {
    try {
        console.log('🔐 Fast password check');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд максимум
        
        const response = await fetch('/api/admin/points?quick=1', {
            method: 'GET',
            headers: {
                'Authorization': password
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.status === 401) {
            return false;
        }
        
        if (response.status === 200) {
            return true;
        }
        
        throw new Error(`Server error: ${response.status}`);
        
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Timeout (5s)');
        }
        throw error;
    }
}

// === ТИХАЯ ПРОВЕРКА ПАРОЛЯ (БЕЗ UI БЛОКИРОВКИ) ===
async function checkPasswordQuiet(password) {
    try {
        const response = await fetch('/api/admin/points?quick=1', {
            method: 'GET',
            headers: { 'Authorization': password }
        });
        return response.status === 200;
    } catch (error) {
        console.error('❌ Quiet password check failed:', error);
        return false;
    }
}

// === ЗАГРУЗКА ТОЧЕК В ФОНЕ ===
async function loadAdminPointsBackground() {
    if (isLoading) return;
    
    isLoading = true;
    console.log('📍 Loading admin points in background');
    
    try {
        const response = await fetch('/api/admin/points', {
            method: 'GET',
            headers: { 'Authorization': currentPassword }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                console.log('❌ Session expired');
                logout();
                return;
            }
            throw new Error(`Server error: ${response.status}`);
        }
        
        const points = await response.json();
        console.log('✅ Background points loaded:', points.length);
        
        // Сохраняем в кэш
        AdminCache.save(points);
        
        allPoints = points;
        updateAdminMap();
        updateAdminStats();
        updatePointsList();
        
        showNotification('Данные обновлены', 'success');
        
    } catch (error) {
        console.error('❌ Background points loading error:', error);
        showNotification('Ошибка обновления данных', 'warning');
    } finally {
        isLoading = false;
    }
}

// === БЫСТРОЕ ОБНОВЛЕНИЕ КАРТЫ ===
function updateAdminMap() {
    if (!adminMap || !allPoints) {
        console.warn('⚠️ Map or points not ready');
        return;
    }
    
    console.log('🗺️ Fast admin map update:', allPoints.length, 'points');
    
    // Быстрая очистка маркеров
    adminMarkers.forEach(marker => {
        adminMap.removeLayer(marker);
    });
    adminMarkers = [];
    
    // Быстрое добавление маркеров
    allPoints.forEach(point => {
        try {
            const marker = createAdminMarkerFast(point);
            if (marker) {
                adminMap.addLayer(marker);
                adminMarkers.push(marker);
            }
        } catch (error) {
            console.error('❌ Marker creation error:', error);
        }
    });
    
    console.log('✅ Fast map update complete:', adminMarkers.length, 'markers');
}

// === БЫСТРОЕ СОЗДАНИЕ МАРКЕРА ===
function createAdminMarkerFast(point) {
    const now = new Date();
    const isScheduled = new Date(point.scheduledTime) > now;
    const isCollected = point.status === 'collected';
    
    let iconColor = '#4CAF50'; // зеленый
    let iconEmoji = '📦';
    
    if (isCollected) {
        iconColor = '#f44336'; // красный
        iconEmoji = '✅';
    } else if (isScheduled) {
        iconColor = '#ff9800'; // оранжевый
        iconEmoji = '⏱️';
    }
    
    const icon = L.divIcon({
        className: 'admin-marker-fast',
        html: `<div style="
            background: ${iconColor};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            font-size: 12px;
            color: white;
        ">${iconEmoji}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    
    const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon });
    
    // Быстрый popup
    const popupContent = createFastPopupContent(point, isScheduled);
    marker.bindPopup(popupContent, { maxWidth: 250 });
    
    return marker;
}

// === БЫСТРЫЙ POPUP ===
function createFastPopupContent(point, isScheduled) {
    const statusText = point.status === 'collected' ? '🔴 Собрано' : 
                      isScheduled ? '🟡 Запланировано' : '🟢 Доступно';
    
    return `
        <div style="text-align: center;">
            <h4 style="margin: 0 0 8px 0;">${point.name}</h4>
            <p style="margin: 4px 0; color: #666;">${statusText}</p>
            <p style="margin: 4px 0; font-size: 0.8rem; color: #999;">ID: ${point.id}</p>
            <div style="margin-top: 10px;">
                <button onclick="showQRCode('${point.id}')" style="
                    background: #667eea; color: white; border: none; 
                    padding: 4px 8px; border-radius: 4px; cursor: pointer;
                    font-size: 0.8rem; margin: 2px;">QR</button>
                <button onclick="deletePoint('${point.id}')" style="
                    background: #f44336; color: white; border: none;
                    padding: 4px 8px; border-radius: 4px; cursor: pointer;
                    font-size: 0.8rem; margin: 2px;">Удалить</button>
            </div>
        </div>
    `;
}

// === БЫСТРОЕ ОБНОВЛЕНИЕ СТАТИСТИКИ ===
function updateAdminStats() {
    const now = new Date();
    const total = allPoints.length;
    const scheduled = allPoints.filter(p => new Date(p.scheduledTime) > now && p.status !== 'collected').length;
    const active = allPoints.filter(p => new Date(p.scheduledTime) <= now && p.status === 'available').length;
    
    // Прямое обновление без анимации для скорости
    const totalEl = document.getElementById('totalPoints');
    const activeEl = document.getElementById('activePoints');
    const scheduledEl = document.getElementById('scheduledPoints');
    
    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (scheduledEl) scheduledEl.textContent = scheduled;
}

// === БЫСТРОЕ ОБНОВЛЕНИЕ СПИСКА ===
function updatePointsList() {
    const container = document.getElementById('pointsList');
    if (!container) return;
    
    if (allPoints.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px;">Точки не созданы</p>';
        return;
    }
    
    // Показываем только последние 10 для скорости
    const recentPoints = [...allPoints]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);
    
    container.innerHTML = recentPoints.map(point => {
        const now = new Date();
        const isScheduled = new Date(point.scheduledTime) > now;
        const statusText = point.status === 'collected' ? '🔴 Собрано' : 
                          isScheduled ? '🟡 Запланировано' : '🟢 Доступно';
        
        return `
            <div style="
                background: #f8f9fa; padding: 10px; margin: 5px 0; 
                border-radius: 8px; border-left: 3px solid #667eea;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>${point.name}</strong>
                    <span style="font-size: 0.8rem;">${statusText}</span>
                </div>
                <div style="font-size: 0.8rem; color: #666; margin-top: 4px;">
                    ID: ${point.id} • ${new Date(point.createdAt).toLocaleDateString()}
                </div>
                <div style="margin-top: 8px;">
                    <button onclick="showQRCode('${point.id}')" style="
                        background: #667eea; color: white; border: none;
                        padding: 4px 8px; border-radius: 4px; cursor: pointer;
                        font-size: 0.8rem; margin-right: 5px;">QR</button>
                    <button onclick="deletePoint('${point.id}')" style="
                        background: #f44336; color: white; border: none;
                        padding: 4px 8px; border-radius: 4px; cursor: pointer;
                        font-size: 0.8rem;">Удалить</button>
                </div>
            </div>
        `;
    }).join('');
    
    if (allPoints.length > 10) {
        container.innerHTML += `<p style="text-align: center; color: #666; font-size: 0.8rem; margin-top: 10px;">
            Показано последние 10 из ${allPoints.length} точек
        </p>`;
    }
}

// === ОСТАЛЬНЫЕ ФУНКЦИИ (УПРОЩЕННЫЕ) ===

function setupEventListeners() {
    // Пароль
    const passwordInput = document.getElementById('adminPassword');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') adminLogin();
        });
    }

    // Форма добавления
    const form = document.getElementById('addPointForm');
    if (form) {
        form.addEventListener('submit', handleAddPointSubmit);
    }

    // Горячие клавиши
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeAddModal();
            closeQrModal();
        }
    });
}

function toggleAddMode() {
    isAddMode = !isAddMode;
    const btn = document.getElementById('addModeBtn');
    
    if (isAddMode) {
        btn.textContent = 'Режим добавления: ВКЛ';
        btn.style.background = '#f44336';
        if (adminMap) adminMap.getContainer().style.cursor = 'crosshair';
        showNotification('Кликните на карте для добавления точки', 'info');
    } else {
        btn.textContent = 'Режим добавления: ВЫКЛ';
        btn.style.background = '#4CAF50';
        if (adminMap) adminMap.getContainer().style.cursor = '';
    }
}

function openAddPointModal(latlng) {
    window.tempCoordinates = latlng;
    document.getElementById('addPointModal').style.display = 'block';
    setTimeout(() => document.getElementById('modelName').focus(), 100);
}

function closeAddModal() {
    document.getElementById('addPointModal').style.display = 'none';
    document.getElementById('addPointForm').reset();
}

function closeQrModal() {
    document.getElementById('qrModal').style.display = 'none';
}

async function handleAddPointSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('modelName').value;
    const delayMinutes = document.getElementById('delayMinutes').value;
    const submitBtn = document.getElementById('createPointBtn');
    
    if (!window.tempCoordinates || !name.trim()) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Создание...';
    
    try {
        const response = await fetch('/api/admin/points', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': currentPassword
            },
            body: JSON.stringify({
                name: name.trim(),
                coordinates: {
                    lat: parseFloat(window.tempCoordinates.lat),
                    lng: parseFloat(window.tempCoordinates.lng)
                },
                delayMinutes: delayMinutes ? parseInt(delayMinutes) : 0
            })
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        const responseData = await response.json();
        
        closeAddModal();
        showNotification('Точка создана!', 'success');
        
        // Показываем QR и обновляем данные
        if (responseData.qrCode) {
            setTimeout(() => showQRCode(responseData.id, responseData.qrCode), 500);
        }
        
        // Очищаем кэш и перезагружаем
        AdminCache.clear();
        loadAdminPointsBackground();
        
    } catch (error) {
        console.error('❌ Point creation error:', error);
        showNotification('Ошибка создания: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Создать точку';
    }
}

function showQRCode(pointId, qrCodeData = null) {
    if (qrCodeData) {
        currentQRCode = qrCodeData;
        displayQRModal(qrCodeData, pointId);
        return;
    }
    
    const point = allPoints.find(p => p.id === pointId);
    if (!point) {
        showNotification('Точка не найдена', 'error');
        return;
    }
    
    currentQRCode = point.qrCode;
    displayQRModal(point.qrCode, pointId, point.name);
}

function displayQRModal(qrCode, pointId, pointName = '') {
    const qrDisplay = document.getElementById('qrCodeDisplay');
    if (qrDisplay) {
        qrDisplay.innerHTML = `
            <img src="${qrCode}" alt="QR код" style="max-width: 200px; border-radius: 8px;">
            ${pointName ? `<p style="margin-top: 10px;"><strong>${pointName}</strong></p>` : ''}
            <p style="color: #666; font-size: 0.8rem;">ID: ${pointId}</p>
        `;
    }
    document.getElementById('qrModal').style.display = 'block';
}

async function deletePoint(pointId) {
    if (!confirm('Удалить эту точку?')) return;
    
    try {
        const response = await fetch(`/api/admin/points/${pointId}`, {
            method: 'DELETE',
            headers: { 'Authorization': currentPassword }
        });
        
        if (!response.ok) {
            throw new Error('Ошибка удаления');
        }
        
        showNotification('Точка удалена', 'success');
        
        // Очищаем кэш и перезагружаем
        AdminCache.clear();
        loadAdminPointsBackground();
        
    } catch (error) {
        console.error('❌ Delete error:', error);
        showNotification('Ошибка удаления: ' + error.message, 'error');
    }
}

function logout() {
    sessionStorage.removeItem('adminPassword');
    AdminCache.clear();
    currentPassword = '';
    allPoints = [];
    
    if (adminMap) {
        adminMap.remove();
        adminMap = null;
    }
    
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('adminPassword').value = '';
    hideLoginError();
}

function showLoginError(message) {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

function hideLoginError() {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

function downloadQR() {
    if (!currentQRCode) return;
    
    const link = document.createElement('a');
    link.download = `plasticboy-qr-${Date.now()}.png`;
    link.href = currentQRCode;
    link.click();
}

function getAdminLocation() {
    if (!navigator.geolocation || !adminMap) {
        showNotification('Геолокация недоступна', 'error');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            adminMap.flyTo([position.coords.latitude, position.coords.longitude], 16);
            showNotification('Местоположение найдено', 'success');
        },
        () => showNotification('Ошибка геолокации', 'error')
    );
}

// Быстрые уведомления
function showNotification(message, type = 'info') {
    console.log(`🔔 ${type}: ${message}`);
    
    // Простое уведомление без сложной анимации
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 2000;
        background: white; border-radius: 8px; padding: 15px; max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-left: 4px solid #667eea;
        font-size: 0.9rem; cursor: pointer;
    `;
    
    if (type === 'error') notification.style.borderLeftColor = '#f44336';
    if (type === 'success') notification.style.borderLeftColor = '#4CAF50';
    if (type === 'warning') notification.style.borderLeftColor = '#ff9800';
    
    notification.textContent = message;
    notification.onclick = () => notification.remove();
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 4000);
}

// === ГЛОБАЛЬНЫЕ ФУНКЦИИ ===
window.adminLogin = adminLogin;
window.toggleAddMode = toggleAddMode;
window.getAdminLocation = getAdminLocation;
window.showQRCode = showQRCode;
window.deletePoint = deletePoint;
window.closeAddModal = closeAddModal;
window.closeQrModal = closeQrModal;
window.downloadQR = downloadQR;

console.log('🛡️ Fast Admin Panel - Ready to rock! 🚀');
