// ИСПРАВЛЕННЫЙ SCRIPT.JS для PlasticBoy - Мобильная версия
let map;
let markers = [];

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// Флаги состояния
let isMapInitialized = false;
let pointsLoaded = false;

// Определение мобильного устройства
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

console.log('PlasticBoy loading - Mobile:', isMobile);

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, starting PlasticBoy');
    
    if (isMobile) {
        // Для мобильных - упрощенная инициализация
        initMobileApp();
    } else {
        // Для десктопа - обычная инициализация
        initControlButtons();
        setTimeout(initMap, 500);
    }
});

// Мобильная инициализация
function initMobileApp() {
    console.log('Starting mobile app initialization');
    
    // Быстро скрываем загрузочный экран для мобильных
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        const mainContent = document.getElementById('mainContent');
        
        if (loadingScreen) {
            loadingScreen.style.transition = 'opacity 0.3s ease';
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 300);
        }
        
        if (mainContent) {
            mainContent.style.opacity = '1';
            mainContent.classList.add('loaded');
        }
        
        // Инициализируем карту после скрытия загрузчика
        setTimeout(initMap, 200);
        
    }, 1000);
}

// Инициализация карты
function initMap() {
    if (isMapInitialized) {
        console.log('Map already initialized');
        return;
    }
    
    console.log('Initializing map...');
    
    try {
        // Проверяем наличие Leaflet
        if (typeof L === 'undefined') {
            console.error('Leaflet not loaded');
            setTimeout(initMap, 1000);
            return;
        }
        
        // Настройки карты
        const mapOptions = {
            zoomControl: true,
            attributionControl: !isMobile,
            preferCanvas: true,
            maxZoom: 18,
            minZoom: 10
        };
        
        // Мобильные настройки
        if (isMobile) {
            mapOptions.tap = true;
            mapOptions.touchZoom = true;
            mapOptions.dragging = true;
            mapOptions.scrollWheelZoom = false;
            mapOptions.doubleClickZoom = true;
            mapOptions.boxZoom = false;
            mapOptions.keyboard = false;
        }
        
        // Создаем карту
        map = L.map('map', mapOptions);
        map.setView(ALMATY_CENTER, 13);
        
        // Добавляем тайлы
        const tileOptions = {
            attribution: isMobile ? '© OSM' : '© OpenStreetMap contributors',
            maxZoom: 18,
            keepBuffer: isMobile ? 1 : 2,
            updateWhenIdle: isMobile,
            updateWhenZooming: !isMobile
        };
        
        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', tileOptions);
        tileLayer.addTo(map);
        
        // Применяем стили
        addMapStyles();
        
        // Обновляем размер карты
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                window.map = map;
                isMapInitialized = true;
                console.log('Map initialized successfully');
                
                // Загружаем точки
                loadPoints();
                
                // Инициализируем кнопки
                initControlButtons();
            }
        }, 100);
        
    } catch (error) {
        console.error('Map initialization error:', error);
        showNotification('Ошибка инициализации карты', 'error');
        
        // Повторная попытка через 2 секунды
        setTimeout(initMap, 2000);
    }
}

// Загрузка точек
async function loadPoints() {
    if (pointsLoaded) {
        console.log('Points already loaded');
        return;
    }
    
    console.log('Loading points...');
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            console.log('Request timeout');
        }, 15000);
        
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
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const points = await response.json();
        console.log(`Successfully loaded ${points.length} points`);
        
        if (Array.isArray(points)) {
            updateMap(points);
            updateStats(points);
            pointsLoaded = true;
            
            if (typeof window.PlasticBoyLoader !== 'undefined' && 
                typeof window.PlasticBoyLoader.onPointsLoaded === 'function') {
                window.PlasticBoyLoader.onPointsLoaded();
            }
            
            showNotification(`Загружено ${points.length} точек`, 'success');
        } else {
            throw new Error('Invalid response format');
        }
        
    } catch (error) {
        console.error('Error loading points:', error);
        
        if (error.name === 'AbortError') {
            showNotification('Превышено время ожидания', 'warning');
        } else {
            showNotification('Ошибка загрузки точек', 'error');
        }
        
        setTimeout(() => {
            if (!pointsLoaded) {
                console.log('Retrying to load points...');
                loadPoints();
            }
        }, 5000);
    }
}

