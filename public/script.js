// МОБИЛЬНО-ОПТИМИЗИРОВАННАЯ версия script.js для PlasticBoy
let map;
let markers = [];
let markersLayer;

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// Флаги состояния
let isAppInitialized = false;
let pointsCache = null;
let abortController = null;
let isMobile = false;

// Определение мобильного устройства
function detectMobile() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 768;
    
    isMobile = isMobileUA || (isTouchDevice && isSmallScreen);
    
    console.log('🔍 [Mobile Detection]', {
        userAgent: userAgent.substring(0, 50),
        isMobileUA,
        isTouchDevice,
        isSmallScreen,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        devicePixelRatio: window.devicePixelRatio,
        isMobile
    });
    
    return isMobile;
}

// Мобильное логирование
function mobileLog(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`📱 [${timestamp}] ${message}`, data || '');
    
    // Дополнительное логирование для мобильных устройств
    if (isMobile && window.location.search.includes('debug')) {
        // Показываем критичные сообщения как алерты на мобильных (только в debug режиме)
        if (message.includes('ОШИБКА') || message.includes('ERROR')) {
            setTimeout(() => {
                alert(`PlasticBoy Debug: ${message}`);
            }, 100);
        }
    }
}

// Проверка координат с усиленной валидацией для мобильных
function validateCoordinates(lat, lng) {
    // Проверяем что это числа
    const numLat = Number(lat);
    const numLng = Number(lng);
    
    const isValidLat = !isNaN(numLat) && isFinite(numLat) && numLat >= -90 && numLat <= 90;
    const isValidLng = !isNaN(numLng) && isFinite(numLng) && numLng >= -180 && numLng <= 180;
    
    mobileLog(`Валидация координат: lat=${lat} (${typeof lat}) -> ${numLat} valid=${isValidLat}, lng=${lng} (${typeof lng}) -> ${numLng} valid=${isValidLng}`);
    
    return isValidLat && isValidLng;
}

// Безопасное уведомление загрузчика
function safeNotifyLoader() {
    try {
        if (typeof window.PlasticBoyLoader !== 'undefined' && 
            typeof window.PlasticBoyLoader.onPointsLoaded === 'function') {
            window.PlasticBoyLoader.onPointsLoaded();
            mobileLog('✅ Загрузчик уведомлен о готовности точек');
        }
    } catch (error) {
        mobileLog('❌ Ошибка при уведомлении загрузчика:', error);
    }
}

// Инициализация при загрузке DOM с мобильными задержками
document.addEventListener('DOMContentLoaded', function() {
    detectMobile();
    mobileLog('DOM загружен, запуск PlasticBoy (мобильная версия)');
    
    // Увеличенная задержка для мобильных устройств
    const initDelay = isMobile ? 500 : 200;
    setTimeout(() => {
        initializeApp();
    }, initDelay);
});

// Основная инициализация приложения
function initializeApp() {
    mobileLog('Инициализация PlasticBoy (мобильная оптимизация включена)...');
    
    // Добавляем мобильные стили
    addMobileOptimizedStyles();
    
    // Инициализируем кнопки управления
    initControlButtons();
    
    // Настраиваем viewport для мобильных
    setupMobileViewport();
    
    // Проверяем доступность Leaflet
    if (typeof L !== 'undefined') {
        mobileLog('Leaflet доступен, инициализируем карту');
        initMap();
    } else {
        mobileLog('Ожидание загрузки Leaflet...');
        waitForLeaflet();
    }
}

// Настройка viewport для мобильных устройств
function setupMobileViewport() {
    if (!isMobile) return;
    
    mobileLog('Настройка мобильного viewport');
    
    // Улучшаем viewport meta tag
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
        viewportMeta.setAttribute('content', 
            'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
        );
    }
    
    // Предотвращаем zoom на input focus
    document.addEventListener('touchstart', function() {}, {passive: true});
    
    // Обработка изменения ориентации
    window.addEventListener('orientationchange', function() {
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                mobileLog('Карта обновлена после поворота экрана');
            }
        }, 300);
    });
}

