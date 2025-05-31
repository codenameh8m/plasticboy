// ДИАГНОСТИЧЕСКАЯ версия script.js для отладки маркеров
let map;
let markers = [];
let markersLayer;

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// Флаги состояния
let isAppInitialized = false;
let pointsCache = null;

// Диагностическая функция
function debugLog(message, data = null) {
    console.log(`🔍 [DEBUG] ${message}`, data || '');
}

// Проверка координат
function validateCoordinates(lat, lng) {
    const isValidLat = typeof lat === 'number' && lat >= -90 && lat <= 90;
    const isValidLng = typeof lng === 'number' && lng >= -180 && lng <= 180;
    return isValidLat && isValidLng;
}

document.addEventListener('DOMContentLoaded', function() {
    debugLog('DOM загружен, инициализация приложения');
    initControlButtons();
    
    // Добавляем стили для маркеров сразу
    addDebugMarkerStyles();
});

// Добавление стилей для отладки
function addDebugMarkerStyles() {
    const style = document.createElement('style');
    style.id = 'debug-marker-styles';
    style.textContent = `
        .debug-marker {
            background: none !important;
            border: none !important;
        }
        
        .debug-dot {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 3px 8px rgba(0,0,0,0.4);
            cursor: pointer;
            transition: transform 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            color: white;
        }
        
        .debug-dot:hover {
            transform: scale(1.2);
        }
        
        .debug-dot.available {
            background: #4CAF50;
        }
        
        .debug-dot.collected {
            background: #f44336;
        }
        
        .debug-popup {
            min-width: 200px;
            font-family: system-ui, sans-serif;
        }
        
        .debug-popup h3 {
            margin: 0 0 10px 0;
            color: #333;
            font-size: 1rem;
        }
        
        .debug-status {
            margin: 8px 0;
            font-weight: 600;
        }
        
        .debug-status.available { color: #4CAF50; }
        .debug-status.collected { color: #f44336; }
        
        /* Тестовый маркер для проверки */
        .test-marker {
            width: 30px !important;
            height: 30px !important;
            background: red !important;
            border: 3px solid yellow !important;
            border-radius: 50% !important;
        }
    `;
    document.head.appendChild(style);
    debugLog('Стили маркеров добавлены');
}

// Инициализация карты
function initMap() {
    if (isAppInitialized) {
        debugLog('Карта уже инициализирована');
        return;
    }
    
    debugLog('Начинаем инициализацию карты');
    
    try {
        map = L.map('map', {
            zoomControl: true,
            attributionControl: true,
            preferCanvas: false, // Используем SVG для отладки
            maxZoom: 18
        }).setView(ALMATY_CENTER, 13);
        
        debugLog('Карта создана, добавляем тайлы');
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(map);
        
        // Создаем группу маркеров
        markersLayer = L.layerGroup().addTo(map);
        debugLog('Группа маркеров создана');
        
        // Добавляем тестовый маркер для проверки
        addTestMarker();
        
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                window.map = map;
                debugLog('Карта готова, размер обновлен');
                
                // Загружаем точки
                loadPointsWithDebug();
            }
        }, 100);
        
        isAppInitialized = true;
        debugLog('Инициализация карты завершена успешно');
        
    } catch (error) {
        debugLog('ОШИБКА при инициализации карты:', error);
    }
}

