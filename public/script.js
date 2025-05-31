// УЛЬТРА-БЫСТРЫЙ SCRIPT.JS с кэшированием для PlasticBoy
let map;
let markers = [];

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// Флаги состояния
let isMapInitialized = false;
let pointsLoaded = false;

// Определение мобильного устройства
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// === СИСТЕМА КЭШИРОВАНИЯ ===
const CACHE_KEY = 'plasticboy_points_cache';
const CACHE_TIMESTAMP_KEY = 'plasticboy_cache_timestamp';
const CACHE_DURATION = 5 * 60 * 1000; // 5 минут
const QUICK_CACHE_KEY = 'plasticboy_quick_cache';

// Кэш для быстрого доступа
let pointsCache = null;
let markersPool = []; // Пул переиспользуемых маркеров

console.log('PlasticBoy Ultra-Fast loading - Mobile:', isMobile);

// === БЫСТРОЕ КЭШИРОВАНИЕ ===
function saveToCache(points) {
    try {
        const cacheData = {
            points: points,
            timestamp: Date.now(),
            version: '1.0'
        };
        
        // Основной кэш
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
        
        // Быстрый кэш (упрощенные данные)
        const quickData = points.map(p => ({
            id: p.id,
            name: p.name,
            coordinates: p.coordinates,
            status: p.status,
            collectorInfo: p.collectorInfo ? {
                name: p.collectorInfo.name,
                signature: p.collectorInfo.signature
            } : null,
            collectedAt: p.collectedAt
        }));
        
        sessionStorage.setItem(QUICK_CACHE_KEY, JSON.stringify(quickData));
        pointsCache = points;
        
        console.log(`💾 Cached ${points.length} points`);
    } catch (error) {
        console.warn('Cache save error:', error);
    }
}

function loadFromCache() {
    try {
        // Сначала пробуем быстрый кэш
        const quickCache = sessionStorage.getItem(QUICK_CACHE_KEY);
        if (quickCache) {
            const quickPoints = JSON.parse(quickCache);
            console.log(`⚡ Quick cache loaded: ${quickPoints.length} points`);
            return quickPoints;
        }
        
        // Затем основной кэш
        const cached = localStorage.getItem(CACHE_KEY);
        const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
        
        if (cached && timestamp) {
            const age = Date.now() - parseInt(timestamp);
            if (age < CACHE_DURATION) {
                const cacheData = JSON.parse(cached);
                console.log(`💾 Cache loaded: ${cacheData.points.length} points (age: ${Math.round(age/1000)}s)`);
                pointsCache = cacheData.points;
                return cacheData.points;
            } else {
                console.log('🗑️ Cache expired, clearing');
                clearCache();
            }
        }
        
        return null;
    } catch (error) {
        console.warn('Cache load error:', error);
        clearCache();
        return null;
    }
}

function clearCache() {
    try {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(CACHE_TIMESTAMP_KEY);
        sessionStorage.removeItem(QUICK_CACHE_KEY);
        pointsCache = null;
        console.log('🗑️ Cache cleared');
    } catch (error) {
        console.warn('Cache clear error:', error);
    }
}

// === ПУЛ МАРКЕРОВ ДЛЯ ПЕРЕИСПОЛЬЗОВАНИЯ ===
function createMarkerPool(size = 50) {
    markersPool = [];
    for (let i = 0; i < size; i++) {
        const icon = L.divIcon({
            className: 'custom-marker',
            html: '<div class="marker-dot available"></div>',
            iconSize: isMobile ? [16, 16] : [20, 20],
            iconAnchor: isMobile ? [8, 8] : [10, 10]
        });
        
        const marker = L.marker([0, 0], { icon });
        markersPool.push(marker);
    }
    console.log(`🎯 Created marker pool: ${size} markers`);
}

function getMarkerFromPool() {
    if (markersPool.length > 0) {
        return markersPool.pop();
    }
    
    // Создаем новый если пул пуст
    const icon = L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-dot available"></div>',
        iconSize: isMobile ? [16, 16] : [20, 20],
        iconAnchor: isMobile ? [8, 8] : [10, 10]
    });
    
    return L.marker([0, 0], { icon });
}

function returnMarkerToPool(marker) {
    if (markersPool.length < 100) { // Ограничиваем размер пула
        markersPool.push(marker);
    }
}

// === ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ===
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Ultra-Fast PlasticBoy starting');
    
    // Создаем пул маркеров заранее
    setTimeout(() => createMarkerPool(), 100);
    
    if (isMobile) {
        initMobileApp();
    } else {
        initControlButtons();
        setTimeout(initMap, 200);
    }
});

