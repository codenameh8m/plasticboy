// СУПЕР-БЫСТРЫЙ SCRIPT.JS для PlasticBoy
// Максимально оптимизирован для мгновенной загрузки точек

let map;
let markers = [];
let markersLayer; // Группа маркеров для быстрого управления

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// Флаги для быстрой работы
let isAppInitialized = false;
let pointsCache = null;
let lastUpdateTime = 0;
let isLoadingPoints = false;

// Кэш для быстрого доступа
const pointsById = new Map();
const markerPool = []; // Пул переиспользуемых маркеров

// Быстрая инициализация
document.addEventListener('DOMContentLoaded', function() {
    console.log('⚡ СУПЕР-быстрая инициализация PlasticBoy');
    initControlButtons();
    
    // Предзагрузка иконок маркеров
    preloadMarkerIcons();
});

// Предзагрузка иконок для ускорения рендеринга
function preloadMarkerIcons() {
    const iconPreloadStyles = `
        .marker-preload {
            position: absolute;
            left: -9999px;
            top: -9999px;
            opacity: 0;
            pointer-events: none;
        }
        .fast-marker-dot.available { background: linear-gradient(45deg, #4CAF50, #45a049); }
        .fast-marker-dot.collected { background: linear-gradient(45deg, #f44336, #e53935); }
    `;
    
    if (!document.getElementById('marker-preload-styles')) {
        const style = document.createElement('style');
        style.id = 'marker-preload-styles';
        style.textContent = iconPreloadStyles;
        document.head.appendChild(style);
    }
}

// МГНОВЕННАЯ инициализация карты
function initMap() {
    if (isAppInitialized) return;
    
    console.log('⚡ МГНОВЕННАЯ инициализация карты');
    
    map = L.map('map', {
        zoomControl: true,
        attributionControl: true,
        preferCanvas: true, // Аппаратное ускорение
        maxZoom: 18,
        zoomAnimation: true,
        markerZoomAnimation: true,
        fadeAnimation: true,
        // Оптимизации производительности
        updateWhenIdle: false,
        updateWhenZooming: false,
        keepBuffer: 4, // Больше буфер для быстрой загрузки
        renderer: L.canvas() // Canvas рендеринг быстрее
    }).setView(ALMATY_CENTER, 13);
    
    // Создаем группу маркеров для быстрого управления
    markersLayer = L.layerGroup().addTo(map);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
        keepBuffer: 4,
        updateWhenIdle: false,
        // Приоритет быстрой загрузки
        crossOrigin: true,
        timeout: 5000,
        retryDelay: 500,
        maxRetry: 2
    }).addTo(map);
    
    // Быстрые стили
    addFastGrayscaleMapStyles();
    
    // МГНОВЕННОЕ обновление размера карты
    map.invalidateSize();
    window.map = map;
    
    // Немедленная загрузка точек
    setTimeout(() => {
        console.log('⚡ Запуск МГНОВЕННОЙ загрузки точек');
        instantLoadPoints();
    }, 50);
    
    // Автообновление каждые 15 секунд (уменьшено для быстроты)
    setInterval(() => {
        if (!isLoadingPoints) {
            fastLoadPoints();
        }
    }, 15000);
    
    isAppInitialized = true;
}

