// Инициализация карты
let map;
let markers = [];

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// Флаги для системы загрузки
let isAppInitialized = false;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    // Не запускаем автоматически - ждем сигнала от системы загрузки
    console.log('📱 DOM готов, ожидаем инициализации от системы загрузки');
    
    // Инициализация кнопок (можно делать сразу)
    initControlButtons();
});

// Инициализация карты (вызывается системой загрузки)
function initMap() {
    if (isAppInitialized) return;
    
    console.log('🗺️ Инициализация карты PlasticBoy');
    
    map = L.map('map').setView(ALMATY_CENTER, 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);
    
    // Добавляем CSS для серо-белых тайлов
    addGrayscaleMapStyles();
    
    // Принудительно обновляем размер карты после инициализации
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
            
            // Уведомляем систему загрузки о готовности карты
            window.map = map;
            console.log('✅ Карта инициализирована и готова');
        }
    }, 100);
    
    // Автообновление каждые 30 секунд (только после полной загрузки)
    setTimeout(() => {
        setInterval(() => {
            if (typeof window.PlasticBoyLoader === 'undefined' || 
                window.PlasticBoyLoader.arePointsLoaded()) {
                loadPoints();
            }
        }, 30000);
    }, 5000);
    
    isAppInitialized = true;
}

// Инициализация кнопок управления
function initControlButtons() {
    const locationBtn = document.querySelector('.location-btn');
    
    if (locationBtn) {
        locationBtn.addEventListener('mousedown', function() {
            this.style.transform = 'translateY(-1px)';
        });
        
        locationBtn.addEventListener('mouseup', function() {
            this.style.transform = '';
        });
    }
}

// Добавление стилей для серо-белой карты
function addGrayscaleMapStyles() {
    if (!document.getElementById('grayscale-map-styles')) {
        const style = document.createElement('style');
        style.id = 'grayscale-map-styles';
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
            
            .leaflet-control-zoom {
                margin-top: 20px !important;
                margin-left: 20px !important;
            }
            
            .leaflet-control-attribution {
                margin-bottom: 10px !important;
                margin-right: 10px !important;
            }
        `;
        document.head.appendChild(style);
    }
}

// Функция получения геолокации
function getCurrentLocation() {
    const locationBtn = document.querySelector('.location-btn');
    
    if (!navigator.geolocation) {
        showNotification('Геолокация не поддерживается', 'error');
        return;
    }
    
    // Анимация загрузки
    const originalText = locationBtn.innerHTML;
    locationBtn.innerHTML = '⏳ Определение...';
    locationBtn.disabled = true;
    locationBtn.style.opacity = '0.8';
    locationBtn.style.animation = 'pulse 1.5s infinite';
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Создаем маркер пользователя
            const userIcon = L.divIcon({
                className: 'user-location-marker',
                html: `<div style="
                    background: linear-gradient(45deg, #007bff, #0056b3);
                    width: 24px; 
                    height: 24px; 
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
                        border: 2px solid #007bff;
                        opacity: 0.3;
                        animation: userPulse 2s infinite;
                    "></div>
                </div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            
            // Добавляем стили для анимации пульса
            if (!document.getElementById('user-pulse-styles')) {
                const style = document.createElement('style');
                style.id = 'user-pulse-styles';
                style.textContent = `
                    @keyframes userPulse {
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
                    
                    .user-location-marker:hover > div {
                        transform: scale(1.1);
                        box-shadow: 0 6px 20px rgba(0,0,0,0.4);
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Удаляем предыдущий маркер пользователя если есть
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
                            ${lat.toFixed(6)}, ${lng.toFixed(6)}
                        </small>
                    </div>
                `);
            
            // Плавно центрируем карту на пользователе
            map.flyTo([lat, lng], 16, {
                duration: 1.5,
                easeLinearity: 0.5
            });
            
            showNotification('Местоположение определено', 'success');
            
            // Восстанавливаем кнопку
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
            locationBtn.style.opacity = '';
            locationBtn.style.animation = '';
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
            locationBtn.style.animation = '';
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        }
    );
}

// Загрузка точек с сервера (интегрированная с системой загрузки)
async function loadPoints() {
    try {
        console.log('📍 Загрузка точек с сервера...');
        
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
        console.log(`📍 Загружено ${points.length} точек`);
        
        updateMap(points);
        updateStats(points);
        
        // Уведомляем систему загрузки о завершении загрузки точек
        if (typeof window.PlasticBoyLoader !== 'undefined' && 
            typeof window.PlasticBoyLoader.onPointsLoaded === 'function') {
            window.PlasticBoyLoader.onPointsLoaded();
        }
        
        return points;
        
    } catch (error) {
        console.error('Error loading points:', error);
        showNotification('Ошибка загрузки данных', 'error');
        
        // Даже при ошибке уведомляем систему загрузки
        if (typeof window.PlasticBoyLoader !== 'undefined' && 
            typeof window.PlasticBoyLoader.onPointsLoaded === 'function') {
            window.PlasticBoyLoader.onPointsLoaded();
        }
        
        throw error;
    }
}

