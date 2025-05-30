// Инициализация карты
let map;
let markers = [];

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    loadPoints();
    
    // Автообновление каждые 30 секунд
    setInterval(loadPoints, 30000);
});

// Инициализация карты с серо-белыми тайлами
function initMap() {
    map = L.map('map').setView(ALMATY_CENTER, 12);
    
    // Добавляем обычные тайлы OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);
    
    // Добавляем CSS для серо-белых тайлов
    addGrayscaleMapStyles();
}

// Добавление стилей для серо-белой карты
function addGrayscaleMapStyles() {
    if (!document.getElementById('grayscale-map-styles')) {
        const style = document.createElement('style');
        style.id = 'grayscale-map-styles';
        style.textContent = `
            /* Применяем серо-белые фильтры только к тайлам карты */
            .leaflet-tile-pane {
                filter: grayscale(100%) contrast(1.1) brightness(1.05) !important;
            }
            
            /* Остальные элементы карты остаются цветными */
            .leaflet-marker-pane,
            .leaflet-popup-pane,
            .leaflet-control-container {
                filter: none !important;
            }
            
            .leaflet-container {
                background: #f8f9fa !important;
            }
        `;
        document.head.appendChild(style);
    }
}

// Функция обновления карты с анимацией
function refreshMap() {
    const refreshBtn = document.querySelector('.refresh-btn');
    
    // Добавляем анимацию вращения
    refreshBtn.classList.add('spinning');
    
    // Загружаем точки
    loadPoints().then(() => {
        showNotification('Карта обновлена', 'success');
        
        // Убираем анимацию через время анимации
        setTimeout(() => {
            refreshBtn.classList.remove('spinning');
        }, 600);
    }).catch(error => {
        console.error('Ошибка обновления:', error);
        showNotification('Ошибка обновления карты', 'error');
        refreshBtn.classList.remove('spinning');
    });
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
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Создаем маркер пользователя
            const userIcon = L.divIcon({
                className: 'user-location-marker',
                html: `<div style="
                    background: linear-gradient(45deg, #007bff, #0056b3);
                    width: 20px; 
                    height: 20px; 
                    border-radius: 50%; 
                    border: 3px solid white; 
                    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                    position: relative;
                ">
                    <div style="
                        position: absolute;
                        top: -5px;
                        left: -5px;
                        right: -5px;
                        bottom: -5px;
                        border-radius: 50%;
                        border: 2px solid #007bff;
                        opacity: 0.3;
                        animation: userPulse 2s infinite;
                    "></div>
                </div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            
            // Добавляем стили для анимации пульса пользователя
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
                            transform: scale(2);
                            opacity: 0;
                        }
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
                .bindPopup('<div style="text-align: center;"><strong>📍 Ваше местоположение</strong></div>');
            
            // Центрируем карту на пользователе
            map.setView([lat, lng], 15);
            
            showNotification('Местоположение определено', 'success');
            
            // Восстанавливаем кнопку
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
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
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        }
    );
}

// Загрузка точек с сервера
async function loadPoints() {
    try {
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
        updateMap(points);
        updateStats(points);
        
    } catch (error) {
        console.error('Error loading points:', error);
        showNotification('Ошибка загрузки данных', 'error');
        throw error;
    }
}

// Обновление карты с цветными маркерами
function updateMap(points) {
    // Очищаем существующие маркеры (кроме пользовательского)
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    points.forEach(point => {
        const isAvailable = point.status === 'available';
        
        // Создаем яркую цветную иконку
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-dot ${isAvailable ? 'available' : 'collected'}">
                     <div class="marker-pulse ${isAvailable ? 'pulse' : ''}"></div>
                   </div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        
        const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon })
            .addTo(map);
        
        // Добавляем popup
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
            `;
            
            // Добавляем кнопку для просмотра подробностей
            popupContent += `<button onclick="showPointDetails('${point.id}')" class="details-btn">Подробнее</button>`;
        }
        
        popupContent += '</div>';
        marker.bindPopup(popupContent);
        markers.push(marker);
    });
    
    // Добавляем стили для маркеров
    addMarkerStyles();
}

