// PlasticBoy v2.0 - С поддержкой Instagram авторизации
(function() {
    'use strict';
    
    console.log('🎯 PlasticBoy - Инициализация скрипта с Instagram поддержкой');
    
    // Глобальные переменные
    let map = null;
    let markers = [];
    let isInitialized = false;
    let initAttempts = 0;
    const MAX_INIT_ATTEMPTS = 10;
    
    // Координаты Алматы
    const ALMATY_CENTER = [43.2220, 76.8512];
    
    // Система кэширования
    const Cache = {
        key: 'plasticboy_points_v2',
        ttl: 5 * 60 * 1000, // 5 минут
        
        save: function(data) {
            try {
                const item = {
                    data: data,
                    timestamp: Date.now()
                };
                localStorage.setItem(this.key, JSON.stringify(item));
                console.log('💾 Сохранено ' + data.length + ' точек в кэш');
            } catch (e) {
                console.warn('⚠️ Ошибка сохранения кэша:', e);
            }
        },
        
        load: function() {
            try {
                const item = localStorage.getItem(this.key);
                if (!item) return null;
                
                const parsed = JSON.parse(item);
                const age = Date.now() - parsed.timestamp;
                
                if (age > this.ttl) {
                    console.log('⏰ Кэш устарел');
                    return null;
                }
                
                console.log('📦 Загружено ' + parsed.data.length + ' точек из кэша');
                return parsed.data;
            } catch (e) {
                console.warn('⚠️ Ошибка чтения кэша:', e);
                return null;
            }
        },
        
        clear: function() {
            localStorage.removeItem(this.key);
            console.log('🗑️ Кэш очищен');
        }
    };
    
    // Проверка готовности DOM
    function waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }
    
    // Проверка загрузки Leaflet
    function waitForLeaflet() {
        return new Promise((resolve, reject) => {
            const checkLeaflet = () => {
                if (typeof L !== 'undefined' && L.map) {
                    console.log('✅ Leaflet загружен');
                    resolve();
                } else {
                    setTimeout(checkLeaflet, 100);
                }
            };
            
            checkLeaflet();
            
            // Таймаут для загрузки Leaflet
            setTimeout(() => {
                if (typeof L === 'undefined') {
                    console.error('❌ Leaflet не загрузился за 10 секунд');
                    reject(new Error('Leaflet timeout'));
                }
            }, 10000);
        });
    }
    
    // Основная инициализация
    async function init() {
        try {
            console.log('🚀 Начинаем инициализацию PlasticBoy');
            
            // Ждем DOM
            await waitForDOM();
            console.log('✅ DOM готов');
            
            // Уведомляем загрузчик о готовности DOM
            if (window.AppLoader && window.AppLoader.updateLoader) {
                window.AppLoader.updateLoader();
            }
            
            // Ждем Leaflet
            await waitForLeaflet();
            
            // Уведомляем загрузчик о готовности Leaflet
            if (window.AppLoader && window.AppLoader.onLeafletReady) {
                window.AppLoader.onLeafletReady();
            }
            
            // Инициализируем карту
            await initMap();
            
            // Загружаем точки
            await loadPoints();
            
            console.log('🎉 PlasticBoy успешно инициализирован');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            
            // Попытаемся переинициализировать через 2 секунды
            if (initAttempts < MAX_INIT_ATTEMPTS) {
                initAttempts++;
                console.log(`🔄 Попытка переинициализации ${initAttempts}/${MAX_INIT_ATTEMPTS}`);
                setTimeout(init, 2000);
            } else {
                console.error('💥 Превышено максимальное количество попыток инициализации');
                showErrorMessage('Не удалось загрузить приложение. Попробуйте обновить страницу.');
            }
        }
    }
    
    // Инициализация карты
    function initMap() {
        return new Promise((resolve, reject) => {
            if (isInitialized) {
                resolve();
                return;
            }
            
            const mapElement = document.getElementById('map');
            if (!mapElement) {
                reject(new Error('Элемент карты не найден'));
                return;
            }
            
            try {
                console.log('🗺️ Создание карты');
                
                // Проверяем, что Leaflet действительно доступен
                if (typeof L === 'undefined' || !L.map) {
                    throw new Error('Leaflet не загружен');
                }
                
                map = L.map('map', {
                    center: ALMATY_CENTER,
                    zoom: 13,
                    zoomControl: true,
                    preferCanvas: true // Улучшаем производительность на мобильных
                });
                
                // Добавляем тайлы
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 18,
                    tileSize: 256,
                    crossOrigin: true
                }).addTo(map);
                
                // Добавляем стили
                addMapStyles();
                
                // Уведомляем загрузчик о готовности карты
                if (window.AppLoader && window.AppLoader.onMapReady) {
                    window.AppLoader.onMapReady();
                }
                
                // Ждем полной загрузки карты
                map.whenReady(() => {
                    setTimeout(() => {
                        map.invalidateSize();
                        console.log('✅ Карта готова');
                        isInitialized = true;
                        
                        // Автообновление каждые 30 секунд
                        setInterval(loadPoints, 30000);
                        
                        resolve();
                    }, 200);
                });
                
            } catch (error) {
                console.error('❌ Ошибка создания карты:', error);
                reject(error);
            }
        });
    }
    
    // Добавление стилей
    function addMapStyles() {
        if (document.getElementById('map-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'map-styles';
        style.textContent = `
            .marker-icon {
                background: none !important;
                border: none !important;
            }
            
            .marker-dot {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: 0 3px 8px rgba(0,0,0,0.3);
                transition: transform 0.2s ease;
                cursor: pointer;
            }
            
            .marker-dot:hover {
                transform: scale(1.2);
            }
            
            .marker-dot.available {
                background: linear-gradient(45deg, #4CAF50, #45a049);
            }
            
            .marker-dot.collected {
                background: linear-gradient(45deg, #f44336, #e53935);
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
                position: relative;
            }
            
            .user-dot::after {
                content: '';
                position: absolute;
                top: -4px;
                left: -4px;
                right: -4px;
                bottom: -4px;
                border-radius: 50%;
                border: 2px solid #007bff;
                opacity: 0.3;
                animation: userPulse 2s infinite;
            }
            
            @keyframes userPulse {
                0% { transform: scale(1); opacity: 0.7; }
                50% { opacity: 0.2; }
                100% { transform: scale(2); opacity: 0; }
            }
            
            .instagram-popup-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 15px;
                padding-bottom: 12px;
                border-bottom: 1px solid #eee;
            }
            
            .instagram-avatar-small {
                width: 50px;
                height: 50px;
                border-radius: 50%;
                border: 2px solid #e6683c;
                object-fit: cover;
            }
            
            .instagram-user-info h4 {
                margin: 0 0 4px 0;
                color: #333;
                font-size: 1.1rem;
            }
            
            .instagram-username {
                color: #666;
                font-size: 0.9rem;
                margin: 0;
            }
            
            .instagram-stats-popup {
                display: flex;
                justify-content: space-around;
                margin: 12px 0;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 8px;
            }
            
            .instagram-stat-popup {
                text-align: center;
            }
            
            .instagram-stat-number-popup {
                font-weight: 600;
                color: #333;
                display: block;
                font-size: 0.9rem;
            }
            
            .instagram-stat-label-popup {
                font-size: 0.7rem;
                color: #666;
            }
            
            .auth-method-badge {
                display: inline-block;
                padding: 4px 8px;
                border-radius: 6px;
                font-size: 0.8rem;
                font-weight: 600;
                margin-bottom: 10px;
            }
            
            .auth-method-badge.instagram {
                background: linear-gradient(45deg, rgba(240, 148, 51, 0.1), rgba(188, 24, 136, 0.1));
                color: #e6683c;
                border: 1px solid rgba(230, 104, 60, 0.3);
            }
            
            .auth-method-badge.manual {
                background: rgba(76, 175, 80, 0.1);
                color: #4CAF50;
                border: 1px solid rgba(76, 175, 80, 0.3);
            }
        `;
        document.head.appendChild(style);
    }
    
    // Загрузка точек
    function loadPoints() {
        return new Promise((resolve) => {
            console.log('📍 Загрузка точек');
            
            // Сначала проверяем кэш
            const cachedPoints = Cache.load();
            if (cachedPoints) {
                updateMap(cachedPoints);
                updateStats(cachedPoints);
                
                // Уведомляем загрузчик
                if (window.AppLoader && window.AppLoader.onPointsLoaded) {
                    window.AppLoader.onPointsLoaded();
                }
                
                // Обновляем в фоне
                setTimeout(() => fetchPointsFromServer(false), 1000);
                resolve();
                return;
            }
            
            // Загружаем с сервера
            fetchPointsFromServer(true).then(resolve);
        });
    }
    
    // Загрузка с сервера
    function fetchPointsFromServer(notifyLoader = true) {
        return new Promise((resolve) => {
            console.log('🌐 Загрузка точек с сервера');
            
            fetch('/api/points', {
                method: 'GET',
                headers: { 
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                cache: 'no-cache'
            })
            .then(response => {
                console.log('📡 Ответ сервера:', response.status);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                return response.json();
            })
            .then(points => {
                console.log('✅ Загружено ' + points.length + ' точек с сервера');
                
                // Сохраняем в кэш
                Cache.save(points);
                
                // Обновляем карту
                updateMap(points);
                updateStats(points);
                
                // Уведомляем загрузчик
                if (notifyLoader && window.AppLoader && window.AppLoader.onPointsLoaded) {
                    window.AppLoader.onPointsLoaded();
                }
                
                resolve();
            })
            .catch(error => {
                console.error('❌ Ошибка загрузки точек:', error);
                
                // Пытаемся загрузить из кэша как fallback
                const cachedPoints = Cache.load();
                if (cachedPoints) {
                    console.log('📦 Используем кэшированные данные как fallback');
                    updateMap(cachedPoints);
                    updateStats(cachedPoints);
                }
                
                // Уведомляем загрузчик даже при ошибке
                if (notifyLoader && window.AppLoader && window.AppLoader.onPointsLoaded) {
                    window.AppLoader.onPointsLoaded();
                }
                
                resolve();
            });
        });
    }
    
    // Обновление карты
    function updateMap(points) {
        if (!map || !points) {
            console.warn('⚠️ Карта или точки не готовы для обновления');
            return;
        }
        
        console.log('🗺️ Обновление карты (' + points.length + ' точек)');
        
        try {
            // Очищаем старые маркеры
            markers.forEach(marker => {
                if (map.hasLayer(marker)) {
                    map.removeLayer(marker);
                }
            });
            markers = [];
            
            // Добавляем новые маркеры
            points.forEach(point => {
                try {
                    const isAvailable = point.status === 'available';
                    
                    const icon = L.divIcon({
                        className: 'marker-icon',
                        html: `<div class="marker-dot ${isAvailable ? 'available' : 'collected'}"></div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    });
                    
                    const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon: icon });
                    
                    // Создаем содержимое popup
                    const popupContent = createPopupContent(point, isAvailable);
                    marker.bindPopup(popupContent);
                    
                    marker.addTo(map);
                    markers.push(marker);
                } catch (error) {
                    console.error('❌ Ошибка добавления маркера:', error, point);
                }
            });
            
            console.log('✅ Добавлено ' + markers.length + ' маркеров');
            
        } catch (error) {
            console.error('❌ Ошибка обновления карты:', error);
        }
    }
    
    // Создание содержимого popup с поддержкой Instagram
    function createPopupContent(point, isAvailable) {
        let popupContent = '<div style="min-width: 200px;">';
        popupContent += `<h3 style="margin: 0 0 10px 0;">${point.name}</h3>`;
        popupContent += `<p style="font-weight: 600; color: ${isAvailable ? '#4CAF50' : '#f44336'};">`;
        popupContent += isAvailable ? '🟢 Доступна для сбора' : '🔴 Уже собрана';
        popupContent += '</p>';
        
        if (!isAvailable && point.collectorInfo) {
            // Определяем метод авторизации
            const authMethod = point.collectorInfo.authMethod || 'manual';
            
            // Бейдж метода авторизации
            popupContent += `<div class="auth-method-badge ${authMethod}">`;
            popupContent += authMethod === 'instagram' ? '📸 Instagram' : '👤 Ручной ввод';
            popupContent += '</div>';
            
            popupContent += '<div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin: 10px 0;">';
            
            // Если собрано через Instagram, показываем профиль
            if (authMethod === 'instagram' && point.collectorInfo.instagram) {
                const instagram = point.collectorInfo.instagram;
                
                popupContent += '<div class="instagram-popup-header">';
                popupContent += `<img src="${instagram.profile_picture}" alt="Avatar" class="instagram-avatar-small" onerror="this.src='https://via.placeholder.com/50x50?text=👤'">`;
                popupContent += '<div class="instagram-user-info">';
                popupContent += `<h4>${instagram.full_name || instagram.username}</h4>`;
                popupContent += `<p class="instagram-username">@${instagram.username}`;
                if (instagram.is_verified) {
                    popupContent += ' ✓';
                }
                popupContent += '</p>';
                popupContent += '</div>';
                popupContent += '</div>';
                
                // Статистика Instagram
                if (instagram.followers_count !== undefined) {
                    popupContent += '<div class="instagram-stats-popup">';
                    popupContent += '<div class="instagram-stat-popup">';
                    popupContent += `<span class="instagram-stat-number-popup">${formatNumber(instagram.posts_count || 0)}</span>`;
                    popupContent += '<span class="instagram-stat-label-popup">постов</span>';
                    popupContent += '</div>';
                    popupContent += '<div class="instagram-stat-popup">';
                    popupContent += `<span class="instagram-stat-number-popup">${formatNumber(instagram.followers_count)}</span>`;
                    popupContent += '<span class="instagram-stat-label-popup">подписчиков</span>';
                    popupContent += '</div>';
                    popupContent += '<div class="instagram-stat-popup">';
                    popupContent += `<span class="instagram-stat-number-popup">${formatNumber(instagram.following_count || 0)}</span>`;
                    popupContent += '<span class="instagram-stat-label-popup">подписок</span>';
                    popupContent += '</div>';
                    popupContent += '</div>';
                }
            } else {
                // Обычное отображение для ручного ввода
                popupContent += `<p style="margin: 4px 0;"><strong>Собрал:</strong> ${point.collectorInfo.name}</p>`;
            }
            
            // Подпись (для всех методов)
            if (point.collectorInfo.signature) {
                popupContent += `<p style="margin: 8px 0 4px 0;"><strong>Сообщение:</strong></p>`;
                popupContent += `<p style="margin: 4px 0; font-style: italic; color: #555;">"${point.collectorInfo.signature}"</p>`;
            }
            
            popupContent += `<p style="margin: 8px 0 4px 0;"><strong>Время:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>`;
            
            // Добавляем селфи если есть
            if (point.collectorInfo.selfie) {
                popupContent += '<div style="margin: 12px 0; text-align: center;">';
                popupContent += `<img src="${point.collectorInfo.selfie}" style="max-width: 150px; max-height: 120px; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" onclick="showFullImage('${point.collectorInfo.selfie}', '${point.name}')" title="Кликните для увеличения">`;
                popupContent += '</div>';
            }
            
            popupContent += '</div>';
        }
        
        popupContent += '</div>';
        return popupContent;
    }
    
    // Форматирование чисел для Instagram статистики
    function formatNumber(num) {
        if (!num) return '0';
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }
    
    // Обновление статистики
    function updateStats(points) {
        const available = points.filter(p => p.status === 'available').length;
        const collected = points.filter(p => p.status === 'collected').length;
        
        const availableEl = document.getElementById('availableCount');
        const collectedEl = document.getElementById('collectedCount');
        
        if (availableEl) {
            animateNumber(availableEl, available);
        }
        if (collectedEl) {
            animateNumber(collectedEl, collected);
        }
        
        console.log('📊 Статистика: ' + available + ' доступно, ' + collected + ' собрано');
    }
    
    // Анимация чисел
    function animateNumber(element, targetValue) {
        const currentValue = parseInt(element.textContent) || 0;
        if (currentValue === targetValue) return;
        
        const duration = 500;
        const steps = 10;
        const stepValue = (targetValue - currentValue) / steps;
        const stepDuration = duration / steps;
        
        let current = currentValue;
        let step = 0;
        
        const timer = setInterval(() => {
            step++;
            current += stepValue;
            
            if (step >= steps) {
                element.textContent = targetValue;
                clearInterval(timer);
            } else {
                element.textContent = Math.round(current);
            }
        }, stepDuration);
    }
    
    // Показ ошибки
    function showErrorMessage(message) {
        const container = document.querySelector('.container');
        if (container) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                background: rgba(244, 67, 54, 0.1);
                border: 1px solid #f44336;
                border-radius: 12px;
                padding: 20px;
                margin: 20px 0;
                text-align: center;
                color: #f44336;
                font-weight: 600;
            `;
            errorDiv.innerHTML = `
                <h3>❌ Ошибка загрузки</h3>
                <p>${message}</p>
                <button onclick="window.location.reload()" style="
                    background: #f44336;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    margin-top: 10px;
                ">Обновить страницу</button>
            `;
            container.appendChild(errorDiv);
        }
    }
    
    // Глобальные функции
    window.getCurrentLocation = function() {
        const btn = document.querySelector('.location-btn');
        if (!navigator.geolocation || !map) {
            console.warn('⚠️ Геолокация недоступна');
            return;
        }
        
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Определение...';
        btn.disabled = true;
        
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                // Удаляем старый маркер
                if (window.userMarker && map.hasLayer(window.userMarker)) {
                    map.removeLayer(window.userMarker);
                }
                
                // Создаем новый маркер
                const userIcon = L.divIcon({
                    className: 'user-marker',
                    html: '<div class="user-dot"></div>',
                    iconSize: [22, 22],
                    iconAnchor: [11, 11]
                });
                
                window.userMarker = L.marker([lat, lng], { icon: userIcon })
                    .addTo(map)
                    .bindPopup('<div style="text-align: center;"><strong>📍 Ваше местоположение</strong></div>');
                
                map.flyTo([lat, lng], 16);
                console.log('✅ Местоположение найдено');
                
                btn.innerHTML = originalText;
                btn.disabled = false;
            },
            function(error) {
                console.error('❌ Ошибка геолокации:', error);
                btn.innerHTML = originalText;
                btn.disabled = false;
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    };
    
    // Показ полного изображения
    window.showFullImage = function(imageSrc, title) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 3000;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        `;
        
        modal.innerHTML = `
            <div style="
                max-width: 90%;
                max-height: 90%;
                background: white;
                border-radius: 12px;
                overflow: hidden;
                cursor: default;
            " onclick="event.stopPropagation()">
                <div style="padding: 15px; background: #f8f9fa; text-align: center; font-weight: 600;">
                    ${title}
                </div>
                <img src="${imageSrc}" style="max-width: 100%; max-height: 70vh; display: block;">
            </div>
        `;
        
        modal.onclick = () => modal.remove();
        document.body.appendChild(modal);
    };
    
    // Обработчики событий
    window.addEventListener('resize', function() {
        if (map) {
            setTimeout(() => map.invalidateSize(), 100);
        }
    });
    
    // Запускаем инициализацию
    init();
    
    // Экспорт основных функций в глобальную область
    window.PlasticBoy = {
        Cache,
        refreshData: loadPoints,
        clearCache: () => Cache.clear(),
        version: '2.1.0'
    };
    
    console.log('🚀 PlasticBoy v2.1.0 полностью загружен');
})();