// Обновление карты с цветными маркерами
function updateMap(points) {
    if (!map) {
        console.warn('Карта не готова для обновления маркеров');
        return;
    }
    
    // Очищаем существующие маркеры (кроме пользовательского)
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    console.log(`🎯 Обновление карты с ${points.length} точками`);
    
    points.forEach(point => {
        const isAvailable = point.status === 'available';
        
        // Создаем цветную иконку
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-dot ${isAvailable ? 'available' : 'collected'}">
                     <div class="marker-pulse ${isAvailable ? 'pulse' : ''}"></div>
                     <div class="marker-glow"></div>
                   </div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });
        
        const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon })
            .addTo(map);
        
        // Улучшенный popup
        let popupContent = `
            <div class="popup-content">
                <h3>${point.name}</h3>
                <p class="status ${point.status}">
                    ${isAvailable ? '🟢 Доступна для сбора' : '🔴 Уже собрана'}
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
        markers.push(marker);
    });
    
    // Делаем маркеры доступными глобально для системы загрузки
    window.markers = markers;
    
    // Добавляем стили для маркеров
    addEnhancedMarkerStyles();
}

// Добавление стилей для цветных маркеров
function addEnhancedMarkerStyles() {
    if (!document.getElementById('enhanced-marker-styles')) {
        const style = document.createElement('style');
        style.id = 'enhanced-marker-styles';
        style.textContent = `
            .custom-marker {
                background: none !important;
                border: none !important;
            }
            
            .marker-dot {
                width: 22px;
                height: 22px;
                border-radius: 50%;
                position: relative;
                border: 3px solid white;
                box-shadow: 0 4px 12px rgba(0,0,0,0.25);
                transition: all 0.3s ease;
                cursor: pointer;
            }
            
            .marker-dot::before {
                content: '';
                position: absolute;
                top: -2px;
                left: -2px;
                right: -2px;
                bottom: -2px;
                border-radius: 50%;
                background: linear-gradient(45deg, rgba(255,255,255,0.3), rgba(255,255,255,0.1));
                z-index: 1;
                pointer-events: none;
            }
            
            .marker-dot:hover {
                transform: scale(1.15);
                box-shadow: 0 6px 18px rgba(0,0,0,0.35);
            }
            
            .marker-dot.available {
                background: linear-gradient(45deg, #4CAF50, #45a049);
                box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
            }
            
            .marker-dot.available:hover {
                box-shadow: 0 6px 18px rgba(76, 175, 80, 0.4);
            }
            
            .marker-dot.collected {
                background: linear-gradient(45deg, #f44336, #e53935);
                box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
            }
            
            .marker-dot.collected:hover {
                box-shadow: 0 6px 18px rgba(244, 67, 54, 0.4);
            }
            
            .marker-pulse {
                position: absolute;
                top: -4px;
                left: -4px;
                right: -4px;
                bottom: -4px;
                border-radius: 50%;
                border: 2px solid #4CAF50;
                opacity: 0;
            }
            
            .marker-pulse.pulse {
                animation: markerPulse 2s infinite;
            }
            
            @keyframes markerPulse {
                0% {
                    transform: scale(1);
                    opacity: 0.8;
                }
                50% {
                    opacity: 0.3;
                }
                100% {
                    transform: scale(1.6);
                    opacity: 0;
                }
            }
            
            .popup-content {
                min-width: 220px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .popup-content h3 {
                margin: 0 0 12px 0;
                color: #333;
                font-size: 1.1rem;
                font-weight: 600;
            }
            
            .status {
                margin: 12px 0;
                font-weight: 600;
                font-size: 0.95rem;
            }
            
            .status.available {
                color: #4CAF50;
            }
            
            .status.collected {
                color: #f44336;
            }
            
            .collector-info {
                background: linear-gradient(135deg, #f8f9fa, #e9ecef);
                padding: 12px;
                border-radius: 8px;
                margin: 12px 0;
                font-size: 0.9rem;
                border-left: 3px solid #667eea;
            }
            
            .collector-info p {
                margin: 6px 0;
            }
            
            .details-btn {
                background: linear-gradient(45deg, #667eea, #764ba2);
                color: white;
                border: none;
                padding: 10px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 0.9rem;
                margin-top: 12px;
                width: 100%;
                transition: all 0.3s;
                font-weight: 500;
            }
            
            .details-btn:hover {
                background: linear-gradient(45deg, #5a67d8, #6b46c1);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            }
        `;
        document.head.appendChild(style);
    }
}

// Обновление статистики с анимацией
function updateStats(points) {
    const available = points.filter(p => p.status === 'available').length;
    const collected = points.filter(p => p.status === 'collected').length;
    
    const availableElement = document.getElementById('availableCount');
    const collectedElement = document.getElementById('collectedCount');
    
    if (availableElement && collectedElement) {
        animateNumber(availableElement, parseInt(availableElement.textContent) || 0, available);
        animateNumber(collectedElement, parseInt(collectedElement.textContent) || 0, collected);
    }
    
    console.log(`📊 Статистика обновлена: ${available} доступно, ${collected} собрано`);
}

// Анимация изменения числа
function animateNumber(element, from, to) {
    if (from === to) return;
    
    const duration = 800;
    const steps = 30;
    const stepValue = (to - from) / steps;
    const stepDuration = duration / steps;
    
    let current = from;
    let step = 0;
    
    element.style.transform = 'scale(1.1)';
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

// Показать подробности точки
async function showPointDetails(pointId) {
    try {
        const response = await fetch(`/api/point/${pointId}/info`);
        if (!response.ok) {
            throw new Error('Ошибка загрузки информации');
        }
        
        const point = await response.json();
        
        let modalContent = `
            <h3 style="color: #667eea; margin-bottom: 15px;">${point.name}</h3>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                <p><strong>Статус:</strong> <span style="color: ${point.status === 'collected' ? '#f44336' : '#4CAF50'}">${point.status === 'collected' ? 'Собрана' : 'Доступна'}</span></p>
                <p><strong>Координаты:</strong> ${point.coordinates.lat.toFixed(6)}, ${point.coordinates.lng.toFixed(6)}</p>
            </div>
        `;
        
        if (point.status === 'collected' && point.collectorInfo) {
            modalContent += `
                <div style="border-left: 4px solid #667eea; padding-left: 15px; margin: 15px 0;">
                    <h4 style="color: #333; margin-bottom: 10px;">Информация о сборщике:</h4>
                    <p><strong>Имя:</strong> ${point.collectorInfo.name}</p>
                    ${point.collectorInfo.signature ? `<p><strong>Сообщение:</strong> <em>"${point.collectorInfo.signature}"</em></p>` : ''}
                    <p><strong>Время сбора:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>
                </div>
            `;
            
            if (point.collectorInfo.selfie) {
                modalContent += `
                    <div style="margin-top: 20px; text-align: center;">
                        <strong style="color: #667eea;">Селфи с места находки:</strong><br>
                        <img src="${point.collectorInfo.selfie}" 
                             style="max-width: 100%; max-height: 300px; border-radius: 12px; margin-top: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);"
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

// Закрыть модальное окно
function closeModal() {
    document.getElementById('infoModal').style.display = 'none';
}

// Функция показа уведомлений
function showNotification(message, type = 'info') {
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
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    addEnhancedNotificationStyles();
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
}

// Добавление стилей для уведомлений
function addEnhancedNotificationStyles() {
    if (!document.getElementById('enhanced-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'enhanced-notification-styles';
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
                font-weight: 500;
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

// Закрытие модального окна при клике вне его
window.addEventListener('click', function(event) {
    const modal = document.getElementById('infoModal');
    if (event.target === modal) {
        closeModal();
    }
});

// Обработка ошибок загрузки карты
window.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG' && e.target.src.includes('openstreetmap')) {
        console.warn('Ошибка загрузки тайлов карты');
        showNotification('Проблемы с загрузкой карты. Проверьте интернет-соединение.', 'error');
    }
});

// Обработка изменения размера окна
window.addEventListener('resize', function() {
    if (map) {
        clearTimeout(window.resizeTimeout);
        window.resizeTimeout = setTimeout(() => {
            map.invalidateSize();
        }, 150);
    }
});

// Обработка состояния сети
window.addEventListener('online', function() {
    showNotification('Соединение восстановлено', 'success');
    if (isAppInitialized) {
        loadPoints();
    }
});

window.addEventListener('offline', function() {
    showNotification('Нет подключения к интернету', 'warning');
});

// Обработка клавиш
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
    
    if (event.ctrlKey && event.key === 'l') {
        event.preventDefault();
        getCurrentLocation();
    }
});

// Экспорт функций для глобального доступа
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

console.log('📱 PlasticBoy script.js загружен и готов к работе');
