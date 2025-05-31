// ПЕРЕРАБОТАННЫЙ SCRIPT.JS для PlasticBoy
// Упрощен и оптимизирован для надежной работы

let map;
let markers = [];

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// Флаги состояния
let isAppInitialized = false;

// СИСТЕМА КЭШИРОВАНИЯ
const Cache = {
    key: 'plasticboy_points_v2',
    ttl: 5 * 60 * 1000, // 5 минут
    
    save(data) {
        try {
            const item = {
                data: data,
                timestamp: Date.now(),
                version: '2.0'
            };
            localStorage.setItem(this.key, JSON.stringify(item));
            console.log(`💾 Кэшировано ${data.length} точек`);
        } catch (e) {
            console.warn('⚠️ Ошибка сохранения в кэш:', e);
        }
    },
    
    load() {
        try {
            const item = localStorage.getItem(this.key);
            if (!item) return null;
            
            const parsed = JSON.parse(item);
            const age = Date.now() - parsed.timestamp;
            
            if (age > this.ttl) {
                console.log('⏰ Кэш устарел');
                return null;
            }
            
            console.log(`📦 Загружено ${parsed.data.length} точек из кэша`);
            return parsed.data;
        } catch (e) {
            console.warn('⚠️ Ошибка чтения кэша:', e);
            return null;
        }
    },
    
    clear() {
        localStorage.removeItem(this.key);
        console.log('🗑️ Кэш очищен');
    }
};

// Ожидание готовности DOM и Leaflet
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM загружен');
    
    // Уведомляем систему загрузки о готовности Leaflet
    if (typeof L !== 'undefined') {
        if (window.AppLoader) window.AppLoader.onLeafletReady();
        initApp();
    } else {
        // Ожидаем загрузки Leaflet
        const checkLeaflet = setInterval(() => {
            if (typeof L !== 'undefined') {
                clearInterval(checkLeaflet);
                if (window.AppLoader) window.AppLoader.onLeafletReady();
                initApp();
            }
        }, 100);
    }
});

// Инициализация приложения
function initApp() {
    console.log('🚀 Инициализация приложения');
    
    // Инициализируем карту
    setTimeout(() => {
        try {
            initMap();
            if (window.AppLoader) window.AppLoader.onMapReady();
            
            // Загружаем точки
            setTimeout(() => {
                loadPoints();
            }, 500);
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            // Повторная попытка через 2 секунды
            setTimeout(initApp, 2000);
        }
    }, 300);
}

// Инициализация карты
function initMap() {
    if (isAppInitialized) return;
    
    console.log('🗺️ Создание карты');
    
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        throw new Error('Элемент карты не найден');
    }
    
    map = L.map('map', {
        center: ALMATY_CENTER,
        zoom: 13,
        zoomControl: true,
        attributionControl: true
    });
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);
    
    // Добавляем стили
    addMapStyles();
    
    // Обновляем размер карты
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
            console.log('✅ Карта готова');
        }
    }, 200);
    
    isAppInitialized = true;
}

