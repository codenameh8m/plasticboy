// МАКСИМАЛЬНО ОПТИМИЗИРОВАННЫЙ PlasticBoy - БЫСТРАЯ ЗАГРУЗКА ТОЧЕК
(function() {
    'use strict';
    
    // Конфигурация для максимальной производительности
    const CONFIG = {
        ALMATY_CENTER: [43.2220, 76.8512],
        API_TIMEOUT: 8000,
        RETRY_ATTEMPTS: 2,
        CACHE_DURATION: 30000, // 30 секунд
        isMobile: window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
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
    
    // МАКСИМАЛЬНО БЫСТРЫЙ API клиент
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
    
    // ОПТИМИЗИРОВАННОЕ управление картой
    const MapManager = {
        async init() {
            if (isInitialized) return;
            
            Utils.log('Быстрая инициализация карты...');
            
            // Проверяем готовность DOM
            if (!DOM.mapElement) {
                throw new Error('Элемент #map не найден');
            }
            
            // Ждем Leaflet с таймаутом
            await this.waitForLeaflet();
            
            // Создаем карту с оптимальными настройками
            map = L.map('map', {
                center: CONFIG.ALMATY_CENTER,
                zoom: CONFIG.isMobile ? 12 : 13,
                zoomControl: true,
                attributionControl: false,
                preferCanvas: true, // Для производительности
                maxZoom: 18,
                minZoom: 9,
                wheelDebounceTime: 40,
                wheelPxPerZoomLevel: 50
            });
            
            // Быстрые тайлы
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
                detectRetina: true,
                updateWhenIdle: true,
                keepBuffer: 2
            }).addTo(map);
            
            // Группа маркеров для быстрого управления
            markersLayer = L.layerGroup().addTo(map);
            
            // Глобальный доступ
            window.map = map;
            window.markersLayer = markersLayer;
            
            // Финальная настройка
            setTimeout(() => {
                map.invalidateSize();
                isInitialized = true;
                Utils.log('✅ Карта готова');
            }, 100);
        },
        
        async waitForLeaflet() {
            if (typeof L !== 'undefined') return;
            
            Utils.log('Ожидание Leaflet...');
            return new Promise((resolve, reject) => {
                const check = setInterval(() => {
                    if (typeof L !== 'undefined') {
                        clearInterval(check);
                        resolve();
                    }
                }, 50);
                
                setTimeout(() => {
                    clearInterval(check);
                    reject(new Error('Leaflet не загрузился за 10 секунд'));
                }, 10000);
            });
        },
        
        // БЫСТРОЕ обновление маркеров с батчингом
        updateMarkers(points) {
            if (!map || !markersLayer) return;
            
            const startTime = Utils.now();
            Utils.log(`Обновление ${points.length} маркеров...`);
            
            // Очищаем все маркеры одним вызовом
            markersLayer.clearLayers();
            markers.length = 0;
            
            // Батчинг для больших объемов данных
            const batchSize = CONFIG.isMobile ? 20 : 50;
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
                        this.autoFit();
                    }
                }
            };
            
            processBatch();
        },
        
        // Создание одного маркера - оптимизировано
        createMarker(point) {
            try {
                const lat = +point.coordinates.lat;
                const lng = +point.coordinates.lng;
                
                if (!Utils.validateCoords(lat, lng)) return;
                
                const isAvailable = point.status === 'available';
                const color = isAvailable ? '#4CAF50' : '#f44336';
                const emoji = isAvailable ? '📦' : '✅';
                const size = CONFIG.isMobile ? 28 : 24;
                
                // Минимальная HTML иконка
                const icon = L.divIcon({
                    className: 'pb-marker',
                    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:${Math.floor(size*0.5)}px;color:white;cursor:pointer;transition:transform 0.2s">${emoji}</div>`,
                    iconSize: [size, size],
                    iconAnchor: [size/2, size/2]
                });
                
                const marker = L.marker([lat, lng], { icon });
                
                // Компактный popup
                const popup = this.createPopup(point, isAvailable);
                marker.bindPopup(popup, {
                    maxWidth: CONFIG.isMobile ? 280 : 250,
                    autoPan: CONFIG.isMobile,
                    closeButton: true
                });
                
                markersLayer.addLayer(marker);
                markers.push(marker);
                
            } catch (error) {
                Utils.log(`❌ Ошибка создания маркера: ${error.message}`);
            }
        },
        
        // Компактный popup
        createPopup(point, isAvailable) {
            const lat = (+point.coordinates.lat).toFixed(6);
            const lng = (+point.coordinates.lng).toFixed(6);
            
            let popup = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;">
                <h3 style="margin:0 0 8px 0;color:#333;font-size:14px;">${point.name}</h3>
                <div style="margin:6px 0;font-weight:600;color:${isAvailable ? '#4CAF50' : '#f44336'};">
                    ${isAvailable ? '🟢 Доступна' : '🔴 Собрана'}
                </div>
                <p style="margin:4px 0;font-size:12px;color:#666;">📍 ${lat}, ${lng}</p>`;
            
            if (point.createdAt) {
                popup += `<p style="margin:4px 0;font-size:12px;color:#666;">🕐 ${new Date(point.createdAt).toLocaleDateString('ru-RU')}</p>`;
            }
            
            if (!isAvailable && point.collectorInfo?.name) {
                popup += `<div style="background:#f5f5f5;padding:6px;border-radius:4px;margin:6px 0;font-size:12px;">
                    <strong>Собрал:</strong> ${point.collectorInfo.name}`;
                
                if (point.collectorInfo.signature) {
                    popup += `<br><em>"${point.collectorInfo.signature}"</em>`;
                }
                popup += '</div>';
            }
            
            return popup + '</div>';
        },
        
        // Автофокус на мобильных
        autoFit() {
            if (CONFIG.isMobile && markers.length > 0) {
                setTimeout(() => {
                    try {
                        const group = new L.featureGroup(markers);
                        const bounds = group.getBounds();
                        if (bounds.isValid()) {
                            map.fitBounds(bounds, { 
                                padding: [20, 20], 
                                maxZoom: 15 
                            });
                        }
                    } catch (error) {
                        Utils.log('❌ Ошибка автофокуса:', error.message);
                    }
                }, 300);
            }
        }
    };
    
    // БЫСТРАЯ статистика
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
    
    // БЫСТРАЯ геолокация
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
                        timeout: 12000,
                        maximumAge: 300000
                    }
                );
            });
        },
        
        onSuccess(position) {
            const { latitude: lat, longitude: lng, accuracy } = position.coords;
            
            Utils.log(`Геолокация: ${lat.toFixed(6)}, ${lng.toFixed(6)} (±${Math.round(accuracy)}м)`);
            
            // Удаляем старый маркер
            if (window.userMarker) map.removeLayer(window.userMarker);
            
            // Создаем новый маркер пользователя
            const userIcon = L.divIcon({
                className: 'user-marker',
                html: `<div style="background:#2196F3;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 3px 12px rgba(33,150,243,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;">📍</div>`,
                iconSize: [22, 22],
                iconAnchor: [11, 11]
            });
            
            window.userMarker = L.marker([lat, lng], { icon: userIcon })
                .addTo(map)
                .bindPopup(`<strong>📍 Ваше местоположение</strong><br><small>${lat.toFixed(6)}, ${lng.toFixed(6)}</small>`);
            
            // Центрируем карту
            map.setView([lat, lng], Math.max(map.getZoom(), 15));
            
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
            Utils.log('🚀 Быстрый запуск PlasticBoy...');
            
            try {
                // Инициализация DOM кэша
                DOM.init();
                
                // Настройка кнопок
                this.initButtons();
                
                // Добавляем минимальные стили
                this.addStyles();
                
                // Инициализация карты
                await MapManager.init();
                
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
        refresh: () => App.recover()
    };
    
    // Псевдонимы
    window.showNotification = Notification.show;
    window.updateMap = MapManager.updateMarkers;
    window.updateStats = Stats.update;
    window.loadPoints = () => App.loadData();
    window.getCurrentLocation = () => Location.get();
    
    // Обработка изменения размера
    window.addEventListener('resize', Utils.debounce(() => {
        if (map) map.invalidateSize();
    }, 300));
    
    // Горячие клавиши
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
    
    // АВТОЗАПУСК с оптимизацией
    function start() {
        if (document.readyState === 'complete') {
            App.init();
        } else {
            // Ждем загрузки DOM
            const ready = () => {
                document.removeEventListener('DOMContentLoaded', ready);
                window.removeEventListener('load', ready);
                setTimeout(App.init, 50);
            };
            
            document.addEventListener('DOMContentLoaded', ready);
            window.addEventListener('load', ready);
        }
    }
    
    start();
    
    Utils.log(`✅ Оптимизированный PlasticBoy загружен (${CONFIG.isMobile ? 'мобильный' : 'десктоп'} режим)`);
    
})();
