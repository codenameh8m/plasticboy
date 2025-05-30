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
    
    // Инициализация кнопки обновления
    initRefreshButton();
});

// Инициализация карты с серо-белой темой
function initMap() {
    map = L.map('map').setView(ALMATY_CENTER, 12);
    
    // Используем светлую карту и применяем серо-белые фильтры
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
        className: 'map-tiles'
    }).addTo(map);
    
    // Применяем серо-белые фильтры к карте
    map.getContainer().style.filter = 'grayscale(100%) contrast(1.1) brightness(1.05)';
    map.getContainer().style.background = '#f8f9fa';
    
    // Добавляем кастомные стили для элементов карты
    addMapCustomStyles();
}

// Добавление кастомных стилей для карты
function addMapCustomStyles() {
    if (!document.getElementById('map-custom-styles')) {
        const style = document.createElement('style');
        style.id = 'map-custom-styles';
        style.textContent = `
            /* Серо-белая тема для Leaflet карты */
            .leaflet-container {
                background: #f8f9fa !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            }
            
            .leaflet-tile {
                filter: grayscale(100%) contrast(1.1) brightness(1.05) !important;
            }
            
            .leaflet-control-zoom a {
                background-color: rgba(255, 255, 255, 0.95) !important;
                color: #495057 !important;
                border: 1px solid rgba(108, 117, 125, 0.2) !important;
                backdrop-filter: blur(10px) !important;
                transition: all 0.3s !important;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
            }
            
            .leaflet-control-zoom a:hover {
                background-color: #f8f9fa !important;
                color: #343a40 !important;
                transform: scale(1.05) !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
            }
            
            .leaflet-control-attribution {
                background-color: rgba(255, 255, 255, 0.9) !important;
                color: #6c757d !important;
                font-size: 0.7rem !important;
                border-radius: 8px !important;
                backdrop-filter: blur(10px) !important;
                border: 1px solid rgba(108, 117, 125, 0.1) !important;
                padding: 2px 5px !important;
            }
            
            .leaflet-popup-content-wrapper {
                background: rgba(255, 255, 255, 0.98) !important;
                border-radius: 12px !important;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15) !important;
                backdrop-filter: blur(15px) !important;
                border: 1px solid rgba(255, 255, 255, 0.2) !important;
            }
            
            .leaflet-popup-tip {
                background: rgba(255, 255, 255, 0.98) !important;
                border: 1px solid rgba(255, 255, 255, 0.2) !important;
            }
            
            .leaflet-popup-close-button {
                color: #6c757d !important;
                font-size: 18px !important;
                padding: 8px !important;
                transition: color 0.3s !important;
                font-weight: bold !important;
            }
            
            .leaflet-popup-close-button:hover {
                color: #495057 !important;
                background: none !important;
            }
        `;
        document.head.appendChild(style);
    }
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
        showNotification('Ошибка загрузки данных. Проверьте подключение к интернету.', 'error');
    }
}