// Стили для карты
function addMapStyles() {
    if (document.getElementById('map-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'map-styles';
    style.textContent = `
        .leaflet-tile-pane {
            filter: grayscale(100%) contrast(1.1) brightness(1.05);
        }
        
        .leaflet-marker-pane, .leaflet-popup-pane, .leaflet-control-container {
            filter: none;
        }
        
        .custom-marker {
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
        }
    `;
    document.head.appendChild(style);
}

// Загрузка точек
async function loadPoints() {
    console.log('📍 Загрузка точек');
    
    // Сначала проверяем кэш
    const cachedPoints = Cache.load();
    if (cachedPoints) {
        updateMap(cachedPoints);
        updateStats(cachedPoints);
        if (window.AppLoader) {
            window.AppLoader.onPointsLoaded();
            window.AppLoader.updateLoader();
        }
        
        // Обновляем в фоне
        setTimeout(() => fetchPointsFromServer(), 1000);
        return;
    }
    
    // Загружаем с сервера
    await fetchPointsFromServer();
}

// Загрузка с сервера
async function fetchPointsFromServer() {
    try {
        const response = await fetch('/api/points', {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const points = await response.json();
        console.log(`✅ Загружено ${points.length} точек с сервера`);
        
        // Сохраняем в кэш
        Cache.save(points);
        
        // Обновляем интерфейс
        updateMap(points);
        updateStats(points);
        
        // Уведомляем систему загрузки
        if (window.AppLoader) {
            window.AppLoader.onPointsLoaded();
            window.AppLoader.updateLoader();
        }
        
        return points;
        
    } catch (error) {
        console.error('❌ Ошибка загрузки точек:', error);
        
        // Уведомляем систему загрузки даже при ошибке
        if (window.AppLoader) {
            window.AppLoader.onPointsLoaded();
            window.AppLoader.updateLoader();
        }
        
        throw error;
    }
}

// Обновление карты
function updateMap(points) {
    if (!map || !points) return;
    
    console.log(`🗺️ Обновление карты: ${points.length} точек`);
    
    // Очищаем старые маркеры
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // Добавляем новые маркеры
    points.forEach(point => {
        try {
            const isAvailable = point.status === 'available';
            
            const icon = L.divIcon({
                className: 'custom-marker',
                html: `<div class="marker-dot ${isAvailable ? 'available' : 'collected'}"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            
            const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon });
            
            // Popup
            let popupContent = `
                <div style="min-width: 200px; font-family: Arial, sans-serif;">
                    <h3 style="margin: 0 0 10px 0; color: #333;">${point.name}</h3>
                    <p style="margin: 5px 0; font-weight: 600; color: ${isAvailable ? '#4CAF50' : '#f44336'};">
                        ${isAvailable ? '🟢 Доступна' : '🔴 Собрана'}
                    </p>
            `;
            
            if (!isAvailable && point.collectorInfo) {
                popupContent += `
                    <div style="background: #f8f9fa; padding: 8px; border-radius: 6px; margin: 8px 0; font-size: 0.9rem;">
                        <p style="margin: 4px 0;"><strong>Собрал:</strong> ${point.collectorInfo.name}</p>
                        ${point.collectorInfo.signature ? `<p style="margin: 4px 0;"><strong>Сообщение:</strong> ${point.collectorInfo.signature}</p>` : ''}
                        <p style="margin: 4px 0;"><strong>Время:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>
                    </div>
                    <button onclick="showPointDetails('${point.id}')" style="
                        background: linear-gradient(45deg, #667eea, #764ba2);
                        color: white; border: none; padding: 8px 12px;
                        border-radius: 6px; cursor: pointer; width: 100%; margin-top: 8px;
                    ">Подробнее</button>
                `;
            }
            
            popupContent += '</div>';
            
            marker.bindPopup(popupContent);
            marker.addTo(map);
            markers.push(marker);
            
        } catch (error) {
            console.warn('⚠️ Ошибка создания маркера:', error);
        }
    });
    
    console.log(`✅ Добавлено ${markers.length} маркеров на карту`);
}

// Обновление статистики
function updateStats(points) {
    const available = points.filter(p => p.status === 'available').length;
    const collected = points.filter(p => p.status === 'collected').length;
    
    const availableEl = document.getElementById('availableCount');
    const collectedEl = document.getElementById('collectedCount');
    
    if (availableEl) availableEl.textContent = available;
    if (collectedEl) collectedEl.textContent = collected;
    
    console.log(`📊 Статистика: ${available} доступно, ${collected} собрано`);
}

// Геолокация
function getCurrentLocation() {
    const btn = document.querySelector('.location-btn');
    if (!navigator.geolocation || !map) {
        console.warn('⚠️ Геолокация недоступна');
        return;
    }
    
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Определение...';
    btn.disabled = true;
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Удаляем старый маркер
            if (window.userMarker) {
                map.removeLayer(window.userMarker);
            }
            
            // Создаем новый маркер
            const userIcon = L.divIcon({
                className: 'user-marker',
                html: '<div class="user-dot"></div>',
                iconSize: [22, 22],
                iconAnchor: [11, 11]
            });
            
            window.userMarker = L.marker([lat, lng], { icon: userIcon })
                .addTo(map)
                .bindPopup(`
                    <div style="text-align: center;">
                        <strong>📍 Ваше местоположение</strong><br>
                        <small>${lat.toFixed(4)}, ${lng.toFixed(4)}</small>
                    </div>
                `);
            
            map.flyTo([lat, lng], 16);
            console.log('✅ Местоположение найдено');
            
            btn.innerHTML = originalText;
            btn.disabled = false;
        },
        function(error) {
            console.error('❌ Ошибка геолокации:', error);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    );
}

// Детали точки
async function showPointDetails(pointId) {
    try {
        const response = await fetch(`/api/point/${pointId}/info`);
        const point = await response.json();
        
        let content = `
            <h3 style="color: #667eea;">${point.name}</h3>
            <p><strong>Статус:</strong> ${point.status === 'collected' ? '🔴 Собрана' : '🟢 Доступна'}</p>
            <p><strong>Координаты:</strong> ${point.coordinates.lat.toFixed(4)}, ${point.coordinates.lng.toFixed(4)}</p>
        `;
        
        if (point.status === 'collected' && point.collectorInfo) {
            content += `
                <hr>
                <h4>Сборщик:</h4>
                <p><strong>Имя:</strong> ${point.collectorInfo.name}</p>
                ${point.collectorInfo.signature ? `<p><strong>Сообщение:</strong> "${point.collectorInfo.signature}"</p>` : ''}
                <p><strong>Время:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>
            `;
            
            if (point.collectorInfo.selfie) {
                content += `
                    <div style="text-align: center; margin-top: 15px;">
                        <img src="${point.collectorInfo.selfie}" 
                             style="max-width: 100%; max-height: 200px; border-radius: 8px;"
                             alt="Селфи">
                    </div>
                `;
            }
        }
        
        document.getElementById('modalTitle').innerHTML = 'Информация о модели';
        document.getElementById('modalBody').innerHTML = content;
        document.getElementById('infoModal').style.display = 'block';
        
    } catch (error) {
        console.error('❌ Ошибка загрузки деталей:', error);
    }
}

// Закрытие модального окна
function closeModal() {
    document.getElementById('infoModal').style.display = 'none';
}

// Обработчики событий
window.addEventListener('click', function(e) {
    if (e.target === document.getElementById('infoModal')) {
        closeModal();
    }
});

window.addEventListener('resize', function() {
    if (map) {
        setTimeout(() => map.invalidateSize(), 100);
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModal();
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        getCurrentLocation();
    }
});

// Автообновление
setInterval(() => {
    if (map && markers.length > 0) {
        fetchPointsFromServer().catch(() => {});
    }
}, 30000);

console.log('🚀 PlasticBoy script готов к работе');

// Быстрая инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Инициализация PlasticBoy');
    
    // Инициализация кнопок
    initControlButtons();
    
    // Ждем загрузки Leaflet
    waitForLeaflet();
});

// Ожидание загрузки Leaflet
function waitForLeaflet() {
    if (typeof L !== 'undefined') {
        console.log('✅ Leaflet загружен');
        setTimeout(initMap, 100);
    } else {
        console.log('⏳ Ожидание Leaflet...');
        setTimeout(waitForLeaflet, 100);
    }
}

// Инициализация карты
function initMap() {
    if (isAppInitialized || !document.getElementById('map')) return;
    
    console.log('🗺️ Инициализация карты');
    
    try {
        map = L.map('map', {
            zoomControl: true,
            attributionControl: true,
            preferCanvas: true,
            maxZoom: 18,
            zoomSnap: 0.5
        }).setView(ALMATY_CENTER, 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18,
            keepBuffer: 2,
            updateWhenIdle: false
        }).addTo(map);
        
        // Добавляем стили
        addMapStyles();
        
        // Уведомляем систему загрузки
        if (window.LoaderAPI) {
            window.LoaderAPI.onMapReady();
        }
        
        // Глобальный доступ
        window.map = map;
        
        // Обновляем размер
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                console.log('✅ Карта готова');
                loadPoints();
            }
        }, 200);
        
        // Автообновление с умным кэшированием
        setInterval(() => {
            loadPoints(); // Автоматически проверит кэш
        }, 30000);
        
        // Принудительное обновление каждые 5 минут
        setInterval(() => {
            loadPoints(true);
        }, 5 * 60 * 1000);
        
        isAppInitialized = true;
        
    } catch (error) {
        console.error('❌ Ошибка инициализации карты:', error);
        retryMapInit();
    }
}

// Повторная попытка инициализации карты
function retryMapInit() {
    if (isRetrying) return;
    isRetrying = true;
    
    console.log('🔄 Повторная инициализация карты...');
    setTimeout(() => {
        isRetrying = false;
        initMap();
    }, 2000);
}

// Стили для карты
function addMapStyles() {
    if (!document.getElementById('map-styles')) {
        const style = document.createElement('style');
        style.id = 'map-styles';
        style.textContent = `
            .leaflet-tile-pane {
                filter: grayscale(100%) contrast(1.1) brightness(1.05) !important;
            }
            
            .leaflet-marker-pane,
            .leaflet-popup-pane,
            .leaflet-control-container {
                filter: none !important;
            }
            
            .leaflet-container {
                background: #f8f9fa !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            }
            
            .marker-icon {
                background: none !important;
                border: none !important;
            }
            
            .marker-dot {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: 0 3px 8px rgba(0,0,0,0.25);
                transition: transform 0.2s ease;
                cursor: pointer;
            }
            
            .marker-dot:hover {
                transform: scale(1.1);
            }
            
            .marker-dot.available {
                background: linear-gradient(45deg, #4CAF50, #45a049);
            }
            
            .marker-dot.collected {
                background: linear-gradient(45deg, #f44336, #e53935);
            }
            
            .popup-content {
                min-width: 200px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .popup-content h3 {
                margin: 0 0 10px 0;
                color: #333;
                font-size: 1rem;
                font-weight: 600;
            }
            
            .status {
                margin: 8px 0;
                font-weight: 600;
                font-size: 0.9rem;
            }
            
            .status.available {
                color: #4CAF50;
            }
            
            .status.collected {
                color: #f44336;
            }
            
            .collector-info {
                background: #f8f9fa;
                padding: 8px;
                border-radius: 6px;
                margin: 8px 0;
                font-size: 0.85rem;
            }
            
            .collector-info p {
                margin: 4px 0;
            }
            
            .details-btn {
                background: linear-gradient(45deg, #667eea, #764ba2);
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.85rem;
                margin-top: 8px;
                width: 100%;
                transition: background 0.2s;
            }
            
            .details-btn:hover {
                background: linear-gradient(45deg, #5a67d8, #6b46c1);
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
                transition: transform 0.2s ease;
            }
            
            .user-dot:hover {
                transform: scale(1.1);
            }
        `;
        document.head.appendChild(style);
    }
}

// Инициализация кнопок управления
function initControlButtons() {
    const locationBtn = document.querySelector('.location-btn');
    
    if (locationBtn) {
        locationBtn.addEventListener('mousedown', function() {
            this.style.transform = 'translateY(-1px)';
        }, { passive: true });
        
        locationBtn.addEventListener('mouseup', function() {
            this.style.transform = '';
        }, { passive: true });
        
        // Мобильные события
        locationBtn.addEventListener('touchstart', function() {
            this.style.transform = 'translateY(-1px)';
        }, { passive: true });
        
        locationBtn.addEventListener('touchend', function() {
            this.style.transform = '';
        }, { passive: true });
    }
}

// Загрузка точек с кэшированием
async function loadPoints(forceRefresh = false) {
    if (!map) {
        console.log('⏳ Карта не готова для загрузки точек');
        return;
    }
    
    // Проверяем кэш если не принудительное обновление
    if (!forceRefresh) {
        const cached = CacheManager.getCachedPoints();
        if (cached && !cached.isExpired) {
            console.log('⚡ Используем кэшированные точки');
            pointsCache = cached.points;
            updateMap(cached.points);
            updateStats(cached.points);
            
            // Уведомляем систему загрузки
            if (window.LoaderAPI) {
                window.LoaderAPI.onPointsLoaded();
            }
            
            return cached.points;
        } else if (cached && cached.isExpired) {
            console.log('📦 Показываем устаревший кэш, обновляем в фоне');
            // Показываем старые данные сразу
            pointsCache = cached.points;
            updateMap(cached.points);
            updateStats(cached.points);
            
            if (window.LoaderAPI) {
                window.LoaderAPI.onPointsLoaded();
            }
            
            // Продолжаем загрузку новых данных в фоне
        }
    }
    
    try {
        console.log('🌐 Загрузка точек с сервера...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут
        
        const response = await fetch('/api/points', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const points = await response.json();
        console.log(`✅ Загружено ${points.length} точек с сервера`);
        
        // Сохраняем в кэш
        CacheManager.savePoints(points);
        
        pointsCache = points;
        updateMap(points);
        updateStats(points);
        
        // Уведомляем систему загрузки
        if (window.LoaderAPI) {
            window.LoaderAPI.onPointsLoaded();
        }
        
        return points;
        
    } catch (error) {
        console.error('❌ Ошибка загрузки точек:', error);
        
        // При ошибке пытаемся использовать любой доступный кэш
        const cached = CacheManager.getCachedPoints();
        if (cached) {
            console.log('📦 Используем резервный кэш из-за ошибки сети');
            pointsCache = cached.points;
            updateMap(cached.points);
            updateStats(cached.points);
            
            showNotification('Используются кэшированные данные', 'warning');
        } else {
            showNotification('Ошибка загрузки данных', 'error');
        }
        
        // Уведомляем систему загрузки даже при ошибке
        if (window.LoaderAPI) {
            window.LoaderAPI.onPointsLoaded();
        }
        
        throw error;
    }
}

// Обновление карты
function updateMap(points) {
    if (!map || !points) return;
    
    console.log(`🗺️ Обновление карты с ${points.length} точками`);
    
    // Очищаем маркеры
    markers.forEach(marker => map.removeLayer(marker));
    markers.length = 0;
    
    // Добавляем новые маркеры
    points.forEach(point => {
        const isAvailable = point.status === 'available';
        
        const icon = L.divIcon({
            className: 'marker-icon',
            html: `<div class="marker-dot ${isAvailable ? 'available' : 'collected'}"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        
        const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon });
        
        // Popup
        let popupContent = `
            <div class="popup-content">
                <h3>${point.name}</h3>
                <p class="status ${point.status}">
                    ${isAvailable ? '🟢 Доступна' : '🔴 Собрана'}
                </p>
        `;
        
        if (!isAvailable && point.collectorInfo) {
            popupContent += `
                <div class="collector-info">
                    <p><strong>Собрал:</strong> ${point.collectorInfo.name}</p>
                    ${point.collectorInfo.signature ? `<p><strong>Сообщение:</strong> ${point.collectorInfo.signature}</p>` : ''}
                    <p><strong>Время:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>
                </div>
                <button onclick="showPointDetails('${point.id}')" class="details-btn">Подробнее</button>
            `;
        }
        
        popupContent += '</div>';
        marker.bindPopup(popupContent);
        marker.addTo(map);
        markers.push(marker);
    });
    
    // Глобальный доступ
    window.markers = markers;
    
    console.log(`✅ Добавлено ${markers.length} маркеров`);
}

// Обновление статистики
function updateStats(points) {
    if (!points) return;
    
    const available = points.filter(p => p.status === 'available').length;
    const collected = points.filter(p => p.status === 'collected').length;
    
    const availableElement = document.getElementById('availableCount');
    const collectedElement = document.getElementById('collectedCount');
    
    if (availableElement && collectedElement) {
        animateNumber(availableElement, parseInt(availableElement.textContent) || 0, available);
        animateNumber(collectedElement, parseInt(collectedElement.textContent) || 0, collected);
    }
    
    console.log(`📊 Статистика: ${available} доступно, ${collected} собрано`);
}

// Анимация чисел
function animateNumber(element, from, to) {
    if (from === to) return;
    
    const duration = 600;
    const steps = 20;
    const stepValue = (to - from) / steps;
    const stepDuration = duration / steps;
    
    let current = from;
    let step = 0;
    
    element.style.transform = 'scale(1.05)';
    element.style.transition = 'transform 0.3s ease';
    
    const timer = setInterval(() => {
        step++;
        current += stepValue;
        
        if (step >= steps) {
            element.textContent = to;
            element.style.transform = 'scale(1)';
            clearInterval(timer);
        } else {
            element.textContent = Math.round(current);
        }
    }, stepDuration);
}

// Геолокация
function getCurrentLocation() {
    const locationBtn = document.querySelector('.location-btn');
    
    if (!navigator.geolocation) {
        showNotification('Геолокация не поддерживается', 'error');
        return;
    }
    
    if (!map) {
        showNotification('Карта не готова', 'error');
        return;
    }
    
    const originalText = locationBtn.innerHTML;
    locationBtn.innerHTML = '⏳ Определение...';
    locationBtn.disabled = true;
    locationBtn.style.opacity = '0.7';
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Простая иконка пользователя
            const userIcon = L.divIcon({
                className: 'user-marker',
                html: '<div class="user-dot"></div>',
                iconSize: [22, 22],
                iconAnchor: [11, 11]
            });
            
            // Удаляем предыдущий маркер
            if (window.userMarker) {
                map.removeLayer(window.userMarker);
            }
            
            // Добавляем новый маркер
            window.userMarker = L.marker([lat, lng], { icon: userIcon })
                .addTo(map)
                .bindPopup(`
                    <div style="text-align: center; min-width: 140px;">
                        <strong>📍 Ваше местоположение</strong><br>
                        <small style="color: #666;">
                            ${lat.toFixed(4)}, ${lng.toFixed(4)}
                        </small>
                    </div>
                `);
            
            // Центрируем карту
            map.flyTo([lat, lng], 16, {
                duration: 1.2,
                easeLinearity: 0.5
            });
            
            showNotification('Местоположение найдено', 'success');
            
            // Восстанавливаем кнопку
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
            locationBtn.style.opacity = '';
        },
        function(error) {
            console.error('Ошибка геолокации:', error);
            let errorMessage = 'Не удалось найти местоположение';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Доступ запрещен';
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

// Детали точки
async function showPointDetails(pointId) {
    try {
        const response = await fetch(`/api/point/${pointId}/info`);
        if (!response.ok) {
            throw new Error('Ошибка загрузки');
        }
        
        const point = await response.json();
        
        let modalContent = `
            <h3 style="color: #667eea; margin-bottom: 12px;">${point.name}</h3>
            <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                <p><strong>Статус:</strong> <span style="color: ${point.status === 'collected' ? '#f44336' : '#4CAF50'}">${point.status === 'collected' ? 'Собрана' : 'Доступна'}</span></p>
                <p><strong>Координаты:</strong> ${point.coordinates.lat.toFixed(4)}, ${point.coordinates.lng.toFixed(4)}</p>
            </div>
        `;
        
        if (point.status === 'collected' && point.collectorInfo) {
            modalContent += `
                <div style="border-left: 3px solid #667eea; padding-left: 12px; margin: 12px 0;">
                    <h4 style="color: #333; margin-bottom: 8px;">Сборщик:</h4>
                    <p><strong>Имя:</strong> ${point.collectorInfo.name}</p>
                    ${point.collectorInfo.signature ? `<p><strong>Сообщение:</strong> <em>"${point.collectorInfo.signature}"</em></p>` : ''}
                    <p><strong>Время:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>
                </div>
            `;
            
            if (point.collectorInfo.selfie) {
                modalContent += `
                    <div style="margin-top: 15px; text-align: center;">
                        <strong style="color: #667eea;">Селфи:</strong><br>
                        <img src="${point.collectorInfo.selfie}" 
                             style="max-width: 100%; max-height: 250px; border-radius: 8px; margin-top: 8px; box-shadow: 0 3px 10px rgba(0,0,0,0.1);"
                             alt="Селфи сборщика">
                    </div>
                `;
            }
        }
        
        document.getElementById('modalTitle').innerHTML = 'Информация о модели';
        document.getElementById('modalBody').innerHTML = modalContent;
        document.getElementById('infoModal').style.display = 'block';
        
    } catch (error) {
        console.error('Ошибка загрузки информации:', error);
        showNotification('Ошибка загрузки информации', 'error');
    }
}

// Закрытие модального окна
function closeModal() {
    document.getElementById('infoModal').style.display = 'none';
}

// Уведомления с поддержкой кэша
function showNotification(message, type = 'info') {
    // Простая реализация с логированием
    const timestamp = new Date().toLocaleTimeString();
    const icon = {
        'info': 'ℹ️',
        'success': '✅', 
        'warning': '⚠️',
        'error': '❌'
    }[type] || 'ℹ️';
    
    console.log(`[${timestamp}] ${icon} ${message}`);
    
    // Дополнительное логирование для разных типов
    if (type === 'error') {
        console.error(`[PlasticBoy Error] ${message}`);
    } else if (type === 'warning') {
        console.warn(`[PlasticBoy Warning] ${message}`);
    } else if (type === 'success') {
        console.log(`[PlasticBoy Success] ${message}`);
    }
}

// Функция принудительного обновления
function forceRefresh() {
    console.log('🔄 Принудительное обновление данных');
    CacheManager.clearCache();
    loadPoints(true);
}

// Информация о кэше для отладки
function getCacheStatus() {
    const info = CacheManager.getCacheInfo();
    if (!info) {
        console.log('📭 Кэш пуст');
        return null;
    }
    
    console.log(`💾 Кэш: ${info.pointsCount} точек, возраст ${info.age}с, ${info.isExpired ? 'устарел' : 'актуален'}`);
    return info;
}

// Обработчики событий
window.addEventListener('click', function(event) {
    const modal = document.getElementById('infoModal');
    if (event.target === modal) {
        closeModal();
    }
}, { passive: true });

window.addEventListener('resize', function() {
    if (map) {
        clearTimeout(window.resizeTimeout);
        window.resizeTimeout = setTimeout(() => {
            map.invalidateSize();
        }, 250);
    }
}, { passive: true });

// Сетевые события с поддержкой кэша
window.addEventListener('online', function() {
    console.log('🌐 Соединение восстановлено');
    showNotification('Соединение восстановлено', 'success');
    if (isAppInitialized) {
        // При восстановлении сети принудительно обновляем данные
        setTimeout(() => loadPoints(true), 1000);
    }
}, { passive: true });

window.addEventListener('offline', function() {
    console.log('📱 Работа в оффлайн режиме');
    showNotification('Работа в оффлайн режиме', 'warning');
    
    // Проверяем доступность кэша
    const cacheInfo = CacheManager.getCacheInfo();
    if (cacheInfo) {
        console.log(`💾 Доступен оффлайн кэш: ${cacheInfo.pointsCount} точек`);
    } else {
        console.log('❌ Нет данных для оффлайн режима');
    }
}, { passive: true });

// Обработка ошибок загрузки изображений
window.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG' && e.target.src.includes('openstreetmap')) {
        console.warn('⚠️ Ошибка загрузки тайлов карты');
    }
}, { passive: true });

// Клавиши
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
    
    if (event.ctrlKey && event.key === 'l') {
        event.preventDefault();
        getCurrentLocation();
    }
    
    // Принудительное обновление по Ctrl+R
    if (event.ctrlKey && event.key === 'r') {
        event.preventDefault();
        forceRefresh();
    }
    
    // Информация о кэше по Ctrl+I
    if (event.ctrlKey && event.key === 'i') {
        event.preventDefault();
        getCacheStatus();
    }
});

// Экспорт функций с поддержкой кэша
window.PlasticBoy = {
    map,
    markers,
    loadPoints,
    getCurrentLocation,
    showPointDetails,
    closeModal,
    initMap,
    updateMap,
    updateStats,
    showNotification,
    // Новые функции кэширования
    forceRefresh,
    getCacheStatus,
    clearCache: () => CacheManager.clearCache(),
    cacheManager: CacheManager
};

// Псевдонимы для совместимости
window.fastLoadPoints = loadPoints;
window.fastUpdateMap = updateMap;
window.fastUpdateStats = updateStats;

// Инициализация кэша при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Показываем информацию о кэше при запуске
    const cacheInfo = CacheManager.getCacheInfo();
    if (cacheInfo) {
        console.log(`🎯 PlasticBoy запущен с кэшем: ${cacheInfo.pointsCount} точек (${cacheInfo.age}с назад)`);
    } else {
        console.log('🎯 PlasticBoy запущен без кэша');
    }
});

console.log('🚀 PlasticBoy script с кэшированием готов к работе');
