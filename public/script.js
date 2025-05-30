// БЫСТРЫЙ SCRIPT.JS для PlasticBoy
// Оптимизирован для быстрой загрузки и отзывчивости

let map;
let markers = [];

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// Флаги для быстрой работы
let isAppInitialized = false;
let pointsCache = null;
let lastUpdateTime = 0;

// Быстрая инициализация
document.addEventListener('DOMContentLoaded', function() {
    console.log('⚡ Быстрая инициализация PlasticBoy script');
    initControlButtons();
});

// Быстрая инициализация карты
function initMap() {
    if (isAppInitialized) return;
    
    console.log('⚡ Быстрая инициализация карты');
    
    map = L.map('map', {
        zoomControl: true,
        attributionControl: true,
        preferCanvas: true, // Ускоряет рендеринг
        maxZoom: 18
    }).setView(ALMATY_CENTER, 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
        keepBuffer: 2, // Ускоряет загрузку тайлов
        updateWhenIdle: false
    }).addTo(map);
    
    // Быстрые стили
    addFastGrayscaleMapStyles();
    
    // Быстрое обновление размера карты
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
            window.map = map;
            console.log('⚡ Карта готова для быстрой загрузки точек');
        }
    }, 50); // Уменьшена задержка
    
    // Быстрое автообновление (только после полной загрузки)
    setTimeout(() => {
        setInterval(() => {
            if (typeof window.PlasticBoyLoader === 'undefined' || 
                window.PlasticBoyLoader.arePointsLoaded()) {
                fastLoadPoints();
            }
        }, 30000);
    }, 2000);
    
    isAppInitialized = true;
}

// Быстрая инициализация кнопок
function initControlButtons() {
    const locationBtn = document.querySelector('.location-btn');
    
    if (locationBtn) {
        // Оптимизированные обработчики событий
        locationBtn.addEventListener('mousedown', function() {
            this.style.transform = 'translateY(-1px)';
        }, { passive: true });
        
        locationBtn.addEventListener('mouseup', function() {
            this.style.transform = '';
        }, { passive: true });
    }
}

// Быстрые стили для карты
function addFastGrayscaleMapStyles() {
    if (!document.getElementById('fast-grayscale-styles')) {
        const style = document.createElement('style');
        style.id = 'fast-grayscale-styles';
        style.textContent = `
            .leaflet-tile-pane {
                filter: grayscale(100%) contrast(1.1) brightness(1.05) !important;
                will-change: transform;
            }
            
            .leaflet-marker-pane,
            .leaflet-popup-pane,
            .leaflet-control-container {
                filter: none !important;
            }
            
            .leaflet-container {
                background: #f8f9fa !important;
            }
            
            .leaflet-control-zoom {
                margin-top: 15px !important;
                margin-left: 15px !important;
            }
            
            .leaflet-control-attribution {
                margin-bottom: 8px !important;
                margin-right: 8px !important;
            }
        `;
        document.head.appendChild(style);
    }
}

