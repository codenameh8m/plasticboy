// PlasticBoy v2.0 - Упрощенная версия
(function() {
    'use strict';
    
    // Глобальные переменные
    let map = null;
    let markers = [];
    let isInitialized = false;
    
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
    
    // Ожидание загрузки DOM
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🎯 PlasticBoy - Инициализация');
        initApp();
    });
    
    // Инициализация приложения
    function initApp() {
        // Проверяем наличие Leaflet
        if (typeof L === 'undefined') {
            console.log('⏳ Ожидание загрузки Leaflet...');
            setTimeout(initApp, 100);
            return;
        }
        
        // Уведомляем загрузчик
        if (window.AppLoader && window.AppLoader.onLeafletReady) {
            window.AppLoader.onLeafletReady();
        }
        
        // Инициализируем карту
        initMap();
    }
    
    // Инициализация карты
    function initMap() {
        if (isInitialized) return;
        
        const mapElement = document.getElementById('map');
        if (!mapElement) {
            console.error('❌ Элемент карты не найден');
            return;
        }
        
        try {
            console.log('🗺️ Создание карты');
            
            map = L.map('map', {
                center: ALMATY_CENTER,
                zoom: 13,
                zoomControl: true
            });
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(map);
            
            // Добавляем стили
            addMapStyles();
            
            // Уведомляем загрузчик
            if (window.AppLoader && window.AppLoader.onMapReady) {
                window.AppLoader.onMapReady();
            }
            
            // Обновляем размер карты
            setTimeout(function() {
                map.invalidateSize();
                console.log('✅ Карта готова');
                
                // Загружаем точки
                loadPoints();
            }, 200);
            
            isInitialized = true;
            
            // Автообновление каждые 30 секунд
            setInterval(function() {
                loadPoints();
            }, 30000);
            
        } catch (error) {
            console.error('❌ Ошибка создания карты:', error);
            setTimeout(initMap, 2000);
        }
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
            }
        `;
        document.head.appendChild(style);
    }
    
    // Загрузка точек
    function loadPoints() {
        console.log('📍 Загрузка точек');
        
        // Сначала проверяем кэш
        const cachedPoints = Cache.load();
        if (cachedPoints) {
            updateMap(cachedPoints);
            updateStats(cachedPoints);
            
            if (window.AppLoader && window.AppLoader.onPointsLoaded) {
                window.AppLoader.onPointsLoaded();
            }
            
            // Обновляем в фоне
            setTimeout(fetchPointsFromServer, 1000);
            return;
        }
        
        // Загружаем с сервера
        fetchPointsFromServer();
    }
    
    // Загрузка с сервера
    function fetchPointsFromServer() {
        fetch('/api/points', {
            headers: { 'Accept': 'application/json' }
        })
        .then(function(response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.json();
        })
        .then(function(points) {
            console.log('✅ Загружено ' + points.length + ' точек');
            
            // Сохраняем в кэш
            Cache.save(points);
            
            // Обновляем карту
            updateMap(points);
            updateStats(points);
            
            // Уведомляем загрузчик
            if (window.AppLoader && window.AppLoader.onPointsLoaded) {
                window.AppLoader.onPointsLoaded();
            }
        })
        .catch(function(error) {
            console.error('❌ Ошибка загрузки точек:', error);
            
            // Уведомляем загрузчик даже при ошибке
            if (window.AppLoader && window.AppLoader.onPointsLoaded) {
                window.AppLoader.onPointsLoaded();
            }
        });
    }
    
    // Обновление карты
    function updateMap(points) {
        if (!map || !points) return;
        
        console.log('🗺️ Обновление карты');
        
        // Очищаем старые маркеры
        markers.forEach(function(marker) {
            map.removeLayer(marker);
        });
        markers = [];
        
        // Добавляем новые маркеры
        points.forEach(function(point) {
            const isAvailable = point.status === 'available';
            
            const icon = L.divIcon({
                className: 'marker-icon',
                html: '<div class="marker-dot ' + (isAvailable ? 'available' : 'collected') + '"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            
            const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon: icon });
            
            // Создаем содержимое popup
            let popupContent = '<div style="min-width: 200px;">';
            popupContent += '<h3 style="margin: 0 0 10px 0;">' + point.name + '</h3>';
            popupContent += '<p style="font-weight: 600; color: ' + (isAvailable ? '#4CAF50' : '#f44336') + ';">';
            popupContent += isAvailable ? '🟢 Доступна' : '🔴 Собрана';
            popupContent += '</p>';
            
            if (!isAvailable && point.collectorInfo) {
                popupContent += '<div style="background: #f8f9fa; padding: 8px; border-radius: 6px; margin: 8px 0;">';
                popupContent += '<p style="margin: 4px 0;"><strong>Собрал:</strong> ' + point.collectorInfo.name + '</p>';
                if (point.collectorInfo.signature) {
                    popupContent += '<p style="margin: 4px 0;"><strong>Сообщение:</strong> ' + point.collectorInfo.signature + '</p>';
                }
                popupContent += '<p style="margin: 4px 0;"><strong>Время:</strong> ' + new Date(point.collectedAt).toLocaleString('ru-RU') + '</p>';
                popupContent += '</div>';
                popupContent += '<button onclick="showPointDetails(\'' + point.id + '\')" style="background: #667eea; color: white; border: none; padding: 8px 12px; border-radius: 6px; width: 100%; cursor: pointer;">Подробнее</button>';
            }
            
            popupContent += '</div>';
            
            marker.bindPopup(popupContent);
            marker.addTo(map);
            markers.push(marker);
        });
        
        console.log('✅ Добавлено ' + markers.length + ' маркеров');
    }
    
    // Обновление статистики
    function updateStats(points) {
        const available = points.filter(function(p) { return p.status === 'available'; }).length;
        const collected = points.filter(function(p) { return p.status === 'collected'; }).length;
        
        const availableEl = document.getElementById('availableCount');
        const collectedEl = document.getElementById('collectedCount');
        
        if (availableEl) availableEl.textContent = available;
        if (collectedEl) collectedEl.textContent = collected;
        
        console.log('📊 Статистика: ' + available + ' доступно, ' + collected + ' собрано');
    }
    
    // Геолокация
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
                if (window.userMarker) {
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
            }
        );
    };
    
    // Детали точки
    window.showPointDetails = function(pointId) {
        fetch('/api/point/' + pointId + '/info')
            .then(function(response) { return response.json(); })
            .then(function(point) {
                let content = '<h3>' + point.name + '</h3>';
                content += '<p><strong>Статус:</strong> ' + (point.status === 'collected' ? '🔴 Собрана' : '🟢 Доступна') + '</p>';
                
                if (point.status === 'collected' && point.collectorInfo) {
                    content += '<hr>';
                    content += '<p><strong>Собрал:</strong> ' + point.collectorInfo.name + '</p>';
                    if (point.collectorInfo.signature) {
                        content += '<p><strong>Сообщение:</strong> ' + point.collectorInfo.signature + '</p>';
                    }
                    content += '<p><strong>Время:</strong> ' + new Date(point.collectedAt).toLocaleString('ru-RU') + '</p>';
                    
                    if (point.collectorInfo.selfie) {
                        content += '<div style="text-align: center; margin-top: 15px;">';
                        content += '<img src="' + point.collectorInfo.selfie + '" style="max-width: 100%; max-height: 200px; border-radius: 8px;">';
                        content += '</div>';
                    }
                }
                
                document.getElementById('modalTitle').innerHTML = 'Информация о модели';
                document.getElementById('modalBody').innerHTML = content;
                document.getElementById('infoModal').style.display = 'block';
            })
            .catch(function(error) {
                console.error('❌ Ошибка загрузки деталей:', error);
            });
    };
    
    // Закрытие модального окна
    window.closeModal = function() {
        document.getElementById('infoModal').style.display = 'none';
    };
    
    // Обработчики событий
    window.addEventListener('click', function(e) {
        if (e.target === document.getElementById('infoModal')) {
            closeModal();
        }
    });
    
    window.addEventListener('resize', function() {
        if (map) {
            setTimeout(function() { map.invalidateSize(); }, 100);
        }
    });
    
    console.log('🚀 PlasticBoy готов к работе');
})();