// Обновление карты
function updateMap(points) {
    // Очищаем существующие маркеры
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    points.forEach(point => {
        const isAvailable = point.status === 'available';
        
        // Создаем кастомную иконку с улучшенным дизайном
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-dot ${isAvailable ? 'available' : 'collected'}">
                     <div class="marker-pulse ${isAvailable ? 'pulse' : ''}"></div>
                     <div class="marker-inner">${isAvailable ? '📦' : '✅'}</div>
                   </div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        
        const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon })
            .addTo(map);
        
        // Добавляем popup с улучшенным дизайном
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

// Добавление улучшенных стилей для маркеров
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
                width: 24px;
                height: 24px;
                border-radius: 50%;
                position: relative;
                border: 3px solid rgba(255, 255, 255, 0.95);
                box-shadow: 
                    0 4px 16px rgba(0, 0, 0, 0.25),
                    0 2px 8px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .marker-dot:hover {
                transform: scale(1.1);
                box-shadow: 
                    0 6px 20px rgba(0, 0, 0, 0.3),
                    0 3px 10px rgba(0, 0, 0, 0.2);
            }
            
            .marker-dot.available {
                background: linear-gradient(45deg, #28a745, #20c997);
            }
            
            .marker-dot.collected {
                background: linear-gradient(45deg, #dc3545, #e74c3c);
            }
            
            .marker-inner {
                font-size: 10px;
                color: white;
                font-weight: bold;
                z-index: 2;
                position: relative;
            }
            
            .marker-pulse {
                position: absolute;
                top: -3px;
                left: -3px;
                right: -3px;
                bottom: -3px;
                border-radius: 50%;
                border: 2px solid #28a745;
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
                min-width: 220px;
            }
            
            .popup-content h3 {
                margin: 0 0 12px 0;
                color: #495057;
                font-size: 1.1rem;
                font-weight: 700;
            }
            
            .status {
                margin: 12px 0;
                font-weight: 600;
                font-size: 0.95rem;
            }
            
            .status.available {
                color: #28a745;
            }
            
            .status.collected {
                color: #dc3545;
            }
            
            .collector-info {
                background: linear-gradient(135deg, #f8f9fa, #e9ecef);
                padding: 12px;
                border-radius: 10px;
                margin: 12px 0;
                font-size: 0.9rem;
                border: 1px solid rgba(108, 117, 125, 0.1);
            }
            
            .collector-info p {
                margin: 6px 0;
                color: #495057;
            }
            
            .details-btn {
                background: linear-gradient(45deg, #495057, #6c757d);
                color: white;
                border: none;
                padding: 10px 18px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 0.9rem;
                font-weight: 600;
                margin-top: 12px;
                width: 100%;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 2px 8px rgba(73, 80, 87, 0.2);
            }
            
            .details-btn:hover {
                background: linear-gradient(45deg, #343a40, #495057);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(73, 80, 87, 0.3);
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
                <hr style="margin: 15px 0; border: 1px solid #e9ecef;">
                <h4 style="color: #495057;">Информация о сборщике:</h4>
                <p><strong>Имя:</strong> ${point.collectorInfo.name}</p>
                ${point.collectorInfo.signature ? `<p><strong>Сообщение:</strong> ${point.collectorInfo.signature}</p>` : ''}
                <p><strong>Время сбора:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>
            `;
            
            if (point.collectorInfo.selfie) {
                modalContent += `
                    <div style="margin-top: 15px;">
                        <strong>Селфи с места находки:</strong><br>
                        <img src="${point.collectorInfo.selfie}" 
                             style="max-width: 100%; max-height: 300px; border-radius: 10px; margin-top: 10px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);"
                             alt="Селфи сборщика"
                             loading="lazy">
                    </div>
                `;
            }
        }
        
        document.getElementById('modalTitle').innerHTML = 'Информация о модели';
        document.getElementById('modalBody').innerHTML = modalContent;
        document.getElementById('infoModal').style.display = 'block';
        
        // Добавляем анимацию появления модального окна
        const modal = document.getElementById('infoModal');
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.style.transition = 'opacity 0.3s ease';
        }, 10);
        
    } catch (error) {
        console.error('Ошибка загрузки информации:', error);
        showNotification('Ошибка загрузки информации о точке', 'error');
    }
}

// Закрыть модальное окно
function closeModal() {
    const modal = document.getElementById('infoModal');
    modal.style.opacity = '0';
    setTimeout(() => {
        modal.style.display = 'none';
        modal.style.transition = '';
    }, 300);
}

// Улучшенная функция показа уведомлений
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
    
    // Анимация появления
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
        notification.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    }, 10);
    
    // Автоматически удаляем через 5 секунд
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.transform = 'translateX(100%)';
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 400);
        }
    }, 5000);
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
                background: rgba(255, 255, 255, 0.98);
                border-radius: 12px;
                box-shadow: 
                    0 8px 32px rgba(0, 0, 0, 0.15),
                    0 4px 16px rgba(0, 0, 0, 0.1);
                padding: 16px 20px;
                min-width: 280px;
                max-width: 380px;
                backdrop-filter: blur(15px);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .notification.error {
                border-left: 4px solid #dc3545;
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 215, 218, 0.3));
            }
            
            .notification.success {
                border-left: 4px solid #28a745;
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(212, 237, 218, 0.3));
            }
            
            .notification.info {
                border-left: 4px solid #495057;
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 249, 250, 0.3));
            }
            
            .notification.warning {
                border-left: 4px solid #ffc107;
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(255, 243, 205, 0.3));
            }
            
            .notification-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
                color: #495057;
                font-weight: 500;
            }
            
            .notification-content button {
                background: none;
                border: none;
                font-size: 1.3rem;
                cursor: pointer;
                color: #6c757d;
                padding: 0;
                margin: 0;
                width: auto;
                margin-left: 12px;
                transition: all 0.3s;
                line-height: 1;
            }
            
            .notification-content button:hover {
                color: #495057;
                transform: scale(1.1);
            }
        `;
        document.head.appendChild(style);
    }
}

// Инициализация кнопки обновления
function initRefreshButton() {
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            // Анимация вращения
            this.style.transform = 'rotate(360deg) scale(0.9)';
            this.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
            
            // Запускаем обновление данных
            loadPoints();
            
            setTimeout(() => {
                this.style.transform = '';
                this.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            }, 600);
        });
        
        // Добавляем подсказку при наведении
        refreshBtn.addEventListener('mouseenter', function() {
            if (!this.dataset.tooltip) {
                this.dataset.tooltip = 'true';
                const tooltip = document.createElement('div');
                tooltip.className = 'refresh-tooltip';
                tooltip.textContent = 'Обновить карту';
                tooltip.style.cssText = `
                    position: absolute;
                    bottom: 75px;
                    right: 0;
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    white-space: nowrap;
                    opacity: 0;
                    transition: opacity 0.3s;
                    pointer-events: none;
                `;
                this.style.position = 'relative';
                this.appendChild(tooltip);
                setTimeout(() => tooltip.style.opacity = '1', 10);
            }
        });
        
        refreshBtn.addEventListener('mouseleave', function() {
            const tooltip = this.querySelector('.refresh-tooltip');
            if (tooltip) {
                tooltip.style.opacity = '0';
                setTimeout(() => tooltip.remove(), 300);
                this.dataset.tooltip = '';
            }
        });
    }
}

// Закрытие модального окна при клике вне его
window.addEventListener('click', function(event) {
    const modal = document.getElementById('infoModal');
    if (event.target === modal) {
        closeModal();
    }
});

// Закрытие модального окна по ESC
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modal = document.getElementById('infoModal');
        if (modal && modal.style.display === 'block') {
            closeModal();
        }
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
    showNotification('Соединение восстановлено. Обновляем данные...', 'success');
    loadPoints();
});

