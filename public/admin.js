// Переменные для админ панели
let adminMap;
let adminMarkers = [];
let isAddMode = false;
let currentPassword = '';
let allPoints = [];
let currentQRCode = '';

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// Инициализация админ панели
document.addEventListener('DOMContentLoaded', function() {
    console.log('🛡️ Админ панель - инициализация');
    
    // Проверяем сохраненный пароль
    const savedPassword = sessionStorage.getItem('adminPassword');
    if (savedPassword) {
        currentPassword = savedPassword;
        showAdminPanel();
    }
    
    // Инициализация кнопок админа
    initAdminControlButtons();
    
    // Добавляем обработчики событий
    setupEventListeners();
});

// Инициализация кнопок управления для админа
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
    // Обработчик Enter в поле пароля
    const passwordInput = document.getElementById('adminPassword');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                adminLogin();
            }
        });
    }

    // Обработчик формы добавления точки
    const form = document.getElementById('addPointForm');
    if (form) {
        form.addEventListener('submit', handleAddPointSubmit);
    }

    // Закрытие модальных окон при клике вне их
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

    // Улучшенная обработка клавиш для админа
    document.addEventListener('keydown', function(event) {
        // Закрытие модальных окон по Escape
        if (event.key === 'Escape') {
            closeAddModal();
            closeQrModal();
        }
        
        // Определение местоположения по Ctrl+L
        if (event.ctrlKey && event.key === 'l') {
            const adminPanel = document.getElementById('adminPanel');
            if (adminPanel && adminPanel.style.display !== 'none') {
                event.preventDefault();
                getAdminLocation();
            }
        }
        
        // Переключение режима добавления по Ctrl+A
        if (event.ctrlKey && event.key === 'a') {
            const adminPanel = document.getElementById('adminPanel');
            if (adminPanel && adminPanel.style.display !== 'none') {
                event.preventDefault();
                toggleAddMode();
            }
        }
    });
}

// Вход в админ панель
async function adminLogin() {
    const password = document.getElementById('adminPassword').value;
    
    if (!password) {
        showNotification('Введите пароль', 'error');
        return;
    }
    
    console.log('🔐 Попытка входа в админ панель...');
    
    // Сначала проверяем пароль
    const isValid = await checkPassword(password);
    if (!isValid) {
        showNotification('Неверный пароль администратора', 'error');
        return;
    }
    
    currentPassword = password;
    sessionStorage.setItem('adminPassword', password);
    showAdminPanel();
}

// Проверка пароля администратора
async function checkPassword(password) {
    try {
        console.log('🔐 Проверяем пароль администратора...');
        
        const response = await fetch('/api/admin/points', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': password
            }
        });
        
        console.log('📡 Ответ проверки пароля:', response.status);
        
        if (response.status === 401) {
            console.log('❌ Неверный пароль');
            return false;
        }
        
        if (!response.ok) {
            console.warn('⚠️ Неожиданный ответ сервера:', response.status);
            return false;
        }
        
        console.log('✅ Пароль верный');
        return true;
        
    } catch (error) {
        console.error('❌ Ошибка проверки пароля:', error);
        showNotification('Ошибка соединения с сервером', 'error');
        return false;
    }
}

// Показать админ панель
async function showAdminPanel() {
    try {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        
        // Инициализируем карту
        await initAdminMap();
        
        // Загружаем точки
        await loadAdminPoints();
    } catch (error) {
        console.error('❌ Ошибка показа админ панели:', error);
        showNotification('Ошибка инициализации панели', 'error');
        
        // При ошибке возвращаемся к форме входа
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
        sessionStorage.removeItem('adminPassword');
        currentPassword = '';
    }
}

// Инициализация админ карты
function initAdminMap() {
    return new Promise((resolve, reject) => {
        try {
            if (adminMap) {
                adminMap.remove();
                adminMap = null;
            }
            
            console.log('🗺️ Инициализация админ карты');
            
            // Проверяем доступность Leaflet
            if (typeof L === 'undefined') {
                throw new Error('Leaflet не загружен');
            }
            
            const mapElement = document.getElementById('adminMap');
            if (!mapElement) {
                throw new Error('Элемент карты не найден');
            }
            
            adminMap = L.map('adminMap').setView(ALMATY_CENTER, 13);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(adminMap);
            
            // Добавляем обработчик клика для добавления точек
            adminMap.on('click', function(e) {
                if (isAddMode) {
                    openAddPointModal(e.latlng);
                }
            });
            
            // Принудительно обновляем размер карты после инициализации
            setTimeout(() => {
                if (adminMap) {
                    adminMap.invalidateSize();
                    console.log('✅ Админ карта готова');
                    resolve();
                }
            }, 200);
            
        } catch (error) {
            console.error('❌ Ошибка инициализации админ карты:', error);
            reject(error);
        }
    });
}

