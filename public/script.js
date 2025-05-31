// СУПЕР-БЫСТРЫЙ SCRIPT.JS для PlasticBoy
// Мгновенное отображение точек на карте

let map;
let markers = [];
let markersLayer; // Группа маркеров для пакетной работы

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// Кэш для мгновенной работы
let pointsCache = null;
let lastUpdateTime = 0;
let isAppInitialized = false;

// Пакетная обработка DOM
const batchDOMUpdates = (callback) => {
    requestAnimationFrame(() => {
        callback();
    });
};

// Оптимизированная инициализация
document.addEventListener('DOMContentLoaded', function() {
    console.log('⚡ Супер-быстрая инициализация PlasticBoy');
    initControlButtons();
    
    // Предзагружаем иконки в CSS
    preloadMarkerStyles();
});

// Предзагрузка стилей маркеров
function preloadMarkerStyles() {
    const style = document.createElement('style');
    style.id = 'preloaded-marker-styles';
    style.textContent = `
        .lightning-marker {
            background: none !important;
            border: none !important;
        }
        
        .lightning-dot {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            transition: transform 0.15s ease;
            cursor: pointer;
            position: relative;
        }
        
        .lightning-dot:hover {
            transform: scale(1.15);
            z-index: 1000;
        }
        
        .lightning-dot.available {
            background: #4CAF50;
            box-shadow: 0 2px 6px rgba(76, 175, 80, 0.4);
        }
        
        .lightning-dot.collected {
            background: #f44336;
            box-shadow: 0 2px 6px rgba(244, 67, 54, 0.4);
        }
        
        .lightning-popup {
            min-width: 180px;
            font-family: system-ui, -apple-system, sans-serif;
        }
        
        .lightning-popup h3 {
            margin: 0 0 8px 0;
            color: #333;
            font-size: 0.95rem;
            font-weight: 600;
        }
        
        .lightning-status {
            margin: 6px 0;
            font-weight: 600;
            font-size: 0.85rem;
        }
        
        .lightning-status.available { color: #4CAF50; }
        .lightning-status.collected { color: #f44336; }
        
        .lightning-collector {
            background: #f8f9fa;
            padding: 6px;
            border-radius: 4px;
            margin: 6px 0;
            font-size: 0.8rem;
        }
        
        .lightning-collector p {
            margin: 3px 0;
        }
        
        .lightning-btn {
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 6px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.8rem;
            width: 100%;
            margin-top: 6px;
            transition: background 0.2s;
        }
        
        .lightning-btn:hover {
            background: linear-gradient(45deg, #5a67d8, #6b46c1);
        }
        
        /* Оптимизированные стили карты */
        .leaflet-tile-pane {
            filter: grayscale(100%) contrast(1.1) brightness(1.05);
            transform: translateZ(0); /* GPU ускорение */
        }
        
        .leaflet-marker-pane {
            will-change: transform;
        }
        
        .leaflet-popup-pane {
            will-change: transform;
        }
    `;
    document.head.appendChild(style);
}

// Мгновенная инициализация карты
function initMap() {
    if (isAppInitialized) return;
    
    console.log('⚡ Мгновенная инициализация карты');
    
    map = L.map('map', {
        zoomControl: true,
        attributionControl: true,
        preferCanvas: true,
        renderer: L.canvas(), // Canvas для лучшей производительности
        maxZoom: 18,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true
    }).setView(ALMATY_CENTER, 13);
    
    // Группа маркеров для пакетной обработки
    markersLayer = L.layerGroup().addTo(map);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
        keepBuffer: 4, // Увеличили буфер тайлов
        updateWhenIdle: false,
        updateWhenZooming: false,
        crossOrigin: true
    }).addTo(map);
    
    // Мгновенное обновление размера
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
            window.map = map;
            console.log('⚡ Карта готова для МГНОВЕННОЙ загрузки точек');
            
            // Сразу пытаемся загрузить точки
            lightningLoadPoints();
        }
    }, 10); // Минимальная задержка
    
    isAppInitialized = true;
    
    // Автообновление каждые 30 секунд
    setInterval(() => {
        if (isAppInitialized) {
            lightningLoadPoints();
        }
    }, 30000);
}

// Быстрая инициализация кнопок
function initControlButtons() {
    batchDOMUpdates(() => {
        const locationBtn = document.querySelector('.location-btn');
        if (locationBtn) {
            locationBtn.addEventListener('mousedown', function() {
                this.style.transform = 'translateY(-1px)';
            }, { passive: true });
            
            locationBtn.addEventListener('mouseup', function() {
                this.style.transform = '';
            }, { passive: true });
        }
    });
}

