// Оптимизированный основной скрипт с кешированием и ленивой загрузкой
let map;
let markers = [];
let pointsData = [];
let lastUpdateTime = 0;
let isUpdating = false;

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// Кеш для маркеров
const markerCache = new Map();

// Дебаунс функция для оптимизации частых вызовов
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Инициализация приложения с оптимизированной загрузкой
document.addEventListener('DOMContentLoaded', function() {
    // Инициализируем карту сразу
    initMap();
    
    // Загружаем точки асинхронно
    loadPoints();
    
    // Оптимизированное автообновление - только если страница активна
    let updateInterval;
    
    function startAutoUpdate() {
        if (updateInterval) return;
        updateInterval = setInterval(() => {
            if (!document.hidden && !isUpdating) {
                loadPoints();
            }
        }, 30000);
    }
    
    function stopAutoUpdate() {
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
    }
    
    // Управляем обновлениями в зависимости от видимости страницы
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            stopAutoUpdate();
        } else {
            startAutoUpdate();
            // Обновляем данные при возврате на страницу
            if (Date.now() - lastUpdateTime > 30000) {
                loadPoints();
            }
        }
    });
    
    startAutoUpdate();
});

// Оптимизированная инициализация карты
function initMap() {
    try {
        // Создаем карту с оптимизированными настройками
        map = L.map('map', {
            center: ALMATY_CENTER,
            zoom: 12,
            zoomControl: true,
            attributionControl: false, // Убираем для экономии места
            preferCanvas: true, // Используем Canvas для лучшей производительности
            renderer: L.canvas() // Явно указываем Canvas renderer
        });
        
        // Добавляем тайлы с оптимизированными настройками
        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            tileSize: 256,
            updateWhenZooming: false, // Уменьшаем количество запросов при зуме
            updateWhenIdle: true, // Обновляем только когда карта не движется
            keepBuffer: 2 // Кешируем больше тайлов
        });
        
        tileLayer.addTo(map);
        
        // Стилизация карты
        map.getContainer().style.filter = 'grayscale(20%) contrast(1.1)';
        
        // Обработчик ошибок загрузки тайлов
        tileLayer.on('tileerror', function(e) {
            console.warn('Tile loading error:', e.tile.src);
        });
        
    } catch (error) {
        console.error('Ошибка инициализации карты:', error);
        showNotification('Ошибка загрузки карты', 'error');
    }
}