// МГНОВЕННАЯ загрузка точек
async function instantLoadPoints() {
    if (isLoadingPoints) return;
    
    try {
        isLoadingPoints = true;
        const startTime = performance.now();
        
        console.log('⚡ МГНОВЕННАЯ загрузка точек...');
        
        // Используем fetch с кэшированием
        const response = await fetch('/api/points', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            },
            // Добавляем сигнал для быстрой отмены
            signal: AbortSignal.timeout(3000)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const points = await response.json();
        const loadTime = performance.now() - startTime;
        
        console.log(`⚡ МГНОВЕННО загружено ${points.length} точек за ${Math.round(loadTime)}ms`);
        
        // Кэшируем результат
        pointsCache = points;
        lastUpdateTime = Date.now();
        
        // Строим индекс для быстрого поиска
        buildPointsIndex(points);
        
        // МГНОВЕННОЕ обновление карты и статистики
        await Promise.all([
            ultraFastUpdateMap(points),
            instantUpdateStats(points)
        ]);
        
        // Уведомляем систему загрузки
        if (typeof window.PlasticBoyLoader !== 'undefined') {
            window.PlasticBoyLoader.onPointsLoaded();
        }
        
        return points;
        
    } catch (error) {
        console.error('Ошибка мгновенной загрузки:', error);
        
        // Показываем кэшированные данные если есть
        if (pointsCache) {
            console.log('⚡ Используем кэшированные данные');
            ultraFastUpdateMap(pointsCache);
            instantUpdateStats(pointsCache);
        } else {
            showFastNotification('Ошибка загрузки точек ⚠️', 'error');
        }
        
        // Уведомляем даже при ошибке
        if (typeof window.PlasticBoyLoader !== 'undefined') {
            window.PlasticBoyLoader.onPointsLoaded();
        }
    } finally {
        isLoadingPoints = false;
    }
}

// Построение индекса для быстрого поиска
function buildPointsIndex(points) {
    pointsById.clear();
    points.forEach(point => {
        pointsById.set(point.id, point);
    });
}

// УЛЬТРА-БЫСТРОЕ обновление карты
async function ultraFastUpdateMap(points) {
    if (!map || !markersLayer) {
        console.warn('Карта не готова для ультра-быстрого обновления');
        return;
    }
    
    const updateStart = performance.now();
    console.log(`⚡ УЛЬТРА-БЫСТРОЕ обновление ${points.length} маркеров`);
    
    // Мгновенная очистка всех маркеров
    markersLayer.clearLayers();
    markers.length = 0;
    
    // Пакетная обработка маркеров
    const markersToAdd = [];
    const fragment = document.createDocumentFragment();
    
    // Группируем точки по статусу для оптимизации
    const availablePoints = [];
    const collectedPoints = [];
    
    points.forEach(point => {
        if (point.status === 'available') {
            availablePoints.push(point);
        } else {
            collectedPoints.push(point);
        }
    });
    
    // Создаем маркеры пачками для лучшей производительности
    const createMarkerBatch = (pointsBatch, isAvailable) => {
        return pointsBatch.map(point => {
            // Переиспользуем маркеры из пула если возможно
            const marker = createFastMarker(point, isAvailable);
            markersToAdd.push(marker);
            return marker;
        });
    };
    
    // Создаем маркеры пачками
    createMarkerBatch(availablePoints, true);
    createMarkerBatch(collectedPoints, false);
    
    // Массовое добавление маркеров к слою
    markersToAdd.forEach(marker => {
        markersLayer.addLayer(marker);
        markers.push(marker);
    });
    
    // Глобальный доступ для системы загрузки
    window.markers = markers;
    
    // Добавляем стили если их нет
    addUltraFastMarkerStyles();
    
    const updateTime = performance.now() - updateStart;
    console.log(`⚡ УЛЬТРА-БЫСТРО обновлено за ${Math.round(updateTime)}ms`);
}