// МГНОВЕННАЯ загрузка точек
async function lightningLoadPoints() {
    const startTime = performance.now();
    
    try {
        console.log('⚡ МГНОВЕННАЯ загрузка точек...');
        
        // Используем fetch с оптимизацией
        const response = await fetch('/api/points', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            },
            cache: 'no-store' // Всегда свежие данные
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const points = await response.json();
        const loadTime = performance.now() - startTime;
        
        console.log(`⚡ МГНОВЕННО загружено ${points.length} точек за ${loadTime.toFixed(1)}ms`);
        
        // Проверяем изменения
        const pointsChanged = !pointsCache || 
            pointsCache.length !== points.length ||
            JSON.stringify(pointsCache.map(p => p.id + p.status)) !== 
            JSON.stringify(points.map(p => p.id + p.status));
        
        if (pointsChanged) {
            pointsCache = points;
            lastUpdateTime = Date.now();
            
            // МГНОВЕННОЕ обновление карты и статистики параллельно
            Promise.all([
                lightningUpdateMap(points),
                lightningUpdateStats(points)
            ]).then(() => {
                const totalTime = performance.now() - startTime;
                console.log(`⚡ ПОЛНОЕ обновление за ${totalTime.toFixed(1)}ms`);
                
                // Уведомляем систему загрузки
                if (typeof window.PlasticBoyLoader !== 'undefined') {
                    window.PlasticBoyLoader.onPointsLoaded();
                }
            });
        } else {
            console.log('⚡ Точки не изменились, пропускаем обновление');
        }
        
        return points;
        
    } catch (error) {
        console.error('⚠️ Ошибка загрузки точек:', error);
        
        // Показываем кэшированные данные при ошибке
        if (pointsCache) {
            console.log('📦 Показываем кэшированные данные');
            await lightningUpdateMap(pointsCache);
            await lightningUpdateStats(pointsCache);
        }
        
        showLightningNotification('Ошибка загрузки ⚠️', 'warning');
        
        // Уведомляем даже при ошибке
        if (typeof window.PlasticBoyLoader !== 'undefined') {
            window.PlasticBoyLoader.onPointsLoaded();
        }
        
        throw error;
    }
}

// МГНОВЕННОЕ обновление карты
async function lightningUpdateMap(points) {
    if (!map || !markersLayer) {
        console.warn('⚠️ Карта не готова');
        return;
    }
    
    const startTime = performance.now();
    console.log(`⚡ МГНОВЕННОЕ обновление ${points.length} маркеров`);
    
    return new Promise((resolve) => {
        // Очищаем ВСЕ маркеры одной операцией
        markersLayer.clearLayers();
        markers.length = 0;
        
        if (points.length === 0) {
            resolve();
            return;
        }
        
        // Пакетное создание маркеров
        const newMarkers = [];
        const iconsCache = new Map(); // Кэш иконок
        
        points.forEach(point => {
            const isAvailable = point.status === 'available';
            const iconKey = isAvailable ? 'available' : 'collected';
            
            // Используем кэшированные иконки
            if (!iconsCache.has(iconKey)) {
                iconsCache.set(iconKey, L.divIcon({
                    className: 'lightning-marker',
                    html: `<div class="lightning-dot ${iconKey}"></div>`,
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                }));
            }
            
            const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { 
                icon: iconsCache.get(iconKey),
                riseOnHover: true
            });
            
            // Оптимизированный popup
            const popupContent = createLightningPopup(point, isAvailable);
            marker.bindPopup(popupContent, {
                maxWidth: 200,
                autoPan: false
            });
            
            newMarkers.push(marker);
        });
        
        // Добавляем ВСЕ маркеры одной операцией
        batchDOMUpdates(() => {
            newMarkers.forEach(marker => {
                markersLayer.addLayer(marker);
                markers.push(marker);
            });
            
            // Глобальный доступ
            window.markers = markers;
            
            const updateTime = performance.now() - startTime;
            console.log(`⚡ Карта обновлена за ${updateTime.toFixed(1)}ms`);
            resolve();
        });
    });
}

// Создание оптимизированного popup
function createLightningPopup(point, isAvailable) {
    let content = `
        <div class="lightning-popup">
            <h3>${point.name}</h3>
            <p class="lightning-status ${point.status}">
                ${isAvailable ? '🟢 Доступна' : '🔴 Собрана'}
            </p>
    `;
    
    if (!isAvailable && point.collectorInfo) {
        content += `
            <div class="lightning-collector">
                <p><strong>Собрал:</strong> ${point.collectorInfo.name}</p>
                ${point.collectorInfo.signature ? `<p><strong>Сообщение:</strong> ${point.collectorInfo.signature}</p>` : ''}
                <p><strong>Время:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                })}</p>
            </div>
            <button onclick="showPointDetails('${point.id}')" class="lightning-btn">Подробнее</button>
        `;
    }
    
    content += '</div>';
    return content;
}

