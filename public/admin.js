// ИСПРАВЛЕННАЯ АДМИН ПАНЕЛЬ - admin.js
// Полностью переписанная версия без багов

console.log('🛡️ Admin Panel - Fixed Version v2.0');

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let adminMap = null;
let adminMarkers = [];
let isAddMode = false;
let currentPassword = '';
let allPoints = [];
let currentQRCode = '';
let isInitialized = false;
let isLoading = false;
let loginAttempts = 0;
const MAX_LOGIN_ATTEMPTS = 3;

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// === ИНИЦИАЛИЗАЦИЯ - FAST VERSION ===
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM готов, быстрый запуск админ панели');
    
    // Проверяем сохраненный пароль немедленно
    const savedPassword = sessionStorage.getItem('adminPassword');
    if (savedPassword) {
        console.log('🔑 Найден сохраненный пароль, быстрый автовход');
        currentPassword = savedPassword;
        
        // Показываем панель сразу, проверяем в фоне
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        
        // Быстрая проверка в фоне
        checkPassword(savedPassword)
            .then(isValid => {
                if (isValid) {
                    initAdminMapWithRetry().then(() => loadAdminPoints());
                } else {
                    logout();
                }
            })
            .catch(() => logout());
    }
    
    setupEventListeners();
    console.log('✅ Админ панель инициализирована');
});

// === ОБРАБОТЧИКИ СОБЫТИЙ ===
function setupEventListeners() {
    // Обработчик поля пароля
    const passwordInput = document.getElementById('adminPassword');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                adminLogin();
            }
        });
        
        passwordInput.addEventListener('input', hideLoginError);
    }

    // Обработчик формы добавления точки
    const form = document.getElementById('addPointForm');
    if (form) {
        form.addEventListener('submit', handleAddPointSubmit);
    }

    // Закрытие модальных окон
    window.addEventListener('click', function(event) {
        const addModal = document.getElementById('addPointModal');
        const qrModal = document.getElementById('qrModal');
        
        if (event.target === addModal) closeAddModal();
        if (event.target === qrModal) closeQrModal();
    });

    // Горячие клавиши
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeAddModal();
            closeQrModal();
        }
        
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel && adminPanel.style.display !== 'none') {
            if (event.ctrlKey && event.key === 'l') {
                event.preventDefault();
                getAdminLocation();
            }
            
            if (event.ctrlKey && event.key === 'a') {
                event.preventDefault();
                toggleAddMode();
            }
        }
    });

    // Изменение размера окна
    window.addEventListener('resize', debounce(() => {
        if (adminMap) {
            adminMap.invalidateSize();
        }
    }, 150));
}

// === ФУНКЦИИ ВХОДА - FAST VERSION ===
async function adminLogin() {
    const password = document.getElementById('adminPassword').value;
    const loginBtn = document.getElementById('loginBtn');
    
    if (!password) {
        showLoginError('Введите пароль');
        return;
    }
    
    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        showLoginError('Превышено количество попыток входа. Попробуйте позже.');
        return;
    }
    
    // Блокируем кнопку
    loginBtn.disabled = true;
    loginBtn.textContent = 'Проверка...';
    hideLoginError();
    
    try {
        loginAttempts++;
        console.log(`🔐 Быстрая попытка входа ${loginAttempts}/${MAX_LOGIN_ATTEMPTS}`);
        
        const isValid = await checkPassword(password);
        
        if (isValid) {
            loginAttempts = 0; // Сброс счетчика при успехе
            currentPassword = password;
            sessionStorage.setItem('adminPassword', password);
            await showAdminPanel();
        } else {
            showLoginError('Неверный пароль администратора');
            sessionStorage.removeItem('adminPassword');
            currentPassword = '';
            
            if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
                showLoginError('Превышено количество попыток. Попробуйте позже.');
                setTimeout(() => { loginAttempts = 0; }, 30000); // Разблокировка через 30 сек
            }
        }
    } catch (error) {
        console.error('❌ Ошибка входа:', error);
        
        if (error.message.includes('timeout')) {
            showLoginError('Сервер не отвечает (3с). Попробуйте еще раз.');
        } else {
            showLoginError('Ошибка соединения: ' + error.message);
        }
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Войти';
    }
}