// Функция получения геолокации для админа
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
    locationBtn.style.opacity = '0.8';
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Создаем улучшенный маркер пользователя для админа
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
            
            // Добавляем стили для анимации пульса админа
            addAdminUserPulseStyles();
            
            // Удаляем предыдущий маркер админа если есть
            if (window.adminUserMarker) {
                adminMap.removeLayer(window.adminUserMarker);
            }
            
            // Добавляем новый маркер
            window.adminUserMarker = L.marker([lat, lng], { icon: userIcon })
                .addTo(adminMap)
                .bindPopup(`
                    <div style="text-align: center; min-width: 150px;">
                        <strong>🛡️ Местоположение админа</strong><br>
                        <small style="color: #666;">
                            ${lat.toFixed(6)}, ${lng.toFixed(6)}
                        </small>
                    </div>
                `);
            
            // Плавно центрируем карту на админе
            adminMap.flyTo([lat, lng], 16, {
                duration: 1.5,
                easeLinearity: 0.5
            });
            
            showNotification('Местоположение определено', 'success');
            
            // Восстанавливаем кнопку
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
            locationBtn.style.opacity = '';
        },
        function(error) {
            console.error('Ошибка геолокации:', error);
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
            
            // Восстанавливаем кнопку
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

// Добавление стилей для анимации пульса админа
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

// Загрузка точек для админа
async function loadAdminPoints() {
    try {
        console.log('🔄 Загружаем точки для админа...');
        
        const response = await fetch('/api/admin/points', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': currentPassword
            }
        });
        
        console.log('📡 Ответ сервера для админ точек:', response.status);
        
        if (!response.ok) {
            if (response.status === 401) {
                showNotification('Неверный пароль', 'error');
                sessionStorage.removeItem('adminPassword');
                
                // Возвращаемся к форме входа
                document.getElementById('adminPanel').style.display = 'none';
                document.getElementById('loginForm').style.display = 'block';
                document.getElementById('adminPassword').value = '';
                currentPassword = '';
                
                return;
            }
            const errorText = await response.text();
            console.error('❌ Ошибка ответа сервера:', errorText);
            throw new Error(`Server error: ${response.status}`);
        }
        
        allPoints = await response.json();
        console.log('✅ Загружено точек для админа:', allPoints.length);
        
        updateAdminMap();
        updateAdminStats();
        updatePointsList();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки точек для админа:', error);
        showNotification(`Ошибка загрузки данных: ${error.message}`, 'error');
        
        // При ошибке сети возвращаемся к форме входа
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            sessionStorage.removeItem('adminPassword');
            document.getElementById('adminPanel').style.display = 'none';
            document.getElementById('loginForm').style.display = 'block';
            document.getElementById('adminPassword').value = '';
            currentPassword = '';
            showNotification('Проверьте соединение с сервером', 'error');
        }
    }
}

// Обновление админ карты с улучшенными маркерами
function updateAdminMap() {
    if (!adminMap || !allPoints) {
        console.warn('⚠️ Карта или точки не готовы для обновления');
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
            
            // Улучшенный popup для админа
            let popupContent = `
                <div class="admin-popup">
                    <h3>${point.name}</h3>
                    <p><strong>ID:</strong> ${point.id}</p>
                    <p><strong>Статус:</strong> ${getStatusText(point, isScheduled)}</p>
                    <p><strong>Создана:</strong> ${new Date(point.createdAt).toLocaleString('ru-RU')}</p>
            `;
            
            if (isScheduled) {
                popupContent += `<p><strong>Появится:</strong> ${new Date(point.scheduledTime).toLocaleString('ru-RU')}</p>`;
            }
            
            if (point.status === 'collected') {
                popupContent += `
                    <p><strong>Собрана:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>
                    <p><strong>Сборщик:</strong> ${point.collectorInfo.name}</p>
                `;
            }
            
            popupContent += `
                    <div style="margin-top: 12px;">
                        <button onclick="showQRCode('${point.id}')" class="admin-btn">Показать QR</button>
                        <button onclick="deletePoint('${point.id}')" class="admin-btn delete-btn">Удалить</button>
                    </div>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            adminMarkers.push(marker);
        } catch (error) {
            console.error('❌ Ошибка добавления маркера:', error, point);
        }
    });
    
    addAdminMarkerStyles();
}

// Получить текст статуса
function getStatusText(point, isScheduled) {
    if (point.status === 'collected') return '🔴 Собрана';
    if (isScheduled) return '🟡 Запланирована';
    return '🟢 Доступна';
}

// Обновление админ статистики с анимацией
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

// Анимация чисел для админ панели
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

// Обновление списка точек
function updatePointsList() {
    const container = document.getElementById('pointsList');
    
    if (!container) {
        console.warn('⚠️ Контейнер списка точек не найден');
        return;
    }
    
    if (allPoints.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Нет созданных точек</p>';
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
                <p><strong>Координаты:</strong> ${point.coordinates.lat.toFixed(6)}, ${point.coordinates.lng.toFixed(6)}</p>
                <p><strong>Создана:</strong> ${new Date(point.createdAt).toLocaleString('ru-RU')}</p>
                ${isScheduled ? `<p><strong>Появится:</strong> ${new Date(point.scheduledTime).toLocaleString('ru-RU')}</p>` : ''}
                ${point.status === 'collected' ? `
                    <p><strong>Собрана:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>
                    <p><strong>Сборщик:</strong> ${point.collectorInfo.name}</p>
                ` : ''}
                <div class="point-actions">
                    <button onclick="showQRCode('${point.id}')" class="admin-btn">QR код</button>
                    <button onclick="deletePoint('${point.id}')" class="admin-btn delete-btn">Удалить</button>
                </div>
            </div>
        `;
    }).join('');
}

