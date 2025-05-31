// ИСПРАВЛЕННАЯ версия script.js для PlasticBoy - решение проблемы с отображением точек
let map;
let markers = [];
let markersLayer;

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// Флаги состояния
let isAppInitialized = false;
let pointsCache = null;
let abortController = null;

// Диагностическая функция
function debugLog(message, data = null) {
    console.log(`🔍 [PlasticBoy] ${message}`, data || '');
}

// Проверка координат
function validateCoordinates(lat, lng) {
    const isValidLat = typeof lat === 'number' && lat >= -90 && lat <= 90 && !isNaN(lat);
    const isValidLng = typeof lng === 'number' && lng >= -180 && lng <= 180 && !isNaN(lng);
    return isValidLat && isValidLng;
}

// Безопасный вызов функций загрузчика
function safeNotifyLoader() {
    try {
        if (typeof window.PlasticBoyLoader !== 'undefined' && 
            typeof window.PlasticBoyLoader.onPointsLoaded === 'function') {
            window.PlasticBoyLoader.onPointsLoaded();
            debugLog('✅ Загрузчик уведомлен о готовности точек');
        }
    } catch (error) {
        debugLog('❌ Ошибка при уведомлении загрузчика:', error);
    }
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    debugLog('DOM загружен, запуск PlasticBoy');
    
    setTimeout(() => {
        initializeApp();
    }, 100);
});

// Основная инициализация приложения
function initializeApp() {
    debugLog('Инициализация PlasticBoy...');
    
    // Добавляем стили для маркеров
    addMarkerStyles();
    
    // Инициализируем кнопки управления
    initControlButtons();
    
    // Проверяем доступность Leaflet
    if (typeof L !== 'undefined') {
        debugLog('Leaflet доступен, инициализируем карту');
        initMap();
    } else {
        debugLog('Ожидание загрузки Leaflet...');
        waitForLeaflet();
    }
}

// Ожидание загрузки Leaflet
function waitForLeaflet() {
    let attempts = 0;
    const maxAttempts = 50; // 5 секунд максимум
    
    const checkInterval = setInterval(() => {
        attempts++;
        
        if (typeof L !== 'undefined') {
            clearInterval(checkInterval);
            debugLog('Leaflet загружен, инициализируем карту');
            initMap();
        } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            debugLog('❌ КРИТИЧЕСКАЯ ОШИБКА: Leaflet не загрузился');
            showErrorNotification('Ошибка загрузки карты. Обновите страницу.');
        }
    }, 100);
}

// Добавление стилей для маркеров
function addMarkerStyles() {
    if (document.getElementById('plasticboy-marker-styles')) {
        return; // Стили уже добавлены
    }
    
    const style = document.createElement('style');
    style.id = 'plasticboy-marker-styles';
    style.textContent = `
        .plasticboy-marker {
            background: none !important;
            border: none !important;
        }
        
        .plasticboy-dot {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: bold;
            color: white;
            position: relative;
        }
        
        .plasticboy-dot:hover {
            transform: scale(1.2);
            box-shadow: 0 6px 20px rgba(0,0,0,0.4);
        }
        
        .plasticboy-dot.available {
            background: linear-gradient(45deg, #4CAF50, #45a049);
        }
        
        .plasticboy-dot.collected {
            background: linear-gradient(45deg, #f44336, #e53935);
        }
        
        .plasticboy-dot.available::before {
            content: '📦';
            font-size: 12px;
        }
        
        .plasticboy-dot.collected::before {
            content: '✅';
            font-size: 12px;
        }
        
        .plasticboy-popup {
            min-width: 220px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .plasticboy-popup h3 {
            margin: 0 0 12px 0;
            color: #333;
            font-size: 1.1rem;
            font-weight: 600;
        }
        
        .plasticboy-status {
            margin: 8px 0;
            font-weight: 600;
            padding: 6px 12px;
            border-radius: 20px;
            text-align: center;
            font-size: 0.9rem;
        }
        
        .plasticboy-status.available { 
            background: #e8f5e8;
            color: #2e7d32; 
        }
        
        .plasticboy-status.collected { 
            background: #ffebee;
            color: #c62828; 
        }
        
        .plasticboy-collector-info {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 8px;
            margin: 10px 0;
            border-left: 4px solid #667eea;
        }
        
        .plasticboy-collector-info p {
            margin: 4px 0;
            font-size: 0.9rem;
        }
        
        .plasticboy-collector-info strong {
            color: #333;
        }
    `;
    document.head.appendChild(style);
    debugLog('✅ Стили маркеров добавлены');
}

