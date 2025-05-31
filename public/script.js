// ИСПРАВЛЕННЫЙ PlasticBoy для мобильных устройств
(function() {
    'use strict';
    
    // Конфигурация с улучшенным определением мобильных устройств
    const CONFIG = {
        ALMATY_CENTER: [43.2220, 76.8512],
        API_TIMEOUT: 8000,
        RETRY_ATTEMPTS: 2,
        CACHE_DURATION: 30000,
        // ИСПРАВЛЕНО: более точное определение мобильных устройств
        isMobile: window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 'ontouchstart' in window
    };
    
    // Глобальные переменные для быстрого доступа
    let map, markersLayer, markers = [], pointsCache = null, lastFetch = 0, isInitialized = false;
    
    // Кэш DOM элементов для ускорения
    const DOM = {
        availableCount: null,
        collectedCount: null,
        mapElement: null,
        init() {
            this.availableCount = document.getElementById('availableCount');
            this.collectedCount = document.getElementById('collectedCount');
            this.mapElement = document.getElementById('map');
        }
    };
    
    // Быстрые утилиты
    const Utils = {
        log: (msg, data) => console.log(`⚡ [PlasticBoy] ${msg}`, data || ''),
        
        now: () => Date.now(),
        
        debounce: (func, delay) => {
            let timeoutId;
            return (...args) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(null, args), delay);
            };
        },
        
        // Быстрая валидация координат
        validateCoords: (lat, lng) => {
            const numLat = +lat, numLng = +lng;
            return numLat >= -90 && numLat <= 90 && numLng >= -180 && numLng <= 180;
        }
    };
    
    // Уведомления - минимальная реализация
    const Notification = {
        show: (message, type = 'info') => {
            const colors = { error: '#f44336', success: '#4CAF50', info: '#2196F3' };
            const icons = { error: '❌', success: '✅', info: 'ℹ️' };
            
            const notification = document.createElement('div');
            notification.style.cssText = `
                position:fixed;top:20px;right:20px;z-index:9999;background:white;
                border-radius:8px;padding:12px 16px;box-shadow:0 4px 20px rgba(0,0,0,0.15);
                border-left:4px solid ${colors[type]};max-width:300px;font-size:14px;
                animation:slideIn 0.3s ease-out;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
            `;
            notification.innerHTML = `${icons[type]} ${message}`;
            
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
        }
    };
    
    // API клиент
    const API = {
        controller: null,
        
        async fetchPoints() {
            Utils.log('Быстрая загрузка точек...');
            
            // Проверяем кэш
            if (pointsCache && (Utils.now() - lastFetch) < CONFIG.CACHE_DURATION) {
                Utils.log('Используем кэш точек');
                return pointsCache;
            }
            
            // Отменяем предыдущий запрос
            if (this.controller) this.controller.abort();
            this.controller = new AbortController();
            
            const startTime = Utils.now();
            
            try {
                const response = await fetch('/api/points', {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Cache-Control': 'max-age=30'
                    },
                    signal: this.controller.signal
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const points = await response.json();
                const loadTime = Utils.now() - startTime;
                
                // Обновляем кэш
                pointsCache = points;
                lastFetch = Utils.now();
                
                Utils.log(`✅ Загружено ${points.length} точек за ${loadTime}ms`);
                return points;
                
            } catch (error) {
                if (error.name === 'AbortError') return pointsCache || [];
                
                Utils.log('❌ Ошибка API:', error.message);
                
                // Возвращаем кэш при ошибке
                if (pointsCache) {
                    Utils.log('Используем устаревший кэш');
                    return pointsCache;
                }
                
                throw error;
            }
        }
    };
    
    // ИСПРАВЛЕННОЕ управление картой для мобильных устройств
    const MapManager = {
        async init() {
            if (isInitialized) return;
            
            Utils.log(`Быстрая инициализация карты для ${CONFIG.isMobile ? 'мобильного' : 'десктопа'}...`);
            
            // Проверяем готовность DOM
            if (!DOM.mapElement) {
                throw new Error('Элемент #map не найден');
            }
            
            // ИСПРАВЛЕНО: убеждаемся что элемент видим
            DOM.mapElement.style.display = 'block';
            DOM.mapElement.style.height = CONFIG.isMobile ? '350px' : '400px';
            DOM.mapElement.style.width = '100%';
            
            // Ждем Leaflet с таймаутом
            await this.waitForLeaflet();
            
            // ИСПРАВЛЕНО: создаем карту с оптимальными настройками для мобильных
            map = L.map('map', {
                center: CONFIG.ALMATY_CENTER,
                zoom: CONFIG.isMobile ? 11 : 13, // Уменьшен зум для мобильных
                zoomControl: !CONFIG.isMobile, // Отключаем контролы на мобильных
                attributionControl: false,
                preferCanvas: CONFIG.isMobile, // Используем Canvas на мобильных для производительности
                maxZoom: 18,
                minZoom: 9,
                wheelDebounceTime: CONFIG.isMobile ? 100 : 40,
                wheelPxPerZoomLevel: 50,
                tap: CONFIG.isMobile,
                tapTolerance: CONFIG.isMobile ? 20 : 15,
                touchZoom: CONFIG.isMobile,
                doubleClickZoom: !CONFIG.isMobile, // Отключаем двойной клик на мобильных
                boxZoom: !CONFIG.isMobile,
                keyboard: !CONFIG.isMobile,
                scrollWheelZoom: !CONFIG.isMobile,
                dragging: true,
                worldCopyJump: false
            });
            
            // ИСПРАВЛЕНО: специальные настройки для мобильных
            if (CONFIG.isMobile) {
                // Добавляем мобильные контролы
                L.control.zoom({
                    position: 'bottomright'
                }).addTo(map);
                
                // Отключаем некоторые события для лучшей производительности
                map.off('movestart resize zoomstart');
            }
            
            // ИСПРАВЛЕНО: быстрые тайлы с retry для мобильных
            const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
                detectRetina: CONFIG.isMobile,
                updateWhenIdle: CONFIG.isMobile,
                keepBuffer: CONFIG.isMobile ? 1 : 2,
                updateWhenZooming: !CONFIG.isMobile,
                attribution: ''
            });
            
            tileLayer.addTo(map);
            
            // ИСПРАВЛЕНО: обработка ошибок загрузки тайлов
            tileLayer.on('tileerror', function(e) {
                Utils.log('❌ Ошибка загрузки тайла:', e.tile.src);
                // Повторная попытка загрузки
                setTimeout(() => {
                    e.tile.src = e.tile.src;
                }, 1000);
            });
            
            // Группа маркеров для быстрого управления
            markersLayer = L.layerGroup().addTo(map);
            
            // Глобальный доступ
            window.map = map;
            window.markersLayer = markersLayer;
            
            // ИСПРАВЛЕНО: финальная настройка с множественными попытками
            const finalizeMap = () => {
                try {
                    map.invalidateSize();
                    isInitialized = true;
                    Utils.log('✅ Карта готова');
                    
                    // Для мобильных добавляем дополнительную проверку
                    if (CONFIG.isMobile) {
                        setTimeout(() => {
                            map.invalidateSize();
                            Utils.log('🔄 Мобильная карта пересчитана');
                        }, 500);
                    }
                } catch (error) {
                    Utils.log('❌ Ошибка финализации карты:', error);
                    // Повторная попытка
                    setTimeout(finalizeMap, 200);
                }
            };
            
            setTimeout(finalizeMap, 100);
            
            // ИСПРАВЛЕНО: обработчик изменения размера для мобильных
            if (CONFIG.isMobile) {
                window.addEventListener('orientationchange', () => {
                    setTimeout(() => {
                        if (map) {
                            map.invalidateSize();
                            Utils.log('📱 Карта обновлена после поворота экрана');
                        }
                    }, 300);
                });
            }
        },
        
        async waitForLeaflet() {
            if (typeof L !== 'undefined') return;
            
            Utils.log('Ожидание Leaflet...');
            return new Promise((resolve, reject) => {
                let attempts = 0;
                const maxAttempts = 200; // 10 секунд
                
                const check = setInterval(() => {
                    attempts++;
                    if (typeof L !== 'undefined') {
                        clearInterval(check);
                        Utils.log('✅ Leaflet загружен');
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        clearInterval(check);
                        reject(new Error('Leaflet не загрузился за 10 секунд'));
                    }
                }, 50);
            });
        },
        
        // ИСПРАВЛЕНО: обновление маркеров с оптимизацией для мобильных
        updateMarkers(points) {
            if (!map || !markersLayer) {
                Utils.log('❌ Карта не готова для маркеров');
                return;
            }
            
            const startTime = Utils.now();
            Utils.log(`Обновление ${points.length} маркеров...`);
            
            // Очищаем все маркеры одним вызовом
            markersLayer.clearLayers();
            markers.length = 0;
            
            if (points.length === 0) {
                Utils.log('⚠️ Нет точек для отображения');
                Notification.show('Нет точек для отображения', 'info');
                return;
            }
            
            // ИСПРАВЛЕНО: батчинг для мобильных устройств
            const batchSize = CONFIG.isMobile ? 10 : 50; // Меньший размер батча для мобильных
            let processed = 0;
            
            const processBatch = () => {
                const endIndex = Math.min(processed + batchSize, points.length);
                
                for (let i = processed; i < endIndex; i++) {
                    this.createMarker(points[i]);
                }
                
                processed = endIndex;
                
                if (processed < points.length) {
                    // Продолжаем в следующем фрейме
                    requestAnimationFrame(processBatch);
                } else {
                    const totalTime = Utils.now() - startTime;
                    Utils.log(`✅ Маркеры созданы за ${totalTime}ms (${markers.length} успешно)`);
                    
                    if (markers.length > 0) {
                        Notification.show(`Загружено ${markers.length} точек`, 'success');
                        
                        // ИСПРАВЛЕНО: автофокус только для мобильных
                        if (CONFIG.isMobile) {
                            this.autoFit();
                        }
                    } else {
                        Notification.show('Не удалось создать маркеры', 'error');
                    }
                }
            };
            
            processBatch();
        },
        
        // ИСПРАВЛЕНО: создание маркера оптимизированное для мобильных
        createMarker(point) {
            try {
                const lat = +point.coordinates.lat;
                const lng = +point.coordinates.lng;
                
                if (!Utils.validateCoords(lat, lng)) {
                    Utils.log(`❌ Неверные координаты: ${lat}, ${lng}`);
                    return;
                }
                
                const isAvailable = point.status === 'available';
                const color = isAvailable ? '#4CAF50' : '#f44336';
                const emoji = isAvailable ? '📦' : '✅';
                
                // ИСПРАВЛЕНО: размеры маркеров для мобильных
                const size = CONFIG.isMobile ? 32 : 24; // Больше размер для мобильных
                
                // ИСПРАВЛЕНО: упрощенная HTML иконка для производительности
                const icon = L.divIcon({
                    className: 'pb-marker',
                    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:${Math.floor(size*0.4)}px;color:white;cursor:pointer;user-select:none;-webkit-user-select:none;">${emoji}</div>`,
                    iconSize: [size, size],
                    iconAnchor: [size/2, size/2]
                });
                
                const marker = L.marker([lat, lng], { icon });
                
                // ИСПРАВЛЕНО: компактный popup для мобильных
                const popup = this.createPopup(point, isAvailable);
                marker.bindPopup(popup, {
                    maxWidth: CONFIG.isMobile ? 250 : 280,
                    autoPan: CONFIG.isMobile,
                    closeButton: true,
                    autoClose: CONFIG.isMobile, // Автозакрытие на мобильных
                    closeOnEscapeKey: !CONFIG.isMobile
                });
                
                // ИСПРАВЛЕНО: события для мобильных
                if (CONFIG.isMobile) {
                    marker.on('click', function() {
                        // Дополнительная обработка для мобильных
                        map.setView([lat, lng], Math.max(map.getZoom(), 14));
                    });
                }
                
                markersLayer.addLayer(marker);
                markers.push(marker);
                
            } catch (error) {
                Utils.log(`❌ Ошибка создания маркера: ${error.message}`, point);
            }
        },
        
        // Компактный popup
        createPopup(point, isAvailable) {
            const lat = (+point.coordinates.lat).toFixed(6);
            const lng = (+point.coordinates.lng).toFixed(6);
            
            let popup = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:${CONFIG.isMobile ? '14px' : '13px'};">
                <h3 style="margin:0 0 8px 0;color:#333;font-size:${CONFIG.isMobile ? '15px' : '14px'};">${point.name}</h3>
                <div style="margin:6px 0;font-weight:600;color:${isAvailable ? '#4CAF50' : '#f44336'};">
                    ${isAvailable ? '🟢 Доступна' : '🔴 Собрана'}
                </div>
                <p style="margin:4px 0;font-size:${CONFIG.isMobile ? '13px' : '12px'};color:#666;">📍 ${lat}, ${lng}</p>`;
            
            if (point.createdAt) {
                popup += `<p style="margin:4px 0;font-size:${CONFIG.isMobile ? '13px' : '12px'};color:#666;">🕐 ${new Date(point.createdAt).toLocaleDateString('ru-RU')}</p>`;
            }
            
            if (!isAvailable && point.collectorInfo?.name) {
                popup += `<div style="background:#f5f5f5;padding:6px;border-radius:4px;margin:6px 0;font-size:${CONFIG.isMobile ? '13px' : '12px'};">
                    <strong>Собрал:</strong> ${point.collectorInfo.name}`;
                
                if (point.collectorInfo.signature) {
                    popup += `<br><em>"${point.collectorInfo.signature}"</em>`;
                }
                popup += '</div>';
            }
            
            return popup + '</div>';
        },
        
        // ИСПРАВЛЕНО: автофокус для мобильных
        autoFit() {
            if (markers.length === 0) return;
            
            setTimeout(() => {
                try {
                    const group = new L.featureGroup(markers);
                    const bounds = group.getBounds();
                    if (bounds.isValid()) {
                        map.fitBounds(bounds, { 
                            padding: CONFIG.isMobile ? [30, 30] : [20, 20], 
                            maxZoom: CONFIG.isMobile ? 14 : 15
                        });
                        Utils.log('📱 Карта подогнана под маркеры');
                    }
                } catch (error) {
                    Utils.log('❌ Ошибка автофокуса:', error.message);
                }
            }, CONFIG.isMobile ? 500 : 300);
        }
    };
    
    // Статистика
    const Stats = {
        update(points) {
            const available = points.filter(p => p.status === 'available').length;
            const collected = points.filter(p => p.status === 'collected').length;
            
            this.animate(DOM.availableCount, available);
            this.animate(DOM.collectedCount, collected);
            
            Utils.log(`Статистика: ${available} доступно, ${collected} собрано`);
        },
        
        animate(element, value) {
            if (!element) return;
            
            const current = +element.textContent || 0;
            if (current === value) return;
            
            element.style.transform = 'scale(1.1)';
            element.style.transition = 'transform 0.2s ease';
            
            setTimeout(() => {
                element.textContent = value;
                element.style.transform = 'scale(1)';
            }, 100);
        }
    };
    
    // Геолокация
    const Location = {
        isRequesting: false,
        
        async get() {
            if (this.isRequesting) return;
            this.isRequesting = true;
            
            Utils.log('Запрос геолокации...');
            
            const btn = document.querySelector('.location-btn');
            if (btn) {
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '⏳ Поиск...';
                btn.disabled = true;
                
                try {
                    const position = await this.getCurrentPosition();
                    this.onSuccess(position);
                } catch (error) {
                    this.onError(error);
                } finally {
                    btn.innerHTML = originalHTML;
                    btn.disabled = false;
                    this.isRequesting = false;
                }
            }
        },
        
        getCurrentPosition() {
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error('Геолокация не поддерживается'));
                    return;
                }
                
                navigator.geolocation.getCurrentPosition(
                    resolve,
                    reject,
                    {
                        enableHighAccuracy: true,
                        timeout: 15000, // Больше времени для мобильных
                        maximumAge: CONFIG.isMobile ? 600000 : 300000 // Больше кэширование для мобильных
                    }
                );
            });
        },
        
        onSuccess(position) {
            const { latitude: lat, longitude: lng, accuracy } = position.coords;
            
            Utils.log(`Геолокация: ${lat.toFixed(6)}, ${lng.toFixed(6)} (±${Math.round(accuracy)}м)`);
            
            if (!map) {
                Utils.log('❌ Карта не готова для геолокации');
                return;
            }
            
            // Удаляем старый маркер
            if (window.userMarker) map.removeLayer(window.userMarker);
            
            // ИСПРАВЛЕНО: маркер пользователя для мобильных
            const size = CONFIG.isMobile ? 26 : 22;
            const userIcon = L.divIcon({
                className: 'user-marker',
                html: `<div style="background:#2196F3;width:${size}px;height:${size}px;border-radius:50%;border:3px solid white;box-shadow:0 3px 12px rgba(33,150,243,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:${Math.floor(size*0.5)}px;font-weight:bold;">📍</div>`,
                iconSize: [size, size],
                iconAnchor: [size/2, size/2]
            });
            
            window.userMarker = L.marker([lat, lng], { icon: userIcon })
                .addTo(map)
                .bindPopup(`<strong>📍 Ваше местоположение</strong><br><small>${lat.toFixed(6)}, ${lng.toFixed(6)}</small>`);
            
            // Центрируем карту
            map.setView([lat, lng], Math.max(map.getZoom(), CONFIG.isMobile ? 14 : 15));
            
            Notification.show('Местоположение найдено!', 'success');
        },
        
        onError(error) {
            const messages = {
                1: 'Разрешите доступ к геолокации',
                2: 'Местоположение недоступно',
                3: 'Время ожидания истекло'
            };
            
            Utils.log('❌ Ошибка геолокации:', error.message);
            Notification.show(messages[error.code] || 'Ошибка геолокации', 'error');
        }
    };
    
    // ГЛАВНОЕ ПРИЛОЖЕНИЕ
    const App = {
        async init() {
            Utils.log(`🚀 Быстрый запуск PlasticBoy для ${CONFIG.isMobile ? 'мобильных' : 'десктопа'}...`);
            
            try {
                // Инициализация DOM кэша
                DOM.init();
                
                // ИСПРАВЛЕНО: проверяем что DOM элементы существуют
                if (!DOM.mapElement) {
                    throw new Error('Элемент карты не найден');
                }
                
                // Настройка кнопок
                this.initButtons();
                
                // Добавляем минимальные стили
                this.addStyles();
                
                // ИСПРАВЛЕНО: инициализация карты с проверкой
                await MapManager.init();
                
                // Проверяем что карта действительно создалась
                if (!map) {
                    throw new Error('Карта не была создана');
                }
                
                // Загрузка данных
                await this.loadData();
                
                Utils.log('✅ PlasticBoy готов к работе!');
                
            } catch (error) {
                Utils.log('❌ Критическая ошибка:', error.message);
                Notification.show('Ошибка загрузки приложения', 'error');
                
                // Попытка восстановления
                setTimeout(() => this.recover(), 2000);
            }
        },
        
        async loadData() {
            try {
                const points = await API.fetchPoints();
                
                if (points.length === 0) {
                    Utils.log('⚠️ Нет точек в базе данных');
                    Notification.show('Нет данных для отображения', 'info');
                    
                    // Уведомляем систему загрузки даже если нет точек
                    if (window.PlasticBoyLoader?.onPointsLoaded) {
                        window.PlasticBoyLoader.onPointsLoaded();
                    }
                    return;
                }
                
                // ИСПРАВЛЕНО: проверяем что карта готова перед обновлением
                if (!map || !isInitialized) {
                    Utils.log('❌ Карта не готова, ждем...');
                    setTimeout(() => this.loadData(), 1000);
                    return;
                }
                
                // Параллельное обновление
                MapManager.updateMarkers(points);
                Stats.update(points);
                
                // Уведомляем систему загрузки
                if (window.PlasticBoyLoader?.onPointsLoaded) {
                    window.PlasticBoyLoader.onPointsLoaded();
                }
                
            } catch (error) {
                Utils.log('❌ Ошибка загрузки данных:', error.message);
                Notification.show('Не удалось загрузить данные', 'error');
                
                // Уведомляем систему загрузки даже при ошибке
                if (window.PlasticBoyLoader?.onPointsLoaded) {
                    window.PlasticBoyLoader.onPointsLoaded();
                }
            }
        },
        
        initButtons() {
            const locationBtn = document.querySelector('.location-btn');
            if (locationBtn) {
                locationBtn.addEventListener('click', () => Location.get());
                
                // ИСПРАВЛЕНО: тач события для мобильных
                if (CONFIG.isMobile) {
                    locationBtn.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        locationBtn.style.transform = 'scale(0.95)';
                    });
                    
                    locationBtn.addEventListener('touchend', (e) => {
                        e.preventDefault();
                        locationBtn.style.transform = '';
                    });
                }
                
                Utils.log('✅ Кнопка геолокации настроена');
            }
        },
        
        addStyles() {
            if (document.getElementById('pb-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'pb-styles';
            style.textContent = `
                .pb-marker{background:none!important;border:none!important}
                .pb-marker div:hover{transform:scale(1.1)!important}
                
                /* ИСПРАВЛЕНО: стили для мобильных устройств */
                @media (max-width: 768px) {
                    .pb-marker div {
                        transition: transform 0.1s ease !important;
                    }
                    
                    .leaflet-popup-content {
                        font-size: 14px !important;
                        line-height: 1.4 !important;
                    }
                    
                    .leaflet-container {
                        font-size: 14px !important;
                    }
                    
                    .leaflet-control-zoom a {
                        width: 35px !important;
                        height: 35px !important;
                        line-height: 35px !important;
                        font-size: 16px !important;
                    }
                }
                
                /* Анимации */
                @keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
            `;
            document.head.appendChild(style);
        },
        
        // Восстановление при ошибках
        async recover() {
            Utils.log('🔄 Попытка восстановления...');
            try {
                if (!isInitialized) {
                    await MapManager.init();
                }
                await this.loadData();
                Notification.show('Восстановление успешно', 'success');
            } catch (error) {
                Utils.log('❌ Восстановление не удалось:', error.message);
            }
        }
    };
    
    // Экспорт для совместимости
    window.PlasticBoy = {
        map: () => map,
        markers: () => markers,
        loadPoints: () => App.loadData(),
        getLocation: () => Location.get(),
        refresh: () => App.recover(),
        isMobile: CONFIG.isMobile
    };
    
    // Псевдонимы
    window.showNotification = Notification.show;
    window.updateMap = MapManager.updateMarkers;
    window.updateStats = Stats.update;
    window.loadPoints = () => App.loadData();
    window.getCurrentLocation = () => Location.get();
    window.initMap = () => MapManager.init();
    
    // ИСПРАВЛЕНО: обработка изменения размера с учетом мобильных
    window.addEventListener('resize', Utils.debounce(() => {
        if (map) {
            map.invalidateSize();
            Utils.log('🔄 Карта пересчитана после изменения размера');
        }
    }, CONFIG.isMobile ? 500 : 300));
    
    // ИСПРАВЛЕНО: обработка поворота экрана для мобильных
    if (CONFIG.isMobile) {
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                if (map) {
                    map.invalidateSize();
                    Utils.log('📱 Карта обновлена после поворота экрана');
                }
            }, 500); // Больше времени для мобильных
        });
        
        // Обработка событий видимости страницы
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && map) {
                setTimeout(() => {
                    map.invalidateSize();
                    Utils.log('👁️ Карта обновлена после возврата в приложение');
                }, 300);
            }
        });
    }
    
    // Горячие клавиши (только для десктопа)
    if (!CONFIG.isMobile) {
        document.addEventListener('keydown', (e) => {
            if (!e.ctrlKey) return;
            
            switch (e.key) {
                case 'l':
                    e.preventDefault();
                    Location.get();
                    break;
                case 'r':
                    e.preventDefault();
                    App.recover();
                    break;
            }
        });
    }
    
    // АВТОЗАПУСК с оптимизацией для мобильных
    function start() {
        const startApp = () => {
            // ИСПРАВЛЕНО: дополнительная задержка для мобильных
            setTimeout(App.init, CONFIG.isMobile ? 200 : 50);
        };
        
        if (document.readyState === 'complete') {
            startApp();
        } else {
            // Ждем загрузки DOM
            const ready = () => {
                document.removeEventListener('DOMContentLoaded', ready);
                window.removeEventListener('load', ready);
                startApp();
            };
            
            document.addEventListener('DOMContentLoaded', ready);
            window.addEventListener('load', ready);
            
            // ИСПРАВЛЕНО: дополнительная безопасность для мобильных
            if (CONFIG.isMobile) {
                setTimeout(ready, 3000); // Принудительный запуск через 3 сек
            }
        }
    }
    
    start();
    
    Utils.log(`✅ Оптимизированный PlasticBoy загружен (${CONFIG.isMobile ? 'мобильный' : 'десктоп'} режим)`);
    
    // ИСПРАВЛЕНО: дополнительная диагностика для мобильных
    if (CONFIG.isMobile) {
        setTimeout(() => {
            Utils.log('📱 Мобильная диагностика:', {
                screenSize: `${window.innerWidth}x${window.innerHeight}`,
                devicePixelRatio: window.devicePixelRatio,
                touchSupport: 'ontouchstart' in window,
                mapElement: !!DOM.mapElement,
                leafletLoaded: typeof L !== 'undefined',
                mapInitialized: isInitialized
            });
        }, 2000);
    }
    
})();