// Переключение режима добавления
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
        showNotification('Кликните по карте для добавления точки', 'info');
    } else {
        btn.textContent = 'Режим добавления: ВЫКЛ';
        btn.classList.remove('active');
        if (adminMap) {
            adminMap.getContainer().style.cursor = '';
        }
    }
}

// Открыть модальное окно добавления точки
function openAddPointModal(latlng) {
    window.tempCoordinates = latlng;
    const modal = document.getElementById('addPointModal');
    const input = document.getElementById('modelName');
    
    if (modal && input) {
        modal.style.display = 'block';
        input.focus();
    }
}

// Закрыть модальное окно добавления
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

// Обработка формы добавления точки
async function handleAddPointSubmit(e) {
    e.preventDefault();
    
    console.log('🚀 Начинаем создание точки...');
    
    const name = document.getElementById('modelName').value;
    const delayMinutes = document.getElementById('delayMinutes').value;
    
    console.log('📝 Данные формы:', { name, delayMinutes });
    
    if (!window.tempCoordinates) {
        console.error('❌ Нет координат');
        showNotification('Ошибка координат', 'error');
        return;
    }
    
    console.log('📍 Координаты:', window.tempCoordinates);
    
    if (!name || !name.trim()) {
        console.error('❌ Имя точки пустое');
        showNotification('Введите название модели', 'error');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalHTML = submitBtn.innerHTML;
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span style="animation: spin 1s linear infinite;">⏳</span> Создание...';
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

        console.log('📤 Отправляем данные:', requestData);
        console.log('🔑 Пароль админа:', currentPassword ? 'установлен' : 'не установлен');

        const response = await fetch('/api/admin/points', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': currentPassword
            },
            body: JSON.stringify(requestData)
        });
        
        console.log('📡 Ответ сервера:', {
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
            console.error('❌ Сервер вернул не JSON:', textResponse);
            throw new Error(`Server returned invalid response: ${textResponse.substring(0, 100)}`);
        }
        
        console.log('📥 Данные ответа:', responseData);
        
        if (!response.ok) {
            if (response.status === 401) {
                console.error('❌ Неверный пароль админа');
                showNotification('Неверный пароль администратора', 'error');
                sessionStorage.removeItem('adminPassword');
                
                // Возвращаемся к форме входа
                document.getElementById('adminPanel').style.display = 'none';
                document.getElementById('loginForm').style.display = 'block';
                document.getElementById('adminPassword').value = '';
                currentPassword = '';
                
                setTimeout(() => location.reload(), 2000);
                return;
            }
            
            const errorMessage = responseData.error || `HTTP ${response.status}: ${response.statusText}`;
            console.error('❌ Ошибка от сервера:', errorMessage);
            throw new Error(errorMessage);
        }
        
        console.log('✅ Точка успешно создана:', responseData);
        
        closeAddModal();
        showNotification('Точка успешно создана!', 'success');
        
        // Показываем QR код для новой точки
        if (responseData.qrCode) {
            showQRCodeForNewPoint(responseData);
        }
        
        // Обновляем данные
        await loadAdminPoints();
        
    } catch (error) {
        console.error('❌ Ошибка создания точки:', error);
        console.error('❌ Stack trace:', error.stack);
        
        // Показываем детальную ошибку
        let errorMessage = 'Неизвестная ошибка';
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Не удалось подключиться к серверу. Проверьте соединение.';
        } else if (error.message.includes('NetworkError')) {
            errorMessage = 'Ошибка сети. Попробуйте позже.';
        } else if (error.message.includes('Invalid')) {
            errorMessage = 'Неверные данные: ' + error.message;
        } else {
            errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
    } finally {
        // Восстанавливаем кнопку
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
        submitBtn.style.opacity = '';
    }
}

