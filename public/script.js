// Оптимизированные переменные
let map;
let markers = [];
let lastUpdateTime = 0;
let isUpdating = false;
let pointsData = [];

// Константы
const ALMATY_CENTER = [43.2220, 76.8512];
const UPDATE_INTERVAL = 12000; // 12 секунд
const FAST_UPDATE_INTERVAL = 5000; // 5 секунд при активности

// Супербыстрая инициализация
document.addEventListener('DOMContentLoaded', function() {
    // Добавляем класс для предотвращения FOUC
    document.body.classList.add('loading');
    
    // Инициализируем карту асинхронно
    requestAnimationFrame(() => {
        initMap();
        loadPoints();
        setupAutoUpdate();
        document.body.classList.remove('loading');
        document.body.classList.add('loaded');
    });
});

// Оптимизированная инициализация карты
function initMap() {
    map = L.map('map', {
        preferCanvas: true,
        zoomControl: true,
        attributionControl: false,
        zoomAnimation: false, // Отключаем анимацию для скорости
        fadeAnimation: false,
        markerZoomAnimation: false
    }).setView(ALMATY_CENTER, 12);
    
    // Быстрый тайловый сервер
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 17, // Ограничиваем для скорости
        tileSize: 256,
        updateWhenZooming: false,
        updateWhenIdle: true,
        keepBuffer: 1, // Уменьшили буфер
        attribution: '© OSM'
    }).addTo(map);
}

// Умная система обновления
function setupAutoUpdate() {
    let interval = UPDATE_INTERVAL;
    
    // Адаптивный интервал
    if (navigator.connection) {
        const connection = navigator.connection;
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
            interval = 30000; // 30 сек для медленного интернета
        } else if (connection.effectiveType === '4g' || connection.effectiveType === '5g') {
            interval = FAST_UPDATE_INTERVAL; // 5 сек для быстрого интернета
        }
    }
    
    // Основной таймер
    setInterval(() => {
        if (!document.hidden && !isUpdating && Date.now() - lastUpdateTime > interval) {
            loadPoints();
        }
    }, interval);
    
    // Обновление при возвращении
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && Date.now() - lastUpdateTime > 10000) {
            loadPoints();
        }
    });
}

// Супербыстрая загрузка точек
async function loadPoints() {
    if (isUpdating) return;
    isUpdating = true;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 сек таймаут
        
        const response = await fetch('/api/points', {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'max-age=20'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const newData = await response.json();
        lastUpdateTime = Date.now();
        
        // Проверяем, нужно ли обновлять карту
        if (JSON.stringify(newData) !== JSON.stringify(pointsData)) {
            pointsData = newData;
            updateMapFast(newData);
            updateStatsAnimated(newData);
        }
        
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.warn('Load error:', error.message);
            // Показываем ошибку только если давно не обновлялись
            if (Date.now() - lastUpdateTime > 60000) {
                showNotification('Connection issue', 'error');
            }
        }
    } finally {
        isUpdating = false;
    }
}

// Супербыстрое обновление карты
function updateMapFast(points) {
    // Получаем текущие ID точек
    const newIds = new Set(points.map(p => p.id));
    const currentIds = new Set(markers.map(m => m.pointId));
    
    // Удаляем исчезнувшие маркеры
    markers = markers.filter(markerObj => {
        if (!newIds.has(markerObj.pointId)) {
            map.removeLayer(markerObj.marker);
            return false;
        }
        return true;
    });
    
    // Добавляем новые маркеры батчами
    const newPoints = points.filter(p => !currentIds.has(p.id));
    if (newPoints.length > 0) {
        addMarkersBatch(newPoints);
    }
    
    // Обновляем существующие маркеры если нужно
    updateExistingMarkers(points);
}