// Мобильные стили
function addMobileOptimizedStyles() {
    if (document.getElementById('mobile-plasticboy-styles')) {
        return; // Стили уже добавлены
    }
    
    const style = document.createElement('style');
    style.id = 'mobile-plasticboy-styles';
    style.textContent = `
        /* Мобильные маркеры - увеличенные для лучшего взаимодействия */
        .mobile-plasticboy-marker {
            background: none !important;
            border: none !important;
        }
        
        .mobile-plasticboy-dot {
            width: ${isMobile ? '32px' : '24px'};
            height: ${isMobile ? '32px' : '24px'};
            border-radius: 50%;
            border: ${isMobile ? '4px' : '3px'} solid white;
            box-shadow: 0 ${isMobile ? '6px' : '4px'} ${isMobile ? '16px' : '12px'} rgba(0,0,0,0.3);
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${isMobile ? '16px' : '14px'};
            font-weight: bold;
            color: white;
            position: relative;
            touch-action: manipulation; /* Улучшение touch взаимодействия */
        }
        
        .mobile-plasticboy-dot:hover,
        .mobile-plasticboy-dot:active {
            transform: scale(${isMobile ? '1.1' : '1.2'});
            box-shadow: 0 ${isMobile ? '8px' : '6px'} ${isMobile ? '20px' : '16px'} rgba(0,0,0,0.4);
        }
        
        .mobile-plasticboy-dot.available {
            background: linear-gradient(45deg, #4CAF50, #45a049);
        }
        
        .mobile-plasticboy-dot.collected {
            background: linear-gradient(45deg, #f44336, #e53935);
        }
        
        .mobile-plasticboy-dot.available::before {
            content: '📦';
            font-size: ${isMobile ? '14px' : '12px'};
        }
        
        .mobile-plasticboy-dot.collected::before {
            content: '✅';
            font-size: ${isMobile ? '14px' : '12px'};
        }
        
        /* Мобильные popup */
        .mobile-plasticboy-popup {
            min-width: ${isMobile ? '250px' : '220px'};
            max-width: ${isMobile ? '300px' : '280px'};
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: ${isMobile ? '16px' : '14px'}; /* Увеличенный шрифт для мобильных */
        }
        
        .mobile-plasticboy-popup h3 {
            margin: 0 0 12px 0;
            color: #333;
            font-size: ${isMobile ? '1.2rem' : '1.1rem'};
            font-weight: 600;
            line-height: 1.3;
        }
        
        .mobile-plasticboy-status {
            margin: 10px 0;
            font-weight: 600;
            padding: ${isMobile ? '8px 16px' : '6px 12px'};
            border-radius: 20px;
            text-align: center;
            font-size: ${isMobile ? '1rem' : '0.9rem'};
        }
        
        .mobile-plasticboy-status.available { 
            background: #e8f5e8;
            color: #2e7d32; 
        }
        
        .mobile-plasticboy-status.collected { 
            background: #ffebee;
            color: #c62828; 
        }
        
        .mobile-plasticboy-collector-info {
            background: #f8f9fa;
            padding: ${isMobile ? '16px' : '12px'};
            border-radius: 8px;
            margin: 12px 0;
            border-left: 4px solid #667eea;
        }
        
        .mobile-plasticboy-collector-info p {
            margin: 6px 0;
            font-size: ${isMobile ? '0.95rem' : '0.9rem'};
            line-height: 1.4;
        }
        
        /* Улучшенные popup для мобильных */
        .leaflet-popup-content-wrapper {
            border-radius: ${isMobile ? '16px' : '12px'} !important;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
        }
        
        .leaflet-popup-close-button {
            width: ${isMobile ? '32px' : '24px'} !important;
            height: ${isMobile ? '32px' : '24px'} !important;
            font-size: ${isMobile ? '20px' : '18px'} !important;
            line-height: ${isMobile ? '30px' : '22px'} !important;
            touch-action: manipulation;
        }
        
        /* Мобильные уведомления */
        .mobile-notification {
            position: fixed;
            top: ${isMobile ? '10px' : '20px'};
            left: ${isMobile ? '10px' : 'auto'};
            right: ${isMobile ? '10px' : '20px'};
            z-index: 3000;
            background: white;
            border-radius: ${isMobile ? '12px' : '8px'};
            padding: ${isMobile ? '16px 20px' : '12px 16px'};
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            font-size: ${isMobile ? '16px' : '14px'};
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideInNotification 0.3s ease-out;
            max-width: none;
        }
        
        /* Пульсация для лучшей видимости на мобильных */
        @keyframes mobilePulse {
            0% { transform: scale(1); opacity: 0.8; }
            50% { opacity: 0.4; }
            100% { transform: scale(1.8); opacity: 0; }
        }
        
        .mobile-pulse-ring {
            position: absolute;
            top: -4px; left: -4px; right: -4px; bottom: -4px;
            border: 2px solid #4CAF50;
            border-radius: 50%;
            opacity: 0;
            animation: mobilePulse 2s infinite;
        }
        
        /* Улучшения для touch устройств */
        @media (hover: none) and (pointer: coarse) {
            .mobile-plasticboy-dot:hover {
                transform: none; /* Убираем hover эффекты на touch устройствах */
            }
            
            .leaflet-container {
                touch-action: pan-x pan-y; /* Улучшаем панорамирование */
            }
        }
        
        /* Дополнительные стили для очень маленьких экранов */
        @media (max-width: 360px) {
            .mobile-plasticboy-popup {
                min-width: 200px;
                font-size: 14px;
            }
            
            .mobile-plasticboy-popup h3 {
                font-size: 1rem;
            }
        }
    `;
    document.head.appendChild(style);
    mobileLog('✅ Мобильные стили добавлены');
}

