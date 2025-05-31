// ИСПРАВЛЕННАЯ версия PlasticBoy для мобильных устройств
(function() {
    'use strict';
    
    // Расширенная диагностика для мобильных устройств
    const MobileDebug = {
        log: (msg, data) => {
            console.log(`📱 [Mobile] ${msg}`, data || '');
            // Показываем критические ошибки на экране для мобильных
            if (msg.includes('❌') || msg.includes('ERROR')) {
                MobileDebug.showError(msg);
            }
        },
        
        showError: (error) => {
            if (window.innerWidth <= 768) {
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = `
                    position: fixed; top: 0; left: 0; right: 0; 
                    background: #f44336; color: white; padding: 10px; 
                    z-index: 9999; font-size: 12px; text-align: center;
                `;
                errorDiv.textContent = error;
                document.body.appendChild(errorDiv);
                setTimeout(() => errorDiv.remove(), 5000);
            }
        },
        
        checkViewport: () => {
            const viewport = {
                width: window.innerWidth,
                height: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio || 1,
                userAgent: navigator.userAgent,
                touchSupport: 'ontouchstart' in window,
                orientation: window.orientation || 0
            };
            MobileDebug.log('Viewport info:', viewport);
            return viewport;
        }
    };
    
    // Улучшенная конфигурация для мобильных
    const CONFIG = {
        ALMATY_CENTER: [43.2220, 76.8512],
        API_TIMEOUT: 20000, // Увеличен таймаут для мобильных
        LEAFLET_TIMEOUT: 15000, // Увеличен таймаут для Leaflet
        NOTIFICATION_DURATION: 4000,
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                 ('ontouchstart' in window && window.innerWidth <= 768),
        isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
        isAndroid: /Android/.test(navigator.userAgent),
        
        // Настройки для разных устройств
        getMapSettings: () => {
            const width = window.innerWidth;
            if (width <= 360) {
                return { zoom: 11, height: 300, markerSize: 28 };
            } else if (width <= 480) {
                return { zoom: 12, height: 320, markerSize: 30 };
            } else if (width <= 768) {
                return { zoom: 12, height: 350, markerSize: 32 };
            }
            return { zoom: 13, height: 400, markerSize: 24 };
        }
    };
    
    MobileDebug.log('Устройство определено как:', {
        isMobile: CONFIG.isMobile,
        isIOS: CONFIG.isIOS,
        isAndroid: CONFIG.isAndroid,
        mapSettings: CONFIG.getMapSettings()
    });
    
    // Глобальные переменные
    let map, markersLayer, markers = [], pointsCache = null, isInitialized = false;
    let initAttempts = 0;
    const MAX_INIT_ATTEMPTS = 3;
    
    // Исправленные утилиты
    const Utils = {
        log: MobileDebug.log,
        
        validateCoords: (lat, lng) => {
            const numLat = Number(lat), numLng = Number(lng);
            const valid = !isNaN(numLat) && !isNaN(numLng) && 
                   numLat >= -90 && numLat <= 90 && 
                   numLng >= -180 && numLng <= 180;
            if (!valid) {
                MobileDebug.log(`❌ Неверные координаты: ${lat}, ${lng}`);
            }
            return valid;
        },
        
        createElement: (tag, className, innerHTML) => {
            const el = document.createElement(tag);
            if (className) el.className = className;
            if (innerHTML) el.innerHTML = innerHTML;
            return el;
        },
        
        addStyles: (id, css) => {
            if (document.getElementById(id)) return;
            const style = Utils.createElement('style');
            style.id = id;
            style.textContent = css;
            document.head.appendChild(style);
            MobileDebug.log(`✅ Стили ${id} добавлены`);
        },
        
        debounce: (func, delay) => {
            let timeoutId;
            return (...args) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(null, args), delay);
            };
        },
        
        // Проверка готовности DOM элемента
        waitForElement: (selector, timeout = 10000) => {
            return new Promise((resolve, reject) => {
                const element = document.querySelector(selector);
                if (element) {
                    MobileDebug.log(`✅ Элемент ${selector} найден сразу`);
                    return resolve(element);
                }
                
                const observer = new MutationObserver((mutations, obs) => {
                    const element = document.querySelector(selector);
                    if (element) {
                        obs.disconnect();
                        MobileDebug.log(`✅ Элемент ${selector} найден через observer`);
                        resolve(element);
                    }
                });
                
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                
                setTimeout(() => {
                    observer.disconnect();
                    MobileDebug.log(`❌ Элемент ${selector} не найден за ${timeout}ms`);
                    reject(new Error(`Элемент ${selector} не найден`));
                }, timeout);
            });
        }
    };
    
    // Улучшенные стили для мобильных
    const MOBILE_STYLES = `
        /* Критические стили для мобильных карт */
        #map, #adminMap {
            width: 100% !important;
            height: ${CONFIG.getMapSettings().height}px !important;
            min-height: ${CONFIG.getMapSettings().height}px !important;
            max-height: ${CONFIG.getMapSettings().height}px !important;
            position: relative !important;
            z-index: 1 !important;
        }
        
        /* Исправляем контейнер карты */
        .map-container {
            width: 100% !important;
            height: ${CONFIG.getMapSettings().height}px !important;
            position: relative !important;
            overflow: hidden !important;
            border-radius: 15px !important;
            background: #f0f0f0 !important;
        }
        
        /* Leaflet контейнер */
        .leaflet-container {
            width: 100% !important;
            height: 100% !important;
            position: relative !important;
            background: #f8f9fa !important;
        }
        
        /* Мобильные маркеры */
        .pb-marker { background: none !important; border: none !important; }
        .pb-dot {
            width: ${CONFIG.getMapSettings().markerSize}px !important;
            height: ${CONFIG.getMapSettings().markerSize}px !important;
            border-radius: 50% !important;
            border: 3px solid white !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
            cursor: pointer !important;
            transition: all 0.3s ease !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: ${CONFIG.getMapSettings().markerSize > 30 ? '14px' : '12px'} !important;
            font-weight: bold !important;
            color: white !important;
            position: relative !important;
            touch-action: manipulation !important;
            z-index: 1000 !important;
        }
        
        .pb-dot:active, .pb-dot.active {
            transform: scale(1.15) !important;
            box-shadow: 0 6px 20px rgba(0,0,0,0.4) !important;
        }
        
        .pb-dot.available {
            background: linear-gradient(45deg, #4CAF50, #45a049) !important;
        }
        
        .pb-dot.collected {
            background: linear-gradient(45deg, #f44336, #e53935) !important;
        }
        
        .pb-dot.available::before { content: '📦' !important; }
        .pb-dot.collected::before { content: '✅' !important; }
        
        /* Улучшенные попапы для мобильных */
        .leaflet-popup-content-wrapper {
            max-width: ${window.innerWidth - 40}px !important;
            min-width: 250px !important;
        }
        
        .leaflet-popup-close-button {
            width: 32px !important;
            height: 32px !important;
            font-size: 24px !important;
            line-height: 30px !important;
            text-align: center !important;
        }
        
        .pb-popup {
            min-width: 250px !important;
            max-width: ${window.innerWidth - 60}px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            font-size: 15px !important;
        }
        
        /* Контролы карты для мобильных */
        .leaflet-control-zoom {
            margin-top: 10px !important;
            margin-left: 10px !important;
        }
        
        .leaflet-control-zoom a {
            width: 35px !important;
            height: 35px !important;
            line-height: 35px !important;
            font-size: 20px !important;
        }
        
        /* Уведомления для мобильных */
        .pb-notification {
            position: fixed !important;
            top: 10px !important;
            left: 10px !important;
            right: 10px !important;
            z-index: 3000 !important;
            max-width: none !important;
            font-size: 14px !important;
        }
        
        /* Дополнительные стили для iOS */
        ${CONFIG.isIOS ? `
            .leaflet-container {
                -webkit-transform: translate3d(0,0,0) !important;
            }
            
            .pb-dot {
                -webkit-transform: translate3d(0,0,0) !important;
            }
        ` : ''}
        
        /* Дополнительные стили для Android */
        ${CONFIG.isAndroid ? `
            .leaflet-container {
                transform: translateZ(0) !important;
            }
        ` : ''}
        
        /* Отладочная информация для мобильных */
        .mobile-debug {
            position: fixed;
            bottom: 10px;
            left: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 10px;
            z-index: 9999;
            display: none;
        }
        
        .mobile-debug.show {
            display: block;
        }
    `;
    
    // Отладочная информация
    const DebugInfo = {
        create: () => {
            if (!CONFIG.isMobile) return;
            
            const debug = Utils.createElement('div', 'mobile-debug');
            debug.innerHTML = `
                📱 ${window.innerWidth}x${window.innerHeight} | 
                🔍 ${CONFIG.getMapSettings().zoom} | 
                📍 ${markers.length} точек
            `;
            document.body.appendChild(debug);
            
            // Показываем на 3 секунды при загрузке
            setTimeout(() => debug.classList.add('show'), 1000);
            setTimeout(() => debug.classList.remove('show'), 4000);
            
            return debug;
        },
        
        update: (info) => {
            const debug = document.querySelector('.mobile-debug');
            if (debug) {
                debug.innerHTML = `📱 ${info} | 📍 ${markers.length} точек`;
            }
        }
    };
    
    // Улучшенные уведомления
    const Notification = {
        show: (message, type = 'info') => {
            const icons = { error: '❌', success: '✅', info: 'ℹ️', warning: '⚠️' };
            const notification = Utils.createElement('div', `pb-notification ${type}`);
            
            notification.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span>${icons[type]}</span>
                    <span style="flex: 1;">${message}</span>
                    <button onclick="this.parentElement.parentElement.remove()" 
                            style="background: none; border: none; color: inherit; font-size: 18px; cursor: pointer;">×</button>
                </div>
            `;
            
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), CONFIG.NOTIFICATION_DURATION);
            MobileDebug.log(`Уведомление: [${type}] ${message}`);
        }
    };
    
    // Исправленный API с лучшей обработкой ошибок
    const API = {
        async fetchPoints(attempt = 1) {
            MobileDebug.log(`Загрузка точек (попытка ${attempt})...`);
            
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);
            
            try {
                const response = await fetch('/api/points', {
                    method: 'GET',
                    headers: { 
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache',
                        'User-Agent': navigator.userAgent
                    },
                    signal: controller.signal
                });
                
                clearTimeout(timeout);
                
                MobileDebug.log(`Ответ API: ${response.status} ${response.statusText}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const points = await response.json();
                
                if (!Array.isArray(points)) {
                    throw new Error('Неверный формат данных от сервера');
                }
                
                MobileDebug.log(`✅ Загружено ${points.length} точек`, points);
                return points;
                
            } catch (error) {
                clearTimeout(timeout);
                MobileDebug.log(`❌ Ошибка загрузки (попытка ${attempt}):`, error.message);
                
                if (attempt < 3 && error.name !== 'AbortError') {
                    MobileDebug.log(`🔄 Повторная попытка через 2 секунды...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    return this.fetchPoints(attempt + 1);
                }
                
                throw error;
            }
        }
    };
    
    // Исправленный менеджер карт
    const MapManager = {
        async init() {
            if (isInitialized) {
                MobileDebug.log('⚠️ Карта уже инициализирована');
                return;
            }
            
            initAttempts++;
            MobileDebug.log(`Инициализация карты (попытка ${initAttempts})...`);
            
            try {
                // Проверяем наличие элемента карты
                const mapElement = await Utils.waitForElement('#map', 5000);
                MobileDebug.log('✅ Элемент #map найден');
                
                // Ожидаем Leaflet
                await this.waitForLeaflet();
                
                // Проверяем viewport
                const viewport = MobileDebug.checkViewport();
                
                // Настройки карты для мобильных
                const mapSettings = CONFIG.getMapSettings();
                
                const mapOptions = {
                    center: CONFIG.ALMATY_CENTER,
                    zoom: mapSettings.zoom,
                    zoomControl: true,
                    attributionControl: !CONFIG.isMobile,
                    preferCanvas: CONFIG.isMobile,
                    maxZoom: 18,
                    minZoom: 8,
                    wheelPxPerZoomLevel: CONFIG.isMobile ? 120 : 60,
                    zoomAnimationThreshold: CONFIG.isMobile ? 2 : 4
                };
                
                // Мобильные настройки
                if (CONFIG.isMobile) {
                    mapOptions.tap = true;
                    mapOptions.touchZoom = true;
                    mapOptions.scrollWheelZoom = false;
                    mapOptions.doubleClickZoom = true;
                    mapOptions.boxZoom = false;
                    mapOptions.keyboard = false;
                    mapOptions.dragging = true;
                    mapOptions.zoomSnap = 0.5;
                    mapOptions.zoomDelta = 0.5;
                }
                
                MobileDebug.log('Создание карты с опциями:', mapOptions);
                
                // Создание карты
                map = L.map('map', mapOptions);
                
                // Проверяем создание карты
                if (!map) {
                    throw new Error('Не удалось создать карту');
                }
                
                MobileDebug.log('✅ Объект карты создан');
                
                // Тайлы с оптимизацией для мобильных
                const tileOptions = {
                    attribution: CONFIG.isMobile ? '' : '© OpenStreetMap contributors',
                    maxZoom: 18,
                    detectRetina: true,
                    updateWhenIdle: CONFIG.isMobile,
                    updateWhenZooming: !CONFIG.isMobile,
                    keepBuffer: CONFIG.isMobile ? 1 : 2
                };
                
                const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', tileOptions);
                tileLayer.addTo(map);
                
                MobileDebug.log('✅ Тайлы добавлены');
                
                // Группа маркеров
                markersLayer = L.layerGroup().addTo(map);
                MobileDebug.log('✅ Слой маркеров создан');
                
                // Глобальный доступ
                window.map = map;
                window.markersLayer = markersLayer;
                
                // События карты
                map.on('ready', () => {
                    MobileDebug.log('✅ Карта готова (событие ready)');
                });
                
                map.on('load', () => {
                    MobileDebug.log('✅ Карта загружена (событие load)');
                });
                
                if (CONFIG.isMobile) {
                    // Дополнительные события для мобильных
                    map.on('zoomend', () => {
                        DebugInfo.update(`zoom: ${map.getZoom()}`);
                    });
                    
                    map.on('moveend', () => {
                        const center = map.getCenter();
                        DebugInfo.update(`center: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`);
                    });
                }
                
                // Принудительное обновление размера
                setTimeout(() => {
                    try {
                        map.invalidateSize();
                        MobileDebug.log('✅ Размер карты обновлен');
                    } catch (e) {
                        MobileDebug.log('❌ Ошибка обновления размера:', e.message);
                    }
                }, 100);
                
                // Дополнительное обновление для мобильных
                if (CONFIG.isMobile) {
                    setTimeout(() => {
                        try {
                            map.invalidateSize();
                            map.setView(CONFIG.ALMATY_CENTER, mapSettings.zoom);
                            MobileDebug.log('✅ Дополнительное обновление для мобильных');
                        } catch (e) {
                            MobileDebug.log('❌ Ошибка дополнительного обновления:', e.message);
                        }
                    }, 500);
                }
                
                isInitialized = true;
                MobileDebug.log('✅ Карта полностью готова');
                
                // Создаем отладочную информацию
                DebugInfo.create();
                
            } catch (error) {
                MobileDebug.log(`❌ Ошибка инициализации карты:`, error.message);
                
                if (initAttempts < MAX_INIT_ATTEMPTS) {
                    MobileDebug.log(`🔄 Повторная попытка инициализации через 3 секунды...`);
                    setTimeout(() => this.init(), 3000);
                } else {
                    MobileDebug.log(`💥 Максимум попыток исчерпан`);
                    Notification.show('Ошибка загрузки карты. Обновите страницу.', 'error');
                }
            }
        },
        
        async waitForLeaflet() {
            if (typeof L !== 'undefined') {
                MobileDebug.log('✅ Leaflet уже доступен');
                return;
            }
            
            MobileDebug.log('⏳ Ожидание Leaflet...');
            const startTime = Date.now();
            
            return new Promise((resolve, reject) => {
                const check = setInterval(() => {
                    if (typeof L !== 'undefined') {
                        clearInterval(check);
                        const loadTime = Date.now() - startTime;
                        MobileDebug.log(`✅ Leaflet загружен за ${loadTime}ms`);
                        resolve();
                    } else if (Date.now() - startTime > CONFIG.LEAFLET_TIMEOUT) {
                        clearInterval(check);
                        MobileDebug.log(`❌ Leaflet не загрузился за ${CONFIG.LEAFLET_TIMEOUT}ms`);
                        reject(new Error('Leaflet не загрузился'));
                    }
                }, 100);
            });
        },
        
        updateMarkers(points) {
            if (!map || !markersLayer) {
                MobileDebug.log('❌ Карта не готова для обновления маркеров');
                return;
            }
            
            MobileDebug.log(`Обновление маркеров (${points.length} точек)...`);
            
            // Очистка
            markersLayer.clearLayers();
            markers.length = 0;
            
            let successCount = 0;
            const mapSettings = CONFIG.getMapSettings();
            
            points.forEach((point, index) => {
                try {
                    const lat = Number(point.coordinates.lat);
                    const lng = Number(point.coordinates.lng);
                    
                    if (!Utils.validateCoords(lat, lng)) {
                        throw new Error(`Неверные координаты: ${lat}, ${lng}`);
                    }
                    
                    const isAvailable = point.status === 'available';
                    
                    // Иконка с учетом размера экрана
                    const icon = L.divIcon({
                        className: 'pb-marker',
                        html: `<div class="pb-dot ${isAvailable ? 'available' : 'collected'}"></div>`,
                        iconSize: [mapSettings.markerSize, mapSettings.markerSize],
                        iconAnchor: [mapSettings.markerSize / 2, mapSettings.markerSize / 2]
                    });
                    
                    // Маркер
                    const marker = L.marker([lat, lng], { icon });
                    
                    // Popup с мобильной оптимизацией
                    let popup = `
                        <div class="pb-popup">
                            <h3>${point.name}</h3>
                            <div class="pb-status ${point.status}">
                                ${isAvailable ? '🟢 Доступна для сбора' : '🔴 Уже собрана'}
                            </div>
                            <p><strong>Координаты:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
                    `;
                    
                    if (point.createdAt) {
                        popup += `<p><strong>Создана:</strong> ${new Date(point.createdAt).toLocaleString('ru-RU')}</p>`;
                    }
                    
                    if (!isAvailable && point.collectorInfo) {
                        popup += `
                            <div style="background:#f8f9fa;padding:10px;border-radius:8px;margin:10px 0;">
                                <p><strong>Собрал:</strong> ${point.collectorInfo.name}</p>
                                ${point.collectorInfo.signature ? `<p><strong>Сообщение:</strong> ${point.collectorInfo.signature}</p>` : ''}
                                ${point.collectedAt ? `<p><strong>Время:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>` : ''}
                            </div>
                        `;
                    }
                    
                    popup += '</div>';
                    
                    const popupOptions = {
                        maxWidth: Math.min(300, window.innerWidth - 40),
                        autoPan: true,
                        autoPanPadding: [10, 10],
                        closeButton: true,
                        autoClose: CONFIG.isMobile, // Автозакрытие на мобильных
                        keepInView: true
                    };
                    
                    marker.bindPopup(popup, popupOptions);
                    
                    // Дополнительные события для мобильных
                    if (CONFIG.isMobile) {
                        marker.on('click', function(e) {
                            // Принудительно открываем popup
                            this.openPopup();
                            // Центрируем карту на маркере
                            map.setView(e.latlng, Math.max(map.getZoom(), 14));
                        });
                    }
                    
                    markersLayer.addLayer(marker);
                    markers.push(marker);
                    successCount++;
                    
                } catch (error) {
                    MobileDebug.log(`❌ Ошибка маркера ${index + 1}:`, error.message);
                }
            });
            
            window.markers = markers;
            
            MobileDebug.log(`✅ Успешно добавлено ${successCount} маркеров из ${points.length}`);
            
            // Обновляем отладочную информацию
            DebugInfo.update(`${successCount} маркеров`);
            
            // Автофокус для мобильных устройств
            if (CONFIG.isMobile && successCount > 0) {
                setTimeout(() => {
                    try {
                        const group = new L.featureGroup(markers);
                        const bounds = group.getBounds();
                        if (bounds.isValid()) {
                            map.fitBounds(bounds, { 
                                padding: [20, 20], 
                                maxZoom: 15 
                            });
                            MobileDebug.log('✅ Карта отцентрована на маркерах');
                        }
                    } catch (e) {
                        MobileDebug.log('❌ Ошибка центрирования карты:', e.message);
                    }
                }, 1000);
            }
            
            if (successCount > 0) {
                Notification.show(`Загружено ${successCount} точек на карту`, 'success');
            } else if (points.length > 0) {
                Notification.show('Не удалось отобразить точки на карте', 'error');
            }
        }
    };
    
    // Статистика (без изменений)
    const Stats = {
        update(points) {
            const available = points.filter(p => p.status === 'available').length;
            const collected = points.filter(p => p.status === 'collected').length;
            
            this.updateElement('availableCount', available);
            this.updateElement('collectedCount', collected);
            
            MobileDebug.log('Статистика обновлена:', { available, collected });
        },
        
        updateElement(id, value) {
            const element = document.getElementById(id);
            if (!element) return;
            
            const current = parseInt(element.textContent) || 0;
            if (current === value) return;
            
            element.style.transform = 'scale(1.1)';
            element.style.transition = 'transform 0.2s ease';
            
            setTimeout(() => {
                element.textContent = value;
                element.style.transform = 'scale(1)';
            }, 100);
        }
    };
    
    // Геолокация (улучшенная для мобильных)
    const Location = {
        getCurrentPosition() {
            MobileDebug.log('Запрос геолокации...');
            
            const locationBtn = document.querySelector('.location-btn');
            if (!locationBtn) {
                MobileDebug.log('❌ Кнопка геолокации не найдена');
                return;
            }
            
            if (!navigator.geolocation) {
                Notification.show('Геолокация не поддерживается', 'error');
                return;
            }
            
            const originalText = locationBtn.innerHTML;
            locationBtn.innerHTML = '⏳ Поиск...';
            locationBtn.disabled = true;
            
            const options = {
                enableHighAccuracy: true,
                timeout: CONFIG.isMobile ? 25000 : 15000, // Больше времени для мобильных
                maximumAge: 300000
            };
            
            MobileDebug.log('Запрос геолокации с опциями:', options);
            
            navigator.geolocation.getCurrentPosition(
                (position) => this.onLocationSuccess(position, locationBtn, originalText),
                (error) => this.onLocationError(error, locationBtn, originalText),
                options
            );
        },
        
        onLocationSuccess(position, btn, originalText) {
            const { latitude: lat, longitude: lng, accuracy } = position.coords;
            
            MobileDebug.log('✅ Геолокация получена:', { lat, lng, accuracy });
            
            if (!map) {
                MobileDebug.log('❌ Карта не готова для отображения геолокации');
                Notification.show('Карта не готова', 'error');
                btn.innerHTML = originalText;
                btn.disabled = false;
                return;
            }
            
            // Размер иконки пользователя зависит от устройства
            const iconSize = CONFIG.getMapSettings().markerSize;
            
            const userIcon = L.divIcon({
                className: 'pb-user-marker',
                html: `<div style="
                    background:linear-gradient(45deg,#2196F3,#1976D2);
                    width:${iconSize}px;
                    height:${iconSize}px;
                    border-radius:50%;border:3px solid white;
                    box-shadow:0 4px 12px rgba(33,150,243,0.4);
                    display:flex;align-items:center;justify-content:center;
                    color:white;font-weight:bold;font-size:${Math.max(10, iconSize-14)}px;position:relative;
                    z-index:1001;
                ">👤<div style="
                    position:absolute;top:-3px;left:-3px;right:-3px;bottom:-3px;
                    border:2px solid #2196F3;border-radius:50%;opacity:0.6;
                    animation:userPulse 2s infinite
                "></div></div>`,
                iconSize: [iconSize, iconSize],
                iconAnchor: [iconSize/2, iconSize/2]
            });
            
            // Удаляем предыдущий маркер
            if (window.userMarker) {
                map.removeLayer(window.userMarker);
            }
            
            // Добавляем новый
            window.userMarker = L.marker([lat, lng], { icon: userIcon })
                .addTo(map)
                .bindPopup(`
                    <div style="text-align:center;min-width:150px">
                        <strong>📍 Ваше местоположение</strong><br>
                        <small style="color:#666">
                            ${lat.toFixed(6)}, ${lng.toFixed(6)}<br>
                            Точность: ±${Math.round(accuracy)}м
                        </small>
                    </div>
                `, {
                    maxWidth: Math.min(200, window.innerWidth - 40)
                });
            
            // Центрируем карту
            const zoom = Math.max(map.getZoom(), CONFIG.isMobile ? 15 : 16);
            map.setView([lat, lng], zoom);
            
            Notification.show('Местоположение определено!', 'success');
            
            btn.innerHTML = originalText;
            btn.disabled = false;
            
            DebugInfo.update(`GPS: ${accuracy}м`);
        },
        
        onLocationError(error, btn, originalText) {
            MobileDebug.log('❌ Ошибка геолокации:', error);
            
            const messages = {
                1: 'Разрешите доступ к геолокации',
                2: 'Местоположение недоступно',
                3: 'Время ожидания истекло'
            };
            
            const message = messages[error.code] || 'Ошибка геолокации';
            Notification.show(message, 'error');
            
            btn.innerHTML = originalText;
            btn.disabled = false;
            
            DebugInfo.update('GPS: error');
        }
    };
    
    // Тестовые данные для отладки
    const TestData = {
        createPoints() {
            MobileDebug.log('🧪 Создание тестовых точек...');
            
            const testPoints = [
                {
                    id: 'test1',
                    name: 'Тестовая модель - Парк Горького',
                    coordinates: { lat: 43.2220, lng: 76.8512 },
                    status: 'available',
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'test2',
                    name: 'Тестовая модель - Площадь Республики',
                    coordinates: { lat: 43.2380, lng: 76.8840 },
                    status: 'collected',
                    collectorInfo: { 
                        name: 'Тестовый пользователь', 
                        signature: 'Первая находка!' 
                    },
                    collectedAt: new Date(Date.now() - 3600000).toISOString()
                },
                {
                    id: 'test3',
                    name: 'Тестовая модель - Кок-Тобе',
                    coordinates: { lat: 43.2050, lng: 76.9080 },
                    status: 'available',
                    createdAt: new Date().toISOString()
                }
            ];
            
            pointsCache = testPoints;
            MapManager.updateMarkers(testPoints);
            Stats.update(testPoints);
            
            Notification.show('Загружены тестовые точки', 'info');
            MobileDebug.log('✅ Тестовые точки созданы');
        }
    };
    
    // Главное приложение
    const App = {
        async init() {
            MobileDebug.log('🚀 Запуск PlasticBoy...');
            MobileDebug.checkViewport();
            
            try {
                // Добавляем стили
                Utils.addStyles('pb-mobile-styles', MOBILE_STYLES);
                
                // Инициализируем кнопки
                this.initButtons();
                
                // Ждем готовности DOM
                await this.waitForDOM();
                
                // Инициализируем карту
                await MapManager.init();
                
                // Загружаем точки
                await this.loadPoints();
                
                MobileDebug.log('✅ PlasticBoy полностью готов');
                
                // Уведомляем загрузчик о готовности
                if (typeof window.PlasticBoyLoader?.onPointsLoaded === 'function') {
                    window.PlasticBoyLoader.onPointsLoaded();
                }
                
            } catch (error) {
                MobileDebug.log('❌ Критическая ошибка инициализации:', error);
                Notification.show('Ошибка загрузки приложения: ' + error.message, 'error');
                
                // Попытка восстановления с тестовыми данными
                if (CONFIG.isMobile || location.hostname === 'localhost') {
                    MobileDebug.log('🔄 Попытка восстановления с тестовыми данными...');
                    setTimeout(() => {
                        TestData.createPoints();
                        if (typeof window.PlasticBoyLoader?.onPointsLoaded === 'function') {
                            window.PlasticBoyLoader.onPointsLoaded();
                        }
                    }, 2000);
                }
            }
        },
        
        async waitForDOM() {
            if (document.readyState === 'complete') {
                MobileDebug.log('✅ DOM уже готов');
                return;
            }
            
            MobileDebug.log('⏳ Ожидание готовности DOM...');
            
            return new Promise(resolve => {
                if (document.readyState === 'complete') {
                    resolve();
                } else {
                    window.addEventListener('load', resolve);
                    // Резервный таймер
                    setTimeout(resolve, 10000);
                }
            });
        },
        
        async loadPoints() {
            try {
                MobileDebug.log('📡 Загрузка точек с сервера...');
                const points = await API.fetchPoints();
                pointsCache = points;
                
                if (points.length === 0) {
                    MobileDebug.log('⚠️ Сервер вернул пустой массив точек');
                    Notification.show('Точки не найдены', 'warning');
                    
                    // На мобильных показываем тестовые данные
                    if (CONFIG.isMobile) {
                        TestData.createPoints();
                    }
                    return;
                }
                
                MapManager.updateMarkers(points);
                Stats.update(points);
                
                MobileDebug.log('✅ Точки успешно загружены и отображены');
                
            } catch (error) {
                MobileDebug.log('❌ Ошибка загрузки точек:', error.message);
                Notification.show('Ошибка загрузки данных: ' + error.message, 'error');
                
                // Fallback для мобильных устройств
                if (CONFIG.isMobile || location.hostname === 'localhost' || location.search.includes('debug')) {
                    MobileDebug.log('🔄 Загрузка тестовых данных...');
                    TestData.createPoints();
                }
            }
        },
        
        initButtons() {
            // Кнопка геолокации
            const locationBtn = document.querySelector('.location-btn');
            if (locationBtn) {
                locationBtn.addEventListener('click', Location.getCurrentPosition);
                MobileDebug.log('✅ Кнопка геолокации настроена');
            } else {
                MobileDebug.log('⚠️ Кнопка геолокации не найдена');
            }
            
            // Дополнительные обработчики для мобильных
            if (CONFIG.isMobile) {
                // Предотвращаем масштабирование при двойном тапе
                document.addEventListener('touchstart', function(e) {
                    if (e.touches.length > 1) {
                        e.preventDefault();
                    }
                });
                
                let lastTouchEnd = 0;
                document.addEventListener('touchend', function(e) {
                    const now = (new Date()).getTime();
                    if (now - lastTouchEnd <= 300) {
                        e.preventDefault();
                    }
                    lastTouchEnd = now;
                }, false);
            }
        }
    };
    
    // События окна
    window.addEventListener('resize', Utils.debounce(() => {
        MobileDebug.log('🔄 Изменение размера окна');
        if (map) {
            map.invalidateSize();
            DebugInfo.update(`${window.innerWidth}x${window.innerHeight}`);
        }
    }, 250));
    
    // Обработка поворота экрана на мобильных
    if (CONFIG.isMobile) {
        window.addEventListener('orientationchange', () => {
            MobileDebug.log('🔄 Поворот экрана');
            setTimeout(() => {
                if (map) {
                    map.invalidateSize();
                    // Переустанавливаем центр карты
                    const currentCenter = map.getCenter();
                    const currentZoom = map.getZoom();
                    setTimeout(() => {
                        map.setView(currentCenter, currentZoom);
                    }, 100);
                }
            }, 500);
        });
    }
    
    // Горячие клавиши
    document.addEventListener('keydown', (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        
        switch (e.key) {
            case 'l':
                e.preventDefault();
                Location.getCurrentPosition();
                break;
            case 'r':
                e.preventDefault();
                if (isInitialized) App.loadPoints();
                break;
            case 'd':
                e.preventDefault();
                console.group('🎯 PlasticBoy Mobile Диагностика');
                console.log('Устройство:', CONFIG.isMobile ? 'Мобильное' : 'Десктоп');
                console.log('iOS:', CONFIG.isIOS);
                console.log('Android:', CONFIG.isAndroid);
                console.log('Размер экрана:', `${window.innerWidth}x${window.innerHeight}`);
                console.log('Инициализировано:', isInitialized);
                console.log('Карта:', !!map);
                console.log('Маркеры:', markers.length);
                console.log('Кэш точек:', pointsCache?.length || 0);
                console.log('Настройки карты:', CONFIG.getMapSettings());
                console.groupEnd();
                Notification.show('Диагностика в консоли', 'info');
                // Показываем/скрываем отладочную информацию
                const debug = document.querySelector('.mobile-debug');
                if (debug) {
                    debug.classList.toggle('show');
                }
                break;
            case 't':
                e.preventDefault();
                if (CONFIG.isMobile) {
                    TestData.createPoints();
                }
                break;
        }
    });
    
    // Экспорт API
    window.PlasticBoy = {
        map: () => map,
        markers: () => markers,
        loadPoints: () => App.loadPoints(),
        getLocation: Location.getCurrentPosition,
        isReady: () => isInitialized,
        getCache: () => pointsCache,
        isMobile: CONFIG.isMobile,
        debug: MobileDebug,
        testData: TestData
    };
    
    // Псевдонимы для совместимости
    window.showNotification = Notification.show;
    window.updateMap = MapManager.updateMarkers;
    window.updateStats = Stats.update;
    window.loadPoints = () => App.loadPoints();
    window.getCurrentLocation = Location.getCurrentPosition;
    window.initMap = MapManager.init;
    
    // Автозапуск
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            MobileDebug.log('📱 DOM готов, запуск через 200ms...');
            setTimeout(App.init, 200);
        });
    } else {
        MobileDebug.log('📱 DOM уже готов, запуск через 100ms...');
        setTimeout(App.init, 100);
    }
    
    MobileDebug.log('✅ PlasticBoy мобильный скрипт загружен');
    MobileDebug.log(`📱 Режим: ${CONFIG.isMobile ? 'МОБИЛЬНЫЙ' : 'ДЕСКТОП'}`);
    MobileDebug.log(`📐 Настройки: ${JSON.stringify(CONFIG.getMapSettings())}`);
    
})();