// Создание быстрого маркера
function createFastMarker(point, isAvailable) {
    // Минималистичная быстрая иконка
    const icon = L.divIcon({
        className: 'ultra-fast-marker',
        html: `<div class="ultra-fast-dot ${isAvailable ? 'available' : 'collected'}">${isAvailable ? '📦' : '✅'}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
    });
    
    const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { 
        icon,
        riseOnHover: true // Быстрая анимация при наведении
    });
    
    // Оптимизированный popup
    const popupContent = createFastPopup(point, isAvailable);
    marker.bindPopup(popupContent, {
        maxWidth: 250,
        className: 'ultra-fast-popup'
    });
    
    return marker;
}

// Создание быстрого попапа
function createFastPopup(point, isAvailable) {
    let content = `
        <div class="ultra-fast-popup-content">
            <h3>${point.name}</h3>
            <div class="status-badge ${point.status}">
                ${isAvailable ? '🟢 Доступна' : '🔴 Собрана'}
            </div>
    `;
    
    if (!isAvailable && point.collectorInfo) {
        content += `
            <div class="collector-summary">
                <strong>Собрал:</strong> ${point.collectorInfo.name}<br>
                <strong>Время:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                })}
            </div>
            <button onclick="showPointDetails('${point.id}')" class="ultra-fast-btn">Подробнее</button>
        `;
    }
    
    content += '</div>';
    return content;
}

// МГНОВЕННОЕ обновление статистики
function instantUpdateStats(points) {
    const available = points.filter(p => p.status === 'available').length;
    const collected = points.filter(p => p.status === 'collected').length;
    
    const availableElement = document.getElementById('availableCount');
    const collectedElement = document.getElementById('collectedCount');
    
    if (availableElement && collectedElement) {
        // Мгновенное обновление без анимации для первой загрузки
        const currentAvailable = parseInt(availableElement.textContent) || 0;
        const currentCollected = parseInt(collectedElement.textContent) || 0;
        
        if (currentAvailable === 0 && currentCollected === 0) {
            // Первая загрузка - мгновенно
            availableElement.textContent = available;
            collectedElement.textContent = collected;
        } else {
            // Последующие обновления с быстрой анимацией
            ultraFastAnimateNumber(availableElement, currentAvailable, available);
            ultraFastAnimateNumber(collectedElement, currentCollected, collected);
        }
    }
    
    console.log(`⚡ Статистика МГНОВЕННО: ${available} доступно, ${collected} собрано`);
}

// Ультра-быстрая анимация чисел
function ultraFastAnimateNumber(element, from, to) {
    if (from === to) return;
    
    const duration = 200; // Очень быстрая анимация
    const steps = 8; // Меньше шагов
    const stepValue = (to - from) / steps;
    const stepDuration = duration / steps;
    
    let current = from;
    let step = 0;
    
    element.style.transform = 'scale(1.05)';
    element.style.transition = 'transform 0.15s ease';
    
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

// Ультра-быстрые стили для маркеров
function addUltraFastMarkerStyles() {
    if (!document.getElementById('ultra-fast-marker-styles')) {
        const style = document.createElement('style');
        style.id = 'ultra-fast-marker-styles';
        style.textContent = `
            .ultra-fast-marker {
                background: none !important;
                border: none !important;
            }
            
            .ultra-fast-dot {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.25);
                transition: transform 0.15s ease, box-shadow 0.15s ease;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                color: white;
                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
            }
            
            .ultra-fast-dot:hover {
                transform: scale(1.15);
                box-shadow: 0 4px 12px rgba(0,0,0,0.35);
            }
            
            .ultra-fast-dot.available {
                background: linear-gradient(45deg, #4CAF50, #45a049);
            }
            
            .ultra-fast-dot.collected {
                background: linear-gradient(45deg, #f44336, #e53935);
            }
            
            .ultra-fast-popup-content {
                min-width: 180px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .ultra-fast-popup-content h3 {
                margin: 0 0 8px 0;
                color: #333;
                font-size: 1rem;
                font-weight: 600;
            }
            
            .status-badge {
                display: inline-block;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 0.8rem;
                font-weight: 600;
                margin-bottom: 8px;
            }
            
            .status-badge.available {
                background: rgba(76, 175, 80, 0.1);
                color: #4CAF50;
                border: 1px solid rgba(76, 175, 80, 0.3);
            }
            
            .status-badge.collected {
                background: rgba(244, 67, 54, 0.1);
                color: #f44336;
                border: 1px solid rgba(244, 67, 54, 0.3);
            }
            
            .collector-summary {
                background: #f8f9fa;
                padding: 6px 8px;
                border-radius: 6px;
                margin: 6px 0;
                font-size: 0.8rem;
                line-height: 1.3;
            }
            
            .ultra-fast-btn {
                background: linear-gradient(45deg, #667eea, #764ba2);
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.8rem;
                margin-top: 6px;
                width: 100%;
                transition: background 0.15s;
            }
            
            .ultra-fast-btn:hover {
                background: linear-gradient(45deg, #5a67d8, #6b46c1);
            }
            
            .ultra-fast-popup {
                border-radius: 10px;
            }
        `;
        document.head.appendChild(style);
    }
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
            timeout: 6000, // Быстрый таймаут
            maximumAge: 300000
        }
    );
}

// Быстрая загрузка точек (псевдоним для совместимости)
async function loadPoints() {
    return await instantLoadPoints();
}

// Быстрая загрузка точек (для автообновления)
async function fastLoadPoints() {
    return await instantLoadPoints();
}

// Быстрые детали точки
async function showPointDetails(pointId) {
    try {
        // Сначала проверяем кэш
        const cachedPoint = pointsById.get(pointId);
        if (cachedPoint) {
            displayPointDetails(cachedPoint);
            return;
        }
        
        // Если нет в кэше, загружаем
        const response = await fetch(`/api/point/${pointId}/info`);
        if (!response.ok) {
            throw new Error('Ошибка загрузки');
        }
        
        const point = await response.json();
        displayPointDetails(point);
        
    } catch (error) {
        console.error('Ошибка загрузки информации:', error);
        showFastNotification('Ошибка загрузки информации', 'error');
    }
}

// Отображение деталей точки
function displayPointDetails(point) {
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
    }, 3000);
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
        }, 50); // Еще быстрее
    }
}, { passive: true });

// Быстрые сетевые события
window.addEventListener('online', function() {
    showFastNotification('Соединение восстановлено ⚡', 'success');
    if (isAppInitialized && !isLoadingPoints) {
        setTimeout(() => instantLoadPoints(), 100);
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
    
    // Быстрое обновление точек по F5
    if (event.key === 'F5' && event.ctrlKey) {
        event.preventDefault();
        if (!isLoadingPoints) {
            showFastNotification('Обновление точек ⚡', 'info');
            instantLoadPoints();
        }
    }
}, { passive: false });

// Предзагрузка критических ресурсов
function preloadCriticalResources() {
    // Предзагружаем важные API эндпоинты
    const preloadUrls = ['/api/points'];
    
    preloadUrls.forEach(url => {
        fetch(url, { 
            method: 'HEAD',
            mode: 'no-cors'
        }).catch(() => {}); // Игнорируем ошибки предзагрузки
    });
}

// Оптимизация производительности
function optimizePerformance() {
    // Включаем аппаратное ускорение для анимаций
    const styleOptimizations = `
        .ultra-fast-dot,
        .fast-notification,
        .ultra-fast-popup-content {
            will-change: transform;
            transform: translateZ(0);
        }
        
        .leaflet-zoom-animated {
            will-change: transform;
        }
        
        .leaflet-tile {
            will-change: transform;
        }
    `;
    
    if (!document.getElementById('performance-optimizations')) {
        const style = document.createElement('style');
        style.id = 'performance-optimizations';
        style.textContent = styleOptimizations;
        document.head.appendChild(style);
    }
}

// Быстрый экспорт и псевдонимы
window.PlasticBoy = {
    map,
    markers,
    markersLayer,
    loadPoints: instantLoadPoints,
    fastLoadPoints: instantLoadPoints,
    showFastNotification,
    getCurrentLocation,
    showPointDetails,
    closeModal,
    initMap,
    ultraFastUpdateMap,
    instantUpdateStats,
    pointsCache,
    pointsById
};

// Псевдонимы для совместимости с существующим кодом
window.showNotification = showFastNotification;
window.updateMap = ultraFastUpdateMap;
window.updateStats = instantUpdateStats;
window.loadPoints = instantLoadPoints;

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    preloadCriticalResources();
    optimizePerformance();
});

console.log('⚡ УЛЬТРА-БЫСТРЫЙ PlasticBoy script готов к мгновенной работе');

// Экспорт функций для системы загрузки
if (typeof window.PlasticBoyLoader !== 'undefined') {
    window.PlasticBoyLoader.instantLoadPoints = instantLoadPoints;
    window.PlasticBoyLoader.ultraFastUpdateMap = ultraFastUpdateMap;
}