async function checkPassword(password) {
    try {
        console.log('🔐 Быстрая проверка пароля...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 секунды
        
        const response = await fetch('/api/admin/points', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': password
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('📡 Быстрый ответ:', response.status);
        
        // Простая проверка статуса
        if (response.status === 401) {
            return false;
        }
        
        if (response.status === 200) {
            return true;
        }
        
        throw new Error(`Ошибка сервера: ${response.status}`);
        
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('timeout (3s)');
        }
        console.error('❌ Ошибка проверки пароля:', error);
        throw error;
    }
}

async function validatePasswordAndShowPanel(password) {
    try {
        const isValid = await checkPasswordWithTimeout(password, 10000);
        
        if (isValid) {
            currentPassword = password;
            sessionStorage.setItem('adminPassword', password);
            await showAdminPanel();
        } else {
            logout();
        }
    } catch (error) {
        console.error('❌ Ошибка валидации пароля:', error);
        logout();
    }
}

// === ПОКАЗ АДМИН ПАНЕЛИ ===
async function showAdminPanel() {
    try {
        console.log('🛡️ Показ админ панели...');
        
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        
        // Инициализация карты с повторными попытками
        await initAdminMapWithRetry(3);
        
        // Загрузка точек
        await loadAdminPoints();
        
        console.log('✅ Админ панель готова');
        showNotification('Добро пожаловать в админ панель!', 'success');
        
    } catch (error) {
        console.error('❌ Ошибка инициализации админ панели:', error);
        showNotification('Ошибка инициализации: ' + error.message, 'error');
        logout();
    }
}

// === ИНИЦИАЛИЗАЦИЯ КАРТЫ ===
async function initAdminMapWithRetry(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🗺️ Попытка инициализации карты ${attempt}/${maxRetries}`);
            await initAdminMap();
            return;
        } catch (error) {
            console.error(`❌ Попытка ${attempt} не удалась:`, error);
            
            if (attempt === maxRetries) {
                throw new Error(`Не удалось инициализировать карту после ${maxRetries} попыток`);
            }
            
            // Ждем перед повторной попыткой
            await sleep(1000 * attempt);
        }
    }
}

function initAdminMap() {
    return new Promise((resolve, reject) => {
        try {
            console.log('🗺️ Создание админ карты...');
            
            // Проверяем доступность Leaflet
            if (typeof L === 'undefined') {
                throw new Error('Leaflet не загружен');
            }
            
            const mapElement = document.getElementById('adminMap');
            if (!mapElement) {
                throw new Error('Элемент карты не найден');
            }
            
            // Удаляем существующую карту
            if (adminMap) {
                adminMap.remove();
                adminMap = null;
            }
            
            // Создаем карту
            adminMap = L.map('adminMap', {
                center: ALMATY_CENTER,
                zoom: 13,
                zoomControl: true,
                preferCanvas: true,
                attributionControl: true
            });
            
            // Добавляем тайлы
            const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18,
                tileSize: 256,
                crossOrigin: true
            });
            
            tileLayer.addTo(adminMap);
            
            // Обработчик клика для добавления точек
            adminMap.on('click', function(e) {
                if (isAddMode) {
                    openAddPointModal(e.latlng);
                }
            });
            
            // Ждем готовности карты
            adminMap.whenReady(() => {
                setTimeout(() => {
                    if (adminMap) {
                        adminMap.invalidateSize();
                        isInitialized = true;
                        console.log('✅ Админ карта готова');
                        resolve();
                    }
                }, 500);
            });
            
            // Обработка ошибок загрузки тайлов
            tileLayer.on('tileerror', (e) => {
                console.warn('⚠️ Ошибка загрузки тайла:', e);
            });
            
        } catch (error) {
            console.error('❌ Ошибка создания карты:', error);
            reject(error);
        }
    });
}

// === ЗАГРУЗКА ТОЧЕК ===
async function loadAdminPoints() {
    if (isLoading) {
        console.log('⏳ Загрузка точек уже выполняется');
        return;
    }
    
    isLoading = true;
    
    try {
        console.log('📍 Загрузка админ точек...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch('/api/admin/points', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': currentPassword
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('📡 Ответ загрузки точек:', response.status);
        
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Недействительный пароль');
            }
            throw new Error(`Ошибка сервера: ${response.status}`);
        }
        
        allPoints = await response.json();
        console.log('✅ Загружено админ точек:', allPoints.length);
        
        updateAdminMap();
        updateAdminStats();
        updatePointsList();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки точек:', error);
        
        if (error.name === 'AbortError') {
            showNotification('Превышено время ожидания загрузки точек', 'error');
        } else if (error.message.includes('Недействительный пароль')) {
            showNotification('Сессия истекла. Войдите заново.', 'error');
            logout();
        } else {
            showNotification('Ошибка загрузки точек: ' + error.message, 'error');
        }
    } finally {
        isLoading = false;
    }
}

// === ОБНОВЛЕНИЕ КАРТЫ ===
function updateAdminMap() {
    if (!adminMap || !allPoints) {
        console.warn('⚠️ Карта или точки не готовы для обновления');
        return;
    }
    
    console.log('🗺️ Обновление карты с', allPoints.length, 'точками');
    
    try {
        // Очищаем существующие маркеры
        adminMarkers.forEach(marker => {
            if (adminMap.hasLayer(marker)) {
                adminMap.removeLayer(marker);
            }
        });
        adminMarkers = [];
        
        // Добавляем новые маркеры
        allPoints.forEach((point, index) => {
            try {
                const marker = createAdminMarker(point);
                if (marker) {
                    marker.addTo(adminMap);
                    adminMarkers.push(marker);
                }
            } catch (error) {
                console.error('❌ Ошибка создания маркера:', error, point);
            }
        });
        
        console.log('✅ Добавлено', adminMarkers.length, 'админ маркеров');
        
    } catch (error) {
        console.error('❌ Ошибка обновления карты:', error);
    }
}

function createAdminMarker(point) {
    const now = new Date();
    const isScheduled = new Date(point.scheduledTime) > now;
    const isCollected = point.status === 'collected';
    
    let iconColor = '#4CAF50'; // зеленый для доступных
    let iconEmoji = '📦';
    
    if (isCollected) {
        iconColor = '#f44336'; // красный для собранных
        iconEmoji = '✅';
    } else if (isScheduled) {
        iconColor = '#ff9800'; // оранжевый для запланированных
        iconEmoji = '⏱️';
    }
    
    const icon = L.divIcon({
        className: 'admin-marker',
        html: `<div class="admin-marker-dot" style="
            background: ${iconColor};
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
        ">${iconEmoji}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });
    
    const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon });
    
    // Содержимое попапа
    const popupContent = createAdminPopupContent(point, isScheduled);
    marker.bindPopup(popupContent, { maxWidth: 300 });
    
    return marker;
}