// Быстрая геолокация
function getCurrentLocation() {
    const locationBtn = document.querySelector('.location-btn');
    
    if (!navigator.geolocation) {
        showFastNotification('Геолокация не поддерживается', 'error');
        return;
    }
    
    const originalText = locationBtn.innerHTML;
    locationBtn.innerHTML = '⚡ Определение...';
    locationBtn.disabled = true;
    locationBtn.style.opacity = '0.8';
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Быстрая иконка пользователя
            const userIcon = L.divIcon({
                className: 'fast-user-marker',
                html: `<div style="
                    background: linear-gradient(45deg, #007bff, #0056b3);
                    width: 22px; 
                    height: 22px; 
                    border-radius: 50%; 
                    border: 2px solid white; 
                    box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                    transition: transform 0.2s ease;
                "></div>`,
                iconSize: [22, 22],
                iconAnchor: [11, 11]
            });
            
            // Быстрые стили для пользователя
            if (!document.getElementById('fast-user-styles')) {
                const style = document.createElement('style');
                style.id = 'fast-user-styles';
                style.textContent = `
                    .fast-user-marker:hover > div {
                        transform: scale(1.1);
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Удаляем предыдущий маркер
            if (window.userMarker) {
                map.removeLayer(window.userMarker);
            }
            
            // Быстрое добавление маркера
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
            
            // Быстрое центрирование
            map.flyTo([lat, lng], 16, {
                duration: 1,
                easeLinearity: 0.5
            });
            
            showFastNotification('Местоположение найдено ⚡', 'success');
            
            // Быстрое восстановление кнопки
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
            
            showFastNotification(errorMessage, 'error');
            
            // Быстрое восстановление
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
            locationBtn.style.opacity = '';
        },
        {
            enableHighAccuracy: true,
            timeout: 8000, // Уменьшен таймаут
            maximumAge: 300000
        }
    );
}

// Быстрая загрузка точек
async function loadPoints() {
    try {
        const startTime = Date.now();
        console.log('⚡ Быстрая загрузка точек...');
        
        const response = await fetch('/api/points', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load points');
        }
        
        const points = await response.json();
        const loadTime = Date.now() - startTime;
        console.log(`⚡ Загружено ${points.length} точек за ${loadTime}ms`);
        
        // Кэшируем результат
        pointsCache = points;
        lastUpdateTime = Date.now();
        
        fastUpdateMap(points);
        fastUpdateStats(points);
        
        // Уведомляем систему загрузки
        if (typeof window.PlasticBoyLoader !== 'undefined' && 
            typeof window.PlasticBoyLoader.onPointsLoaded === 'function') {
            window.PlasticBoyLoader.onPointsLoaded();
        }
        
        return points;
        
    } catch (error) {
        console.error('Error loading points:', error);
        showFastNotification('Ошибка загрузки ⚠️', 'error');
        
        // Уведомляем даже при ошибке
        if (typeof window.PlasticBoyLoader !== 'undefined' && 
            typeof window.PlasticBoyLoader.onPointsLoaded === 'function') {
            window.PlasticBoyLoader.onPointsLoaded();
        }
        
        throw error;
    }
}

// Быстрое обновление карты
function fastUpdateMap(points) {
    if (!map) {
        console.warn('Карта не готова для быстрого обновления');
        return;
    }
    
    console.log(`⚡ Быстрое обновление ${points.length} маркеров`);
    
    // Быстрая очистка маркеров
    markers.forEach(marker => map.removeLayer(marker));
    markers.length = 0; // Быстрая очистка массива
    
    // Пакетное добавление маркеров
    const markersToAdd = [];
    
    points.forEach(point => {
        const isAvailable = point.status === 'available';
        
        // Простая быстрая иконка
        const icon = L.divIcon({
            className: 'fast-marker',
            html: `<div class="fast-marker-dot ${isAvailable ? 'available' : 'collected'}"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        
        const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon });
        
        // Быстрый popup
        let popupContent = `
            <div class="fast-popup">
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
                <button onclick="showPointDetails('${point.id}')" class="fast-details-btn">Подробнее</button>
            `;
        }
        
        popupContent += '</div>';
        marker.bindPopup(popupContent);
        markersToAdd.push(marker);
    });
    
    // Быстрое пакетное добавление
    markersToAdd.forEach(marker => {
        marker.addTo(map);
        markers.push(marker);
    });
    
    // Глобальный доступ для системы загрузки
    window.markers = markers;
    
    // Быстрые стили для маркеров
    addFastMarkerStyles();
}

// Быстрые стили для маркеров
function addFastMarkerStyles() {
    if (!document.getElementById('fast-marker-styles')) {
        const style = document.createElement('style');
        style.id = 'fast-marker-styles';
        style.textContent = `
            .fast-marker {
                background: none !important;
                border: none !important;
            }
            
            .fast-marker-dot {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: 0 3px 8px rgba(0,0,0,0.25);
                transition: transform 0.2s ease;
                cursor: pointer;
            }
            
            .fast-marker-dot:hover {
                transform: scale(1.1);
            }
            
            .fast-marker-dot.available {
                background: linear-gradient(45deg, #4CAF50, #45a049);
            }
            
            .fast-marker-dot.collected {
                background: linear-gradient(45deg, #f44336, #e53935);
            }
            
            .fast-popup {
                min-width: 200px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .fast-popup h3 {
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
            
            .fast-details-btn {
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
            
            .fast-details-btn:hover {
                background: linear-gradient(45deg, #5a67d8, #6b46c1);
            }
        `;
        document.head.appendChild(style);
    }
}

// Быстрое обновление статистики
function fastUpdateStats(points) {
    const available = points.filter(p => p.status === 'available').length;
    const collected = points.filter(p => p.status === 'collected').length;
    
    const availableElement = document.getElementById('availableCount');
    const collectedElement = document.getElementById('collectedCount');
    
    if (availableElement && collectedElement) {
        fastAnimateNumber(availableElement, parseInt(availableElement.textContent) || 0, available);
        fastAnimateNumber(collectedElement, parseInt(collectedElement.textContent) || 0, collected);
    }
    
    console.log(`⚡ Статистика: ${available} доступно, ${collected} собрано`);
}

