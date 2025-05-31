// ОПТИМИЗИРОВАННЫЙ SCRIPT.JS для PlasticBoy
// Упрощен для мобильных устройств и быстрой загрузки

let map;
let markers = [];

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// Флаги состояния
let isAppInitialized = false;
let pointsCache = null;
let isRetrying = false;

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
        
        // Автообновление
        setInterval(loadPoints, 30000);
        
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

// Загрузка точек
async function loadPoints() {
    if (!map) {
        console.log('⏳ Карта не готова для загрузки точек');
        return;
    }
    
    try {
        console.log('📍 Загрузка точек...');
        
        const response = await fetch('/api/points', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const points = await response.json();
        console.log(`✅ Загружено ${points.length} точек`);
        
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

// Уведомления
function showNotification(message, type = 'info') {
    // Простая реализация без всплывающих окон
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Можно добавить простое уведомление в статус бар или консоль
    if (type === 'error') {
        console.error(message);
    } else if (type === 'success') {
        console.log(`✅ ${message}`);
    } else {
        console.info(`ℹ️ ${message}`);
    }
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

// Сетевые события
window.addEventListener('online', function() {
    console.log('🌐 Соединение восстановлено');
    if (isAppInitialized) {
        setTimeout(loadPoints, 1000);
    }
}, { passive: true });

window.addEventListener('offline', function() {
    console.log('⚠️ Нет интернета');
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
});

// Экспорт функций
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
    showNotification
};

// Псевдонимы для совместимости
window.fastLoadPoints = loadPoints;
window.fastUpdateMap = updateMap;
window.fastUpdateStats = updateStats;

console.log('🚀 PlasticBoy script готов к работе');