// Ожидание загрузки Leaflet с увеличенным таймаутом для мобильных
function waitForLeaflet() {
    let attempts = 0;
    const maxAttempts = isMobile ? 100 : 50; // Больше времени для мобильных
    const checkInterval = isMobile ? 150 : 100; // Более редкие проверки
    
    mobileLog(`Ожидание Leaflet (максимум ${maxAttempts * checkInterval}ms)`);
    
    const checkLeafletInterval = setInterval(() => {
        attempts++;
        
        if (typeof L !== 'undefined') {
            clearInterval(checkLeafletInterval);
            mobileLog('✅ Leaflet загружен, инициализируем карту');
            initMap();
        } else if (attempts >= maxAttempts) {
            clearInterval(checkLeafletInterval);
            mobileLog('❌ КРИТИЧЕСКАЯ ОШИБКА: Leaflet не загрузился');
            showMobileNotification('Ошибка загрузки карты. Обновите страницу.', 'error');
        }
        
        // Логируем прогресс каждые 20 попыток
        if (attempts % 20 === 0) {
            mobileLog(`Ожидание Leaflet... попытка ${attempts}/${maxAttempts}`);
        }
    }, checkInterval);
}

// Мобильно-оптимизированная инициализация карты
function initMap() {
    if (isAppInitialized) {
        mobileLog('⚠️ Карта уже инициализирована');
        return;
    }
    
    mobileLog('Создание мобильно-оптимизированной карты...');
    
    try {
        // Проверяем существование элемента карты
        const mapElement = document.getElementById('map');
        if (!mapElement) {
            throw new Error('Элемент #map не найден в DOM');
        }
        
        // Мобильно-оптимизированные настройки карты
        const mapOptions = {
            center: ALMATY_CENTER,
            zoom: isMobile ? 12 : 13, // Чуть меньший zoom для мобильных
            zoomControl: true,
            attributionControl: !isMobile, // Скрываем attribution на мобильных для экономии места
            preferCanvas: isMobile, // Canvas режим для лучшей производительности на мобильных
            maxZoom: 18,
            minZoom: isMobile ? 9 : 10,
            zoomSnap: isMobile ? 0.5 : 1, // Более плавный zoom на мобильных
            zoomDelta: isMobile ? 0.5 : 1,
            wheelPxPerZoomLevel: isMobile ? 120 : 60,
            // Настройки для touch устройств
            tap: isMobile,
            tapTolerance: isMobile ? 20 : 15,
            touchZoom: isMobile,
            doubleClickZoom: true,
            scrollWheelZoom: !isMobile, // Отключаем scroll zoom на мобильных
            boxZoom: !isMobile,
            keyboard: !isMobile
        };
        
        // Создаем карту
        map = L.map('map', mapOptions);
        
        mobileLog('✅ Объект карты создан с мобильными настройками');
        
        // Добавляем тайлы с оптимизацией для мобильных
        const tileOptions = {
            attribution: isMobile ? '' : '© OpenStreetMap contributors',
            maxZoom: 18,
            detectRetina: true, // Поддержка retina дисплеев
            tileSize: isMobile ? 256 : 256,
            zoomOffset: 0
        };
        
        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', tileOptions);
        tileLayer.addTo(map);
        mobileLog('✅ Тайлы добавлены с мобильной оптимизацией');
        
        // Создаем группу для маркеров
        markersLayer = L.layerGroup();
        markersLayer.addTo(map);
        mobileLog('✅ Группа маркеров создана');
        
        // Мобильные обработчики событий карты
        if (isMobile) {
            // Предотвращаем случайные клики при панорамировании
            let isPanning = false;
            
            map.on('movestart', function() {
                isPanning = true;
            });
            
            map.on('moveend', function() {
                setTimeout(() => {
                    isPanning = false;
                }, 100);
            });
            
            // Улучшенная обработка touch событий
            map.on('click', function(e) {
                if (isPanning) {
                    e.originalEvent.preventDefault();
                    return false;
                }
            });
        }
        
        // Глобальный доступ к карте
        window.map = map;
        window.markersLayer = markersLayer;
        
        // Обновляем размер карты после инициализации
        const resizeDelay = isMobile ? 500 : 200;
        setTimeout(() => {
            map.invalidateSize();
            mobileLog('✅ Размер карты обновлен');
        }, resizeDelay);
        
        isAppInitialized = true;
        mobileLog('✅ Карта готова, загружаем точки');
        
        // Загружаем точки с задержкой для мобильных
        const loadDelay = isMobile ? 300 : 100;
        setTimeout(() => {
            loadPoints();
        }, loadDelay);
        
    } catch (error) {
        mobileLog('❌ КРИТИЧЕСКАЯ ОШИБКА при создании карты:', error);
        showMobileNotification('Ошибка инициализации карты: ' + error.message, 'error');
    }
}