// Инициализация карты
function initMap() {
    if (isAppInitialized) {
        debugLog('⚠️ Карта уже инициализирована');
        return;
    }
    
    debugLog('Создание карты...');
    
    try {
        // Проверяем существование элемента карты
        const mapElement = document.getElementById('map');
        if (!mapElement) {
            throw new Error('Элемент #map не найден в DOM');
        }
        
        // Создаем карту
        map = L.map('map', {
            center: ALMATY_CENTER,
            zoom: 13,
            zoomControl: true,
            attributionControl: true,
            preferCanvas: false,
            maxZoom: 18,
            minZoom: 10
        });
        
        debugLog('✅ Объект карты создан');
        
        // Добавляем тайлы
        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        });
        
        tileLayer.addTo(map);
        debugLog('✅ Тайлы добавлены');
        
        // Создаем группу для маркеров
        markersLayer = L.layerGroup();
        markersLayer.addTo(map);
        debugLog('✅ Группа маркеров создана');
        
        // Глобальный доступ к карте
        window.map = map;
        window.markersLayer = markersLayer;
        
        // Обновляем размер карты после инициализации
        setTimeout(() => {
            map.invalidateSize();
            debugLog('✅ Размер карты обновлен');
        }, 200);
        
        isAppInitialized = true;
        debugLog('✅ Карта готова, загружаем точки');
        
        // Загружаем точки
        loadPoints();
        
    } catch (error) {
        debugLog('❌ КРИТИЧЕСКАЯ ОШИБКА при создании карты:', error);
        showErrorNotification('Ошибка инициализации карты: ' + error.message);
    }
}

// Загрузка точек
async function loadPoints() {
    debugLog('Начинаем загрузку точек...');
    
    // Отменяем предыдущий запрос
    if (abortController) {
        abortController.abort();
    }
    abortController = new AbortController();
    
    try {
        debugLog('Отправляем запрос к /api/points');
        
        const response = await fetch('/api/points', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            },
            signal: abortController.signal
        });
        
        debugLog('Ответ получен:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Сервер вернул не JSON ответ: ' + contentType);
        }
        
        const points = await response.json();
        debugLog('Данные точек получены:', {
            type: typeof points,
            isArray: Array.isArray(points),
            length: points ? points.length : 'undefined',
            sample: points ? points.slice(0, 2) : 'none'
        });
        
        if (!Array.isArray(points)) {
            throw new Error('Полученные данные не являются массивом: ' + typeof points);
        }
        
        pointsCache = points;
        
        // Обновляем карту и статистику
        updateMapMarkers(points);
        updateStatistics(points);
        
        // Уведомляем систему загрузки
        safeNotifyLoader();
        
        debugLog(`✅ Загрузка завершена: ${points.length} точек`);
        
        if (points.length === 0) {
            showInfoNotification('На карте пока нет точек для сбора');
        } else {
            showSuccessNotification(`Загружено ${points.length} точек на карту`);
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            debugLog('⚠️ Запрос отменен');
            return;
        }
        
        debugLog('❌ ОШИБКА при загрузке точек:', error);
        
        // Показываем ошибку пользователю
        showErrorNotification('Ошибка загрузки данных: ' + error.message);
        
        // Для отладки создаем тестовые точки
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            debugLog('Создаем тестовые точки для локальной отладки');
            createTestPoints();
        }
        
        // Уведомляем загрузчик даже при ошибке
        safeNotifyLoader();
    }
}

// Создание тестовых точек для отладки
function createTestPoints() {
    const testPoints = [
        {
            id: 'test1',
            name: 'Тестовая модель - Парк Горького',
            coordinates: { lat: 43.2220, lng: 76.8512 },
            status: 'available',
            createdAt: new Date().toISOString()
        },
        {
            id: 'test2',
            name: 'Тестовая модель - Площадь Республики',
            coordinates: { lat: 43.2380, lng: 76.8840 },
            status: 'collected',
            collectorInfo: {
                name: 'Тестовый пользователь',
                signature: 'Первая находка!'
            },
            collectedAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
            id: 'test3',
            name: 'Тестовая модель - Кок-Тобе',
            coordinates: { lat: 43.2050, lng: 76.9080 },
            status: 'available',
            createdAt: new Date().toISOString()
        }
    ];
    
    debugLog('Создаем тестовые точки:', testPoints);
    
    pointsCache = testPoints;
    updateMapMarkers(testPoints);
    updateStatistics(testPoints);
    safeNotifyLoader();
    
    showInfoNotification('Загружены тестовые точки для отладки');
}