// Обновление карты
function updateMap(points) {
    if (!map || !isMapInitialized) {
        console.warn('Map not ready for update');
        setTimeout(() => updateMap(points), 1000);
        return;
    }
    
    console.log(`Updating map with ${points.length} points`);
    
    try {
        // Очищаем старые маркеры
        markers.forEach(marker => {
            try {
                map.removeLayer(marker);
            } catch (e) {
                console.warn('Error removing marker:', e);
            }
        });
        markers = [];
        
        // Добавляем новые маркеры
        points.forEach((point, index) => {
            try {
                if (!point.coordinates || 
                    typeof point.coordinates.lat !== 'number' || 
                    typeof point.coordinates.lng !== 'number') {
                    console.warn('Invalid point coordinates:', point);
                    return;
                }
                
                const isAvailable = point.status === 'available';
                
                const icon = L.divIcon({
                    className: 'custom-marker',
                    html: `<div class="marker-dot ${isAvailable ? 'available' : 'collected'}"></div>`,
                    iconSize: isMobile ? [16, 16] : [20, 20],
                    iconAnchor: isMobile ? [8, 8] : [10, 10]
                });
                
                const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon });
                
                let popupContent = `
                    <div class="popup-content">
                        <h3>${point.name || 'Модель'}</h3>
                        <div class="status ${point.status}">
                            ${isAvailable ? '🟢 Доступна для сбора' : '🔴 Уже собрана'}
                        </div>
                `;
                
                if (!isAvailable && point.collectorInfo) {
                    popupContent += `
                        <div class="collector-info">
                            <p><strong>Собрал:</strong> ${point.collectorInfo.name}</p>
                            ${point.collectorInfo.signature ? 
                                `<p><strong>Сообщение:</strong> "${point.collectorInfo.signature}"</p>` : ''
                            }
                            ${point.collectedAt ? 
                                `<p><strong>Время:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>` : ''
                            }
                        </div>
                    `;
                    
                    if (point.collectorInfo.selfie) {
                        popupContent += `<button onclick="showPointDetails('${point.id}')" class="details-btn">Посмотреть селфи</button>`;
                    }
                }
                
                popupContent += '</div>';
                
                marker.bindPopup(popupContent, {
                    maxWidth: isMobile ? 250 : 300,
                    className: 'custom-popup'
                });
                
                marker.addTo(map);
                markers.push(marker);
                
            } catch (error) {
                console.error(`Error adding marker ${index}:`, error);
            }
        });
        
        addMarkerStyles();
        window.markers = markers;
        
        console.log(`Successfully added ${markers.length} markers to map`);
        
    } catch (error) {
        console.error('Error updating map:', error);
        showNotification('Ошибка обновления карты', 'error');
    }
}

