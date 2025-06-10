// PlasticBoy v2.1 - Optimized for blazing fast performance
(function() {
    'use strict';
    
    console.log('🎯 PlasticBoy - Optimized Script initialization');
    
    // ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
    let map = null;
    let markers = [];
    let isInitialized = false;
    let markersPool = []; // Пул маркеров для переиспользования
    
    // Almaty coordinates
    const ALMATY_CENTER = [43.2220, 76.8512];
    
    // ОПТИМИЗИРОВАННАЯ СИСТЕМА КЭШИРОВАНИЯ
    class FastCache {
        constructor() {
            this.cache = new Map();
            this.ttl = 3 * 60 * 1000; // 3 минуты
            this.maxSize = 50;
        }
        
        set(key, data) {
            try {
                // Удаляем старые записи если превышен размер
                if (this.cache.size >= this.maxSize) {
                    const firstKey = this.cache.keys().next().value;
                    this.cache.delete(firstKey);
                }
                
                this.cache.set(key, {
                    data,
                    timestamp: Date.now()
                });
                
                // Также сохраняем в localStorage как fallback
                localStorage.setItem(`pb_${key}`, JSON.stringify({
                    data,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.warn('⚠️ Cache save error:', e.message);
            }
        }
        
        get(key) {
            try {
                // Сначала проверяем memory cache
                let item = this.cache.get(key);
                
                // Если нет в памяти, проверяем localStorage
                if (!item) {
                    const stored = localStorage.getItem(`pb_${key}`);
                    if (stored) {
                        item = JSON.parse(stored);
                        // Восстанавливаем в memory cache
                        this.cache.set(key, item);
                    }
                }
                
                if (!item) return null;
                
                const age = Date.now() - item.timestamp;
                if (age > this.ttl) {
                    this.cache.delete(key);
                    localStorage.removeItem(`pb_${key}`);
                    return null;
                }
                
                return item.data;
            } catch (e) {
                console.warn('⚠️ Cache read error:', e.message);
                return null;
            }
        }
        
        clear() {
            this.cache.clear();
            // Очищаем только наши ключи из localStorage
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith('pb_')) {
                    localStorage.removeItem(key);
                }
            }
        }
        
        getSize() {
            return this.cache.size;
        }
    }
    
    const cache = new FastCache();
    
    // БАТЧИНГ DOM ОПЕРАЦИЙ
    class DOMBatcher {
        constructor() {
            this.pending = [];
            this.isScheduled = false;
        }
        
        add(fn) {
            this.pending.push(fn);
            if (!this.isScheduled) {
                this.isScheduled = true;
                requestAnimationFrame(() => {
                    const batch = this.pending.splice(0);
                    this.isScheduled = false;
                    
                    // Выполняем все операции в одном frame
                    batch.forEach(fn => {
                        try {
                            fn();
                        } catch (e) {
                            console.warn('⚠️ DOM batch error:', e);
                        }
                    });
                });
            }
        }
    }
    
    const domBatcher = new DOMBatcher();
    
    // ДЕБАУНС ДЛЯ ЧАСТЫХ ОПЕРАЦИЙ
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // THROTTLE ДЛЯ ОГРАНИЧЕНИЯ ЧАСТОТЫ
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // БЫСТРАЯ ИНИЦИАЛИЗАЦИЯ
    function initFast() {
        return new Promise((resolve) => {
            console.log('🚀 Fast initialization started');
            
            // Проверяем готовность DOM
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initFast);
                return;
            }
            
            // Проверяем Leaflet с таймаутом
            let attempts = 0;
            const maxAttempts = 100; // 10 секунд
            
            const checkLeaflet = () => {
                attempts++;
                
                if (typeof L !== 'undefined' && L.map) {
                    console.log('✅ Leaflet ready in', attempts * 100, 'ms');
                    initMapFast().then(resolve);
                } else if (attempts < maxAttempts) {
                    setTimeout(checkLeaflet, 100);
                } else {
                    console.error('❌ Leaflet timeout after 10 seconds');
                    resolve(); // Не блокируем даже при ошибке
                }
            };
            
            checkLeaflet();
        });
    }
    
    // МОЛНИЕНОСНАЯ ИНИЦИАЛИЗАЦИЯ КАРТЫ
    function initMapFast() {
        return new Promise((resolve) => {
            if (isInitialized) {
                resolve();
                return;
            }
            
            const mapElement = document.getElementById('map');
            if (!mapElement) {
                console.warn('⚠️ Map element not found');
                resolve();
                return;
            }
            
            try {
                console.log('🗺️ Creating optimized map');
                
                // Создаем карту с оптимизированными настройками
                map = L.map('map', {
                    center: ALMATY_CENTER,
                    zoom: 13,
                    zoomControl: true,
                    preferCanvas: true,
                    renderer: L.canvas(), // Canvas рендерер для лучшей производительности
                    zoomAnimation: true,
                    fadeAnimation: true,
                    markerZoomAnimation: true
                });
                
                // Добавляем тайлы с оптимизацией
                const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap',
                    maxZoom: 18,
                    tileSize: 256,
                    crossOrigin: true,
                    updateWhenZooming: false, // Оптимизация
                    updateWhenIdle: true,     // Оптимизация
                    keepBuffer: 2             // Кэшируем больше тайлов
                });
                
                tileLayer.addTo(map);
                
                // Добавляем стили
                addMapStylesFast();
                
                // Уведомляем загрузчик
                if (window.AppLoader?.onMapReady) {
                    window.AppLoader.onMapReady();
                }
                
                // Быстро финализируем
                map.whenReady(() => {
                    setTimeout(() => {
                        map.invalidateSize();
                        isInitialized = true;
                        
                        // Автообновление с оптимизацией
                        setInterval(loadPointsFast, 30000);
                        
                        console.log('✅ Map optimized and ready');
                        resolve();
                    }, 50); // Уменьшено с 200ms
                });
                
            } catch (error) {
                console.error('❌ Map creation error:', error);
                resolve(); // Не блокируем
            }
        });
    }
    
    // МОЛНИЕНОСНЫЕ СТИЛИ
    function addMapStylesFast() {
        if (document.getElementById('map-styles-fast')) return;
        
        const style = document.createElement('style');
        style.id = 'map-styles-fast';
        style.textContent = `
            .marker-fast { background: none !important; border: none !important; }
            .marker-dot-fast {
                width: 18px; height: 18px; border-radius: 50%;
                border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                transition: transform 0.2s ease; cursor: pointer;
            }
            .marker-dot-fast:hover { transform: scale(1.15); }
            .marker-dot-fast.available { background: linear-gradient(45deg, #4CAF50, #45a049); }
            .marker-dot-fast.collected { background: linear-gradient(45deg, #f44336, #e53935); }
            .user-marker-fast { background: none !important; border: none !important; }
            .user-dot-fast {
                width: 20px; height: 20px; border-radius: 50%;
                background: linear-gradient(45deg, #007bff, #0056b3);
                border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                position: relative;
            }
            .user-dot-fast::after {
                content: ''; position: absolute; top: -3px; left: -3px; right: -3px; bottom: -3px;
                border-radius: 50%; border: 2px solid #007bff; opacity: 0.3;
                animation: userPulseFast 2s infinite;
            }
            @keyframes userPulseFast {
                0% { transform: scale(1); opacity: 0.7; }
                50% { opacity: 0.2; }
                100% { transform: scale(1.8); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // СУПЕРСКОРОСТНАЯ ЗАГРУЗКА ТОЧЕК
    function loadPointsFast() {
        return new Promise((resolve) => {
            console.log('📍 Fast points loading');
            
            // Сначала проверяем кэш
            const cached = cache.get('points');
            if (cached) {
                updateMapFast(cached);
                updateStatsFast(cached);
                
                if (window.AppLoader?.onPointsLoaded) {
                    window.AppLoader.onPointsLoaded();
                }
                
                // Обновляем в фоне
                setTimeout(() => fetchPointsFast(false), 100);
                resolve();
                return;
            }
            
            // Загружаем с сервера
            fetchPointsFast(true).then(resolve);
        });
    }
    
    // ОПТИМИЗИРОВАННЫЙ FETCH
    function fetchPointsFast(notifyLoader = true) {
        return new Promise((resolve) => {
            console.log('🌐 Fetching points with optimization');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 секунд
            
            fetch('/api/points', {
                method: 'GET',
                headers: { 
                    'Accept': 'application/json',
                    'Cache-Control': 'max-age=120' // Кэш на 2 минуты
                },
                signal: controller.signal
            })
            .then(response => {
                clearTimeout(timeoutId);
                console.log('📡 Server response:', response.status, response.headers.get('X-Cache') || 'NO-CACHE');
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                return response.json();
            })
            .then(points => {
                console.log('✅ Loaded', points.length, 'points with optimization');
                
                // Сохраняем в кэш
                cache.set('points', points);
                
                // Обновляем UI
                updateMapFast(points);
                updateStatsFast(points);
                
                if (notifyLoader && window.AppLoader?.onPointsLoaded) {
                    window.AppLoader.onPointsLoaded();
                }
                
                resolve();
            })
            .catch(error => {
                clearTimeout(timeoutId);
                console.error('❌ Points loading error:', error.message);
                
                // Fallback к кэшу
                const cachedPoints = cache.get('points');
                if (cachedPoints) {
                    console.log('📦 Using cached fallback');
                    updateMapFast(cachedPoints);
                    updateStatsFast(cachedPoints);
                }
                
                if (notifyLoader && window.AppLoader?.onPointsLoaded) {
                    window.AppLoader.onPointsLoaded();
                }
                
                resolve();
            });
        });
    }
    
    // СУПЕРБЫСТРОЕ ОБНОВЛЕНИЕ КАРТЫ
    function updateMapFast(points) {
        if (!map || !points || !Array.isArray(points)) {
            console.warn('⚠️ Map or points not ready for fast update');
            return;
        }
        
        console.log('🗺️ Fast map update with', points.length, 'points');
        
        try {
            // Используем батчинг для DOM операций
            domBatcher.add(() => {
                // Очищаем старые маркеры эффективно
                clearMarkersFast();
                
                // Добавляем новые маркеры пакетами
                const batchSize = 10;
                let processed = 0;
                
                const processBatch = () => {
                    const batch = points.slice(processed, processed + batchSize);
                    
                    batch.forEach(point => {
                        try {
                            addMarkerFast(point);
                        } catch (error) {
                            console.warn('⚠️ Marker error:', error, point.id);
                        }
                    });
                    
                    processed += batchSize;
                    
                    if (processed < points.length) {
                        // Следующий батч в следующем frame
                        requestAnimationFrame(processBatch);
                    } else {
                        console.log('✅ Added', markers.length, 'markers efficiently');
                    }
                };
                
                processBatch();
            });
            
        } catch (error) {
            console.error('❌ Fast map update error:', error);
        }
    }
    
    // ЭФФЕКТИВНАЯ ОЧИСТКА МАРКЕРОВ
    function clearMarkersFast() {
        markers.forEach(marker => {
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
            // Возвращаем маркер в пул для переиспользования
            markersPool.push(marker);
        });
        markers.length = 0; // Быстрая очистка массива
    }
    
    // БЫСТРОЕ ДОБАВЛЕНИЕ МАРКЕРА
    function addMarkerFast(point) {
        const isAvailable = point.status === 'available';
        
        // Переиспользуем маркер из пула или создаем новый
        let marker = markersPool.pop();
        
        if (!marker) {
            const icon = L.divIcon({
                className: 'marker-fast',
                html: `<div class="marker-dot-fast ${isAvailable ? 'available' : 'collected'}"></div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9]
            });
            
            marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon });
        } else {
            // Обновляем существующий маркер
            marker.setLatLng([point.coordinates.lat, point.coordinates.lng]);
            const iconEl = marker.getElement()?.querySelector('.marker-dot-fast');
            if (iconEl) {
                iconEl.className = `marker-dot-fast ${isAvailable ? 'available' : 'collected'}`;
            }
        }
        
        // Создаем popup с оптимизацией
        const popupContent = createPopupContentFast(point, isAvailable);
        marker.bindPopup(popupContent, {
            maxWidth: 280,
            closeButton: true,
            autoPan: true,
            keepInView: true
        });
        
        marker.addTo(map);
        markers.push(marker);
    }
    
    // БЫСТРОЕ СОЗДАНИЕ POPUP КОНТЕНТА
    function createPopupContentFast(point, isAvailable) {
        let html = `<div class="popup-content-fast">
            <h3>${escapeHtml(point.name)}</h3>
            <p class="status-fast ${isAvailable ? 'available' : 'collected'}">
                ${isAvailable ? '🟢 Available for collection' : '🔴 Already collected'}
            </p>`;
        
        if (!isAvailable && point.collectorInfo) {
            html += '<div class="collector-info-fast">';
            html += '<h4>Collector information:</h4>';
            
            // Telegram пользователь
            if (point.collectorInfo.authMethod === 'telegram' && point.collectorInfo.telegramData) {
                const tgData = point.collectorInfo.telegramData;
                
                html += '<div class="telegram-user-info-fast">';
                
                if (tgData.photo_url) {
                    html += `<img src="${tgData.photo_url}" alt="Avatar" class="telegram-avatar-fast" 
                              onerror="this.style.display='none';">`;
                }
                
                const fullName = [tgData.first_name, tgData.last_name].filter(Boolean).join(' ');
                html += `<div class="telegram-name-fast">${escapeHtml(fullName)}</div>`;
                
                if (tgData.username) {
                    html += `<a href="https://t.me/${tgData.username}" target="_blank" class="telegram-username-fast">
                              <span>✈️</span> @${escapeHtml(tgData.username)}
                            </a>`;
                }
                
                html += '</div>';
                
                if (point.collectorInfo.signature) {
                    html += `<div class="collector-detail-fast">
                              <strong>Message:</strong> ${escapeHtml(point.collectorInfo.signature)}
                            </div>`;
                }
            } else {
                // Обычный пользователь
                html += `<div class="collector-detail-fast">
                          <span class="collector-name-fast">${escapeHtml(point.collectorInfo.name)}</span>
                        </div>`;
                
                if (point.collectorInfo.signature) {
                    html += `<div class="collector-detail-fast">
                              <strong>Message:</strong> ${escapeHtml(point.collectorInfo.signature)}
                            </div>`;
                }
            }
            
            html += `<div class="collector-detail-fast">
                      <strong>Collection time:</strong> ${new Date(point.collectedAt).toLocaleString('en-US')}
                    </div>`;
            
            // Селфи с ленивой загрузкой
            if (point.collectorInfo.selfie) {
                html += `<div class="selfie-container-fast">
                          <img data-src="${point.collectorInfo.selfie}" 
                               class="selfie-fast lazy-load" 
                               onclick="showFullImageFast('${point.collectorInfo.selfie}', '${escapeHtml(point.name)}')"
                               alt="Selfie" title="Click to enlarge">
                        </div>`;
            }
            
            html += '</div>';
        }
        
        html += '</div>';
        return html;
    }
    
    // БЫСТРОЕ ЭКРАНИРОВАНИЕ HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ЛЕНИВАЯ ЗАГРУЗКА ИЗОБРАЖЕНИЙ
    function setupLazyLoading() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.classList.remove('lazy-load');
                        observer.unobserve(img);
                    }
                }
            });
        }, { threshold: 0.1 });
        
        // Наблюдаем за новыми изображениями
        const checkForImages = () => {
            document.querySelectorAll('img.lazy-load').forEach(img => {
                observer.observe(img);
            });
        };
        
        // Проверяем при открытии popup'ов
        map?.on('popupopen', () => {
            setTimeout(checkForImages, 100);
        });
    }
    
    // БЫСТРОЕ ОБНОВЛЕНИЕ СТАТИСТИКИ
    const updateStatsFast = throttle((points) => {
        if (!points || !Array.isArray(points)) return;
        
        const available = points.filter(p => p.status === 'available').length;
        const collected = points.filter(p => p.status === 'collected').length;
        
        domBatcher.add(() => {
            const availableEl = document.getElementById('availableCount');
            const collectedEl = document.getElementById('collectedCount');
            
            if (availableEl) animateNumberFast(availableEl, available);
            if (collectedEl) animateNumberFast(collectedEl, collected);
        });
        
        console.log('📊 Fast stats: Available:', available, 'Collected:', collected);
    }, 500);
    
    // БЫСТРАЯ АНИМАЦИЯ ЧИСЕЛ
    function animateNumberFast(element, targetValue) {
        const currentValue = parseInt(element.textContent) || 0;
        if (currentValue === targetValue) return;
        
        const diff = targetValue - currentValue;
        const duration = Math.min(300, Math.abs(diff) * 30); // Адаптивная длительность
        const steps = Math.min(10, Math.abs(diff)); // Меньше шагов для скорости
        
        if (steps === 0) {
            element.textContent = targetValue;
            return;
        }
        
        const stepValue = diff / steps;
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
    
    // ОПТИМИЗИРОВАННОЕ ОПРЕДЕЛЕНИЕ МЕСТОПОЛОЖЕНИЯ
    const getCurrentLocationFast = debounce(function() {
        const btn = document.querySelector('.location-btn');
        if (!navigator.geolocation || !map) {
            console.warn('⚠️ Geolocation unavailable');
            return;
        }
        
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Locating...';
        btn.disabled = true;
        
        const options = {
            enableHighAccuracy: true,
            timeout: 8000, // Уменьшено с 10 секунд
            maximumAge: 120000 // 2 минуты кэш
        };
        
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                // Удаляем старый маркер пользователя
                if (window.userMarkerFast && map.hasLayer(window.userMarkerFast)) {
                    map.removeLayer(window.userMarkerFast);
                }
                
                // Создаем новый маркер пользователя
                const userIcon = L.divIcon({
                    className: 'user-marker-fast',
                    html: '<div class="user-dot-fast"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                });
                
                window.userMarkerFast = L.marker([lat, lng], { icon: userIcon }).addTo(map);
                
                // Плавный переход к местоположению
                map.flyTo([lat, lng], 16, {
                    duration: 1.0 // Уменьшено с 1.5 секунд
                });
                
                console.log('✅ Location found fast');
                
                btn.innerHTML = originalText;
                btn.disabled = false;
            },
            function(error) {
                console.error('❌ Geolocation error:', error);
                btn.innerHTML = originalText;
                btn.disabled = false;
            },
            options
        );
    }, 1000);
    
    // БЫСТРОЕ ПОКАЗ ПОЛНОГО ИЗОБРАЖЕНИЯ
    window.showFullImageFast = function(imageSrc, title) {
        const modal = document.createElement('div');
        modal.className = 'image-modal-fast';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 3000; display: flex;
            align-items: center; justify-content: center; cursor: pointer;
            animation: fadeInFast 0.2s ease-out;
        `;
        
        modal.innerHTML = `
            <div style="
                max-width: 90%; max-height: 90%; background: white;
                border-radius: 12px; overflow: hidden; cursor: default;
                animation: scaleInFast 0.2s ease-out;
            " onclick="event.stopPropagation()">
                <div style="padding: 15px; background: #f8f9fa; text-align: center; font-weight: 600;">
                    ${escapeHtml(title)}
                </div>
                <img src="${imageSrc}" style="max-width: 100%; max-height: 70vh; display: block;">
            </div>
        `;
        
        // Добавляем стили анимации если их нет
        if (!document.getElementById('modal-animations')) {
            const style = document.createElement('style');
            style.id = 'modal-animations';
            style.textContent = `
                @keyframes fadeInFast { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleInFast { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            `;
            document.head.appendChild(style);
        }
        
        modal.onclick = () => {
            modal.style.animation = 'fadeInFast 0.2s ease-out reverse';
            setTimeout(() => modal.remove(), 200);
        };
        
        document.body.appendChild(modal);
    };
    
    // ОПТИМИЗИРОВАННЫЙ ОБРАБОТЧИК РАЗМЕРА ОКНА
    const handleResizeFast = throttle(() => {
        if (map) {
            map.invalidateSize();
        }
    }, 250);
    
    // ГЛОБАЛЬНЫЕ ФУНКЦИИ
    window.getCurrentLocation = getCurrentLocationFast;
    
    // ОБРАБОТЧИКИ СОБЫТИЙ
    window.addEventListener('resize', handleResizeFast);
    
    // Оптимизация производительности на мобильных
    if (window.DeviceOrientationEvent) {
        window.addEventListener('orientationchange', () => {
            setTimeout(handleResizeFast, 500);
        });
    }
    
    // ИНИЦИАЛИЗАЦИЯ ПРИ СТАРТЕ
    async function startApp() {
        try {
            console.log('🚀 Starting optimized PlasticBoy app');
            
            // Быстрая инициализация
            await initFast();
            
            // Уведомляем загрузчик о готовности Leaflet
            if (window.AppLoader?.onLeafletReady) {
                window.AppLoader.onLeafletReady();
            }
            
            // Загружаем точки
            await loadPointsFast();
            
            // Настраиваем ленивую загрузку
            setupLazyLoading();
            
            console.log('🎉 PlasticBoy app optimized and ready');
            
        } catch (error) {
            console.error('❌ App initialization error:', error);
            
            // Показываем ошибку пользователю
            const container = document.querySelector('.container');
            if (container) {
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = `
                    background: rgba(244, 67, 54, 0.1); border: 1px solid #f44336;
                    border-radius: 12px; padding: 20px; margin: 20px 0;
                    text-align: center; color: #f44336; font-weight: 600;
                `;
                errorDiv.innerHTML = `
                    <h3>❌ Loading error</h3>
                    <p>Failed to load the application. Please refresh the page.</p>
                    <button onclick="window.location.reload()" style="
                        background: #f44336; color: white; border: none;
                        padding: 10px 20px; border-radius: 6px; cursor: pointer; margin-top: 10px;
                    ">Refresh page</button>
                `;
                container.appendChild(errorDiv);
            }
        }
    }
    
    // ЗАПУСК ПРИЛОЖЕНИЯ
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp);
    } else {
        startApp();
    }
    
    console.log('🚀 PlasticBoy optimized script loaded');
    
    // Дебаг информация
    window.PlasticBoyDebug = {
        cache: cache,
        markers: markers,
        map: map,
        clearCache: () => cache.clear(),
        getStats: () => ({
            markersCount: markers.length,
            cacheSize: cache.getSize(),
            mapReady: isInitialized
        })
    };
    
})();