function createAdminPopupContent(point, isScheduled) {
    let content = `
        <div class="admin-popup">
            <h3>${escapeHtml(point.name)}</h3>
            <p><strong>ID:</strong> ${escapeHtml(point.id)}</p>
            <p><strong>Статус:</strong> ${getStatusText(point, isScheduled)}</p>
            <p><strong>Создано:</strong> ${new Date(point.createdAt).toLocaleString('ru-RU')}</p>
    `;
    
    if (isScheduled) {
        content += `<p><strong>Появится:</strong> ${new Date(point.scheduledTime).toLocaleString('ru-RU')}</p>`;
    }
    
    if (point.status === 'collected' && point.collectorInfo) {
        content += `
            <p><strong>Собрано:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>
            <p><strong>Сборщик:</strong> ${escapeHtml(point.collectorInfo.name)}</p>
        `;
    }
    
    content += `
            <div style="margin-top: 12px;">
                <button onclick="showQRCode('${escapeHtml(point.id)}')" class="admin-btn">Показать QR</button>
                <button onclick="deletePoint('${escapeHtml(point.id)}')" class="admin-btn delete-btn">Удалить</button>
            </div>
        </div>
    `;
    
    return content;
}

function getStatusText(point, isScheduled) {
    if (point.status === 'collected') return '🔴 Собрано';
    if (isScheduled) return '🟡 Запланировано';
    return '🟢 Доступно';
}

// === СТАТИСТИКА ===
function updateAdminStats() {
    const now = new Date();
    const total = allPoints.length;
    const scheduled = allPoints.filter(p => new Date(p.scheduledTime) > now && p.status !== 'collected').length;
    const active = allPoints.filter(p => new Date(p.scheduledTime) <= now && p.status === 'available').length;
    
    animateNumber(document.getElementById('totalPoints'), total);
    animateNumber(document.getElementById('activePoints'), active);
    animateNumber(document.getElementById('scheduledPoints'), scheduled);
}