// Обновление маркеров на карте
function updateMapMarkers(points) {
    if (!map || !markersLayer) {
        debugLog('❌ Карта или группа маркеров не готовы');
        return;
    }
    
    debugLog('Обновляем маркеры на карте...');
    
    try {
        // Очищаем существующие маркеры
        markersLayer.clearLayers();
        markers.length = 0;
        debugLog('Существующие маркеры очищены');
        
        if (points.length === 0) {
            debugLog('⚠️ Нет точек для отображения');
            return;
        }
        
        let successCount = 0;
        let errorCount = 0;
        
        points.forEach((point, index) => {
            try {
                // Валидация точки
                if (!point.coordinates) {
                    throw new Error('Отсутствуют координаты');
                }
                
                const lat = parseFloat(point.coordinates.lat);
                const lng = parseFloat(point.coordinates.lng);
                
                if (!validateCoordinates(lat, lng)) {
                    throw new Error(`Неверные координаты: lat=${lat}, lng=${lng}`);
                }
                
                const isAvailable = point.status === 'available';
                
                debugLog(`Создаем маркер ${index + 1}: ${point.name} [${lat}, ${lng}] - ${point.status}`);
                
                // Создаем иконку маркера
                const icon = L.divIcon({
                    className: 'plasticboy-marker',
                    html: `<div class="plasticboy-dot ${isAvailable ? 'available' : 'collected'}"></div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });
                
                // Создаем маркер
                const marker = L.marker([lat, lng], { icon });
                
                // Создаем содержимое popup
                let popupContent = `
                    <div class="plasticboy-popup">
                        <h3>${point.name}</h3>
                        <div class="plasticboy-status ${point.status}">
                            ${isAvailable ? '🟢 Доступна для сбора' : '🔴 Уже собрана'}
                        </div>
                        <p><strong>Координаты:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
                `;
                
                if (point.createdAt) {
                    popupContent += `<p><strong>Создана:</strong> ${new Date(point.createdAt).toLocaleString('ru-RU')}</p>`;
                }
                
                if (!isAvailable && point.collectorInfo) {
                    popupContent += `
                        <div class="plasticboy-collector-info">
                            <p><strong>Собрал:</strong> ${point.collectorInfo.name}</p>
                            ${point.collectorInfo.signature ? `<p><strong>Сообщение:</strong> ${point.collectorInfo.signature}</p>` : ''}
                            ${point.collectedAt ? `<p><strong>Время сбора:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>` : ''}
                        </div>
                    `;
                }
                
                popupContent += '</div>';
                
                // Привязываем popup к маркеру
                marker.bindPopup(popupContent, {
                    maxWidth: 300,
                    className: 'plasticboy-popup-wrapper'
                });
                
                // Добавляем маркер на карту
                markersLayer.addLayer(marker);
                markers.push(marker);
                successCount++;
                
                debugLog(`✅ Маркер ${index + 1} добавлен успешно`);
                
            } catch (error) {
                errorCount++;
                debugLog(`❌ Ошибка при создании маркера ${index + 1}:`, error);
            }
        });
        
        // Обновляем глобальный доступ
        window.markers = markers;
        
        debugLog(`Обновление маркеров завершено: успешно=${successCount}, ошибок=${errorCount}`);
        
        if (successCount > 0) {
            debugLog(`✅ На карте отображено ${successCount} маркеров`);
        }
        
        if (errorCount > 0) {
            debugLog(`⚠️ Ошибок при создании маркеров: ${errorCount}`);
        }
        
    } catch (error) {
        debugLog('❌ КРИТИЧЕСКАЯ ОШИБКА при обновлении маркеров:', error);
        showErrorNotification('Ошибка отображения точек на карте');
    }
}

// Обновление статистики
function updateStatistics(points) {
    debugLog('Обновляем статистику...');
    
    try {
        const available = points.filter(p => p.status === 'available').length;
        const collected = points.filter(p => p.status === 'collected').length;
        
        debugLog('Статистика:', { available, collected, total: points.length });
        
        // Обновляем элементы с анимацией
        updateStatElement('availableCount', available);
        updateStatElement('collectedCount', collected);
        
    } catch (error) {
        debugLog('❌ Ошибка при обновлении статистики:', error);
    }
}

// Обновление элемента статистики с анимацией
function updateStatElement(elementId, newValue) {
    const element = document.getElementById(elementId);
    if (!element) {
        debugLog(`⚠️ Элемент ${elementId} не найден`);
        return;
    }
    
    const currentValue = parseInt(element.textContent) || 0;
    
    if (currentValue === newValue) {
        return; // Значение не изменилось
    }
    
    // Простая анимация изменения числа
    const duration = 800;
    const steps = 20;
    const stepValue = (newValue - currentValue) / steps;
    const stepDuration = duration / steps;
    
    let current = currentValue;
    let step = 0;
    
    const timer = setInterval(() => {
        step++;
        current += stepValue;
        
        if (step >= steps) {
            element.textContent = newValue;
            clearInterval(timer);
        } else {
            element.textContent = Math.round(current);
        }
    }, stepDuration);
}

// Геолокация пользователя
function getCurrentLocation() {
    debugLog('Запрос геолокации пользователя');
    
    const locationBtn = document.querySelector('.location-btn');
    if (!locationBtn) {
        debugLog('❌ Кнопка геолокации не найдена');
        return;
    }
    
    if (!navigator.geolocation) {
        debugLog('❌ Геолокация не поддерживается браузером');
        showErrorNotification('Геолокация не поддерживается вашим браузером');
        return;
    }
    
    const originalText = locationBtn.innerHTML;
    locationBtn.innerHTML = '⏳ Определение местоположения...';
    locationBtn.disabled = true;
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            debugLog('Геолокация получена:', { lat, lng, accuracy: position.coords.accuracy });
            
            // Создаем иконку пользователя
            const userIcon = L.divIcon({
                className: 'plasticboy-user-marker',
                html: `<div style="
                    background: linear-gradient(45deg, #2196F3, #1976D2);
                    width: 20px; 
                    height: 20px; 
                    border-radius: 50%; 
                    border: 3px solid white; 
                    box-shadow: 0 4px 12px rgba(33, 150, 243, 0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: 10px;
                    position: relative;
                ">👤
                    <div style="
                        position: absolute;
                        top: -3px; left: -3px; right: -3px; bottom: -3px;
                        border: 2px solid #2196F3;
                        border-radius: 50%;
                        opacity: 0.6;
                        animation: userPulse 2s infinite;
                    "></div>
                </div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            
            // Добавляем стиль для анимации если его нет
            if (!document.getElementById('user-pulse-animation')) {
                const style = document.createElement('style');
                style.id = 'user-pulse-animation';
                style.textContent = `
                    @keyframes userPulse {
                        0% { transform: scale(1); opacity: 0.7; }
                        50% { opacity: 0.3; }
                        100% { transform: scale(2); opacity: 0; }
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Удаляем предыдущий маркер пользователя
            if (window.userMarker) {
                map.removeLayer(window.userMarker);
            }
            
            // Добавляем новый маркер
            window.userMarker = L.marker([lat, lng], { icon: userIcon })
                .addTo(map)
                .bindPopup(`
                    <div style="text-align: center; min-width: 150px;">
                        <strong>📍 Ваше местоположение</strong><br>
                        <small style="color: #666;">
                            Координаты: ${lat.toFixed(6)}, ${lng.toFixed(6)}<br>
                            Точность: ±${Math.round(position.coords.accuracy)}м
                        </small>
                    </div>
                `, {
                    className: 'user-location-popup'
                });
            
            // Центрируем карту на пользователе
            map.setView([lat, lng], Math.max(map.getZoom(), 15));
            
            showSuccessNotification('Местоположение определено!');
            
            // Восстанавливаем кнопку
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
            
        },
        function(error) {
            debugLog('❌ Ошибка геолокации:', error);
            
            let errorMessage = 'Не удалось определить местоположение';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Доступ к геолокации запрещен. Разрешите доступ в настройках браузера.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Местоположение недоступно. Проверьте подключение к интернету.';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Время ожидания истекло. Попробуйте еще раз.';
                    break;
            }
            
            showErrorNotification(errorMessage);
            
            // Восстанавливаем кнопку
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 300000 // 5 минут
        }
    );
}

// Инициализация кнопок управления
function initControlButtons() {
    const locationBtn = document.querySelector('.location-btn');
    if (locationBtn) {
        // Убираем старые обработчики если есть
        locationBtn.removeEventListener('click', getCurrentLocation);
        // Добавляем новый обработчик
        locationBtn.addEventListener('click', getCurrentLocation);
        debugLog('✅ Кнопка геолокации настроена');
    } else {
        debugLog('⚠️ Кнопка геолокации не найдена в DOM');
    }
}

// Уведомления
function showSuccessNotification(message) {
    showNotification(message, 'success');
}

function showErrorNotification(message) {
    showNotification(message, 'error');
}

function showInfoNotification(message) {
    showNotification(message, 'info');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `plasticboy-notification ${type}`;
    
    const icons = {
        error: '❌',
        success: '✅',
        info: 'ℹ️',
        warning: '⚠️'
    };
    
    const colors = {
        error: '#f44336',
        success: '#4CAF50',
        info: '#2196F3',
        warning: '#ff9800'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 3000;
        background: white;
        border-left: 4px solid ${colors[type]};
        border-radius: 8px;
        padding: 16px 20px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        max-width: 350px;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideInNotification 0.3s ease-out;
    `;
    
    notification.innerHTML = `
        <span>${icons[type]}</span>
        <span style="flex: 1;">${message}</span>
        <button onclick="this.parentElement.remove()" style="
            background: none; border: none; font-size: 18px; 
            cursor: pointer; color: #999; padding: 0; margin: 0;
        ">×</button>
    `;
    
    // Добавляем стиль анимации если его нет
    if (!document.getElementById('notification-animation')) {
        const style = document.createElement('style');
        style.id = 'notification-animation';
        style.textContent = `
            @keyframes slideInNotification {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Автоматическое удаление через 5 секунд
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideInNotification 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
    
    debugLog(`Уведомление показано: [${type}] ${message}`);
}

// Обработчики событий
window.addEventListener('resize', function() {
    if (map) {
        debugLog('Изменение размера окна - обновляем карту');
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
});

// Горячие клавиши
document.addEventListener('keydown', function(event) {
    // Ctrl + L - определить местоположение
    if (event.ctrlKey && event.key === 'l') {
        event.preventDefault();
        getCurrentLocation();
    }
    
    // Ctrl + R - перезагрузить точки
    if (event.ctrlKey && event.key === 'r') {
        event.preventDefault();
        if (isAppInitialized) {
            debugLog('Принудительная перезагрузка точек');
            loadPoints();
        }
    }
    
    // Ctrl + D - диагностика (только в режиме разработки)
    if (event.ctrlKey && event.key === 'd') {
        event.preventDefault();
        showDiagnostics();
    }
});

// Диагностическая информация
function showDiagnostics() {
    const diagnostics = {
        'Приложение инициализировано': isAppInitialized,
        'Leaflet доступен': typeof L !== 'undefined',
        'Карта создана': !!map,
        'Группа маркеров': !!markersLayer,
        'Количество маркеров': markers ? markers.length : 0,
        'Кэш точек': pointsCache ? pointsCache.length : 'нет',
        'URL страницы': window.location.href,
        'User Agent': navigator.userAgent.substring(0, 50) + '...'
    };
    
    console.group('🔍 PlasticBoy Диагностика');
    Object.entries(diagnostics).forEach(([key, value]) => {
        console.log(`${key}:`, value);
    });
    console.groupEnd();
    
    showInfoNotification('Диагностическая информация выведена в консоль');
}

// Экспорт основных функций для глобального доступа
window.PlasticBoy = {
    // Основные объекты
    map: () => map,
    markers: () => markers,
    markersLayer: () => markersLayer,
    
    // Управляющие функции
    loadPoints,
    getCurrentLocation,
    initMap,
    
    // Служебные функции
    debugLog,
    showNotification,
    isInitialized: () => isAppInitialized,
    
    // Диагностика
    diagnostics: showDiagnostics,
    getPointsCache: () => pointsCache
};

// Псевдонимы для совместимости с загрузчиком
window.showNotification = showNotification;
window.updateMap = updateMapMarkers;
window.updateStats = updateStatistics;
window.loadPoints = loadPoints;
window.initMap = initMap;

// Финальная инициализация
debugLog('✅ PlasticBoy script.js загружен и готов к работе');
debugLog('Используйте горячие клавиши: Ctrl+L (геолокация), Ctrl+R (перезагрузить), Ctrl+D (диагностика)');