// Батчевое добавление маркеров
function addMarkersBatch(points) {
    const fragment = document.createDocumentFragment();
    
    points.forEach(point => {
        const isAvailable = point.status === 'available';
        
        // Минимальная иконка для скорости
        const icon = L.divIcon({
            className: 'fast-marker',
            html: `<div class="dot ${isAvailable ? 'available' : 'collected'}"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });
        
        const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon })
            .addTo(map);
        
        // Ленивый popup
        marker.on('click', () => {
            createPopup(marker, point);
        });
        
        markers.push({ marker, pointId: point.id, point });
    });
    
    // Добавляем стили если нужно
    addFastMarkerStyles();
}

// Обновление существующих маркеров
function updateExistingMarkers(points) {
    const pointsMap = new Map(points.map(p => [p.id, p]));
    
    markers.forEach(markerObj => {
        const point = pointsMap.get(markerObj.pointId);
        if (point && point.status !== markerObj.point?.status) {
            // Обновляем только изменившиеся маркеры
            const isAvailable = point.status === 'available';
            const dotElement = markerObj.marker.getElement()?.querySelector('.dot');
            if (dotElement) {
                dotElement.className = `dot ${isAvailable ? 'available' : 'collected'}`;
            }
            markerObj.point = point;
        }
    });
}

// Ленивое создание popup
function createPopup(marker, point) {
    const isAvailable = point.status === 'available';
    
    let content = `<div class="popup-content">
        <h3>${point.name}</h3>
        <p class="status ${point.status}">
            ${isAvailable ? '🟢 Available' : '🔴 Collected'}
        </p>`;
    
    if (!isAvailable && point.collectorInfo) {
        content += `<p><strong>By:</strong> ${point.collectorInfo.name}</p>`;
        if (point.collectedAt) {
            content += `<p><strong>Time:</strong> ${new Date(point.collectedAt).toLocaleDateString()}</p>`;
        }
        content += `<button onclick="showDetails('${point.id}')" class="details-btn">Details</button>`;
    }
    
    content += '</div>';
    marker.bindPopup(content).openPopup();
}

// Быстрые стили маркеров
function addFastMarkerStyles() {
    if (document.getElementById('fast-marker-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'fast-marker-styles';
    style.textContent = `
        .fast-marker { background: none !important; border: none !important; }
        .dot {
            width: 14px; height: 14px; border-radius: 50%;
            border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        .dot.available { background: #4CAF50; }
        .dot.collected { background: #f44336; }
        .popup-content { min-width: 160px; font-size: 0.85rem; }
        .popup-content h3 { margin: 0 0 6px 0; font-size: 0.95rem; }
        .status { margin: 6px 0; font-weight: 600; font-size: 0.8rem; }
        .status.available { color: #4CAF50; }
        .status.collected { color: #f44336; }
        .details-btn {
            background: #667eea; color: white; border: none;
            padding: 4px 8px; border-radius: 3px; cursor: pointer;
            width: 100%; margin-top: 6px; font-size: 0.75rem;
        }
    `;
    document.head.appendChild(style);
}

// Анимированная статистика
function updateStatsAnimated(points) {
    const available = points.filter(p => p.status === 'available').length;
    const collected = points.length - available;
    
    animateNumber('availableCount', available);
    animateNumber('collectedCount', collected);
}

// Оптимизированная анимация чисел
function animateNumber(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const currentValue = parseInt(element.textContent) || 0;
    if (currentValue === targetValue) return;
    
    const diff = targetValue - currentValue;
    const duration = Math.min(Math.abs(diff) * 30, 500); // Максимум 500мс
    const startTime = performance.now();
    
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const current = Math.round(currentValue + diff * progress);
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

// Быстрое отображение деталей
async function showDetails(pointId) {
    const modal = document.getElementById('infoModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    
    // Показываем загрузку
    title.textContent = 'Loading...';
    body.innerHTML = '<div style="text-align:center;padding:15px;">⏳</div>';
    modal.style.display = 'block';
    
    try {
        const response = await fetch(`/api/point/${pointId}/info`, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) throw new Error('Load failed');
        
        const point = await response.json();
        
        title.textContent = 'Point Info';
        body.innerHTML = createDetailsHTML(point);
        
    } catch (error) {
        body.innerHTML = '<p style="color:#f44336;text-align:center;">Failed to load</p>';
    }
}

// Создание HTML для деталей
function createDetailsHTML(point) {
    let html = `
        <h3>${point.name}</h3>
        <p><strong>Status:</strong> ${point.status === 'collected' ? 'Collected' : 'Available'}</p>
        <p><strong>Coordinates:</strong> ${point.coordinates.lat.toFixed(4)}, ${point.coordinates.lng.toFixed(4)}</p>
    `;
    
    if (point.status === 'collected' && point.collectorInfo) {
        html += `
            <hr style="margin: 10px 0;">
            <h4>Collector Info:</h4>
            <p><strong>Name:</strong> ${point.collectorInfo.name}</p>
            ${point.collectorInfo.signature ? `<p><strong>Message:</strong> ${point.collectorInfo.signature}</p>` : ''}
            <p><strong>Collected:</strong> ${new Date(point.collectedAt).toLocaleDateString()}</p>
        `;
        
        if (point.collectorInfo.selfie) {
            html += `
                <div style="margin-top: 10px;">
                    <strong>Photo:</strong><br>
                    <img src="${point.collectorInfo.selfie}" 
                         style="max-width: 100%; max-height: 150px; border-radius: 6px; margin-top: 8px; cursor: pointer;"
                         onclick="this.style.maxHeight=this.style.maxHeight==='150px'?'none':'150px'">
                </div>
            `;
        }
    }
    
    return html;
}

// Закрытие модального окна
function closeModal() {
    document.getElementById('infoModal').style.display = 'none';
}

// Оптимизированные уведомления
let notificationTimeout;
function showNotification(message, type = 'info') {
    // Убираем предыдущее
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="background:none;border:none;font-size:1rem;cursor:pointer;color:#999;margin-left:8px;">×</button>
    `;
    
    // Мини стили
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed; top: 15px; right: 15px; z-index: 2000;
                background: white; border-radius: 6px; padding: 10px;
                box-shadow: 0 3px 10px rgba(0,0,0,0.2); font-size: 0.85rem;
                display: flex; align-items: center; max-width: 250px;
                animation: slideIn 0.2s ease-out;
            }
            .notification.error { border-left: 3px solid #f44336; }
            .notification.success { border-left: 3px solid #4CAF50; }
            .notification.info { border-left: 3px solid #2196F3; }
            @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    notificationTimeout = setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideIn 0.2s ease-out reverse';
            setTimeout(() => notification.remove(), 200);
        }
    }, 2500);
}

// Глобальные обработчики событий
window.addEventListener('click', function(event) {
    if (event.target.id === 'infoModal') {
        closeModal();
    }
});

// Оптимизированная кнопка обновления
document.addEventListener('DOMContentLoaded', function() {
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            if (isUpdating) return;
            
            this.style.transform = 'rotate(360deg) scale(0.9)';
            this.style.transition = 'transform 0.4s ease';
            
            loadPoints();
            
            setTimeout(() => {
                this.style.transform = '';
                this.style.transition = '';
            }, 400);
        });
    }
});

// Предзагрузка критических ресурсов
if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
        // Предзагружаем админ панель если пользователь долго на сайте
        if (performance.now() > 30000) { // Через 30 сек
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = '/admin.html';
            document.head.appendChild(link);
        }
    });
}

// Оптимизация для медленных устройств
if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) {
    // Для слабых устройств увеличиваем интервалы
    UPDATE_INTERVAL *= 1.5;
    FAST_UPDATE_INTERVAL *= 1.5;
}

// Экспорт функций для глобального доступа
window.showDetails = showDetails;
window.closeModal = closeModal;