// Быстрая анимация чисел
function fastAnimateNumber(element, from, to) {
    if (from === to) return;
    
    const duration = 400; // Уменьшена продолжительность
    const steps = 20; // Меньше шагов
    const stepValue = (to - from) / steps;
    const stepDuration = duration / steps;
    
    let current = from;
    let step = 0;
    
    element.style.transform = 'scale(1.05)';
    element.style.transition = 'transform 0.2s ease';
    
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

// Быстрые детали точки
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
        showFastNotification('Ошибка загрузки информации', 'error');
    }
}

// Быстрое закрытие модального окна
function closeModal() {
    document.getElementById('infoModal').style.display = 'none';
}

// Быстрые уведомления
function showFastNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fast-notification ${type}`;
    
    const icons = {
        error: '❌',
        success: '✅',
        info: 'ℹ️',
        warning: '⚠️'
    };
    
    notification.innerHTML = `
        <div class="fast-notification-content">
            <span>${icons[type] || icons.info} ${message}</span>
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    addFastNotificationStyles();
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'fastSlideOut 0.2s ease';
            setTimeout(() => notification.remove(), 200);
        }
    }, 3000); // Уменьшено время показа
}

// Быстрые стили уведомлений
function addFastNotificationStyles() {
    if (!document.getElementById('fast-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'fast-notification-styles';
        style.textContent = `
            .fast-notification {
                position: fixed;
                top: 15px;
                right: 15px;
                z-index: 2000;
                background: rgba(255, 255, 255, 0.98);
                border-radius: 8px;
                box-shadow: 0 6px 24px rgba(0,0,0,0.15);
                backdrop-filter: blur(8px);
                padding: 12px;
                min-width: 250px;
                max-width: 350px;
                animation: fastSlideIn 0.3s ease;
                border: 1px solid rgba(255,255,255,0.3);
                font-size: 0.9rem;
            }
            
            .fast-notification.error {
                border-left: 3px solid #f44336;
            }
            
            .fast-notification.success {
                border-left: 3px solid #4CAF50;
            }
            
            .fast-notification.info {
                border-left: 3px solid #2196F3;
            }
            
            .fast-notification.warning {
                border-left: 3px solid #ff9800;
            }
            
            .fast-notification-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-weight: 500;
            }
            
            .fast-notification-content button {
                background: none;
                border: none;
                font-size: 1.1rem;
                cursor: pointer;
                color: #999;
                padding: 0;
                margin-left: 10px;
                transition: color 0.2s;
            }
            
            .fast-notification-content button:hover {
                color: #666;
            }
            
            @keyframes fastSlideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes fastSlideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Быстрые обработчики событий
window.addEventListener('click', function(event) {
    const modal = document.getElementById('infoModal');
    if (event.target === modal) {
        closeModal();
    }
}, { passive: true });

window.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG' && e.target.src.includes('openstreetmap')) {
        console.warn('Ошибка загрузки тайлов карты');
        showFastNotification('Проблемы с картой', 'warning');
    }
}, { passive: true });

// Быстрое изменение размера
window.addEventListener('resize', function() {
    if (map) {
        clearTimeout(window.fastResizeTimeout);
        window.fastResizeTimeout = setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
}, { passive: true });

// Быстрые сетевые события
window.addEventListener('online', function() {
    showFastNotification('Соединение восстановлено ⚡', 'success');
    if (isAppInitialized) {
        setTimeout(() => loadPoints(), 100);
    }
}, { passive: true });

window.addEventListener('offline', function() {
    showFastNotification('Нет интернета ⚠️', 'warning');
}, { passive: true });

// Быстрые клавиши
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
    
    if (event.ctrlKey && event.key === 'l') {
        event.preventDefault();
        getCurrentLocation();
    }
}, { passive: false });

// Быстрый экспорт
window.PlasticBoy = {
    map,
    markers,
    loadPoints,
    showFastNotification,
    getCurrentLocation,
    showPointDetails,
    closeModal,
    initMap,
    fastUpdateMap,
    fastUpdateStats
};

// Псевдонимы для совместимости
window.showNotification = showFastNotification;
window.updateMap = fastUpdateMap;
window.updateStats = fastUpdateStats;

console.log('⚡ Быстрый PlasticBoy script готов к работе');