// === СПИСОК ТОЧЕК ===
function updatePointsList() {
    const container = document.getElementById('pointsList');
    
    if (!container) {
        console.warn('⚠️ Контейнер списка точек не найден');
        return;
    }
    
    if (allPoints.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Точки не созданы</p>';
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
                    <h4>${escapeHtml(point.name)}</h4>
                    <span class="point-status">${getStatusText(point, isScheduled)}</span>
                </div>
                <p><strong>ID:</strong> ${escapeHtml(point.id)}</p>
                <p><strong>Координаты:</strong> ${point.coordinates.lat.toFixed(6)}, ${point.coordinates.lng.toFixed(6)}</p>
                <p><strong>Создано:</strong> ${new Date(point.createdAt).toLocaleString('ru-RU')}</p>
                ${isScheduled ? `<p><strong>Появится:</strong> ${new Date(point.scheduledTime).toLocaleString('ru-RU')}</p>` : ''}
                ${point.status === 'collected' && point.collectorInfo ? `
                    <p><strong>Собрано:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>
                    <p><strong>Сборщик:</strong> ${escapeHtml(point.collectorInfo.name)}</p>
                ` : ''}
                <div class="point-actions">
                    <button onclick="showQRCode('${escapeHtml(point.id)}')" class="admin-btn">QR код</button>
                    <button onclick="deletePoint('${escapeHtml(point.id)}')" class="admin-btn delete-btn">Удалить</button>
                </div>
            </div>
        `;
    }).join('');
}

// === РЕЖИМ ДОБАВЛЕНИЯ ===
function toggleAddMode() {
    isAddMode = !isAddMode;
    const btn = document.getElementById('addModeBtn');
    
    if (!btn) {
        console.warn('⚠️ Кнопка режима добавления не найдена');
        return;
    }
    
    if (isAddMode) {
        btn.textContent = 'Режим добавления: ВКЛ';
        btn.classList.add('active');
        if (adminMap) {
            adminMap.getContainer().style.cursor = 'crosshair';
        }
        showNotification('Кликните на карте для добавления точки', 'info');
    } else {
        btn.textContent = 'Режим добавления: ВЫКЛ';
        btn.classList.remove('active');
        if (adminMap) {
            adminMap.getContainer().style.cursor = '';
        }
    }
}

// === МОДАЛЬНЫЕ ОКНА ===
function openAddPointModal(latlng) {
    window.tempCoordinates = latlng;
    const modal = document.getElementById('addPointModal');
    const input = document.getElementById('modelName');
    
    if (modal && input) {
        modal.style.display = 'block';
        setTimeout(() => input.focus(), 100);
    }
}

function closeAddModal() {
    const modal = document.getElementById('addPointModal');
    const form = document.getElementById('addPointForm');
    
    if (modal) modal.style.display = 'none';
    if (form) form.reset();
    
    // Сброс состояния кнопки
    const btn = document.getElementById('createPointBtn');
    if (btn) {
        btn.disabled = false;
        btn.textContent = 'Создать точку';
    }
}

function closeQrModal() {
    const modal = document.getElementById('qrModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// === ОБРАБОТКА ФОРМЫ ДОБАВЛЕНИЯ ===
async function handleAddPointSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('modelName').value;
    const delayMinutes = document.getElementById('delayMinutes').value;
    const submitBtn = document.getElementById('createPointBtn');
    
    if (!window.tempCoordinates) {
        showNotification('Ошибка координат', 'error');
        return;
    }
    
    if (!name || !name.trim()) {
        showNotification('Введите название модели', 'error');
        return;
    }
    
    // Блокируем кнопку
    submitBtn.disabled = true;
    submitBtn.textContent = 'Создание...';
    
    try {
        const requestData = {
            name: name.trim(),
            coordinates: {
                lat: parseFloat(window.tempCoordinates.lat),
                lng: parseFloat(window.tempCoordinates.lng)
            },
            delayMinutes: delayMinutes ? parseInt(delayMinutes) : 0
        };
        
        console.log('📤 Создание точки:', requestData);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch('/api/admin/points', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': currentPassword
            },
            body: JSON.stringify(requestData),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Сессия истекла');
            }
            
            const errorData = await response.json();
            throw new Error(errorData.error || `Ошибка сервера: ${response.status}`);
        }
        
        const responseData = await response.json();
        console.log('✅ Точка создана:', responseData);
        
        closeAddModal();
        showNotification('Точка успешно создана!', 'success');
        
        // Показываем QR код
        if (responseData.qrCode) {
            setTimeout(() => showQRCode(responseData.id, responseData.qrCode), 500);
        }
        
        // Перезагружаем точки
        await loadAdminPoints();
        
    } catch (error) {
        console.error('❌ Ошибка создания точки:', error);
        
        if (error.name === 'AbortError') {
            showNotification('Превышено время ожидания создания точки', 'error');
        } else if (error.message.includes('Сессия истекла')) {
            showNotification('Сессия истекла. Войдите заново.', 'error');
            logout();
        } else {
            showNotification('Ошибка создания: ' + error.message, 'error');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Создать точку';
    }
}

// === ГЕОЛОКАЦИЯ ===
function getAdminLocation() {
    const locationBtn = document.querySelector('.location-btn');
    
    if (!navigator.geolocation) {
        showNotification('Геолокация не поддерживается', 'error');
        return;
    }
    
    if (!adminMap) {
        showNotification('Карта не готова', 'error');
        return;
    }
    
    const originalText = locationBtn.innerHTML;
    locationBtn.innerHTML = '⏳ Определение...';
    locationBtn.disabled = true;
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Удаляем предыдущий маркер
            if (window.adminUserMarker) {
                adminMap.removeLayer(window.adminUserMarker);
            }
            
            // Создаем маркер пользователя
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
            
            // Добавляем стили анимации
            addAdminUserPulseStyles();
            
            window.adminUserMarker = L.marker([lat, lng], { icon: userIcon }).addTo(adminMap);
            adminMap.flyTo([lat, lng], 16, {
                duration: 1.5,
                easeLinearity: 0.5
            });
            
            showNotification('Местоположение определено', 'success');
            
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
        },
        function(error) {
            console.error('❌ Ошибка геолокации:', error);
            
            let errorMessage = 'Не удалось определить местоположение';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Доступ к геолокации запрещен';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Местоположение недоступно';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Превышено время ожидания';
                    break;
            }
            
            showNotification(errorMessage, 'error');
            
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
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
        `;
        document.head.appendChild(style);
    }
}

