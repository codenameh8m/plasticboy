// PlasticBoy v2.0 - ИСПРАВЛЕННАЯ версия для ПК и мобильных
(function() {
    'use strict';
    
    console.log('🎯 PlasticBoy - FIXED Script initialization');
    
    // Глобальные переменные
    let map = null;
    let markers = [];
    let isInitialized = false;
    let markersPool = []; // Пул маркеров для переиспользования
    let lastMarkersCount = 0;
    
    // Координаты Алматы
    const ALMATY_CENTER = [43.2220, 76.8512];
    
    // УСКОРЕННАЯ система кэширования
    const FastCache = {
        key: 'plasticboy_points_v2_optimized',
        ttl: 3 * 60 * 1000, // 3 минуты для скорости
        
        save: function(data) {
            try {
                const item = JSON.stringify({
                    data: data,
                    timestamp: Date.now(),
                    version: '2.0'
                });
                localStorage.setItem(this.key, item);
                console.log('💾 Cached ' + data.length + ' points');
            } catch (e) {
                console.warn('⚠️ Cache save failed:', e);
            }
        },
        
        load: function() {
            try {
                const item = localStorage.getItem(this.key);
                if (!item) return null;
                
                const parsed = JSON.parse(item);
                const age = Date.now() - parsed.timestamp;
                
                if (age > this.ttl) {
                    localStorage.removeItem(this.key);
                    console.log('⏰ Cache expired');
                    return null;
                }
                
                console.log('📦 Loaded ' + parsed.data.length + ' points from cache (age: ' + Math.round(age/1000) + 's)');
                return parsed.data;
            } catch (e) {
                console.warn('⚠️ Cache read failed:', e);
                localStorage.removeItem(this.key);
                return null;
            }
        },
        
        clear: function() {
            localStorage.removeItem(this.key);
            console.log('🗑️ Cache cleared');
        },
        
        getAge: function() {
            try {
                const item = localStorage.getItem(this.key);
                if (!item) return null;
                const parsed = JSON.parse(item);
                return Date.now() - parsed.timestamp;
            } catch (e) {
                return null;
            }
        }
    };
    
    // Дебаунс для оптимизации
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
    
    // Быстрая проверка готовности DOM
    function isDOMReady() {
        return document.readyState === 'complete' || document.readyState === 'interactive';
    }
    
    // Ожидание готовности DOM
    function waitForDOM() {
        return new Promise((resolve) => {
            if (isDOMReady()) {
                resolve();
            } else {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            }
        });
    }
    
    // Проверка загрузки Leaflet
    function waitForLeaflet() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100; // 10 секунд
            
            const checkLeaflet = () => {
                attempts++;
                
                if (typeof L !== 'undefined' && L.map && L.tileLayer) {
                    console.log('✅ Leaflet ready in ' + attempts + ' attempts');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.error('❌ Leaflet timeout after ' + attempts + ' attempts');
                    reject(new Error('Leaflet loading timeout'));
                } else {
                    setTimeout(checkLeaflet, 100);
                }
            };
            
            checkLeaflet();
        });
    }
    
    // МГНОВЕННАЯ инициализация
    async function ultraFastInit() {
        try {
            console.log('🚀 Starting ULTRA FAST initialization');
            const startTime = performance.now();
            
            // Параллельное ожидание DOM и Leaflet
            await Promise.all([
                waitForDOM(),
                waitForLeaflet()
            ]);
            
            // Уведомляем загрузчик
            if (window.AppLoader) {
                window.AppLoader.onLeafletReady && window.AppLoader.onLeafletReady();
                window.AppLoader.updateLoader && window.AppLoader.updateLoader();
            }
            
            // ИСПРАВЛЕННАЯ инициализация карты для ПК
            await initMapFixed();
            
            // Молниеносная загрузка точек
            await loadPointsLightning();
            
            const totalTime = performance.now() - startTime;
            console.log(`🎉 ULTRA FAST init completed in ${totalTime.toFixed(2)}ms`);
            
        } catch (error) {
            console.error('❌ Ultra fast init error:', error);
            // Fallback к обычной инициализации
            setTimeout(() => fallbackInit(), 1000);
        }
    }
    
    // Резервная инициализация
    async function fallbackInit() {
        try {
            console.log('🔄 Fallback initialization...');
            
            await waitForDOM();
            await waitForLeaflet();
            await initMapFixed();
            await loadPointsLightning();
            
            console.log('✅ Fallback init completed');
        } catch (error) {
            console.error('❌ Fallback init failed:', error);
            showErrorMessage('Application failed to load. Please refresh the page.');
        }
    }
    
    // ИСПРАВЛЕННАЯ инициализация карты для ПК
    function initMapFixed() {
        return new Promise((resolve, reject) => {
            if (isInitialized) {
                resolve();
                return;
            }
            
            const mapElement = document.getElementById('map');
            if (!mapElement) {
                reject(new Error('Map element missing'));
                return;
            }
            
            try {
                console.log('🗺️ FIXED map creation for PC');
                
                // КРИТИЧЕСКИ ВАЖНО: Принудительно устанавливаем размеры контейнера
                mapElement.style.width = '100%';
                mapElement.style.height = '500px';
                mapElement.style.minHeight = '500px';
                mapElement.style.display = 'block';
                mapElement.style.position = 'relative';
                mapElement.style.zIndex = '1';
                
                // Даем браузеру время на обновление DOM
                setTimeout(() => {
                    try {
                        // Создаем карту с ИСПРАВЛЕННЫМИ настройками для ПК
                        map = L.map('map', {
                            center: ALMATY_CENTER,
                            zoom: 13,
                            zoomControl: true,
                            preferCanvas: false, // ИЗМЕНЕНО: SVG рендерер лучше для ПК
                            attributionControl: true,
                            scrollWheelZoom: true,
                            doubleClickZoom: true,
                            touchZoom: true,
                            keyboard: true,
                            dragging: true,
                            boxZoom: true,
                            tap: false, // Отключаем tap для ПК
                            trackResize: true, // ВАЖНО: Автоматическое изменение размера
                            worldCopyJump: false,
                            closePopupOnClick: true,
                            maxBounds: null,
                            maxBoundsViscosity: 1.0,
                            inertia: true,
                            inertiaDeceleration: 3000,
                            inertiaMaxSpeed: Infinity,
                            easeLinearity: 0.2,
                            zoomSnap: 1, // ИЗМЕНЕНО: Целые значения зума для ПК
                            zoomDelta: 1, // ИЗМЕНЕНО: Шаг зума 1 для ПК
                            wheelPxPerZoomLevel: 60 // ИЗМЕНЕНО: Более чувствительное колесо мыши
                        });
                        
                        // Добавляем тайлы с оптимизацией для ПК
                        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '© OpenStreetMap contributors',
                            maxZoom: 18,
                            minZoom: 3,
                            tileSize: 256,
                            crossOrigin: true,
                            keepBuffer: 4, // УВЕЛИЧЕНО: Больше буфер для ПК
                            updateWhenZooming: true, // ИЗМЕНЕНО: Обновляем при зуме на ПК
                            updateWhenIdle: false, // ИЗМЕНЕНО: Не ждем idle на ПК
                            detectRetina: true,
                            maxNativeZoom: 18,
                            subdomains: 'abc',
                            errorTileUrl: '',
                            zoomOffset: 0,
                            opacity: 1,
                            zIndex: 1,
                            unloadInvisibleTiles: true,
                            updateInterval: 200,
                            reuseTiles: true
                        });
                        
                        tileLayer.addTo(map);
                        
                        // КРИТИЧЕСКИ ВАЖНО: Принудительная инвалидация размера
                        setTimeout(() => {
                            map.invalidateSize(true);
                            console.log('🗺️ Map size invalidated');
                            
                            // Еще одна инвалидация через секунду
                            setTimeout(() => {
                                map.invalidateSize(true);
                                console.log('🗺️ Map size double-checked');
                            }, 1000);
                        }, 100);
                        
                        // Быстрое добавление стилей
                        addOptimizedMapStyles();
                        
                        // Уведомляем загрузчик
                        if (window.AppLoader && window.AppLoader.onMapReady) {
                            window.AppLoader.onMapReady();
                        }
                        
                        // Обработчики событий карты
                        map.on('load', () => {
                            console.log('✅ Map loaded event');
                            map.invalidateSize(true);
                        });
                        
                        map.on('resize', () => {
                            console.log('🔄 Map resize event');
                            setTimeout(() => map.invalidateSize(true), 100);
                        });
                        
                        // КРИТИЧЕСКИ ВАЖНО: Проверяем готовность карты
                        map.whenReady(() => {
                            console.log('🗺️ Map when ready triggered');
                            
                            // Несколько попыток инвалидации с задержками
                            const invalidationAttempts = [50, 200, 500, 1000, 2000];
                            invalidationAttempts.forEach(delay => {
                                setTimeout(() => {
                                    if (map) {
                                        map.invalidateSize(true);
                                        console.log(`🔄 Map invalidated at ${delay}ms`);
                                    }
                                }, delay);
                            });
                            
                            isInitialized = true;
                            console.log('✅ FIXED map ready for PC');
                            
                            // Автообновление каждые 45 секунд (оптимизировано)
                            setInterval(loadPointsLightning, 45000);
                            
                            resolve();
                        });
                        
                    } catch (mapError) {
                        console.error('❌ Map creation error:', mapError);
                        reject(mapError);
                    }
                }, 200); // Увеличенная задержка для ПК
                
            } catch (error) {
                console.error('❌ Fixed map error:', error);
                reject(error);
            }
        });
    }
    
    // Оптимизированные стили карты с фиксами для ПК
    function addOptimizedMapStyles() {
        if (document.getElementById('optimized-map-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'optimized-map-styles';
        style.textContent = `
            /* КРИТИЧЕСКИЕ ФИКСЫ ДЛЯ ПК */
            #map {
                width: 100% !important;
                height: 500px !important;
                min-height: 500px !important;
                display: block !important;
                position: relative !important;
                z-index: 1 !important;
                background: #f8f9fa !important;
            }
            
            .leaflet-container {
                width: 100% !important;
                height: 100% !important;
                position: relative !important;
                overflow: hidden !important;
                background: #f8f9fa !important;
                font-family: 'ABC Oracle', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                font-weight: 500 !important;
            }
            
            .leaflet-map-pane {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: 100% !important;
            }
            
            .leaflet-tile-pane {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: 100% !important;
                z-index: 2 !important;
            }
            
            .leaflet-tile {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 256px !important;
                height: 256px !important;
                border: none !important;
                margin: 0 !important;
                padding: 0 !important;
                display: block !important;
            }
            
            /* Маркеры */
            .marker-icon { background: none !important; border: none !important; }
            .marker-dot {
                width: 20px; height: 20px; border-radius: 50%;
                border: 2px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.3);
                transition: transform 0.2s ease; cursor: pointer;
                will-change: transform;
            }
            .marker-dot:hover { transform: scale(1.2); }
            .marker-dot.available { background: linear-gradient(45deg, #4CAF50, #45a049); }
            .marker-dot.collected { background: linear-gradient(45deg, #f44336, #e53935); }
            
            .user-marker { background: none !important; border: none !important; }
            .user-dot {
                width: 22px; height: 22px; border-radius: 50%;
                background: linear-gradient(45deg, #007bff, #0056b3);
                border: 2px solid white; box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                position: relative;
            }
            .user-dot::after {
                content: ''; position: absolute; top: -4px; left: -4px; right: -4px; bottom: -4px;
                border-radius: 50%; border: 2px solid #007bff; opacity: 0.3;
                animation: userPulse 2s infinite;
            }
            @keyframes userPulse {
                0% { transform: scale(1); opacity: 0.7; }
                50% { opacity: 0.2; }
                100% { transform: scale(2); opacity: 0; }
            }
            
            /* Улучшенные стили popup для ПК */
            .leaflet-popup-content-wrapper {
                background: rgba(255, 255, 255, 0.98) !important;
                border-radius: 12px !important;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15) !important;
                backdrop-filter: blur(15px) !important;
                border: 1px solid rgba(255, 255, 255, 0.2) !important;
                max-width: 320px !important; /* Увеличен для ПК */
                font-family: 'ABC Oracle', sans-serif !important;
                font-weight: 500 !important;
            }
            
            .leaflet-popup-content {
                margin: 12px 15px !important;
                line-height: 1.4 !important;
                text-align: center !important;
                font-size: 0.95rem !important; /* Чуть больше для ПК */
            }
            
            /* Оптимизированные стили popup */
            .popup-content {
                min-width: 220px; /* Увеличен для ПК */
                text-align: center !important;
                padding: 5px;
            }
            .popup-content h3 {
                margin: 0 0 10px 0; color: #333; font-size: 1.1rem;
                font-family: 'ABC Oracle', sans-serif; font-weight: 500;
                text-align: center !important;
            }
            .status {
                margin: 10px 0; font-weight: 500; text-align: center !important;
                display: block; width: 100%;
            }
            .status.available { color: #4CAF50; }
            .status.collected { color: #f44336; }
            
            .telegram-user-info {
                background: linear-gradient(135deg, #0088cc, #00a0ff);
                color: white; padding: 12px; border-radius: 10px;
                margin: 10px auto; text-align: center !important;
                box-shadow: 0 3px 10px rgba(0, 136, 204, 0.3);
                max-width: 100%; width: fit-content;
            }
            .telegram-avatar {
                width: 50px; height: 50px; border-radius: 50%;
                border: 2px solid white; margin: 0 auto 8px auto !important;
                display: block !important; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            .telegram-name {
                font-weight: 500; font-size: 1rem; margin-bottom: 4px;
                text-align: center !important;
            }
            .telegram-username {
                font-size: 0.85rem; opacity: 0.9; text-decoration: none;
                color: white; display: inline-flex; align-items: center; gap: 4px;
                transition: all 0.3s; padding: 4px 8px; border-radius: 15px;
                background: rgba(255,255,255,0.1); margin: 0 auto;
            }
            .telegram-username:hover {
                background: rgba(255,255,255,0.2); transform: translateY(-1px);
            }
            
            .collector-info-enhanced {
                background: #f8f9fa; padding: 12px; border-radius: 10px;
                margin: 10px auto; border-left: 4px solid #4CAF50;
                text-align: center !important; max-width: 100%;
            }
            .collector-info-enhanced h4 {
                margin: 0 0 8px 0; color: #333; font-size: 0.95rem;
                text-align: center !important;
            }
            .collector-detail {
                margin: 4px 0; font-size: 0.9rem; color: #666;
                text-align: center !important;
            }
            .collector-info {
                background: #f8f9fa; padding: 10px; border-radius: 8px;
                margin: 10px auto; font-size: 0.9rem;
                text-align: center !important; max-width: 100%;
            }
            .collector-info p {
                margin: 5px 0; text-align: center !important;
            }
            
            /* Контролы Leaflet для ПК */
            .leaflet-control-zoom a {
                background-color: rgba(255, 255, 255, 0.95) !important;
                color: #495057 !important;
                border: 1px solid rgba(108, 117, 125, 0.2) !important;
                backdrop-filter: blur(10px) !important;
                transition: all 0.3s !important;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
                font-family: 'ABC Oracle', sans-serif !important;
                font-weight: 500 !important;
                width: 30px !important;
                height: 30px !important;
                line-height: 28px !important;
                text-align: center !important;
                font-size: 16px !important;
            }
            
            .leaflet-control-zoom a:hover {
                background-color: #f8f9fa !important;
                color: #343a40 !important;
                transform: scale(1.05) !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    // МОЛНИЕНОСНАЯ загрузка точек (без изменений)
    function loadPointsLightning() {
        return new Promise((resolve) => {
            console.log('⚡ Lightning points loading');
            
            // Сначала проверяем кэш
            const cachedPoints = FastCache.load();
            if (cachedPoints) {
                updateMapLightning(cachedPoints);
                updateStatsLightning(cachedPoints);
                
                // Уведомляем загрузчик
                if (window.AppLoader && window.AppLoader.onPointsLoaded) {
                    window.AppLoader.onPointsLoaded();
                }
                
                // Обновляем в фоне если кэш старый
                const cacheAge = FastCache.getAge();
                if (cacheAge && cacheAge > 90000) { // 1.5 минуты
                    setTimeout(() => fetchPointsFromServerLightning(false), 500);
                }
                
                resolve();
                return;
            }
            
            // Загружаем с сервера
            fetchPointsFromServerLightning(true).then(resolve);
        });
    }
    
    // МОЛНИЕНОСНАЯ загрузка с сервера (без изменений)
    function fetchPointsFromServerLightning(notifyLoader = true) {
        return new Promise((resolve) => {
            console.log('🌐 Lightning server fetch');
            
            // Создаем AbortController для таймаута
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 секунд
            
            fetch('/api/points', {
                method: 'GET',
                headers: { 
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                signal: controller.signal
            })
            .then(response => {
                clearTimeout(timeoutId);
                console.log('📡 Server response:', response.status);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                return response.json();
            })
            .then(points => {
                console.log('✅ Lightning loaded ' + points.length + ' points');
                
                // Сохраняем в кэш
                FastCache.save(points);
                
                // Обновляем карту
                updateMapLightning(points);
                updateStatsLightning(points);
                
                // Уведомляем загрузчик
                if (notifyLoader && window.AppLoader && window.AppLoader.onPointsLoaded) {
                    window.AppLoader.onPointsLoaded();
                }
                
                resolve();
            })
            .catch(error => {
                clearTimeout(timeoutId);
                console.error('❌ Lightning fetch error:', error);
                
                // Fallback к кэшу
                const fallbackPoints = FastCache.load();
                if (fallbackPoints) {
                    console.log('📦 Using fallback cache');
                    updateMapLightning(fallbackPoints);
                    updateStatsLightning(fallbackPoints);
                }
                
                // Уведомляем загрузчик даже при ошибке
                if (notifyLoader && window.AppLoader && window.AppLoader.onPointsLoaded) {
                    window.AppLoader.onPointsLoaded();
                }
                
                resolve();
            });
        });
    }
    
    // МОЛНИЕНОСНОЕ обновление карты с переиспользованием маркеров
    function updateMapLightning(points) {
        if (!map || !points) {
            console.warn('⚠️ Map or points not ready');
            return;
        }
        
        console.log('🗺️ Lightning map update (' + points.length + ' points)');
        
        try {
            // Если количество точек не изменилось, обновляем существующие маркеры
            if (points.length === lastMarkersCount && markers.length === points.length) {
                console.log('🔄 Updating existing markers');
                
                for (let i = 0; i < points.length; i++) {
                    const point = points[i];
                    const marker = markers[i];
                    
                    if (marker && marker._myPointId !== point.id) {
                        // Обновляем popup
                        const popupContent = createOptimizedPopupContent(point);
                        marker.setPopupContent(popupContent);
                        marker._myPointId = point.id;
                    }
                }
                
                console.log('✅ Updated existing markers');
                return;
            }
            
            // Полное пересоздание маркеров
            clearMarkersLightning();
            
            const fragment = document.createDocumentFragment();
            
            // Создаем новые маркеры
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
                    
                    // Создаем оптимизированный popup
                    const popupContent = createOptimizedPopupContent(point);
                    marker.bindPopup(popupContent, {
                        maxWidth: 320, // Увеличен для ПК
                        className: 'custom-popup',
                        autoPan: true,
                        keepInView: true
                    });
                    
                    marker._myPointId = point.id;
                    marker.addTo(map);
                    markers.push(marker);
                } catch (error) {
                    console.error('❌ Marker error:', error);
                }
            });
            
            lastMarkersCount = points.length;
            console.log('✅ Created ' + markers.length + ' lightning markers');
            
        } catch (error) {
            console.error('❌ Lightning map update error:', error);
        }
    }
    
    // Быстрая очистка маркеров
    function clearMarkersLightning() {
        markers.forEach(marker => {
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        });
        markers = [];
    }
    
    // Создание оптимизированного popup контента (без изменений)
    function createOptimizedPopupContent(point) {
        const isAvailable = point.status === 'available';
        
        let popupContent = '<div class="popup-content">';
        popupContent += `<h3>${point.name}</h3>`;
        
        // Статус
        popupContent += `<p class="status ${isAvailable ? 'available' : 'collected'}">`;
        popupContent += isAvailable ? '🟢 Available for collection' : '🔴 Already collected';
        popupContent += '</p>';
        
        if (!isAvailable && point.collectorInfo) {
            popupContent += '<div class="collector-info-enhanced">';
            popupContent += '<h4>Collector information:</h4>';
            
            // Если пользователь авторизован через Telegram
            if (point.collectorInfo.authMethod === 'telegram' && point.collectorInfo.telegramData) {
                const tgData = point.collectorInfo.telegramData;
                
                popupContent += '<div class="telegram-user-info">';
                
                // Аватар пользователя
                if (tgData.photo_url) {
                    popupContent += `<img src="${tgData.photo_url}" alt="Avatar" class="telegram-avatar" 
                                      onerror="this.style.display='none';">`;
                }
                
                // Имя пользователя
                const fullName = [tgData.first_name, tgData.last_name].filter(Boolean).join(' ');
                popupContent += `<div class="telegram-name">${fullName}</div>`;
                
                // Ссылка на Telegram профиль
                if (tgData.username) {
                    popupContent += `<a href="https://t.me/${tgData.username}" 
                                      target="_blank" class="telegram-username">
                                      <span>✈️</span>
                                      @${tgData.username}
                                    </a>`;
                } else {
                    popupContent += `<div class="telegram-username" style="cursor: default;">
                                      <span>🆔</span>
                                      ID: ${tgData.id}
                                    </div>`;
                }
                
                popupContent += '</div>';
                
                // Дополнительная информация
                if (point.collectorInfo.signature) {
                    popupContent += `<div class="collector-detail">
                                      <strong>Message:</strong> ${point.collectorInfo.signature}
                                    </div>`;
                }
            } else {
                // Обычный коллектор (ручной ввод)
                popupContent += `<div class="collector-detail">
                                  <span class="popup-collector-name">${point.collectorInfo.name}</span>
                                </div>`;
                
                if (point.collectorInfo.signature) {
                    popupContent += `<div class="collector-detail">
                                      <strong>Message:</strong> ${point.collectorInfo.signature}
                                    </div>`;
                }
            }
            
            popupContent += `<div class="collector-detail">
                              <strong>Collection time:</strong> ${new Date(point.collectedAt).toLocaleString('en-US')}
                            </div>`;
            
            // Добавляем селфи если доступно (сохраняем функциональность!)
            if (point.collectorInfo.selfie) {
                popupContent += '<div style="margin: 10px 0; text-align: center;">';
                popupContent += `<img src="${point.collectorInfo.selfie}" 
                                  style="max-width: 150px; max-height: 120px; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 5px auto; display: block;" 
                                  onclick="showFullImage('${point.collectorInfo.selfie}', '${point.name}')" 
                                  title="Click to enlarge">`;
                popupContent += '</div>';
            }
            
            popupContent += '</div>';
        }
        
        popupContent += '</div>';
        return popupContent;
    }
    
    // МОЛНИЕНОСНОЕ обновление статистики
    function updateStatsLightning(points) {
        const available = points.filter(p => p.status === 'available').length;
        const collected = points.filter(p => p.status === 'collected').length;
        
        const availableEl = document.getElementById('availableCount');
        const collectedEl = document.getElementById('collectedCount');
        
        if (availableEl) {
            lightningAnimateNumber(availableEl, available);
        }
        if (collectedEl) {
            lightningAnimateNumber(collectedEl, collected);
        }
        
        console.log('📊 Lightning stats: ' + available + ' available, ' + collected + ' collected');
    }
    
    // Быстрая анимация чисел
    function lightningAnimateNumber(element, targetValue) {
        const currentValue = parseInt(element.textContent) || 0;
        if (currentValue === targetValue) return;
        
        // Мгновенно устанавливаем значение для скорости
        element.textContent = targetValue;
        
        // Добавляем быструю анимацию
        element.style.transform = 'scale(1.1)';
        element.style.transition = 'transform 0.2s ease';
        
        setTimeout(() => {
            element.style.transform = 'scale(1)';
        }, 200);
    }
    
    // Показать ошибку
    function showErrorMessage(message) {
        const container = document.querySelector('.container');
        if (container) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                background: rgba(244, 67, 54, 0.1);
                border: 1px solid #f44336; border-radius: 12px;
                padding: 20px; margin: 20px 0; text-align: center;
                color: #f44336; font-weight: 600;
            `;
            errorDiv.innerHTML = `
                <h3>❌ Loading error</h3>
                <p>${message}</p>
                <button onclick="window.location.reload()" style="
                    background: #f44336; color: white; border: none;
                    padding: 10px 20px; border-radius: 6px; cursor: pointer;
                    margin-top: 10px;
                ">Refresh page</button>
            `;
            container.appendChild(errorDiv);
        }
    }
    
    // ГЛОБАЛЬНЫЕ функции (сохраняем весь функционал!)
    window.getCurrentLocation = function() {
        const btn = document.querySelector('.location-btn');
        if (!navigator.geolocation || !map) {
            console.warn('⚠️ Geolocation unavailable');
            return;
        }
        
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Locating...';
        btn.disabled = true;
        
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                // Удаляем старый маркер
                if (window.userMarker && map.hasLayer(window.userMarker)) {
                    map.removeLayer(window.userMarker);
                }
                
                // Создаем новый маркер БЕЗ popup (как и было)
                const userIcon = L.divIcon({
                    className: 'user-marker',
                    html: '<div class="user-dot"></div>',
                    iconSize: [22, 22],
                    iconAnchor: [11, 11]
                });
                
                window.userMarker = L.marker([lat, lng], { icon: userIcon })
                    .addTo(map);
                    // БЕЗ .bindPopup() - маркер пользователя без popup
                
                map.flyTo([lat, lng], 16, {
                    duration: 1.2,
                    easeLinearity: 0.3
                });
                console.log('✅ Location found');
                
                btn.innerHTML = originalText;
                btn.disabled = false;
            },
            function(error) {
                console.error('❌ Geolocation error:', error);
                btn.innerHTML = originalText;
                btn.disabled = false;
            },
            {
                enableHighAccuracy: true,
                timeout: 8000,
                maximumAge: 300000
            }
        );
    };
    
    // Показать полное изображение (сохраняем функциональность!)
    window.showFullImage = function(imageSrc, title) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 3000;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
        `;
        
        modal.innerHTML = `
            <div style="
                max-width: 90%; max-height: 90%; background: white;
                border-radius: 12px; overflow: hidden; cursor: default;
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
    
    // ОБРАБОТЧИКИ СОБЫТИЙ С ИСПРАВЛЕНИЯМИ ДЛЯ ПК
    window.addEventListener('resize', debounce(() => {
        if (map) {
            console.log('🔄 Window resize detected');
            
            // Исправляем размеры контейнера
            const mapElement = document.getElementById('map');
            if (mapElement) {
                mapElement.style.width = '100%';
                mapElement.style.height = '500px';
                mapElement.style.minHeight = '500px';
            }
            
            // Множественная инвалидация для надежности
            setTimeout(() => map.invalidateSize(true), 50);
            setTimeout(() => map.invalidateSize(true), 200);
            setTimeout(() => map.invalidateSize(true), 500);
        }
    }, 250));
    
    // Очистка кэша при видимости страницы
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && map) {
            console.log('🔄 Page became visible - checking map');
            
            // Принудительная проверка размеров карты
            setTimeout(() => {
                if (map) {
                    map.invalidateSize(true);
                    console.log('🗺️ Map invalidated on visibility change');
                }
            }, 100);
            
            // Перезагружаем точки при возвращении на страницу
            setTimeout(loadPointsLightning, 1000);
        }
    });
    
    // Предварительная загрузка при hover на кнопки
    const preloadOnHover = debounce(() => {
        if (!FastCache.load()) {
            loadPointsLightning();
        }
    }, 1000);
    
    document.addEventListener('mouseover', (e) => {
        if (e.target.matches('.control-btn, .leaderboard-btn')) {
            preloadOnHover();
        }
    });
    
    // ДОПОЛНИТЕЛЬНЫЕ ПРОВЕРКИ ДЛЯ ПК
    function performAdditionalPCChecks() {
        setTimeout(() => {
            const mapElement = document.getElementById('map');
            if (mapElement && map) {
                const rect = mapElement.getBoundingClientRect();
                console.log('🗺️ Map element dimensions:', {
                    width: rect.width,
                    height: rect.height,
                    display: getComputedStyle(mapElement).display,
                    position: getComputedStyle(mapElement).position
                });
                
                if (rect.height === 0) {
                    console.error('❌ Map height is 0! Fixing...');
                    mapElement.style.height = '500px';
                    mapElement.style.minHeight = '500px';
                    mapElement.style.display = 'block';
                    
                    setTimeout(() => {
                        map.invalidateSize(true);
                        console.log('🔧 Map fixed and invalidated');
                    }, 100);
                }
            }
        }, 2000);
    }
    
    // ЗАПУСК ИСПРАВЛЕННОЙ ИНИЦИАЛИЗАЦИИ
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            ultraFastInit();
            performAdditionalPCChecks();
        });
    } else {
        ultraFastInit();
        performAdditionalPCChecks();
    }
    
    console.log('🚀 PlasticBoy FIXED script loaded for PC compatibility');
})();