// Оптимизированная загрузка точек с кешированием
async function loadPoints() {
    if (isUpdating) return; // Предотвращаем множественные одновременные запросы
    
    isUpdating = true;
    
    try {
        // Добавляем контроллер для отмены запроса
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch('/api/points', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'max-age=30' // Разрешаем кеширование на 30 сек
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to load points`);
        }
        
        const points = await response.json();
        
        // Проверяем, изменились ли данные
        const pointsHash = JSON.stringify(points.map(p => ({ id: p.id, status: p.status })));
        const currentHash = JSON.stringify(pointsData.map(p => ({ id: p.id, status: p.status })));
        
        if (pointsHash === currentHash) {
            console.log('Data unchanged, skipping update');
            return;
        }
        
        pointsData = points;
        lastUpdateTime = Date.now();
        
        // Обновляем интерфейс
        updateMap(points);
        updateStats(points);
        
    } catch (error) {
        console.error('Error loading points:', error);
        
        if (error.name === 'AbortError') {
            console.log('Request was aborted');
        } else {
            showNotification('Ошибка загрузки данных', 'error');
        }
    } finally {
        isUpdating = false;
    }
}

// Оптимизированное обновление карты с переиспользованием маркеров
function updateMap(points) {
    if (!map) return;
    
    // Создаем Set для быстрого поиска существующих точек
    const existingPointIds = new Set(markers.map(m => m.pointId));
    const newPointIds = new Set(points.map(p => p.id));
    
    // Удаляем маркеры для несуществующих точек
    markers = markers.filter(marker => {
        if (!newPointIds.has(marker.pointId)) {
            map.removeLayer(marker);
            markerCache.delete(marker.pointId);
            return false;
        }
        return true;
    });
    
    // Добавляем или обновляем маркеры
    points.forEach(point => {
        const existingMarkerIndex = markers.findIndex(m => m.pointId === point.id);
        
        if (existingMarkerIndex >= 0) {
            // Обновляем существующий маркер только если статус изменился
            const existingMarker = markers[existingMarkerIndex];
            if (existingMarker.pointStatus !== point.status) {
                updateMarkerIcon(existingMarker, point);
                updateMarkerPopup(existingMarker, point);
            }
        } else {
            // Создаем новый маркер
            createMarker(point);
        }
    });
    
    // Добавляем стили маркеров только один раз
    addMarkerStyles();
}

// Создание нового маркера с кешированием
function createMarker(point) {
    const isAvailable = point.status === 'available';
    
    // Проверяем кеш для иконки
    const iconKey = `${isAvailable ? 'available' : 'collected'}`;
    let icon = markerCache.get(iconKey);
    
    if (!icon) {
        // Создаем иконку только если её нет в кеше
        icon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-dot ${isAvailable ? 'available' : 'collected'}">
                     <div class="marker-pulse ${isAvailable ? 'pulse' : ''}"></div>
                   </div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        markerCache.set(iconKey, icon);
    }
    
    const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon });
    
    // Добавляем кастомные свойства для оптимизации
    marker.pointId = point.id;
    marker.pointStatus = point.status;
    
    marker.addTo(map);
    
    // Создаем попап
    updateMarkerPopup(marker, point);
    
    markers.push(marker);
}

// Обновление иконки маркера
function updateMarkerIcon(marker, point) {
    const isAvailable = point.status === 'available';
    const iconKey = `${isAvailable ? 'available' : 'collected'}`;
    let icon = markerCache.get(iconKey);
    
    if (!icon) {
        icon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-dot ${isAvailable ? 'available' : 'collected'}">
                     <div class="marker-pulse ${isAvailable ? 'pulse' : ''}"></div>
                   </div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        markerCache.set(iconKey, icon);
    }
    
    marker.setIcon(icon);
    marker.pointStatus = point.status;
}

// Обновление попапа маркера
function updateMarkerPopup(marker, point) {
    const isAvailable = point.status === 'available';
    
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
        
        popupContent += `<button onclick="showPointDetails('${point.id}')" class="details-btn">Подробнее</button>`;
    }
    
    popupContent += '</div>';
    marker.bindPopup(popupContent);
}

// Ленивое добавление стилей для маркеров
let markerStylesAdded = false;
function addMarkerStyles() {
    if (markerStylesAdded) return;
    
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
        }
        
        .marker-dot.available {
            background: #4CAF50;
        }
        
        .marker-dot.collected {
            background: #f44336;
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
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            margin-top: 10px;
            width: 100%;
        }
        
        .details-btn:hover {
            background: #5a67d8;
        }
    `;
    document.head.appendChild(style);
    markerStylesAdded = true;
}

// Оптимизированное обновление статистики
function updateStats(points) {
    const available = points.filter(p => p.status === 'available').length;
    const collected = points.filter(p => p.status === 'collected').length;
    
    // Анимированное обновление чисел
    animateCounter('availableCount', available);
    animateCounter('collectedCount', collected);
}

// Анимация счетчиков
function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    const currentValue = parseInt(element.textContent) || 0;
    
    if (currentValue === targetValue) return;
    
    const duration = 500;
    const steps = 20;
    const stepValue = (targetValue - currentValue) / steps;
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    const timer = setInterval(() => {
        currentStep++;
        const newValue = Math.round(currentValue + (stepValue * currentStep));
        element.textContent = currentStep === steps ? targetValue : newValue;
        
        if (currentStep >= steps) {
            clearInterval(timer);
        }
    }, stepDuration);
}

// Кеш для информации о точках
const pointInfoCache = new Map();

// Оптимизированное показание подробностей точки
async function showPointDetails(pointId) {
    try {
        // Проверяем кеш
        let point = pointInfoCache.get(pointId);
        
        if (!point) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`/api/point/${pointId}/info`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error('Ошибка загрузки информации');
            }
            
            point = await response.json();
            // Кешируем на 5 минут
            pointInfoCache.set(pointId, point);
            setTimeout(() => pointInfoCache.delete(pointId), 5 * 60 * 1000);
        }
        
        let modalContent = `
            <h3>${point.name}</h3>
            <p><strong>Статус:</strong> ${point.status === 'collected' ? 'Собрана' : 'Доступна'}</p>
            <p><strong>Координаты:</strong> ${point.coordinates.lat.toFixed(6)}, ${point.coordinates.lng.toFixed(6)}</p>
        `;
        
        if (point.status === 'collected' && point.collectorInfo) {
            modalContent += `
                <hr style="margin: 15px 0;">
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
                             alt="Селфи сборщика"
                             loading="lazy"
                             onload="this.style.opacity=1"
                             style="opacity:0;transition:opacity 0.3s">
                    </div>
                `;
            }
        }
        
        document.getElementById('modalTitle').innerHTML = 'Информация о модели';
        document.getElementById('modalBody').innerHTML = modalContent;
        document.getElementById('infoModal').style.display = 'block';
        
    } catch (error) {
        console.error('Ошибка загрузки информации:', error);
        
        if (error.name === 'AbortError') {
            showNotification('Время ожидания истекло', 'error');
        } else {
            showNotification('Ошибка загрузки информации', 'error');
        }
    }
}