// Мобильно-оптимизированная загрузка точек
async function loadPoints() {
    mobileLog('Начинаем мобильную загрузку точек...');
    
    // Отменяем предыдущий запрос
    if (abortController) {
        abortController.abort();
    }
    abortController = new AbortController();
    
    try {
        mobileLog('Отправляем запрос к /api/points');
        
        const fetchOptions = {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            },
            signal: abortController.signal
        };
        
        // Увеличенный таймаут для медленных мобильных соединений
        if (isMobile) {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout: медленное соединение')), 15000);
            });
            
            const fetchPromise = fetch('/api/points', fetchOptions);
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            
            await handlePointsResponse(response);
        } else {
            const response = await fetch('/api/points', fetchOptions);
            await handlePointsResponse(response);
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            mobileLog('⚠️ Запрос отменен');
            return;
        }
        
        mobileLog('❌ ОШИБКА при загрузке точек:', error);
        
        // Показываем ошибку пользователю
        showMobileNotification('Ошибка загрузки данных: ' + error.message, 'error');
        
        // Для отладки создаем тестовые точки
        if (window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1' ||
            window.location.search.includes('debug')) {
            mobileLog('Создаем тестовые точки для отладки');
            createMobileTestPoints();
        }
        
        // Уведомляем загрузчик даже при ошибке
        safeNotifyLoader();
    }
}

