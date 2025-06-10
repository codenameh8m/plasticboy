// PlasticBoy v2.0 - ОПТИМИЗИРОВАННАЯ версия для максимальной скорости
(function() {
    'use strict';
    
    console.log('🎯 PlasticBoy - OPTIMIZED Script initialization');
    
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
            
            // Быстрая инициализация карты
            await initMapUltraFast();
            
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
            await initMapUltraFast();
            await loadPointsLightning();
            
            console.log('✅ Fallback init completed');
        } catch (error) {
            console.error('❌ Fallback init failed:', error);
            showErrorMessage('Application failed to load. Please refresh the page.');
        }
    }
    
    // МОЛНИЕНОСНАЯ инициализация карты
    function initMapUltraFast() {
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
                console.log('🗺️ Ultra fast map creation');
                
                // Создаем карту с оптимальными настройками
                map = L.map('map', {
                    center: ALMATY_CENTER,
                    zoom: 13,
                    zoomControl: true,
                    preferCanvas: true,
                    renderer: L.canvas({ padding: 0.5 }),
                    wheelPxPerZoomLevel: 120,
                    zoomSnap: 0.5,
                    zoomDelta: 0.5,
                    maxBoundsViscosity: 1.0
                });
                
                // Добавляем тайлы с оптимизацией
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap',
                    maxZoom: 18,
                    tileSize: 256,
                    crossOrigin: true,
                    keepBuffer: 2,
                    updateWhenZooming: false,
                    updateWhenIdle: true
                }).addTo(map);
                
                // Быстрое добавление стилей
                addOptimizedMapStyles();
                
                // Уведомляем загрузчик
                if (window.AppLoader && window.AppLoader.onMapReady) {
                    window.AppLoader.onMapReady();
                }
                
                // Готовность карты
                map.whenReady(() => {
                    setTimeout(() => {
                        map.invalidateSize();
                        isInitialized = true;
                        console.log('✅ Ultra fast map ready');
                        
                        // Автообновление каждые 45 секунд (оптимизировано)
                        setInterval(loadPointsLightning, 45000);
                        
                        resolve();
                    }, 50); // Минимальная задержка
                });
                
            } catch (error) {
                console.error('❌ Ultra fast map error:', error);
                reject(error);
            }
        });
    }
    
    // Оптимизированные стили карты
    function addOptimizedMapStyles() {
        if (document.getElementById('optimized-map-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'optimized-map-styles';
        style.textContent = `
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
            
            /* Оптимизированные стили popup */
            .popup-content {
                min-width: 200px; text-align: center !important; padding: 5px;
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
        `;
        document.head.appendChild(style);
    }
    
    // МОЛНИЕНОСНАЯ загрузка точек
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
    
    // МОЛНИЕНОСНАЯ загрузка с сервера
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
                        maxWidth: 300,
                        className: 'custom-popup'
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
    
    // Создание оптимизированного popup контента (сохраняем ВЕСЬ UI!)
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
    
    // Обработчики событий
    window.addEventListener('resize', debounce(() => {
        if (map) {
            map.invalidateSize();
        }
    }, 150));
    
    // Очистка кэша при видимости страницы
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && map) {
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
    
    // ЗАПУСК МОЛНИЕНОСНОЙ ИНИЦИАЛИЗАЦИИ
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ultraFastInit);
    } else {
        ultraFastInit();
    }
    
    console.log('🚀 PlasticBoy OPTIMIZED script loaded');
})();