// Добавление тестового маркера
function addTestMarker() {
    try {
        const testIcon = L.divIcon({
            className: 'test-marker',
            html: '<div style="width: 30px; height: 30px; background: red; border: 3px solid yellow; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">T</div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        const testMarker = L.marker(ALMATY_CENTER, { icon: testIcon })
            .addTo(map)
            .bindPopup('🧪 ТЕСТОВЫЙ МАРКЕР - если видите это, карта работает правильно!');
            
        debugLog('Тестовый маркер добавлен на координаты:', ALMATY_CENTER);
        
        // Убираем тестовый маркер через 10 секунд
        setTimeout(() => {
            map.removeLayer(testMarker);
            debugLog('Тестовый маркер удален');
        }, 10000);
        
    } catch (error) {
        debugLog('ОШИБКА при добавлении тестового маркера:', error);
    }
}

// Загрузка точек с отладкой
async function loadPointsWithDebug() {
    debugLog('Начинаем загрузку точек');
    
    try {
        const response = await fetch('/api/points', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        debugLog('Ответ сервера получен:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const points = await response.json();
        debugLog('Данные точек получены:', {
            количество: points.length,
            данные: points
        });
        
        if (!Array.isArray(points)) {
            throw new Error('Полученные данные не являются массивом');
        }
        
        pointsCache = points;
        
        // Обновляем карту и статистику
        await updateMapWithDebug(points);
        updateStatsWithDebug(points);
        
        // Уведомляем систему загрузки
        if (typeof window.PlasticBoyLoader !== 'undefined') {
            window.PlasticBoyLoader.onPointsLoaded();
        }
        
        debugLog('Загрузка точек завершена успешно');
        
    } catch (error) {
        debugLog('ОШИБКА при загрузке точек:', error);
        
        // Показываем уведомление об ошибке
        showDebugNotification('Ошибка загрузки точек: ' + error.message, 'error');
        
        // Создаем тестовые точки для отладки
        createTestPoints();
    }
}

// Создание тестовых точек для отладки
function createTestPoints() {
    debugLog('Создаем тестовые точки для отладки');
    
    const testPoints = [
        {
            id: 'test1',
            name: 'Тестовая точка 1',
            coordinates: { lat: 43.2220, lng: 76.8512 },
            status: 'available'
        },
        {
            id: 'test2',
            name: 'Тестовая точка 2',
            coordinates: { lat: 43.2250, lng: 76.8550 },
            status: 'collected',
            collectorInfo: {
                name: 'Тестовый пользователь',
                signature: 'Тестовое сообщение'
            },
            collectedAt: new Date().toISOString()
        }
    ];
    
    updateMapWithDebug(testPoints);
    updateStatsWithDebug(testPoints);
    
    debugLog('Тестовые точки созданы и добавлены');
}

// Обновление карты с отладкой
async function updateMapWithDebug(points) {
    if (!map || !markersLayer) {
        debugLog('ОШИБКА: карта или группа маркеров не готовы');
        return;
    }
    
    debugLog('Начинаем обновление карты с точками:', points.length);
    
    try {
        // Очищаем существующие маркеры
        markersLayer.clearLayers();
        markers.length = 0;
        debugLog('Существующие маркеры очищены');
        
        if (points.length === 0) {
            debugLog('Нет точек для отображения');
            return;
        }
        
        let successCount = 0;
        let errorCount = 0;
        
        points.forEach((point, index) => {
            try {
                debugLog(`Обрабатываем точку ${index + 1}:`, point);
                
                // Валидация данных точки
                if (!point.coordinates) {
                    throw new Error('Отсутствуют координаты');
                }
                
                const lat = parseFloat(point.coordinates.lat);
                const lng = parseFloat(point.coordinates.lng);
                
                if (!validateCoordinates(lat, lng)) {
                    throw new Error(`Неверные координаты: lat=${lat}, lng=${lng}`);
                }
                
                const isAvailable = point.status === 'available';
                debugLog(`Точка ${point.name}: статус=${point.status}, координаты=[${lat}, ${lng}]`);
                
                // Создаем иконку
                const icon = L.divIcon({
                    className: 'debug-marker',
                    html: `<div class="debug-dot ${isAvailable ? 'available' : 'collected'}">${isAvailable ? '●' : '✓'}</div>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                });
                
                // Создаем маркер
                const marker = L.marker([lat, lng], { icon });
                
                // Создаем popup
                let popupContent = `
                    <div class="debug-popup">
                        <h3>${point.name}</h3>
                        <p class="debug-status ${point.status}">
                            ${isAvailable ? '🟢 Доступна' : '🔴 Собрана'}
                        </p>
                        <p><strong>Координаты:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
                `;
                
                if (!isAvailable && point.collectorInfo) {
                    popupContent += `
                        <div style="background: #f8f9fa; padding: 8px; border-radius: 6px; margin: 8px 0;">
                            <p><strong>Собрал:</strong> ${point.collectorInfo.name}</p>
                            ${point.collectorInfo.signature ? `<p><strong>Сообщение:</strong> ${point.collectorInfo.signature}</p>` : ''}
                            <p><strong>Время:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>
                        </div>
                    `;
                }
                
                popupContent += '</div>';
                
                marker.bindPopup(popupContent);
                
                // Добавляем маркер
                markersLayer.addLayer(marker);
                markers.push(marker);
                successCount++;
                
                debugLog(`✅ Маркер ${index + 1} добавлен успешно`);
                
            } catch (error) {
                errorCount++;
                debugLog(`❌ Ошибка при добавлении маркера ${index + 1}:`, error);
            }
        });
        
        debugLog(`Обновление карты завершено: успешно=${successCount}, ошибок=${errorCount}`);
        
        // Глобальный доступ
        window.markers = markers;
        
        if (successCount > 0) {
            showDebugNotification(`Добавлено ${successCount} маркеров на карту`, 'success');
        }
        
    } catch (error) {
        debugLog('КРИТИЧЕСКАЯ ОШИБКА при обновлении карты:', error);
        showDebugNotification('Критическая ошибка при обновлении карты', 'error');
    }
}

// Обновление статистики с отладкой
function updateStatsWithDebug(points) {
    debugLog('Обновляем статистику');
    
    try {
        const available = points.filter(p => p.status === 'available').length;
        const collected = points.filter(p => p.status === 'collected').length;
        
        debugLog('Статистика:', { available, collected });
        
        const availableElement = document.getElementById('availableCount');
        const collectedElement = document.getElementById('collectedCount');
        
        if (availableElement) {
            availableElement.textContent = available;
            debugLog('Элемент availableCount обновлен');
        } else {
            debugLog('ОШИБКА: элемент availableCount не найден');
        }
        
        if (collectedElement) {
            collectedElement.textContent = collected;
            debugLog('Элемент collectedCount обновлен');
        } else {
            debugLog('ОШИБКА: элемент collectedCount не найден');
        }
        
    } catch (error) {
        debugLog('ОШИБКА при обновлении статистики:', error);
    }
}

// Быстрая геолокация
function getCurrentLocation() {
    debugLog('Запрос геолокации');
    
    const locationBtn = document.querySelector('.location-btn');
    
    if (!navigator.geolocation) {
        debugLog('Геолокация не поддерживается');
        showDebugNotification('Геолокация не поддерживается', 'error');
        return;
    }
    
    const originalText = locationBtn.innerHTML;
    locationBtn.innerHTML = '🔍 Поиск...';
    locationBtn.disabled = true;
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            debugLog('Геолокация найдена:', { lat, lng });
            
            const userIcon = L.divIcon({
                className: 'debug-user-marker',
                html: `<div style="
                    background: linear-gradient(45deg, #007bff, #0056b3);
                    width: 24px; 
                    height: 24px; 
                    border-radius: 50%; 
                    border: 3px solid white; 
                    box-shadow: 0 3px 10px rgba(0,0,0,0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: 12px;
                ">👤</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            
            if (window.userMarker) {
                map.removeLayer(window.userMarker);
            }
            
            window.userMarker = L.marker([lat, lng], { icon: userIcon })
                .addTo(map)
                .bindPopup(`
                    <div style="text-align: center;">
                        <strong>📍 Ваше местоположение</strong><br>
                        <small>${lat.toFixed(6)}, ${lng.toFixed(6)}</small>
                    </div>
                `);
            
            map.setView([lat, lng], 16);
            showDebugNotification('Местоположение найдено!', 'success');
            
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
        },
        function(error) {
            debugLog('Ошибка геолокации:', error);
            showDebugNotification('Ошибка геолокации', 'error');
            
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

// Инициализация кнопок
function initControlButtons() {
    const locationBtn = document.querySelector('.location-btn');
    if (locationBtn) {
        debugLog('Кнопка геолокации найдена и настроена');
    } else {
        debugLog('ОШИБКА: кнопка геолокации не найдена');
    }
}

// Отладочные уведомления
function showDebugNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `debug-notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2000;
        background: white;
        border: 2px solid ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
        border-radius: 8px;
        padding: 12px 16px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        max-width: 300px;
        font-size: 14px;
        font-weight: 500;
    `;
    
    const icons = {
        error: '❌',
        success: '✅',
        info: 'ℹ️',
        warning: '⚠️'
    };
    
    notification.innerHTML = `${icons[type]} ${message}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
    
    debugLog(`Уведомление показано: ${message}`);
}

// Обработчики событий
window.addEventListener('resize', function() {
    if (map) {
        debugLog('Изменение размера окна, обновляем карту');
        map.invalidateSize();
    }
});

// Обработка клавиш
document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.key === 'l') {
        event.preventDefault();
        getCurrentLocation();
    }
    
    // Дополнительные отладочные клавиши
    if (event.ctrlKey && event.key === 'd') {
        event.preventDefault();
        debugLog('=== ДИАГНОСТИЧЕСКАЯ ИНФОРМАЦИЯ ===');
        debugLog('Карта инициализирована:', isAppInitialized);
        debugLog('Объект карты:', map);
        debugLog('Группа маркеров:', markersLayer);
        debugLog('Массив маркеров:', markers);
        debugLog('Кэш точек:', pointsCache);
        debugLog('===================================');
    }
    
    if (event.ctrlKey && event.key === 't') {
        event.preventDefault();
        createTestPoints();
    }
    
    if (event.ctrlKey && event.key === 'r') {
        event.preventDefault();
        loadPointsWithDebug();
    }
});

// Экспорт функций
window.PlasticBoy = {
    map,
    markers,
    markersLayer,
    loadPoints: loadPointsWithDebug,
    showDebugNotification,
    getCurrentLocation,
    initMap,
    debugLog,
    createTestPoints
};

// Псевдонимы для совместимости
window.showNotification = showDebugNotification;
window.updateMap = updateMapWithDebug;
window.updateStats = updateStatsWithDebug;
window.loadPoints = loadPointsWithDebug;

debugLog('Диагностический скрипт загружен');
debugLog('Используйте Ctrl+D для диагностики, Ctrl+T для тестовых точек, Ctrl+R для перезагрузки');