// Добавление стилей для цветных маркеров
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
                width: 20px;
                height: 20px;
                border-radius: 50%;
                position: relative;
                border: 3px solid white;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                transition: all 0.3s ease;
            }
            
            .marker-dot:hover {
                transform: scale(1.2);
                box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            }
            
            .marker-dot.available {
                background: linear-gradient(45deg, #4CAF50, #45a049);
            }
            
            .marker-dot.collected {
                background: linear-gradient(45deg, #f44336, #e53935);
            }
            
            .marker-pulse {
                position: absolute;
                top: -3px;
                left: -3px;
                right: -3px;
                bottom: -3px;
                border-radius: 50%;
                border: 2px solid #4CAF50;
                opacity: 0;
            }
            
            .marker-pulse.pulse {
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0% {
                    transform: scale(1);
                    opacity: 1;
                }
                50% {
                    opacity: 0.3;
                }
                100% {
                    transform: scale(1.5);
                    opacity: 0;
                }
            }
            
            .popup-content {
                min-width: 200px;
            }
            
            .popup-content h3 {
                margin: 0 0 10px 0;
                color: #333;
                font-size: 1.1rem;
            }
            
            .status {
                margin: 10px 0;
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
                border-radius: 8px;
                margin: 10px 0;
                font-size: 0.9rem;
            }
            
            .collector-info p {
                margin: 5px 0;
            }
            
            .details-btn {
                background: linear-gradient(45deg, #667eea, #764ba2);
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.9rem;
                margin-top: 10px;
                width: 100%;
                transition: all 0.3s;
            }
            
            .details-btn:hover {
                background: linear-gradient(45deg, #5a67d8, #6b46c1);
                transform: translateY(-1px);
            }
        `;
        document.head.appendChild(style);
    }
}

// Обновление статистики
function updateStats(points) {
    const available = points.filter(p => p.status === 'available').length;
    const collected = points.filter(p => p.status === 'collected').length;
    
    const availableElement = document.getElementById('availableCount');
    const collectedElement = document.getElementById('collectedCount');
    
    if (availableElement && collectedElement) {
        // Анимированное обновление цифр
        animateNumber(availableElement, parseInt(availableElement.textContent) || 0, available);
        animateNumber(collectedElement, parseInt(collectedElement.textContent) || 0, collected);
    }
}

// Анимация изменения числа
function animateNumber(element, from, to) {
    if (from === to) return;
    
    const duration = 500;
    const steps = 20;
    const stepValue = (to - from) / steps;
    const stepDuration = duration / steps;
    
    let current = from;
    let step = 0;
    
    const timer = setInterval(() => {
        step++;
        current += stepValue;
        
        if (step >= steps) {
            element.textContent = to;
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
            <h3>${point.name}</h3>
            <p><strong>Статус:</strong> ${point.status === 'collected' ? 'Собрана' : 'Доступна'}</p>
            <p><strong>Координаты:</strong> ${point.coordinates.lat.toFixed(6)}, ${point.coordinates.lng.toFixed(6)}</p>
        `;
        
        if (point.status === 'collected' && point.collectorInfo) {
            modalContent += `
                <hr style="margin: 15px 0; border: 1px solid #eee;">
                <h4>Информация о сборщике:</h4>
                <p><strong>Имя:</strong> ${point.collectorInfo.name}</p>
                ${point.collectorInfo.signature ? `<p><strong>Сообщение:</strong> ${point.collectorInfo.signature}</p>` : ''}
                <p><strong>Время сбора:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>
            `;
            
            if (point.collectorInfo.selfie) {
                modalContent += `
                    <div style="margin-top: 15px;">
                        <strong>Селфи с места находки:</strong><br>
                        <img src="${point.collectorInfo.selfie}" 
                             style="max-width: 100%; max-height: 300px; border-radius: 8px; margin-top: 10px;"
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

// Показать уведомление
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Иконки для разных типов уведомлений
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
    
    // Добавляем стили для уведомлений если их нет
    addNotificationStyles();
    
    document.body.appendChild(notification);
    
    // Автоматически удаляем через 4 секунды
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
}

// Добавление стилей для уведомлений
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
                background: white;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                padding: 15px;
                min-width: 250px;
                max-width: 350px;
                animation: slideIn 0.3s ease-out;
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
            
            .notification-content button {
                background: none;
                border: none;
                font-size: 1.2rem;
                cursor: pointer;
                color: #999;
                padding: 0;
                margin: 0;
                width: auto;
                margin-left: 10px;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOut {
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

// Обработка изменения размера окна для адаптивности
window.addEventListener('resize', function() {
    if (map) {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
});

// Обработка состояния сети
window.addEventListener('online', function() {
    showNotification('Соединение восстановлено', 'success');
    loadPoints();
});

window.addEventListener('offline', function() {
    showNotification('Нет подключения к интернету', 'warning');
});

// Экспорт функций для глобального доступа
window.PlasticBoy = {
    map,
    loadPoints,
    showNotification,
    getCurrentLocation,
    refreshMap
};