// Обновление статистики
function updateStats(points) {
    try {
        const available = points.filter(p => p.status === 'available').length;
        const collected = points.filter(p => p.status === 'collected').length;
        
        const availableEl = document.getElementById('availableCount');
        const collectedEl = document.getElementById('collectedCount');
        
        if (availableEl) availableEl.textContent = available;
        if (collectedEl) collectedEl.textContent = collected;
        
        console.log(`Stats updated: ${available} available, ${collected} collected`);
        
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// Инициализация кнопок
function initControlButtons() {
    console.log('Initializing control buttons');
    
    const locationBtn = document.querySelector('.location-btn');
    if (locationBtn) {
        locationBtn.addEventListener('click', getCurrentLocation);
    }
}

// Геолокация
function getCurrentLocation() {
    console.log('Getting current location');
    
    const locationBtn = document.querySelector('.location-btn');
    
    if (!navigator.geolocation) {
        showNotification('Геолокация не поддерживается', 'error');
        return;
    }
    
    if (locationBtn) {
        const originalText = locationBtn.innerHTML;
        locationBtn.innerHTML = '⏳ Определение...';
        locationBtn.disabled = true;
    }
    
    const options = {
        enableHighAccuracy: true,
        timeout: isMobile ? 20000 : 10000,
        maximumAge: 300000
    };
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            console.log(`Location found: ${lat}, ${lng}`);
            
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
                
                map.flyTo([lat, lng], 15, {
                    duration: 1.5
                });
                
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

// Показать детали точки
async function showPointDetails(pointId) {
    try {
        const response = await fetch(`/api/point/${pointId}/info`);
        if (!response.ok) {
            throw new Error('Ошибка загрузки информации');
        }
        
        const point = await response.json();
        
        let modalContent = `
            <h3 style="color: #667eea; margin-bottom: 15px;">${point.name}</h3>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <p><strong>Статус:</strong> 
                    <span style="color: ${point.status === 'collected' ? '#f44336' : '#4CAF50'}">
                        ${point.status === 'collected' ? 'Собрана' : 'Доступна'}
                    </span>
                </p>
            </div>
        `;
        
        if (point.status === 'collected' && point.collectorInfo) {
            modalContent += `
                <div style="border-left: 3px solid #667eea; padding-left: 15px; margin: 15px 0;">
                    <h4>Сборщик:</h4>
                    <p><strong>Имя:</strong> ${point.collectorInfo.name}</p>
                    ${point.collectorInfo.signature ? 
                        `<p><strong>Сообщение:</strong> "${point.collectorInfo.signature}"</p>` : ''
                    }
                </div>
            `;
            
            if (point.collectorInfo.selfie) {
                modalContent += `
                    <div style="text-align: center; margin-top: 15px;">
                        <img src="${point.collectorInfo.selfie}" 
                             style="max-width: 100%; max-height: 250px; border-radius: 8px;"
                             alt="Селфи сборщика">
                    </div>
                `;
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

// Закрыть модальное окно
function closeModal() {
    document.getElementById('infoModal').style.display = 'none';
}

// Показать уведомление
function showNotification(message, type = 'info') {
    console.log(`Notification [${type}]: ${message}`);
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
        error: '❌',
        success: '✅',
        info: 'ℹ️',
        warning: '⚠️'
    };
    
    notification.innerHTML = `
        <div class="notification-content">
            <span>${icons[type] || icons.info} ${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: #999; font-size: 18px; cursor: pointer; margin-left: 10px;">×</button>
        </div>
    `;
    
    addNotificationStyles();
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
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
            }
            
            .leaflet-control-zoom a {
                width: ${isMobile ? '35px' : '26px'} !important;
                height: ${isMobile ? '35px' : '26px'} !important;
                line-height: ${isMobile ? '35px' : '26px'} !important;
                font-size: 18px !important;
            }
        `;
        document.head.appendChild(style);
    }
}

// Стили для маркеров
function addMarkerStyles() {
    if (!document.getElementById('marker-styles')) {
        const style = document.createElement('style');
        style.id = 'marker-styles';
        style.textContent = `
            .custom-marker {
                background: none !important;
                border: none !important;
            }
            
            .marker-dot {
                width: ${isMobile ? '16px' : '20px'};
                height: ${isMobile ? '16px' : '20px'};
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
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
                min-width: ${isMobile ? '200px' : '220px'};
                font-size: ${isMobile ? '14px' : '15px'};
            }
            
            .popup-content h3 {
                margin: 0 0 10px 0;
                color: #333;
                font-size: ${isMobile ? '16px' : '18px'};
                font-weight: 600;
            }
            
            .status {
                margin: 8px 0;
                font-weight: 600;
            }
            
            .status.available {
                color: #4CAF50;
            }
            
            .status.collected {
                color: #f44336;
            }
            
            .collector-info {
                background: #f8f9fa;
                padding: 10px;
                border-radius: 6px;
                margin: 10px 0;
                font-size: ${isMobile ? '12px' : '13px'};
            }
            
            .collector-info p {
                margin: 4px 0;
            }
            
            .details-btn {
                background: linear-gradient(45deg, #667eea, #764ba2);
                color: white;
                border: none;
                padding: ${isMobile ? '8px 12px' : '10px 16px'};
                border-radius: 6px;
                cursor: pointer;
                font-size: ${isMobile ? '12px' : '14px'};
                width: 100%;
                margin-top: 8px;
            }
        `;
        document.head.appendChild(style);
    }
}

// Стили для уведомлений
function addNotificationStyles() {
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
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                padding: 12px 16px;
                min-width: 250px;
                max-width: 350px;
                font-size: ${isMobile ? '14px' : '15px'};
                transition: all 0.3s ease;
            }
            
            .notification.error {
                border-left: 4px solid #f44336;
            }
            
            .notification.success {
                border-left: 4px solid #4CAF50;
            }
            
            .notification.info {
                border-left: 4px solid #2196F3;
            }
            
            .notification.warning {
                border-left: 4px solid #ff9800;
            }
            
            .notification-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            @media (max-width: 480px) {
                .notification {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                    min-width: auto;
                    max-width: none;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Обработчики событий
window.addEventListener('click', function(event) {
    const modal = document.getElementById('infoModal');
    if (event.target === modal) {
        closeModal();
    }
});

window.addEventListener('error', function(e) {
    if (e.target && e.target.src && e.target.src.includes('openstreetmap')) {
        console.warn('Map tile loading error');
    }
});

let resizeTimeout;
window.addEventListener('resize', function() {
    if (map && isMapInitialized) {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            map.invalidateSize();
        }, 250);
    }
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});

// Экспорт
window.PlasticBoy = {
    map,
    markers,
    loadPoints,
    showNotification,
    getCurrentLocation,
    showPointDetails,
    closeModal,
    initMap,
    updateMap,
    updateStats
};

window.showNotification = showNotification;
window.updateMap = updateMap;
window.updateStats = updateStats;

console.log('PlasticBoy script loaded successfully');