// === QR КОД ===
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
            <img src="${qrCode}" alt="QR код" style="max-width: 280px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            ${pointName ? `<p style="font-weight: 600; margin-top: 15px;"><strong>${escapeHtml(pointName)}</strong></p>` : ''}
            <p style="color: #666;">ID: ${escapeHtml(pointId)}</p>
        `;
    }
    
    const modal = document.getElementById('qrModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function downloadQR() {
    if (!currentQRCode) {
        showNotification('QR код не найден', 'error');
        return;
    }
    
    try {
        const link = document.createElement('a');
        link.download = `plasticboy-qr-${Date.now()}.png`;
        link.href = currentQRCode;
        link.click();
        
        showNotification('QR код загружен', 'success');
    } catch (error) {
        console.error('❌ Ошибка загрузки QR кода:', error);
        showNotification('Ошибка загрузки QR кода', 'error');
    }
}

// === УДАЛЕНИЕ ТОЧКИ ===
async function deletePoint(pointId) {
    if (!confirm('Вы уверены, что хотите удалить эту точку?')) {
        return;
    }
    
    try {
        console.log('🗑️ Удаление точки:', pointId);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(`/api/admin/points/${encodeURIComponent(pointId)}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': currentPassword
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Сессия истекла');
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Ошибка удаления точки');
        }
        
        showNotification('Точка успешно удалена', 'success');
        await loadAdminPoints();
        
    } catch (error) {
        console.error('❌ Ошибка удаления точки:', error);
        
        if (error.name === 'AbortError') {
            showNotification('Превышено время ожидания удаления', 'error');
        } else if (error.message.includes('Сессия истекла')) {
            showNotification('Сессия истекла. Войдите заново.', 'error');
            logout();
        } else {
            showNotification('Ошибка удаления: ' + error.message, 'error');
        }
    }
}

// === ВЫХОД ===
function logout() {
    sessionStorage.removeItem('adminPassword');
    currentPassword = '';
    allPoints = [];
    loginAttempts = 0;
    
    if (adminMap) {
        adminMap.remove();
        adminMap = null;
    }
    
    adminMarkers = [];
    isInitialized = false;
    isAddMode = false;
    
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('adminPassword').value = '';
    hideLoginError();
    
    console.log('👋 Выход из админ панели');
}

// === ОШИБКИ ВХОДА ===
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

// === АНИМАЦИЯ ЧИСЕЛ ===
function animateNumber(element, targetValue) {
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

// === УВЕДОМЛЕНИЯ ===
function showNotification(message, type = 'info') {
    console.log(`🔔 Уведомление: ${type} - ${message}`);
    
    // Удаляем существующие уведомления
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${getNotificationIcon(type)} ${escapeHtml(message)}</span>
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Добавляем стили если их нет
    ensureNotificationStyles();
    
    document.body.appendChild(notification);
    
    // Автоудаление через 5 секунд
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
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

function ensureNotificationStyles() {
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
                font-family: 'ABC Oracle', sans-serif;
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
            
            @keyframes slideOut {
                from {
                    transform: translateX(0) scale(1);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%) scale(0.9);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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

// === ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ HTML ===
window.adminLogin = adminLogin;
window.toggleAddMode = toggleAddMode;
window.getAdminLocation = getAdminLocation;
window.showQRCode = showQRCode;
window.deletePoint = deletePoint;
window.closeAddModal = closeAddModal;
window.closeQrModal = closeQrModal;
window.downloadQR = downloadQR;

console.log('🛡️ Админ панель - Исправленная версия готова');