// === МОБИЛЬНАЯ ИНИЦИАЛИЗАЦИЯ ===
function initMobileApp() {
    console.log('📱 Starting mobile app initialization');
    
    // Пробуем загрузить из кэша сразу
    const cachedPoints = loadFromCache();
    if (cachedPoints && cachedPoints.length > 0) {
        console.log('⚡ Found cached points, pre-loading...');
        // Предзагружаем маркеры из кэша в фоне
        preloadMarkersFromCache(cachedPoints);
    }
    
    // Быстро скрываем загрузочный экран
    setTimeout(() => {
        hideLoadingScreen();
        setTimeout(initMap, 100);
    }, 800);
}

function preloadMarkersFromCache(points) {
    // Подготавливаем маркеры в фоне пока карта не готова
    window.preloadedMarkers = points.map(point => {
        const isAvailable = point.status === 'available';
        return {
            point: point,
            isAvailable: isAvailable,
            lat: point.coordinates.lat,
            lng: point.coordinates.lng
        };
    });
    console.log(`⚡ Pre-loaded ${points.length} markers data`);
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const mainContent = document.getElementById('mainContent');
    
    if (loadingScreen) {
        loadingScreen.style.transition = 'opacity 0.2s ease';
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 200);
    }
    
    if (mainContent) {
        mainContent.style.opacity = '1';
        mainContent.classList.add('loaded');
    }
}

// === ИНИЦИАЛИЗАЦИЯ КАРТЫ ===
function initMap() {
    if (isMapInitialized) {
        console.log('Map already initialized');
        return;
    }
    
    console.log('🗺️ Initializing map...');
    
    try {
        if (typeof L === 'undefined') {
            console.error('Leaflet not loaded, retrying...');
            setTimeout(initMap, 500);
            return;
        }
        
        // Быстрые настройки карты
        const mapOptions = {
            zoomControl: true,
            attributionControl: !isMobile,
            preferCanvas: true,
            maxZoom: 18,
            minZoom: 10,
            zoomAnimation: !isMobile, // Отключаем анимации на мобильных
            fadeAnimation: !isMobile,
            markerZoomAnimation: !isMobile
        };
        
        if (isMobile) {
            mapOptions.tap = true;
            mapOptions.touchZoom = true;
            mapOptions.dragging = true;
            mapOptions.scrollWheelZoom = false;
            mapOptions.doubleClickZoom = true;
            mapOptions.boxZoom = false;
            mapOptions.keyboard = false;
        }
        
        map = L.map('map', mapOptions);
        map.setView(ALMATY_CENTER, 13);
        
        // Быстрые тайлы
        const tileOptions = {
            attribution: isMobile ? '© OSM' : '© OpenStreetMap contributors',
            maxZoom: 18,
            keepBuffer: isMobile ? 1 : 2,
            updateWhenIdle: isMobile,
            updateWhenZooming: !isMobile,
            crossOrigin: true
        };
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', tileOptions).addTo(map);
        
        addMapStyles();
        
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                window.map = map;
                isMapInitialized = true;
                console.log('✅ Map initialized');
                
                // Сначала пробуем кэш, потом сеть
                loadPointsFast();
                initControlButtons();
            }
        }, 50);
        
    } catch (error) {
        console.error('Map initialization error:', error);
        showNotification('Ошибка инициализации карты', 'error');
        setTimeout(initMap, 1000);
    }
}

// === УЛЬТРА-БЫСТРАЯ ЗАГРУЗКА ТОЧЕК ===
async function loadPointsFast() {
    if (pointsLoaded) return;
    
    console.log('⚡ Fast loading points...');
    
    // 1. Сначала загружаем из кэша
    const cachedPoints = loadFromCache();
    if (cachedPoints && cachedPoints.length > 0) {
        console.log('⚡ Using cached points');
        updateMapFast(cachedPoints);
        updateStats(cachedPoints);
        pointsLoaded = true;
        
        // Показываем кэшированные данные мгновенно
        showNotification(`Загружено ${cachedPoints.length} точек (кэш)`, 'success');
        
        // В фоне обновляем кэш
        setTimeout(() => {
            loadPointsFromNetwork(true);
        }, 1000);
        
        return;
    }
    
    // 2. Если кэша нет, загружаем из сети
    loadPointsFromNetwork(false);
}

