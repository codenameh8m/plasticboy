// ОПТИМИЗИРОВАННАЯ версия PlasticBoy - универсальная для всех устройств
(function() {
    'use strict';
    
    // Конфигурация
    const CONFIG = {
        ALMATY_CENTER: [43.2220, 76.8512],
        API_TIMEOUT: 15000,
        LEAFLET_TIMEOUT: 10000,
        NOTIFICATION_DURATION: 5000,
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                 ('ontouchstart' in window && window.innerWidth <= 768)
    };
    
    // Глобальные переменные
    let map, markersLayer, markers = [], pointsCache = null, isInitialized = false;
    
    // Утилиты
    const Utils = {
        log: (msg, data) => console.log(`🎯 [PlasticBoy] ${msg}`, data || ''),
        
        validateCoords: (lat, lng) => {
            const numLat = Number(lat), numLng = Number(lng);
            return !isNaN(numLat) && !isNaN(numLng) && 
                   numLat >= -90 && numLat <= 90 && 
                   numLng >= -180 && numLng <= 180;
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
        },
        
        debounce: (func, delay) => {
            let timeoutId;
            return (...args) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(null, args), delay);
            };
        }
    };
    
    // Стили (объединенные и минимизированные)
    const STYLES = `
        .pb-marker{background:none!important;border:none!important}
        .pb-dot{
            width:${CONFIG.isMobile ? '32px' : '24px'};
            height:${CONFIG.isMobile ? '32px' : '24px'};
            border-radius:50%;border:3px solid white;
            box-shadow:0 4px 12px rgba(0,0,0,0.3);cursor:pointer;
            transition:all 0.3s ease;display:flex;align-items:center;
            justify-content:center;font-size:${CONFIG.isMobile ? '14px' : '12px'};
            font-weight:bold;color:white;position:relative;
            touch-action:manipulation
        }
        .pb-dot:hover,.pb-dot:active{transform:scale(1.1);box-shadow:0 6px 16px rgba(0,0,0,0.4)}
        .pb-dot.available{background:linear-gradient(45deg,#4CAF50,#45a049)}
        .pb-dot.collected{background:linear-gradient(45deg,#f44336,#e53935)}
        .pb-dot.available::before{content:'📦'}
        .pb-dot.collected::before{content:'✅'}
        .pb-popup{
            min-width:${CONFIG.isMobile ? '250px' : '220px'};
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
            font-size:${CONFIG.isMobile ? '15px' : '14px'}
        }
        .pb-popup h3{margin:0 0 10px 0;color:#333;font-size:1.1rem;font-weight:600}
        .pb-status{
            margin:8px 0;font-weight:600;padding:6px 12px;
            border-radius:20px;text-align:center;font-size:0.9rem
        }
        .pb-status.available{background:#e8f5e8;color:#2e7d32}
        .pb-status.collected{background:#ffebee;color:#c62828}
        .pb-collector{
            background:#f8f9fa;padding:12px;border-radius:8px;
            margin:10px 0;border-left:4px solid #667eea
        }
        .pb-collector p{margin:4px 0;font-size:0.9rem}
        .pb-notification{
            position:fixed;top:20px;right:20px;z-index:3000;
            background:white;border-radius:8px;padding:16px 20px;
            box-shadow:0 4px 20px rgba(0,0,0,0.15);max-width:350px;
            font-size:14px;font-weight:500;display:flex;align-items:center;
            gap:10px;animation:slideIn 0.3s ease-out
        }
        .pb-notification.error{border-left:4px solid #f44336}
        .pb-notification.success{border-left:4px solid #4CAF50}
        .pb-notification.info{border-left:4px solid #2196F3}
        .pb-notification button{
            background:none;border:none;font-size:18px;cursor:pointer;
            color:#999;padding:0;margin:0;margin-left:10px
        }
        @keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes userPulse{0%{transform:scale(1);opacity:0.7}50%{opacity:0.3}100%{transform:scale(2);opacity:0}}
        ${CONFIG.isMobile ? `
            .pb-notification{left:10px;right:10px}
            .leaflet-popup-close-button{width:32px!important;height:32px!important;font-size:20px!important}
        ` : ''}
    `;
    
    // Уведомления
    const Notification = {
        show: (message, type = 'info') => {
            const icons = { error: '❌', success: '✅', info: 'ℹ️', warning: '⚠️' };
            const notification = Utils.createElement('div', `pb-notification ${type}`);
            
            notification.innerHTML = `
                <span>${icons[type]}</span>
                <span style="flex:1">${message}</span>
                <button onclick="this.parentElement.remove()">×</button>
            `;
            
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), CONFIG.NOTIFICATION_DURATION);
            Utils.log(`Уведомление: [${type}] ${message}`);
        }
    };
    
    // API
    const API = {
        async fetchPoints() {
            Utils.log('Загрузка точек...');
            
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);
            
            try {
                const response = await fetch('/api/points', {
                    method: 'GET',
                    headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
                    signal: controller.signal
                });
                
                clearTimeout(timeout);
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const points = await response.json();
                if (!Array.isArray(points)) throw new Error('Неверный формат данных');
                
                Utils.log(`✅ Загружено ${points.length} точек`);
                return points;
                
            } catch (error) {
                clearTimeout(timeout);
                if (error.name === 'AbortError') throw new Error('Таймаут загрузки');
                throw error;
            }
        }
    };
    
    // Карта
    const MapManager = {
        async init() {
            if (isInitialized) return;
            Utils.log('Инициализация карты...');
            
            if (!document.getElementById('map')) throw new Error('Элемент #map не найден');
            
            // Ожидание Leaflet
            await this.waitForLeaflet();
            
            // Создание карты
            map = L.map('map', {
                center: CONFIG.ALMATY_CENTER,
                zoom: CONFIG.isMobile ? 12 : 13,
                zoomControl: true,
                attributionControl: !CONFIG.isMobile,
                preferCanvas: CONFIG.isMobile,
                maxZoom: 18,
                minZoom: 10,
                tap: CONFIG.isMobile,
                touchZoom: CONFIG.isMobile,
                scrollWheelZoom: !CONFIG.isMobile
            });
            
            // Тайлы
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: CONFIG.isMobile ? '' : '© OpenStreetMap contributors',
                maxZoom: 18,
                detectRetina: true
            }).addTo(map);
            
            // Группа маркеров
            markersLayer = L.layerGroup().addTo(map);
            
            // Глобальный доступ
            window.map = map;
            window.markersLayer = markersLayer;
            
            // Обновление размера
            setTimeout(() => map.invalidateSize(), 200);
            
            isInitialized = true;
            Utils.log('✅ Карта готова');
        },
        
        async waitForLeaflet() {
            if (typeof L !== 'undefined') return;
            
            Utils.log('Ожидание Leaflet...');
            const startTime = Date.now();
            
            return new Promise((resolve, reject) => {
                const check = setInterval(() => {
                    if (typeof L !== 'undefined') {
                        clearInterval(check);
                        resolve();
                    } else if (Date.now() - startTime > CONFIG.LEAFLET_TIMEOUT) {
                        clearInterval(check);
                        reject(new Error('Leaflet не загрузился'));
                    }
                }, 100);
            });
        },
        
        updateMarkers(points) {
            if (!map || !markersLayer) return;
            
            Utils.log('Обновление маркеров...');
            
            // Очистка
            markersLayer.clearLayers();
            markers.length = 0;
            
            let successCount = 0;
            
            points.forEach((point, index) => {
                try {
                    const lat = Number(point.coordinates.lat);
                    const lng = Number(point.coordinates.lng);
                    
                    if (!Utils.validateCoords(lat, lng)) {
                        throw new Error(`Неверные координаты: ${lat}, ${lng}`);
                    }
                    
                    const isAvailable = point.status === 'available';
                    
                    // Иконка
                    const icon = L.divIcon({
                        className: 'pb-marker',
                        html: `<div class="pb-dot ${isAvailable ? 'available' : 'collected'}"></div>`,
                        iconSize: [CONFIG.isMobile ? 32 : 24, CONFIG.isMobile ? 32 : 24],
                        iconAnchor: [CONFIG.isMobile ? 16 : 12, CONFIG.isMobile ? 16 : 12]
                    });
                    
                    // Маркер
                    const marker = L.marker([lat, lng], { icon });
                    
                    // Popup
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
                            <div class="pb-collector">
                                <p><strong>Собрал:</strong> ${point.collectorInfo.name}</p>
                                ${point.collectorInfo.signature ? `<p><strong>Сообщение:</strong> ${point.collectorInfo.signature}</p>` : ''}
                                ${point.collectedAt ? `<p><strong>Время:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>` : ''}
                            </div>
                        `;
                    }
                    
                    popup += '</div>';
                    
                    marker.bindPopup(popup, {
                        maxWidth: CONFIG.isMobile ? 300 : 280,
                        autoPan: CONFIG.isMobile,
                        autoPanPadding: [20, 20]
                    });
                    
                    markersLayer.addLayer(marker);
                    markers.push(marker);
                    successCount++;
                    
                } catch (error) {
                    Utils.log(`❌ Ошибка маркера ${index + 1}:`, error.message);
                }
            });
            
            window.markers = markers;
            
            Utils.log(`✅ Добавлено ${successCount} маркеров`);
            
            // Автофокус для мобильных
            if (CONFIG.isMobile && successCount > 0) {
                setTimeout(() => {
                    const group = new L.featureGroup(markers);
                    if (group.getBounds().isValid()) {
                        map.fitBounds(group.getBounds(), { padding: [20, 20], maxZoom: 15 });
                    }
                }, 500);
            }
            
            if (successCount > 0) {
                Notification.show(`Загружено ${successCount} точек на карту`, 'success');
            }
        }
    };
    
    // Статистика
    const Stats = {
        update(points) {
            const available = points.filter(p => p.status === 'available').length;
            const collected = points.filter(p => p.status === 'collected').length;
            
            this.updateElement('availableCount', available);
            this.updateElement('collectedCount', collected);
            
            Utils.log('Статистика:', { available, collected });
        },
        
        updateElement(id, value) {
            const element = document.getElementById(id);
            if (!element) return;
            
            const current = parseInt(element.textContent) || 0;
            if (current === value) return;
            
            // Простая анимация
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
        getCurrentPosition() {
            Utils.log('Запрос геолокации...');
            
            const locationBtn = document.querySelector('.location-btn');
            if (!locationBtn) return;
            
            if (!navigator.geolocation) {
                Notification.show('Геолокация не поддерживается', 'error');
                return;
            }
            
            const originalText = locationBtn.innerHTML;
            locationBtn.innerHTML = '⏳ Поиск...';
            locationBtn.disabled = true;
            
            const options = {
                enableHighAccuracy: true,
                timeout: CONFIG.isMobile ? 20000 : 15000,
                maximumAge: 300000
            };
            
            navigator.geolocation.getCurrentPosition(
                (position) => this.onLocationSuccess(position, locationBtn, originalText),
                (error) => this.onLocationError(error, locationBtn, originalText),
                options
            );
        },
        
        onLocationSuccess(position, btn, originalText) {
            const { latitude: lat, longitude: lng, accuracy } = position.coords;
            
            Utils.log('Геолокация получена:', { lat, lng, accuracy });
            
            // Иконка пользователя
            const userIcon = L.divIcon({
                className: 'pb-user-marker',
                html: `<div style="
                    background:linear-gradient(45deg,#2196F3,#1976D2);
                    width:${CONFIG.isMobile ? '24px' : '20px'};
                    height:${CONFIG.isMobile ? '24px' : '20px'};
                    border-radius:50%;border:3px solid white;
                    box-shadow:0 4px 12px rgba(33,150,243,0.4);
                    display:flex;align-items:center;justify-content:center;
                    color:white;font-weight:bold;font-size:10px;position:relative
                ">👤<div style="
                    position:absolute;top:-3px;left:-3px;right:-3px;bottom:-3px;
                    border:2px solid #2196F3;border-radius:50%;opacity:0.6;
                    animation:userPulse 2s infinite
                "></div></div>`,
                iconSize: [CONFIG.isMobile ? 24 : 20, CONFIG.isMobile ? 24 : 20],
                iconAnchor: [CONFIG.isMobile ? 12 : 10, CONFIG.isMobile ? 12 : 10]
            });
            
            // Удаляем предыдущий маркер
            if (window.userMarker) map.removeLayer(window.userMarker);
            
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
                `);
            
            // Центрируем карту
            const zoom = Math.max(map.getZoom(), CONFIG.isMobile ? 14 : 15);
            map.setView([lat, lng], zoom);
            
            Notification.show('Местоположение определено!', 'success');
            
            btn.innerHTML = originalText;
            btn.disabled = false;
        },
        
        onLocationError(error, btn, originalText) {
            Utils.log('❌ Ошибка геолокации:', error);
            
            const messages = {
                1: 'Разрешите доступ к геолокации',
                2: 'Местоположение недоступно',
                3: 'Время ожидания истекло'
            };
            
            Notification.show(messages[error.code] || 'Ошибка геолокации', 'error');
            
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    };
    
    // Тестовые данные
    const TestData = {
        createPoints() {
            Utils.log('Создание тестовых точек...');
            
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
                    collectorInfo: { name: 'Тестовый пользователь', signature: 'Первая находка!' },
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
        }
    };
    
    // Главное приложение
    const App = {
        async init() {
            Utils.log('Запуск PlasticBoy...');
            
            try {
                // Стили
                Utils.addStyles('pb-styles', STYLES);
                
                // Кнопки
                this.initButtons();
                
                // Карта
                await MapManager.init();
                
                // Точки
                await this.loadPoints();
                
                Utils.log('✅ PlasticBoy готов');
                
            } catch (error) {
                Utils.log('❌ Ошибка инициализации:', error);
                Notification.show('Ошибка загрузки приложения', 'error');
            }
        },
        
        async loadPoints() {
            try {
                const points = await API.fetchPoints();
                pointsCache = points;
                MapManager.updateMarkers(points);
                Stats.update(points);
                
                // Уведомляем загрузчик
                if (typeof window.PlasticBoyLoader?.onPointsLoaded === 'function') {
                    window.PlasticBoyLoader.onPointsLoaded();
                }
                
            } catch (error) {
                Utils.log('❌ Ошибка загрузки точек:', error);
                Notification.show('Ошибка загрузки данных: ' + error.message, 'error');
                
                // Тестовые данные для отладки
                if (location.hostname === 'localhost' || location.search.includes('debug')) {
                    TestData.createPoints();
                }
                
                // Уведомляем загрузчик даже при ошибке
                if (typeof window.PlasticBoyLoader?.onPointsLoaded === 'function') {
                    window.PlasticBoyLoader.onPointsLoaded();
                }
            }
        },
        
        initButtons() {
            const locationBtn = document.querySelector('.location-btn');
            if (locationBtn) {
                locationBtn.addEventListener('click', Location.getCurrentPosition);
                Utils.log('✅ Кнопка геолокации настроена');
            }
        }
    };
    
    // События
    window.addEventListener('resize', Utils.debounce(() => {
        if (map) map.invalidateSize();
    }, 250));
    
    // Горячие клавиши
    document.addEventListener('keydown', (e) => {
        if (!e.ctrlKey) return;
        
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
                console.group('🎯 PlasticBoy Диагностика');
                console.log('Устройство:', CONFIG.isMobile ? 'Мобильное' : 'Десктоп');
                console.log('Инициализировано:', isInitialized);
                console.log('Карта:', !!map);
                console.log('Маркеры:', markers.length);
                console.log('Кэш точек:', pointsCache?.length || 0);
                console.groupEnd();
                Notification.show('Диагностика в консоли', 'info');
                break;
        }
    });
    
    // Экспорт
    window.PlasticBoy = {
        map: () => map,
        markers: () => markers,
        loadPoints: () => App.loadPoints(),
        getLocation: Location.getCurrentPosition,
        isReady: () => isInitialized,
        getCache: () => pointsCache
    };
    
    // Псевдонимы для совместимости
    window.showNotification = Notification.show;
    window.updateMap = MapManager.updateMarkers;
    window.updateStats = Stats.update;
    window.loadPoints = () => App.loadPoints();
    window.getCurrentLocation = Location.getCurrentPosition;
    
    // Автозапуск
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(App.init, 100));
    } else {
        setTimeout(App.init, 100);
    }
    
    Utils.log('✅ PlasticBoy оптимизированный скрипт загружен');
    Utils.log(`Режим: ${CONFIG.isMobile ? 'МОБИЛЬНЫЙ' : 'ДЕСКТОП'}`);
    
})();
