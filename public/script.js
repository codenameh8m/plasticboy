// PlasticBoy v2.1 - Ультра-оптимизированная версия
(function() {
    'use strict';
    
    // === КОНСТАНТЫ И ПЕРЕМЕННЫЕ ===
    const ALMATY_CENTER = [43.2220, 76.8512];
    const CACHE_KEY = 'plasticboy_points_v3';
    const CACHE_TTL = 3 * 60 * 1000; // 3 минуты
    const UPDATE_INTERVAL = 45000; // 45 секунд
    const MAX_RETRIES = 3;
    
    let map = null;
    let markers = [];
    let markersLayer = null;
    let isInitialized = false;
    let updateTimer = null;
    let retryCount = 0;
    
    // === УЛЬТРА-БЫСТРОЕ КЭШИРОВАНИЕ ===
    const FastCache = {
        data: null,
        timestamp: 0,
        
        save(points) {
            this.data = points;
            this.timestamp = Date.now();
            
            // Сохраняем в localStorage асинхронно
            requestIdleCallback(() => {
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        data: points,
                        timestamp: this.timestamp
                    }));
                } catch (e) {
                    console.warn('⚠️ localStorage error:', e);
                }
            });
        },
        
        load() {
            // Сначала проверяем память
            if (this.data && (Date.now() - this.timestamp) < CACHE_TTL) {
                return this.data;
            }
            
            // Затем localStorage
            try {
                const stored = localStorage.getItem(CACHE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if ((Date.now() - parsed.timestamp) < CACHE_TTL) {
                        this.data = parsed.data;
                        this.timestamp = parsed.timestamp;
                        return this.data;
                    }
                }
            } catch (e) {
                console.warn('⚠️ Cache read error:', e);
            }
            
            return null;
        },
        
        isValid() {
            return this.data && (Date.now() - this.timestamp) < CACHE_TTL;
        }
    };
    
    // === ОПТИМИЗИРОВАННЫЙ HTTP КЛИЕНТ ===
    class FastHTTP {
        static async get(url, options = {}) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), options.timeout || 8000);
            
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Cache-Control': 'max-age=30'
                    },
                    signal: controller.signal,
                    cache: 'default'
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                return await response.json();
            } catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        }
    }
    
    // === ДЕБАУНСИРОВАННЫЕ ФУНКЦИИ ===
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
    
    // === УЛЬТРА-БЫСТРАЯ ИНИЦИАЛИЗАЦИЯ ===
    async function ultraFastInit() {
        try {
            console.log('🚀 Ultra-fast initialization');
            
            // 1. Быстрая инициализация карты
            await initMapFast();
            
            // 2. Загрузка точек с приоритетом кэша
            await loadPointsUltraFast();
            
            // 3. Запуск автообновления
            startSmartUpdates();
            
            console.log('⚡ PlasticBoy ready in ultra-fast mode');
            
        } catch (error) {
            console.error('❌ Init error:', error);
            if (retryCount < MAX_RETRIES) {
                retryCount++;
                setTimeout(ultraFastInit, 2000 * retryCount);
            }
        }
    }
    
    // === МОЛНИЕНОСНАЯ ИНИЦИАЛИЗАЦИЯ КАРТЫ ===
    function initMapFast() {
        return new Promise((resolve) => {
            const mapElement = document.getElementById('map');
            if (!mapElement || typeof L === 'undefined') {
                setTimeout(() => initMapFast().then(resolve), 100);
                return;
            }
            
            if (map) {
                resolve();
                return;
            }
            
            try {
                // Создаем карту с оптимизированными настройками
                map = L.map('map', {
                    center: ALMATY_CENTER,
                    zoom: 13,
                    zoomControl: true,
                    preferCanvas: true,
                    renderer: L.canvas({ padding: 0.5 }), // Canvas рендерер для скорости
                    trackResize: false, // Отключаем автоматическое отслеживание размера
                    worldCopyJump: false,
                    maxBounds: [
                        [42.8, 76.4], // Юго-запад Алматы
                        [43.6, 77.2]  // Северо-восток Алматы
                    ]
                });
                
                // Добавляем тайлы с кэшированием
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap',
                    maxZoom: 18,
                    tileSize: 256,
                    crossOrigin: true,
                    updateWhenIdle: true,
                    updateWhenZooming: false,
                    keepBuffer: 4
                }).addTo(map);
                
                // Создаем слой для маркеров
                markersLayer = L.layerGroup().addTo(map);
                
                // Уведомляем загрузчик
                if (window.AppLoader?.onMapReady) {
                    window.AppLoader.onMapReady();
                }
                
                // Дебаунсированный resize handler
                const debouncedResize = debounce(() => {
                    if (map) map.invalidateSize();
                }, 250);
                
                window.addEventListener('resize', debouncedResize, { passive: true });
                
                map.whenReady(() => {
                    isInitialized = true;
                    resolve();
                });
                
            } catch (error) {
                console.error('❌ Map init error:', error);
                resolve();
            }
        });
    }
    
    // === МОЛНИЕНОСНАЯ ЗАГРУЗКА ТОЧЕК ===
    async function loadPointsUltraFast() {
        console.log('📍 Ultra-fast points loading');
        
        try {
            // 1. Сначала проверяем кэш
            const cachedPoints = FastCache.load();
            if (cachedPoints) {
                console.log('⚡ Using cached points:', cachedPoints.length);
                updateMapUltraFast(cachedPoints);
                updateStats(cachedPoints);
                
                if (window.AppLoader?.onPointsLoaded) {
                    window.AppLoader.onPointsLoaded();
                }
                
                // Обновляем в фоне, если кэш старый
                if (!FastCache.isValid()) {
                    fetchPointsInBackground();
                }
                return;
            }
            
            // 2. Загружаем с сервера
            await fetchPointsFromServer(true);
            
        } catch (error) {
            console.error('❌ Points loading error:', error);
            
            // Пытаемся использовать устаревший кэш
            const oldCache = FastCache.data;
            if (oldCache) {
                console.log('🔄 Using stale cache as fallback');
                updateMapUltraFast(oldCache);
                updateStats(oldCache);
            }
            
            if (window.AppLoader?.onPointsLoaded) {
                window.AppLoader.onPointsLoaded();
            }
        }
    }
    
    // === ФОНОВАЯ ЗАГРУЗКА ===
    async function fetchPointsInBackground() {
        try {
            await fetchPointsFromServer(false);
        } catch (error) {
            console.warn('⚠️ Background fetch failed:', error.message);
        }
    }
    
    // === ОПТИМИЗИРОВАННАЯ ЗАГРУЗКА С СЕРВЕРА ===
    async function fetchPointsFromServer(notifyLoader = true) {
        console.log('🌐 Fetching from server');
        
        const startTime = performance.now();
        
        try {
            const points = await FastHTTP.get('/api/points', { timeout: 6000 });
            
            const loadTime = performance.now() - startTime;
            console.log(`✅ Points loaded in ${loadTime.toFixed(1)}ms:`, points.length);
            
            // Сохраняем в кэш
            FastCache.save(points);
            
            // Обновляем UI
            updateMapUltraFast(points);
            updateStats(points);
            
            if (notifyLoader && window.AppLoader?.onPointsLoaded) {
                window.AppLoader.onPointsLoaded();
            }
            
            retryCount = 0; // Сбрасываем счетчик ошибок
            
        } catch (error) {
            console.error('❌ Server fetch error:', error);
            throw error;
        }
    }
    
    // === МОЛНИЕНОСНОЕ ОБНОВЛЕНИЕ КАРТЫ ===
    function updateMapUltraFast(points) {
        if (!map || !markersLayer || !points) return;
        
        const startTime = performance.now();
        
        try {
            // Очищаем старые маркеры одним вызовом
            markersLayer.clearLayers();
            markers = [];
            
            // Создаем маркеры батчами для лучшей производительности
            const markerBatch = [];
            const batchSize = 50;
            
            for (let i = 0; i < points.length; i += batchSize) {
                const batch = points.slice(i, i + batchSize);
                
                requestAnimationFrame(() => {
                    batch.forEach(point => {
                        try {
                            const marker = createOptimizedMarker(point);
                            if (marker) {
                                markerBatch.push(marker);
                                markersLayer.addLayer(marker);
                            }
                        } catch (error) {
                            console.warn('⚠️ Marker creation error:', error);
                        }
                    });
                });
                
                // Даем браузеру передышку
                if (i > 0 && i % (batchSize * 4) === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            }
            
            markers = markerBatch;
            
            const updateTime = performance.now() - startTime;
            console.log(`🗺️ Map updated in ${updateTime.toFixed(1)}ms: ${markers.length} markers`);
            
        } catch (error) {
            console.error('❌ Map update error:', error);
        }
    }
    
    // === ОПТИМИЗИРОВАННОЕ СОЗДАНИЕ МАРКЕРА ===
    function createOptimizedMarker(point) {
        try {
            const isAvailable = point.status === 'available';
            
            // Простая HTML иконка для скорости
            const icon = L.divIcon({
                className: 'fast-marker',
                html: `<div class="fast-marker-dot ${isAvailable ? 'available' : 'collected'}"></div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9],
                popupAnchor: [0, -10]
            });
            
            const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { 
                icon: icon,
                riseOnHover: true
            });
            
            // Ленивая загрузка popup
            marker.on('click', () => {
                if (!marker.getPopup()) {
                    const popup = createOptimizedPopup(point, isAvailable);
                    marker.bindPopup(popup);
                }
                marker.openPopup();
            });
            
            return marker;
            
        } catch (error) {
            console.error('❌ Marker creation error:', error);
            return null;
        }
    }
    
    // === ОПТИМИЗИРОВАННОЕ СОЗДАНИЕ POPUP ===
    function createOptimizedPopup(point, isAvailable) {
        let content = `<div class="fast-popup">`;
        content += `<h3>${point.name}</h3>`;
        content += `<p class="status ${isAvailable ? 'available' : 'collected'}">`;
        content += isAvailable ? '🟢 Доступно для сбора' : '🔴 Уже собрано';
        content += '</p>';
        
        if (!isAvailable && point.collectorInfo) {
            content += createCollectorInfo(point.collectorInfo);
        }
        
        content += '</div>';
        return content;
    }
    
    // === ИНФОРМАЦИЯ О КОЛЛЕКТОРЕ ===
    function createCollectorInfo(collectorInfo) {
        let info = '<div class="collector-info-fast">';
        
        if (collectorInfo.authMethod === 'telegram' && collectorInfo.telegramData) {
            const tg = collectorInfo.telegramData;
            const fullName = [tg.first_name, tg.last_name].filter(Boolean).join(' ');
            
            info += '<div class="telegram-info-fast">';
            if (tg.photo_url) {
                info += `<img src="${tg.photo_url}" class="tg-avatar-fast" onerror="this.style.display='none'">`;
            }
            info += `<div class="tg-name-fast">${fullName}</div>`;
            if (tg.username) {
                info += `<a href="https://t.me/${tg.username}" target="_blank" class="tg-username-fast">@${tg.username}</a>`;
            }
            info += '</div>';
        } else {
            info += `<div class="manual-collector-fast">${collectorInfo.name}</div>`;
        }
        
        if (collectorInfo.signature) {
            info += `<div class="signature-fast">"${collectorInfo.signature}"</div>`;
        }
        
        info += '</div>';
        return info;
    }
    
    // === МОЛНИЕНОСНОЕ ОБНОВЛЕНИЕ СТАТИСТИКИ ===
    function updateStats(points) {
        if (!points) return;
        
        const available = points.filter(p => p.status === 'available').length;
        const collected = points.length - available;
        
        animateNumber('availableCount', available);
        animateNumber('collectedCount', collected);
    }
    
    // === АНИМАЦИЯ ЧИСЕЛ ===
    function animateNumber(elementId, targetValue) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const currentValue = parseInt(element.textContent) || 0;
        if (currentValue === targetValue) return;
        
        // Простая анимация без setInterval
        const duration = 400;
        const startTime = performance.now();
        const difference = targetValue - currentValue;
        
        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const currentNumber = Math.round(currentValue + (difference * progress));
            element.textContent = currentNumber;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    // === УМНОЕ АВТООБНОВЛЕНИЕ ===
    function startSmartUpdates() {
        if (updateTimer) {
            clearInterval(updateTimer);
        }
        
        updateTimer = setInterval(async () => {
            // Обновляем только если вкладка активна
            if (document.hidden) return;
            
            try {
                await fetchPointsInBackground();
            } catch (error) {
                console.warn('⚠️ Auto-update failed:', error.message);
            }
        }, UPDATE_INTERVAL);
        
        // Останавливаем обновления при скрытии вкладки
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && updateTimer) {
                clearInterval(updateTimer);
                updateTimer = null;
            } else if (!document.hidden && !updateTimer) {
                startSmartUpdates();
            }
        });
    }
    
    // === ОПТИМИЗИРОВАННОЕ ОПРЕДЕЛЕНИЕ МЕСТОПОЛОЖЕНИЯ ===
    window.getCurrentLocation = function() {
        const btn = document.querySelector('.location-btn');
        if (!navigator.geolocation || !map) return;
        
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Определяем...';
        btn.disabled = true;
        
        const options = {
            enableHighAccuracy: false, // Быстрее, но менее точно
            timeout: 8000,
            maximumAge: 300000 // 5 минут кэш
        };
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude: lat, longitude: lng } = position.coords;
                
                // Удаляем старый маркер
                if (window.userMarker) {
                    map.removeLayer(window.userMarker);
                }
                
                // Создаем новый маркер пользователя
                const userIcon = L.divIcon({
                    className: 'user-marker-fast',
                    html: '<div class="user-dot-fast"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                });
                
                window.userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
                
                // Плавно перемещаемся к позиции
                map.flyTo([lat, lng], 16, { duration: 1 });
                
                btn.innerHTML = originalText;
                btn.disabled = false;
            },
            (error) => {
                console.warn('⚠️ Geolocation error:', error);
                btn.innerHTML = originalText;
                btn.disabled = false;
            },
            options
        );
    };
    
    // === СТИЛИ ДЛЯ БЫСТРЫХ МАРКЕРОВ ===
    function addFastStyles() {
        if (document.getElementById('fast-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'fast-styles';
        style.textContent = `
            .fast-marker { background: none !important; border: none !important; }
            .fast-marker-dot {
                width: 18px; height: 18px; border-radius: 50%;
                border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                transition: transform 0.2s ease;
            }
            .fast-marker-dot:hover { transform: scale(1.15); }
            .fast-marker-dot.available { background: linear-gradient(45deg, #4CAF50, #45a049); }
            .fast-marker-dot.collected { background: linear-gradient(45deg, #f44336, #e53935); }
            
            .user-marker-fast { background: none !important; border: none !important; }
            .user-dot-fast {
                width: 20px; height: 20px; border-radius: 50%;
                background: linear-gradient(45deg, #007bff, #0056b3);
                border: 2px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.3);
                position: relative;
            }
            .user-dot-fast::after {
                content: ''; position: absolute; top: -3px; left: -3px; right: -3px; bottom: -3px;
                border-radius: 50%; border: 2px solid #007bff; opacity: 0.3;
                animation: userPulseFast 2s infinite;
            }
            @keyframes userPulseFast {
                0% { transform: scale(1); opacity: 0.7; }
                100% { transform: scale(1.8); opacity: 0; }
            }
            
            .fast-popup { min-width: 180px; text-align: center; font-size: 0.9rem; }
            .fast-popup h3 { margin: 0 0 8px 0; color: #333; font-size: 1rem; }
            .fast-popup .status { margin: 6px 0; font-weight: 500; }
            .fast-popup .status.available { color: #4CAF50; }
            .fast-popup .status.collected { color: #f44336; }
            
            .collector-info-fast { background: #f8f9fa; padding: 8px; border-radius: 6px; margin: 8px 0; }
            .telegram-info-fast { text-align: center; }
            .tg-avatar-fast { width: 40px; height: 40px; border-radius: 50%; margin-bottom: 4px; }
            .tg-name-fast { font-weight: 600; margin-bottom: 2px; }
            .tg-username-fast { color: #0088cc; font-size: 0.8rem; text-decoration: none; }
            .manual-collector-fast { font-weight: 600; text-align: center; }
            .signature-fast { font-style: italic; color: #666; margin-top: 4px; }
        `;
        document.head.appendChild(style);
    }
    
    // === ПОКАЗ ПОЛНОГО ИЗОБРАЖЕНИЯ ===
    window.showFullImage = function(imageSrc, title) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 3000; display: flex;
            align-items: center; justify-content: center; cursor: pointer;
        `;
        
        modal.innerHTML = `
            <div style="max-width: 90%; max-height: 90%; background: white; border-radius: 12px; overflow: hidden;" onclick="event.stopPropagation()">
                <div style="padding: 15px; background: #f8f9fa; text-align: center; font-weight: 600;">${title}</div>
                <img src="${imageSrc}" style="max-width: 100%; max-height: 70vh; display: block;">
            </div>
        `;
        
        modal.onclick = () => modal.remove();
        document.body.appendChild(modal);
    };
    
    // === ИНИЦИАЛИЗАЦИЯ ===
    function init() {
        // Ждем готовности DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }
        
        // Добавляем стили
        addFastStyles();
        
        // Ждем загрузки Leaflet
        function waitForLeaflet() {
            if (typeof L !== 'undefined') {
                if (window.AppLoader?.onLeafletReady) {
                    window.AppLoader.onLeafletReady();
                }
                ultraFastInit();
            } else {
                setTimeout(waitForLeaflet, 50);
            }
        }
        
        waitForLeaflet();
    }
    
    // === ОБРАБОТКА ОШИБОК ===
    window.addEventListener('error', (event) => {
        console.error('❌ Global error:', event.error);
    });
    
    // === ОЧИСТКА ПРИ ВЫГРУЗКЕ ===
    window.addEventListener('beforeunload', () => {
        if (updateTimer) {
            clearInterval(updateTimer);
        }
    });
    
    // Запуск
    init();
    
    console.log('🚀 PlasticBoy Ultra-Fast loaded');
    
})();