async function loadPointsFromNetwork(isBackgroundUpdate = false) {
    try {
        console.log(isBackgroundUpdate ? '🔄 Background update...' : '🌐 Loading from network...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, isMobile ? 8000 : 5000); // Быстрые таймауты
        
        const response = await fetch('/api/points', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': isBackgroundUpdate ? 'no-cache' : 'max-age=300'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const points = await response.json();
        console.log(`📡 Network loaded: ${points.length} points`);
        
        if (Array.isArray(points)) {
            // Сохраняем в кэш
            saveToCache(points);
            
            if (!isBackgroundUpdate) {
                updateMapFast(points);
                updateStats(points);
                pointsLoaded = true;
                showNotification(`Загружено ${points.length} точек`, 'success');
            } else {
                // Проверяем изменения
                const hasChanges = checkForChanges(pointsCache, points);
                if (hasChanges) {
                    console.log('🔄 Changes detected, updating map');
                    updateMapFast(points);
                    updateStats(points);
                    showNotification('Карта обновлена', 'info');
                }
            }
            
            if (typeof window.PlasticBoyLoader !== 'undefined') {
                window.PlasticBoyLoader.onPointsLoaded();
            }
        }
        
    } catch (error) {
        console.error('Network error:', error);
        
        if (!isBackgroundUpdate) {
            if (error.name === 'AbortError') {
                showNotification('Медленное соединение', 'warning');
            } else {
                showNotification('Ошибка загрузки точек', 'error');
            }
            
            // Retry через 3 секунды
            setTimeout(() => {
                if (!pointsLoaded) {
                    loadPointsFromNetwork(false);
                }
            }, 3000);
        }
    }
}

function checkForChanges(oldPoints, newPoints) {
    if (!oldPoints || !newPoints) return true;
    if (oldPoints.length !== newPoints.length) return true;
    
    // Быстрая проверка по хэшу статусов
    const oldHash = oldPoints.map(p => `${p.id}:${p.status}`).join(',');
    const newHash = newPoints.map(p => `${p.id}:${p.status}`).join(',');
    
    return oldHash !== newHash;
}

// === УЛЬТРА-БЫСТРОЕ ОБНОВЛЕНИЕ КАРТЫ ===
function updateMapFast(points) {
    if (!map || !isMapInitialized) {
        console.warn('Map not ready, retrying...');
        setTimeout(() => updateMapFast(points), 500);
        return;
    }
    
    const startTime = performance.now();
    console.log(`⚡ Ultra-fast updating map with ${points.length} points`);
    
    try {
        // Используем пул маркеров для переиспользования
        clearMarkersFast();
        
        // Пакетное добавление маркеров
        const fragment = document.createDocumentFragment();
        const newMarkers = [];
        
        // Если есть предзагруженные маркеры, используем их
        const markerData = window.preloadedMarkers || points.map(point => ({
            point: point,
            isAvailable: point.status === 'available',
            lat: point.coordinates.lat,
            lng: point.coordinates.lng
        }));
        
        markerData.forEach((data, index) => {
            try {
                const { point, isAvailable, lat, lng } = data;
                
                if (typeof lat !== 'number' || typeof lng !== 'number') {
                    console.warn('Invalid coordinates:', point);
                    return;
                }
                
                // Получаем маркер из пула
                const marker = getMarkerFromPool();
                
                // Быстро обновляем позицию и стиль
                marker.setLatLng([lat, lng]);
                
                // Обновляем иконку
                const iconHtml = `<div class="marker-dot ${isAvailable ? 'available' : 'collected'}"></div>`;
                marker.getElement().innerHTML = iconHtml;
                
                // Быстрый popup
                const popupContent = createPopupContentFast(point, isAvailable);
                marker.bindPopup(popupContent, {
                    maxWidth: isMobile ? 250 : 300,
                    className: 'custom-popup'
                });
                
                marker.addTo(map);
                newMarkers.push(marker);
                
            } catch (error) {
                console.error(`Error adding marker ${index}:`, error);
            }
        });
        
        markers = newMarkers;
        window.markers = markers;
        
        // Очищаем предзагруженные данные
        delete window.preloadedMarkers;
        
        addMarkerStyles();
        
        const endTime = performance.now();
        console.log(`✅ Map updated in ${Math.round(endTime - startTime)}ms with ${markers.length} markers`);
        
    } catch (error) {
        console.error('Error updating map:', error);
        showNotification('Ошибка обновления карты', 'error');
    }
}

function clearMarkersFast() {
    markers.forEach(marker => {
        try {
            map.removeLayer(marker);
            returnMarkerToPool(marker);
        } catch (e) {
            console.warn('Error removing marker:', e);
        }
    });
    markers = [];
}

function createPopupContentFast(point, isAvailable) {
    let content = `
        <div class="popup-content">
            <h3>${point.name || 'Модель'}</h3>
            <div class="status ${point.status}">
                ${isAvailable ? '🟢 Доступна для сбора' : '🔴 Уже собрана'}
            </div>`;
    
    if (!isAvailable && point.collectorInfo) {
        content += `
            <div class="collector-info">
                <p><strong>Собрал:</strong> ${point.collectorInfo.name}</p>`;
        
        if (point.collectorInfo.signature) {
            content += `<p><strong>Сообщение:</strong> "${point.collectorInfo.signature}"</p>`;
        }
        
        if (point.collectedAt) {
            content += `<p><strong>Время:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>`;
        }
        
        content += '</div>';
        
        if (point.collectorInfo.selfie) {
            content += `<button onclick="showPointDetails('${point.id}')" class="details-btn">Посмотреть селфи</button>`;
        }
    }
    
    content += '</div>';
    return content;
}

// === ОСТАЛЬНЫЕ ФУНКЦИИ (ОПТИМИЗИРОВАННЫЕ) ===
function updateStats(points) {
    try {
        const available = points.filter(p => p.status === 'available').length;
        const collected = points.filter(p => p.status === 'collected').length;
        
        const availableEl = document.getElementById('availableCount');
        const collectedEl = document.getElementById('collectedCount');
        
        if (availableEl) availableEl.textContent = available;
        if (collectedEl) collectedEl.textContent = collected;
        
        console.log(`📊 Stats: ${available} available, ${collected} collected`);
        
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

function initControlButtons() {
    const locationBtn = document.querySelector('.location-btn');
    if (locationBtn && !locationBtn.hasAttribute('data-initialized')) {
        locationBtn.setAttribute('data-initialized', 'true');
        locationBtn.addEventListener('click', getCurrentLocation);
    }
}

function getCurrentLocation() {
    const locationBtn = document.querySelector('.location-btn');
    
    if (!navigator.geolocation) {
        showNotification('Геолокация не поддерживается', 'error');
        return;
    }
    
    if (locationBtn) {
        locationBtn.innerHTML = '⏳ Определение...';
        locationBtn.disabled = true;
    }
    
    const options = {
        enableHighAccuracy: true,
        timeout: isMobile ? 15000 : 8000,
        maximumAge: 300000
    };
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            if (map && isMapInitialized) {
                if (window.userMarker) {
                    map.removeLayer(window.userMarker);
                }
                
                const userIcon = L.divIcon({
                    className: 'user-marker',
                    html: `<div style="
                        background: linear-gradient(45deg, #007bff, #0056b3);
                        width: ${isMobile ? '18px' : '22px'}; 
                        height: ${isMobile ? '18px' : '22px'}; 
                        border-radius: 50%; 
                        border: 2px solid white; 
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    "></div>`,
                    iconSize: isMobile ? [18, 18] : [22, 22],
                    iconAnchor: isMobile ? [9, 9] : [11, 11]
                });
                
                window.userMarker = L.marker([lat, lng], { icon: userIcon })
                    .addTo(map)
                    .bindPopup(`
                        <div style="text-align: center;">
                            <strong>📍 Ваше местоположение</strong><br>
                            <small>${lat.toFixed(4)}, ${lng.toFixed(4)}</small>
                        </div>
                    `);
                
                map.flyTo([lat, lng], 15, { duration: 1 });
                showNotification('Местоположение найдено', 'success');
            }
            
            if (locationBtn) {
                locationBtn.innerHTML = '📍 Моё местоположение';
                locationBtn.disabled = false;
            }
        },
        function(error) {
            console.error('Geolocation error:', error);
            
            let errorMessage = 'Не удалось найти местоположение';
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
            
            if (locationBtn) {
                locationBtn.innerHTML = '📍 Моё местоположение';
                locationBtn.disabled = false;
            }
        },
        options
    );
}

async function showPointDetails(pointId) {
    try {
        const response = await fetch(`/api/point/${pointId}/info`);
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        const point = await response.json();
        
        let modalContent = `
            <h3 style="color: #667eea; margin-bottom: 15px;">${point.name}</h3>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <p><strong>Статус:</strong> 
                    <span style="color: ${point.status === 'collected' ? '#f44336' : '#4CAF50'}">
                        ${point.status === 'collected' ? 'Собрана' : 'Доступна'}
                    </span>
                </p>
            </div>`;
        
        if (point.status === 'collected' && point.collectorInfo) {
            modalContent += `
                <div style="border-left: 3px solid #667eea; padding-left: 15px; margin: 15px 0;">
                    <h4>Сборщик:</h4>
                    <p><strong>Имя:</strong> ${point.collectorInfo.name}</p>
                    ${point.collectorInfo.signature ? 
                        `<p><strong>Сообщение:</strong> "${point.collectorInfo.signature}"</p>` : ''}
                </div>`;
            
            if (point.collectorInfo.selfie) {
                modalContent += `
                    <div style="text-align: center; margin-top: 15px;">
                        <img src="${point.collectorInfo.selfie}" 
                             style="max-width: 100%; max-height: 250px; border-radius: 8px;"
                             alt="Селфи сборщика">
                    </div>`;
            }
        }
        
        document.getElementById('modalTitle').innerHTML = 'Информация о модели';
        document.getElementById('modalBody').innerHTML = modalContent;
        document.getElementById('infoModal').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading point details:', error);
        showNotification('Ошибка загрузки информации', 'error');
    }
}

function closeModal() {
    document.getElementById('infoModal').style.display = 'none';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = { error: '❌', success: '✅', info: 'ℹ️', warning: '⚠️' };
    
    notification.innerHTML = `
        <div class="notification-content">
            <span>${icons[type] || icons.info} ${message}</span>
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>`;
    
    addNotificationStyles();
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 200);
        }
    }, 3000);
}