// Обработка ответа с точками
async function handlePointsResponse(response) {
    mobileLog('Ответ получен:', {
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
    mobileLog('Данные точек получены:', {
        type: typeof points,
        isArray: Array.isArray(points),
        length: points ? points.length : 'undefined',
        sample: points ? points.slice(0, 1) : 'none'
    });
    
    if (!Array.isArray(points)) {
        throw new Error('Полученные данные не являются массивом: ' + typeof points);
    }
    
    pointsCache = points;
    
    // Обновляем карту и статистику
    updateMobileMapMarkers(points);
    updateMobileStatistics(points);
    
    // Уведомляем систему загрузки
    safeNotifyLoader();
    
    mobileLog(`✅ Мобильная загрузка завершена: ${points.length} точек`);
    
    if (points.length === 0) {
        showMobileNotification('На карте пока нет точек для сбора', 'info');
    } else {
        showMobileNotification(`Загружено ${points.length} точек на карту`, 'success');
    }
}

// Создание тестовых точек для мобильной отладки
function createMobileTestPoints() {
    const testPoints = [
        {
            id: 'mobile-test1',
            name: 'Мобильная тестовая точка 1 - Парк Горького',
            coordinates: { lat: 43.2220, lng: 76.8512 },
            status: 'available',
            createdAt: new Date().toISOString()
        },
        {
            id: 'mobile-test2',
            name: 'Мобильная тестовая точка 2 - Площадь Республики',
            coordinates: { lat: 43.2380, lng: 76.8840 },
            status: 'collected',
            collectorInfo: {
                name: 'Мобильный пользователь',
                signature: 'Найдено через мобильное приложение!'
            },
            collectedAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
            id: 'mobile-test3',
            name: 'Мобильная тестовая точка 3 - Кок-Тобе',
            coordinates: { lat: 43.2050, lng: 76.9080 },
            status: 'available',
            createdAt: new Date().toISOString()
        }
    ];
    
    mobileLog('Создаем мобильные тестовые точки:', testPoints);
    
    pointsCache = testPoints;
    updateMobileMapMarkers(testPoints);
    updateMobileStatistics(testPoints);
    safeNotifyLoader();
    
    showMobileNotification('Загружены тестовые точки для мобильной отладки', 'info');
}

// Мобильно-оптимизированное обновление маркеров
function updateMobileMapMarkers(points) {
    if (!map || !markersLayer) {
        mobileLog('❌ Карта или группа маркеров не готовы');
        return;
    }
    
    mobileLog('Обновляем мобильные маркеры на карте...');
    
    try {
        // Очищаем существующие маркеры
        markersLayer.clearLayers();
        markers.length = 0;
        mobileLog('Существующие маркеры очищены');
        
        if (points.length === 0) {
            mobileLog('⚠️ Нет точек для отображения');
            return;
        }
        
        let successCount = 0;
        let errorCount = 0;
        
        points.forEach((point, index) => {
            try {
                // Усиленная валидация для мобильных
                if (!point.coordinates) {
                    throw new Error('Отсутствуют координаты');
                }
                
                // Убеждаемся что координаты - числа
                const lat = Number(point.coordinates.lat);
                const lng = Number(point.coordinates.lng);
                
                if (!validateCoordinates(lat, lng)) {
                    throw new Error(`Неверные координаты: lat=${lat} (${typeof lat}), lng=${lng} (${typeof lng})`);
                }
                
                const isAvailable = point.status === 'available';
                
                mobileLog(`Создаем мобильный маркер ${index + 1}: ${point.name} [${lat}, ${lng}] - ${point.status}`);
                
                // Создаем мобильную иконку маркера
                const icon = L.divIcon({
                    className: 'mobile-plasticboy-marker',
                    html: `
                        <div class="mobile-plasticboy-dot ${isAvailable ? 'available' : 'collected'}">
                            ${isAvailable ? '<div class="mobile-pulse-ring"></div>' : ''}
                        </div>
                    `,
                    iconSize: [isMobile ? 32 : 24, isMobile ? 32 : 24],
                    iconAnchor: [isMobile ? 16 : 12, isMobile ? 16 : 12]
                });
                
                // Создаем маркер
                const marker = L.marker([lat, lng], { icon });
                
                // Создаем мобильное содержимое popup
                let popupContent = `
                    <div class="mobile-plasticboy-popup">
                        <h3>${point.name}</h3>
                        <div class="mobile-plasticboy-status ${point.status}">
                            ${isAvailable ? '🟢 Доступна для сбора' : '🔴 Уже собрана'}
                        </div>
                        <p><strong>Координаты:</strong><br>${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
                `;
                
                if (point.createdAt) {
                    popupContent += `<p><strong>Создана:</strong><br>${new Date(point.createdAt).toLocaleString('ru-RU')}</p>`;
                }
                
                if (!isAvailable && point.collectorInfo) {
                    popupContent += `
                        <div class="mobile-plasticboy-collector-info">
                            <p><strong>Собрал:</strong> ${point.collectorInfo.name}</p>
                            ${point.collectorInfo.signature ? `<p><strong>Сообщение:</strong> ${point.collectorInfo.signature}</p>` : ''}
                            ${point.collectedAt ? `<p><strong>Время сбора:</strong><br>${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>` : ''}
                        </div>
                    `;
                }
                
                popupContent += '</div>';
                
                // Привязываем popup к маркеру с мобильными настройками
                marker.bindPopup(popupContent, {
                    maxWidth: isMobile ? 300 : 280,
                    className: 'mobile-plasticboy-popup-wrapper',
                    closeButton: true,
                    autoPan: isMobile,
                    keepInView: isMobile,
                    autoPanPadding: isMobile ? [20, 20] : [10, 10]
                });
                
                // Добавляем маркер на карту
                markersLayer.addLayer(marker);
                markers.push(marker);
                successCount++;
                
                mobileLog(`✅ Мобильный маркер ${index + 1} добавлен успешно`);
                
            } catch (error) {
                errorCount++;
                mobileLog(`❌ Ошибка при создании мобильного маркера ${index + 1}:`, error);
            }
        });
        
        // Обновляем глобальный доступ
        window.markers = markers;
        
        mobileLog(`Обновление мобильных маркеров завершено: успешно=${successCount}, ошибок=${errorCount}`);
        
        if (successCount > 0) {
            mobileLog(`✅ На карте отображено ${successCount} мобильных маркеров`);
            
            // Автоматически фокусируемся на маркерах для мобильных
            if (isMobile && successCount > 0) {
                setTimeout(() => {
                    const group = new L.featureGroup(markers);
                    if (group.getBounds().isValid()) {
                        map.fitBounds(group.getBounds(), {
                            padding: [20, 20],
                            maxZoom: 15
                        });
                        mobileLog('✅ Карта автоматически сфокусирована на маркерах');
                    }
                }, 500);
            }
        }
        
        if (errorCount > 0) {
            mobileLog(`⚠️ Ошибок при создании мобильных маркеров: ${errorCount}`);
        }
        
    } catch (error) {
        mobileLog('❌ КРИТИЧЕСКАЯ ОШИБКА при обновлении мобильных маркеров:', error);
        showMobileNotification('Ошибка отображения точек на карте', 'error');
    }
}

// Мобильное обновление статистики
function updateMobileStatistics(points) {
    mobileLog('Обновляем мобильную статистику...');
    
    try {
        const available = points.filter(p => p.status === 'available').length;
        const collected = points.filter(p => p.status === 'collected').length;
        
        mobileLog('Мобильная статистика:', { available, collected, total: points.length });
        
        // Обновляем элементы с мобильной анимацией
        updateMobileStatElement('availableCount', available);
        updateMobileStatElement('collectedCount', collected);
        
    } catch (error) {
        mobileLog('❌ Ошибка при обновлении мобильной статистики:', error);
    }
}

// Мобильное обновление элемента статистики
function updateMobileStatElement(elementId, newValue) {
    const element = document.getElementById(elementId);
    if (!element) {
        mobileLog(`⚠️ Элемент ${elementId} не найден`);
        return;
    }
    
    const currentValue = parseInt(element.textContent) || 0;
    
    if (currentValue === newValue) {
        return; // Значение не изменилось
    }
    
    // Упрощенная анимация для мобильных (более производительная)
    if (isMobile) {
        element.style.transform = 'scale(1.1)';
        element.style.transition = 'transform 0.2s ease';
        
        setTimeout(() => {
            element.textContent = newValue;
            element.style.transform = 'scale(1)';
        }, 100);
    } else {
        // Полная анимация для десктопа
        const duration = 600;
        const steps = 15;
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
}

// Мобильная геолокация с улучшенной обработкой
function getCurrentLocation() {
    mobileLog('Запрос мобильной геолокации пользователя');
    
    const locationBtn = document.querySelector('.location-btn');
    if (!locationBtn) {
        mobileLog('❌ Кнопка геолокации не найдена');
        return;
    }
    
    if (!navigator.geolocation) {
        mobileLog('❌ Геолокация не поддерживается браузером');
        showMobileNotification('Геолокация не поддерживается вашим браузером', 'error');
        return;
    }
    
    const originalText = locationBtn.innerHTML;
    locationBtn.innerHTML = isMobile ? '⏳ Поиск...' : '⏳ Определение местоположения...';
    locationBtn.disabled = true;
    
    // Мобильные настройки геолокации
    const geoOptions = {
        enableHighAccuracy: true,
        timeout: isMobile ? 20000 : 15000, // Больше времени для мобильных
        maximumAge: 300000 // 5 минут
    };
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = Math.round(position.coords.accuracy);
            
            mobileLog('Мобильная геолокация получена:', { 
                lat, lng, accuracy, 
                timestamp: new Date(position.timestamp).toLocaleTimeString()
            });
            
            // Создаем мобильную иконку пользователя
            const userIcon = L.divIcon({
                className: 'mobile-user-marker',
                html: `<div style="
                    background: linear-gradient(45deg, #2196F3, #1976D2);
                    width: ${isMobile ? '24px' : '20px'}; 
                    height: ${isMobile ? '24px' : '20px'}; 
                    border-radius: 50%; 
                    border: ${isMobile ? '4px' : '3px'} solid white; 
                    box-shadow: 0 ${isMobile ? '6px' : '4px'} ${isMobile ? '16px' : '12px'} rgba(33, 150, 243, 0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: ${isMobile ? '12px' : '10px'};
                    position: relative;
                ">👤
                    <div style="
                        position: absolute;
                        top: -${isMobile ? '4px' : '3px'}; left: -${isMobile ? '4px' : '3px'}; 
                        right: -${isMobile ? '4px' : '3px'}; bottom: -${isMobile ? '4px' : '3px'};
                        border: 2px solid #2196F3;
                        border-radius: 50%;
                        opacity: 0.6;
                        animation: userPulse 2s infinite;
                    "></div>
                </div>`,
                iconSize: [isMobile ? 24 : 20, isMobile ? 24 : 20],
                iconAnchor: [isMobile ? 12 : 10, isMobile ? 12 : 10]
            });
            
            // Добавляем стиль для мобильной анимации если его нет
            if (!document.getElementById('mobile-user-pulse-animation')) {
                const style = document.createElement('style');
                style.id = 'mobile-user-pulse-animation';
                style.textContent = `
                    @keyframes userPulse {
                        0% { transform: scale(1); opacity: 0.7; }
                        50% { opacity: 0.3; }
                        100% { transform: scale(${isMobile ? '1.8' : '2'}); opacity: 0; }
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
                    <div style="text-align: center; min-width: ${isMobile ? '180px' : '150px'};">
                        <strong>📍 Ваше местоположение</strong><br>
                        <small style="color: #666; font-size: ${isMobile ? '14px' : '12px'};">
                            Координаты:<br>${lat.toFixed(6)}, ${lng.toFixed(6)}<br>
                            Точность: ±${accuracy}м
                        </small>
                    </div>
                `, {
                    className: 'mobile-user-location-popup',
                    maxWidth: isMobile ? 250 : 200
                });
            
            // Мобильное центрирование карты
            const targetZoom = isMobile ? 
                Math.max(map.getZoom(), 14) : 
                Math.max(map.getZoom(), 15);
                
            if (isMobile) {
                // Плавная анимация для мобильных
                map.flyTo([lat, lng], targetZoom, {
                    duration: 1.5,
                    easeLinearity: 0.5
                });
            } else {
                map.setView([lat, lng], targetZoom);
            }
            
            showMobileNotification('Местоположение определено!', 'success');
            
            // Восстанавливаем кнопку
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
            
        },
        function(error) {
            mobileLog('❌ Ошибка мобильной геолокации:', error);
            
            let errorMessage = 'Не удалось определить местоположение';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = isMobile ? 
                        'Разрешите доступ к геолокации в настройках' : 
                        'Доступ к геолокации запрещен. Разрешите доступ в настройках браузера.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = isMobile ?
                        'Местоположение недоступно. Включите GPS' :
                        'Местоположение недоступно. Проверьте подключение к интернету.';
                    break;
                case error.TIMEOUT:
                    errorMessage = isMobile ?
                        'Поиск занял слишком много времени' :
                        'Время ожидания истекло. Попробуйте еще раз.';
                    break;
            }
            
            showMobileNotification(errorMessage, 'error');
            
            // Восстанавливаем кнопку
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
        },
        geoOptions
    );
}

// Мобильная инициализация кнопок управления
function initControlButtons() {
    const locationBtn = document.querySelector('.location-btn');
    if (locationBtn) {
        // Убираем старые обработчики если есть
        locationBtn.removeEventListener('click', getCurrentLocation);
        // Добавляем новый обработчик
        locationBtn.addEventListener('click', getCurrentLocation);
        
        // Дополнительные мобильные обработчики
        if (isMobile) {
            // Предотвращаем двойное нажатие
            locationBtn.addEventListener('touchstart', function(e) {
                e.stopPropagation();
            }, {passive: true});
            
            // Улучшаем touch feedback
            locationBtn.addEventListener('touchend', function() {
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);
            });
        }
        
        mobileLog('✅ Мобильная кнопка геолокации настроена');
    } else {
        mobileLog('⚠️ Кнопка геолокации не найдена в DOM');
    }
}