// Показать QR код для только что созданной точки
function showQRCodeForNewPoint(point) {
    currentQRCode = point.qrCode;
    
    const qrDisplay = document.getElementById('qrCodeDisplay');
    if (qrDisplay) {
        qrDisplay.innerHTML = `
            <img src="${point.qrCode}" alt="QR код для ${point.name}" style="max-width: 280px; border-radius: 12px;">
            <p style="font-weight: 600; margin-top: 15px;"><strong>${point.name}</strong></p>
            <p style="color: #666;">ID: ${point.id}</p>
        `;
    }
    
    const modal = document.getElementById('qrModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Показать QR код для существующих точек
function showQRCode(pointId, qrCodeData = null) {
    // Если передан готовый QR код (для новых точек), используем его
    if (qrCodeData) {
        currentQRCode = qrCodeData;
        const qrDisplay = document.getElementById('qrCodeDisplay');
        if (qrDisplay) {
            qrDisplay.innerHTML = `
                <img src="${qrCodeData}" alt="QR код" style="max-width: 280px; border-radius: 12px;">
                <p style="color: #666; margin-top: 15px;">ID: ${pointId}</p>
            `;
        }
        const modal = document.getElementById('qrModal');
        if (modal) {
            modal.style.display = 'block';
        }
        return;
    }
    
    // Для существующих точек ищем в списке
    const point = allPoints.find(p => p.id === pointId);
    if (!point) {
        showNotification('Точка не найдена', 'error');
        return;
    }
    
    currentQRCode = point.qrCode;
    
    const qrDisplay = document.getElementById('qrCodeDisplay');
    if (qrDisplay) {
        qrDisplay.innerHTML = `
            <img src="${point.qrCode}" alt="QR код для ${point.name}" style="max-width: 280px; border-radius: 12px;">
            <p style="font-weight: 600; margin-top: 15px;"><strong>${point.name}</strong></p>
            <p style="color: #666;">ID: ${pointId}</p>
        `;
    }
    
    const modal = document.getElementById('qrModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Закрыть QR модальное окно
function closeQrModal() {
    const modal = document.getElementById('qrModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Скачать QR код
function downloadQR() {
    if (!currentQRCode) return;
    
    const link = document.createElement('a');
    link.download = `plasticboy-qr-${Date.now()}.png`;
    link.href = currentQRCode;
    link.click();
}

// Удалить точку
async function deletePoint(pointId) {
    if (!confirm('Вы уверены, что хотите удалить эту точку?')) {
        return;
    }
    
    try {
        console.log('🗑️ Удаляем точку:', pointId);
        
        const response = await fetch(`/api/admin/points/${pointId}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': currentPassword
            }
        });
        
        console.log('📡 Ответ на удаление:', response.status);
        
        if (!response.ok) {
            if (response.status === 401) {
                showNotification('Неверный пароль администратора', 'error');
                sessionStorage.removeItem('adminPassword');
                location.reload();
                return;
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete point');
        }
        
        showNotification('Точка удалена', 'success');
        await loadAdminPoints();
        
    } catch (error) {
        console.error('❌ Ошибка удаления точки:', error);
        showNotification('Ошибка удаления точки: ' + error.message, 'error');
    }
}

// Добавление улучшенных стилей для админ маркеров
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

// Улучшенная функция показа уведомлений для админа
function showNotification(message, type = 'info') {
    console.log(`🔔 Уведомление: ${type} - ${message}`);
    
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

// Получить иконку для уведомления
function getNotificationIcon(type) {
    const icons = {
        error: '❌',
        success: '✅',
        info: 'ℹ️',
        warning: '⚠️'
    };
    return icons[type] || icons.info;
}

// Функция отладки для проверки состояния
function debugAdminState() {
    console.log('🔍 Отладка состояния админ панели:', {
        currentPassword: currentPassword ? 'установлен' : 'не установлен',
        isAddMode: isAddMode,
        allPointsCount: allPoints.length,
        adminMapReady: !!adminMap,
        tempCoordinates: window.tempCoordinates
    });
}

// Экспорт функций для глобального использования (если нужно)
window.adminLogin = adminLogin;
window.toggleAddMode = toggleAddMode;
window.getAdminLocation = getAdminLocation;
window.showQRCode = showQRCode;
window.deletePoint = deletePoint;
window.closeAddModal = closeAddModal;
window.closeQrModal = closeQrModal;
window.downloadQR = downloadQR;
window.debugAdminState = debugAdminState;
window.checkPassword = checkPassword;