// === СТИЛИ ===
function addMapStyles() {
    if (!document.getElementById('map-styles')) {
        const style = document.createElement('style');
        style.id = 'map-styles';
        style.textContent = `
            .leaflet-tile-pane {
                filter: grayscale(100%) contrast(1.1) brightness(1.05) !important;
            }
            .leaflet-marker-pane, .leaflet-popup-pane, .leaflet-control-container {
                filter: none !important;
            }
            .leaflet-container {
                background: #f8f9fa !important;
            }
            .leaflet-control-zoom a {
                width: ${isMobile ? '35px' : '26px'} !important;
                height: ${isMobile ? '35px' : '26px'} !important;
                line-height: ${isMobile ? '35px' : '26px'} !important;
                font-size: 18px !important;
            }`;
        document.head.appendChild(style);
    }
}

function addMarkerStyles() {
    if (!document.getElementById('marker-styles')) {
        const style = document.createElement('style');
        style.id = 'marker-styles';
        style.textContent = `
            .custom-marker { background: none !important; border: none !important; }
            .marker-dot {
                width: ${isMobile ? '16px' : '20px'};
                height: ${isMobile ? '16px' : '20px'};
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                transition: transform 0.2s ease;
                cursor: pointer;
            }
            .marker-dot:hover { transform: scale(1.1); }
            .marker-dot.available { background: linear-gradient(45deg, #4CAF50, #45a049); }
            .marker-dot.collected { background: linear-gradient(45deg, #f44336, #e53935); }
            .popup-content { min-width: ${isMobile ? '200px' : '220px'}; font-size: ${isMobile ? '14px' : '15px'}; }
            .popup-content h3 { margin: 0 0 10px 0; color: #333; font-size: ${isMobile ? '16px' : '18px'}; font-weight: 600; }
            .status { margin: 8px 0; font-weight: 600; }
            .status.available { color: #4CAF50; }
            .status.collected { color: #f44336; }
            .collector-info { background: #f8f9fa; padding: 10px; border-radius: 6px; margin: 10px 0; font-size: ${isMobile ? '12px' : '13px'}; }
            .collector-info p { margin: 4px 0; }
            .details-btn { background: linear-gradient(45deg, #667eea, #764ba2); color: white; border: none; padding: ${isMobile ? '8px 12px' : '10px 16px'}; border-radius: 6px; cursor: pointer; font-size: ${isMobile ? '12px' : '14px'}; width: 100%; margin-top: 8px; }`;
        document.head.appendChild(style);
    }
}

function addNotificationStyles() {
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification { position: fixed; top: 20px; right: 20px; z-index: 2000; background: rgba(255, 255, 255, 0.98); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); padding: 12px 16px; min-width: 250px; max-width: 350px; font-size: ${isMobile ? '14px' : '15px'}; transition: all 0.3s ease; }
            .notification.error { border-left: 4px solid #f44336; }