window.addEventListener('offline', function() {
    showNotification('Нет подключения к интернету', 'warning');
});

// Проверка поддержки Service Worker для кэширования
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        // Здесь можно добавить регистрацию Service Worker для оффлайн работы
        console.log('Service Worker поддерживается');
    });
}

// Функция для центрирования карты на всех точках
function fitMapToPoints() {
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Функция для получения текущего местоположения пользователя
function getCurrentLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;
            
            // Добавляем маркер пользователя
            const userIcon = L.divIcon({
                className: 'user-location-marker',
                html: '<div style="background: #007bff; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.3);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            
            L.marker([userLat, userLng], { icon: userIcon })
                .addTo(map)
                .bindPopup('<div style="text-align: center;"><strong>📍 Ваше местоположение</strong></div>');
            
            // Центрируем карту на пользователе
            map.setView([userLat, userLng], 14);
            
            showNotification('Местоположение определено', 'success');
        }, function(error) {
            console.warn('Ошибка определения местоположения:', error);
            showNotification('Не удалось определить местоположение', 'warning');
        });
    }
}

// Добавляем кнопку местоположения (опционально)
document.addEventListener('DOMContentLoaded', function() {
    const locationBtn = document.createElement('div');
    locationBtn.className = 'location-btn';
    locationBtn.innerHTML = '📍';
    locationBtn.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 25px;
        width: 50px;
        height: 50px;
        background: linear-gradient(45deg, #007bff, #0056b3);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(0, 123, 255, 0.3);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 1000;
    `;
    
    locationBtn.addEventListener('click', getCurrentLocation);
    locationBtn.addEventListener('mouseenter', function() {
        this.style.transform = 'scale(1.1)';
    });
    locationBtn.addEventListener('mouseleave', function() {
        this.style.transform = 'scale(1)';
    });
    
    document.body.appendChild(locationBtn);
});

// Улучшенная обработка ошибок
window.addEventListener('unhandledrejection', function(event) {
    console.error('Необработанная ошибка Promise:', event.reason);
    showNotification('Произошла неожиданная ошибка', 'error');
    event.preventDefault();
});

// Дебаг информация для разработки
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('🎯 PlasticBoy Debug Mode');
    console.log('📍 Almaty Center:', ALMATY_CENTER);
    console.log('🗺️ Map initialized with grayscale theme');
}

// Экспорт функций для использования в других скриптах (если необходимо)
window.PlasticBoy = {
    map,
    loadPoints,
    showNotification,
    getCurrentLocation,
    fitMapToPoints
};