// Закрыть модальное окно
function closeModal() {
    document.getElementById('infoModal').style.display = 'none';
}

// Оптимизированные уведомления с ограничением количества
let notificationCount = 0;
const maxNotifications = 3;

function showNotification(message, type = 'info') {
    if (notificationCount >= maxNotifications) {
        // Удаляем старые уведомления
        const oldNotifications = document.querySelectorAll('.notification');
        if (oldNotifications.length > 0) {
            oldNotifications[0].remove();
            notificationCount--;
        }
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove(); notificationCount--">×</button>
        </div>
    `;
    
    addNotificationStyles();
    
    document.body.appendChild(notification);
    notificationCount++;
    
    // Автоматически удаляем через 5 секунд
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
            notificationCount--;
        }
    }, 5000);
}

// Ленивое добавление стилей уведомлений
let notificationStylesAdded = false;
function addNotificationStyles() {
    if (notificationStylesAdded) return;
    
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
    `;
    document.head.appendChild(style);
    notificationStylesAdded = true;
}

// Закрытие модального окна при клике вне его
window.addEventListener('click', function(event) {
    const modal = document.getElementById('infoModal');
    if (event.target === modal) {
        closeModal();
    }
});

// Оптимизированная обработка кнопки обновления
const debouncedRefresh = debounce(() => {
    loadPoints();
}, 1000);

document.addEventListener('DOMContentLoaded', function() {
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            if (isUpdating) return;
            
            this.style.transform = 'rotate(360deg)';
            this.style.transition = 'transform 0.5s';
            
            setTimeout(() => {
                this.style.transform = '';
                this.style.transition = '';
            }, 500);
            
            debouncedRefresh();
        });
    }
});

// Обработка ошибок загрузки карты с повторными попытками
let tileErrorCount = 0;
window.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG' && e.target.src.includes('openstreetmap')) {
        tileErrorCount++;
        
        if (tileErrorCount <= 3) {
            console.warn(`Ошибка загрузки тайла карты (попытка ${tileErrorCount})`);
        } else {
            showNotification('Проблемы с загрузкой карты. Проверьте интернет-соединение.', 'error');
        }
    }
});

// Оптимизация памяти: очистка при выходе со страницы
window.addEventListener('beforeunload', function() {
    // Очищаем кеши
    markerCache.clear();
    pointInfoCache.clear();
    
    // Очищаем маркеры
    if (markers.length > 0) {
        markers.forEach(marker => {
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        });
        markers = [];
    }
});

// Service Worker для кеширования (если поддерживается)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('SW registered: ', registration);
            })
            .catch(function(registrationError) {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