// Мобильные уведомления
function showMobileNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `mobile-notification ${type}`;
    
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
    
    notification.style.borderLeftColor = colors[type];
    
    notification.innerHTML = `
        <span style="font-size: ${isMobile ? '18px' : '16px'};">${icons[type]}</span>
        <span style="flex: 1; line-height: 1.4;">${message}</span>
        <button onclick="this.parentElement.remove()" style="
            background: none; border: none; font-size: ${isMobile ? '20px' : '18px'}; 
            cursor: pointer; color: #999; padding: 0; margin: 0;
            min-width: ${isMobile ? '32px' : '24px'};
            min-height: ${isMobile ? '32px' : '24px'};
            display: flex; align-items: center; justify-content: center;
        ">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Автоматическое удаление через время (больше для мобильных)
    const autoHideDelay = isMobile ? 6000 : 5000;
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideInNotification 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, autoHideDelay);
    
    mobileLog(`Мобильное уведомление показано: [${type}] ${message}`);
}

// Мобильные обработчики событий
window.addEventListener('resize', function() {
    if (map) {
        mobileLog('Изменение размера окна - обновляем мобильную карту');
        setTimeout(() => {
            map.invalidateSize();
        }, isMobile ? 200 : 100);
    }
});

// Мобильные горячие клавиши (упрощенные)
document.addEventListener('keydown', function(event) {
    // Только основные горячие клавиши для мобильных
    if (event.ctrlKey && event.key === 'l') {
        event.preventDefault();
        getCurrentLocation();
    }
    
    if (event.ctrlKey && event.key === 'r') {
        event.preventDefault();
        if (isAppInitialized) {
            mobileLog('Принудительная перезагрузка мобильных точек');
            loadPoints();
        }
    }
    
    // Диагностика (всегда доступна)
    if (event.ctrlKey && event.key === 'd') {
        event.preventDefault();
        showMobileDiagnostics();
    }
});

// Мобильная диагностическая информация
function showMobileDiagnostics() {
    const diagnostics = {
        'Устройство': isMobile ? 'Мобильное' : 'Десктоп',
        'Размер экрана': `${window.innerWidth}x${window.innerHeight}`,
        'Device Pixel Ratio': window.devicePixelRatio,
        'Touch поддержка': 'ontouchstart' in window,
        'Приложение инициализировано': isAppInitialized,
        'Leaflet доступен': typeof L !== 'undefined',
        'Карта создана': !!map,
        'Группа маркеров': !!markersLayer,
        'Количество маркеров': markers ? markers.length : 0,
        'Кэш точек': pointsCache ? pointsCache.length : 'нет',
        'URL страницы': window.location.href,
        'User Agent': navigator.userAgent.substring(0, 80) + '...'
    };
    
    console.group('📱 PlasticBoy Мобильная Диагностика');
    Object.entries(diagnostics).forEach(([key, value]) => {
        console.log(`${key}:`, value);
    });
    console.groupEnd();
    
    showMobileNotification('Мобильная диагностика выведена в консоль', 'info');
    
    // Дополнительная диагностика для мобильных
    if (isMobile) {
        console.group('📱 Дополнительная мобильная информация');
        console.log('Ориентация экрана:', screen.orientation ? screen.orientation.type : 'неизвестно');
        console.log('Сетевое подключение:', navigator.connection ? navigator.connection.effectiveType : 'неизвестно');
        console.log('Standalone режим:', window.navigator.standalone);
        console.groupEnd();
    }
}

// Экспорт мобильных функций для глобального доступа
window.PlasticBoyMobile = {
    // Основные объекты
    map: () => map,
    markers: () => markers,
    markersLayer: () => markersLayer,
    
    // Управляющие функции
    loadPoints,
    getCurrentLocation,
    initMap,
    
    // Мобильные функции
    isMobile: () => isMobile,
    detectMobile,
    showMobileNotification,
    
    // Служебные функции
    mobileLog,
    isInitialized: () => isAppInitialized,
    
    // Диагностика
    diagnostics: showMobileDiagnostics,
    getPointsCache: () => pointsCache
};

// Псевдонимы для совместимости
window.showNotification = showMobileNotification;
window.updateMap = updateMobileMapMarkers;
window.updateStats = updateMobileStatistics;
window.loadPoints = loadPoints;
window.initMap = initMap;

// Финальная инициализация
mobileLog('✅ PlasticBoy мобильно-оптимизированный script.js загружен');
mobileLog(`Устройство: ${isMobile ? 'МОБИЛЬНОЕ' : 'ДЕСКТОП'}`);
mobileLog('Используйте горячие клавиши: Ctrl+L (геолокация), Ctrl+R (перезагрузить), Ctrl+D (диагностика)');