// МГНОВЕННОЕ обновление статистики
async function lightningUpdateStats(points) {
    return new Promise((resolve) => {
        const available = points.filter(p => p.status === 'available').length;
        const collected = points.filter(p => p.status === 'collected').length;
        
        batchDOMUpdates(() => {
            const availableElement = document.getElementById('availableCount');
            const collectedElement = document.getElementById('collectedCount');
            
            if (availableElement && collectedElement) {
                // Мгновенное обновление без анимации для скорости
                const currentAvailable = parseInt(availableElement.textContent) || 0;
                const currentCollected = parseInt(collectedElement.textContent) || 0;
                
                if (currentAvailable !== available) {
                    lightningAnimateNumber(availableElement, currentAvailable, available);
                }
                if (currentCollected !== collected) {
                    lightningAnimateNumber(collectedElement, currentCollected, collected);
                }
            }
            
            console.log(`⚡ Статистика: ${available} доступно, ${collected} собрано`);
            resolve();
        });
    });
}

// Быстрая анимация чисел (сокращенная)
function lightningAnimateNumber(element, from, to) {
    if (from === to) return;
    
    // Для больших изменений - мгновенно
    if (Math.abs(to - from) > 5) {
        element.textContent = to;
        element.style.transform = 'scale(1.05)';
        element.style.transition = 'transform 0.15s ease';
        setTimeout(() => {
            element.style.transform = 'scale(1)';
        }, 150);
        return;
    }
    
    // Для малых изменений - быстрая анимация
    const duration = 200;
    const steps = 8;
    const stepValue = (to - from) / steps;
    const stepDuration = duration / steps;
    
    let current = from;
    let step = 0;
    
    element.style.transform = 'scale(1.05)';
    element.style.transition = 'transform 0.1s ease';
    
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

// Оптимизированная геолокация
function getCurrentLocation() {
    const locationBtn = document.querySelector('.location-btn');
    
    if (!navigator.geolocation) {
        showLightningNotification('Геолокация не поддерживается', 'error');
        return;
    }
    
    const originalText = locationBtn.innerHTML;
    locationBtn.innerHTML = '⚡ Поиск...';
    locationBtn.disabled = true;
    locationBtn.style.opacity = '0.8';
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Быстрая иконка пользователя
            const userIcon = L.divIcon({
                className: 'lightning-user-marker',
                html: `<div style="
                    background: linear-gradient(45deg, #007bff, #0056b3);
                    width: 20px; 
                    height: 20px; 
                    border-radius: 50%; 
                    border: 2px solid white; 
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    transform: translateZ(0);
                "></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            
            // Удаляем предыдущий маркер
            if (window.userMarker) {
                map.removeLayer(window.userMarker);
            }
            
            // Быстрое добавление маркера
            window.userMarker = L.marker([lat, lng], { icon: userIcon })
                .addTo(map)
                .bindPopup(`
                    <div style="text-align: center; min-width: 120px;">
                        <strong>📍 Вы здесь</strong><br>
                        <small style="color: #666;">
                            ${lat.toFixed(4)}, ${lng.toFixed(4)}
                        </small>
                    </div>
                `, {
                    autoPan: false
                });
            
            // Быстрое центрирование
            map.setView([lat, lng], 16);
            
            showLightningNotification('Найдено ⚡', 'success');
            
            // Восстановление кнопки
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
            locationBtn.style.opacity = '';
        },
        function(error) {
            console.error('Ошибка геолокации:', error);
            
            let errorMessage = 'Не найдено';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Доступ запрещен';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Недоступно';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Таймаут';
                    break;
            }
            
            showLightningNotification(errorMessage, 'error');
            
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
            locationBtn.style.opacity = '';
        },
        {
            enableHighAccuracy: true,
            timeout: 5000, // Уменьшенный таймаут
            maximumAge: 300000
        }
    );
}

// Быстрые детали точки (кэшированные)
const detailsCache = new Map();

async function showPointDetails(pointId) {
    try {
        // Проверяем кэш
        if (detailsCache.has(pointId)) {
            const cachedData = detailsCache.get(pointId);
            if (Date.now() - cachedData.timestamp < 300000) { // 5 минут кэш
                showModal(cachedData.content);
                return;
            }
        }
        
        const response = await fetch(`/api/point/${pointId}/info`);
        if (!response.ok) {
            throw new Error('Ошибка загрузки');
        }
        
        const point = await response.json();
        const content = createDetailedContent(point);
        
        // Кэшируем
        detailsCache.set(pointId, {
            content,
            timestamp: Date.now()
        });
        
        showModal(content);
        
    } catch (error) {
        console.error('Ошибка загрузки информации:', error);
        showLightningNotification('Ошибка загрузки', 'error');
    }
}

// Создание детального контента
function createDetailedContent(point) {
    let content = `
        <h3 style="color: #667eea; margin-bottom: 12px;">${point.name}</h3>
        <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
            <p><strong>Статус:</strong> <span style="color: ${point.status === 'collected' ? '#f44336' : '#4CAF50'}">${point.status === 'collected' ? 'Собрана' : 'Доступна'}</span></p>
            <p><strong>Координаты:</strong> ${point.coordinates.lat.toFixed(4)}, ${point.coordinates.lng.toFixed(4)}</p>
        </div>
    `;
    
    if (point.status === 'collected' && point.collectorInfo) {
        content += `
            <div style="border-left: 3px solid #667eea; padding-left: 12px; margin: 12px 0;">
                <h4 style="color: #333; margin-bottom: 8px;">Сборщик:</h4>
                <p><strong>Имя:</strong> ${point.collectorInfo.name}</p>
                ${point.collectorInfo.signature ? `<p><strong>Сообщение:</strong> <em>"${point.collectorInfo.signature}"</em></p>` : ''}
                <p><strong>Время:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>
            </div>
        `;
        
        if (point.collectorInfo.selfie) {
            content += `
                <div style="margin-top: 15px; text-align: center;">
                    <strong style="color: #667eea;">Селфи:</strong><br>
                    <img src="${point.collectorInfo.selfie}" 
                         style="max-width: 100%; max-height: 250px; border-radius: 8px; margin-top: 8px; box-shadow: 0 3px 10px rgba(0,0,0,0.1);"
                         alt="Селфи сборщика"
                         loading="lazy">
                </div>
            `;
        }
    }
    
    return content;
}

// Показ модального окна
function showModal(content) {
    batchDOMUpdates(() => {
        document.getElementById('modalTitle').innerHTML = 'Информация о модели';
        document.getElementById('modalBody').innerHTML = content;
        document.getElementById('infoModal').style.display = 'block';
    });
}

// Закрытие модального окна
function closeModal() {
    document.getElementById('infoModal').style.display = 'none';
}

// Быстрые уведомления
function showLightningNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `lightning-notification ${type}`;
    
    const icons = {
        error: '❌',
        success: '✅',
        info: 'ℹ️',
        warning: '⚠️'
    };
    
    notification.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
            <span>${icons[type] || icons.info} ${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #999; padding: 0; margin-left: 10px;">×</button>
        </div>
    `;
    
    // Добавляем стили если их нет
    if (!document.getElementById('lightning-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'lightning-notification-styles';
        style.textContent = `
            .lightning-notification {
                position: fixed;
                top: 15px;
                right: 15px;
                z-index: 2000;
                background: rgba(255, 255, 255, 0.98);
                border-radius: 6px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                backdrop-filter: blur(8px);
                padding: 10px 12px;
                min-width: 200px;
                max-width: 300px;
                animation: lightningSlideIn 0.2s ease;
                border: 1px solid rgba(255,255,255,0.3);
                font-weight: 500;
            }
            
            .lightning-notification.error { border-left: 3px solid #f44336; }
            .lightning-notification.success { border-left: 3px solid #4CAF50; }
            .lightning-notification.info { border-left: 3px solid #2196F3; }
            .lightning-notification.warning { border-left: 3px solid #ff9800; }
            
            @keyframes lightningSlideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'lightningSlideOut 0.15s ease';
            setTimeout(() => notification.remove(), 150);
        }
    }, 2500); // Короче время показа
}

// Оптимизированные обработчики событий
window.addEventListener('click', function(event) {
    if (event.target === document.getElementById('infoModal')) {
        closeModal();
    }
}, { passive: true });

window.addEventListener('resize', function() {
    if (map) {
        clearTimeout(window.lightningResizeTimeout);
        window.lightningResizeTimeout = setTimeout(() => {
            map.invalidateSize();
        }, 50); // Быстрее отклик
    }
}, { passive: true });

// Сетевые события
window.addEventListener('online', function() {
    showLightningNotification('Онлайн ⚡', 'success');
    if (isAppInitialized) {
        setTimeout(() => lightningLoadPoints(), 50);
    }
}, { passive: true });

window.addEventListener('offline', function() {
    showLightningNotification('Офлайн ⚠️', 'warning');
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
    if (event.ctrlKey && event.key === 'r') {
        event.preventDefault();
        lightningLoadPoints();
    }
}, { passive: false });

// Экспорт для совместимости
window.PlasticBoy = {
    map,
    markers,
    markersLayer,
    loadPoints: lightningLoadPoints,
    showLightningNotification,
    getCurrentLocation,
    showPointDetails,
    closeModal,
    initMap,
    lightningUpdateMap,
    lightningUpdateStats
};

// Псевдонимы
window.showNotification = showLightningNotification;
window.updateMap = lightningUpdateMap;
window.updateStats = lightningUpdateStats;
window.loadPoints = lightningLoadPoints;

console.log('⚡ МГНОВЕННЫЙ PlasticBoy готов к работе!');
