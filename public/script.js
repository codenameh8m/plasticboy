// PlasticBoy v2.0 - Упрощенная версия с модальным просмотром селфи
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
        addPhotoModalStyles();
    });
    
    // Добавление стилей для модального окна с фотографиями
    function addPhotoModalStyles() {
        if (document.getElementById('photo-modal-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'photo-modal-styles';
        style.textContent = `
            .photo-modal {
                display: none;
                position: fixed;
                z-index: 3000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100vh;
                background: rgba(0, 0, 0, 0.95);
                backdrop-filter: blur(15px);
                animation: photoModalFadeIn 0.3s ease-out;
                overflow: hidden;
            }
            
            .photo-modal.show {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                padding: 20px;
            }
            
            .photo-modal-content {
                position: relative;
                width: 100%;
                max-width: min(90vw, 600px);
                max-height: 85vh;
                background: rgba(255, 255, 255, 0.98);
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6);
                animation: photoModalSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                display: flex;
                flex-direction: column;
            }
            
            .photo-modal-image-container {
                position: relative;
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #f8f9fa, #e9ecef);
                min-height: 200px;
                overflow: hidden;
            }
            
            .photo-modal-image {
                max-width: 100%;
                max-height: 60vh;
                object-fit: contain;
                border-radius: 0;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                transition: transform 0.3s ease;
            }
            
            .photo-modal-info {
                padding: 20px;
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05));
                border-top: 1px solid rgba(0, 0, 0, 0.05);
                flex-shrink: 0;
            }
            
            .photo-modal-close {
                position: absolute;
                top: 15px;
                right: 15px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                border: none;
                border-radius: 50%;
                width: 44px;
                height: 44px;
                font-size: 22px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
                z-index: 20;
                backdrop-filter: blur(10px);
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            }
            
            .photo-modal-close:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
            }
            
            .photo-modal-title {
                margin: 0 0 15px 0;
                font-size: 1.3rem;
                font-weight: 700;
                color: #2c3e50;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .photo-modal-details {
                font-size: 0.95rem;
                color: #495057;
                line-height: 1.6;
            }
            
            .photo-modal-details p {
                margin: 8px 0;
                display: flex;
                align-items: flex-start;
                gap: 8px;
            }
            
            .photo-modal-details strong {
                color: #2c3e50;
                min-width: 90px;
                font-weight: 600;
            }
            
            .photo-modal-signature {
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
                padding: 15px;
                border-radius: 12px;
                margin-top: 15px;
                font-style: italic;
                border-left: 4px solid #667eea;
                box-shadow: 0 2px 10px rgba(102, 126, 234, 0.1);
            }
            
            .photo-modal-signature strong {
                color: #667eea;
                display: block;
                margin-bottom: 8px;
                font-style: normal;
            }
            
            .photo-modal-meta {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                margin-bottom: 15px;
            }
            
            .photo-modal-meta-item {
                background: rgba(255, 255, 255, 0.7);
                padding: 12px;
                border-radius: 10px;
                text-align: center;
                border: 1px solid rgba(0, 0, 0, 0.05);
            }
            
            .photo-modal-meta-item strong {
                display: block;
                color: #667eea;
                font-size: 0.85rem;
                margin-bottom: 4px;
                min-width: auto;
            }
            
            .photo-modal-meta-item span {
                color: #2c3e50;
                font-weight: 600;
                font-size: 0.9rem;
            }
            
            @keyframes photoModalFadeIn {
                from {
                    opacity: 0;
                    backdrop-filter: blur(0px);
                }
                to {
                    opacity: 1;
                    backdrop-filter: blur(15px);
                }
            }
            
            @keyframes photoModalSlideIn {
                from {
                    opacity: 0;
                    transform: scale(0.9) translateY(50px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            
            .photo-modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                cursor: pointer;
                z-index: 1;
            }
            
            /* Анимация закрытия */
            .photo-modal.closing {
                animation: photoModalFadeOut 0.3s ease-in;
            }
            
            .photo-modal.closing .photo-modal-content {
                animation: photoModalSlideOut 0.3s ease-in;
            }
            
            @keyframes photoModalFadeOut {
                from {
                    opacity: 1;
                    backdrop-filter: blur(15px);
                }
                to {
                    opacity: 0;
                    backdrop-filter: blur(0px);
                }
            }
            
            @keyframes photoModalSlideOut {
                from {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
                to {
                    opacity: 0;
                    transform: scale(0.9) translateY(50px);
                }
            }
            
            /* Мобильная адаптация */
            @media (max-width: 768px) {
                .photo-modal.show {
                    padding: 10px;
                }
                
                .photo-modal-content {
                    max-width: 95vw;
                    max-height: 90vh;
                    border-radius: 16px;
                }
                
                .photo-modal-image {
                    max-height: 50vh;
                }
                
                .photo-modal-info {
                    padding: 16px;
                }
                
                .photo-modal-close {
                    top: 12px;
                    right: 12px;
                    width: 40px;
                    height: 40px;
                    font-size: 20px;
                }
                
                .photo-modal-title {
                    font-size: 1.15rem;
                    margin-bottom: 12px;
                }
                
                .photo-modal-details {
                    font-size: 0.9rem;
                }
                
                .photo-modal-details strong {
                    min-width: 80px;
                    font-size: 0.85rem;
                }
                
                .photo-modal-meta {
                    grid-template-columns: 1fr;
                    gap: 10px;
                }
                
                .photo-modal-signature {
                    padding: 12px;
                    margin-top: 12px;
                }
            }
            
            @media (max-width: 480px) {
                .photo-modal.show {
                    padding: 5px;
                }
                
                .photo-modal-content {
                    max-width: 98vw;
                    max-height: 95vh;
                    border-radius: 12px;
                }
                
                .photo-modal-image {
                    max-height: 45vh;
                }
                
                .photo-modal-info {
                    padding: 14px;
                }
                
                .photo-modal-title {
                    font-size: 1.05rem;
                    margin-bottom: 10px;
                }
                
                .photo-modal-details {
                    font-size: 0.85rem;
                }
                
                .photo-modal-details p {
                    margin: 6px 0;
                    gap: 6px;
                }
                
                .photo-modal-details strong {
                    min-width: 70px;
                    font-size: 0.8rem;
                }
                
                .photo-modal-signature {
                    padding: 10px;
                    font-size: 0.85rem;
                }
                
                .photo-modal-meta-item {
                    padding: 10px;
                }
                
                .photo-modal-meta-item strong {
                    font-size: 0.8rem;
                }
                
                .photo-modal-meta-item span {
                    font-size: 0.85rem;
                }
            }
            
            /* Улучшение для кликабельных селфи в popup */
            .clickable-selfie {
                cursor: pointer;
                transition: all 0.3s ease;
                border-radius: 10px;
                overflow: hidden;
                position: relative;
                display: inline-block;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            }
            
            .clickable-selfie:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
            }
            
            .clickable-selfie::after {
                content: '👁️';
                position: absolute;
                top: 8px;
                right: 8px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                border-radius: 50%;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                opacity: 0;
                transition: opacity 0.3s ease;
                backdrop-filter: blur(5px);
            }
            
            .clickable-selfie:hover::after {
                opacity: 1;
            }
            
            @media (max-width: 768px) {
                .clickable-selfie::after {
                    opacity: 1;
                    background: rgba(0, 0, 0, 0.6);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Создание модального окна для фотографий
    function createPhotoModal() {
        if (document.getElementById('photoModal')) return;
        
        const modal = document.createElement('div');
        modal.id = 'photoModal';
        modal.className = 'photo-modal';
        modal.innerHTML = `
            <div class="photo-modal-overlay" onclick="closePhotoModal()"></div>
            <div class="photo-modal-content">
                <button class="photo-modal-close" onclick="closePhotoModal()">×</button>
                <div class="photo-modal-image-container">
                    <img id="photoModalImage" class="photo-modal-image" alt="Селфи с места находки">
                </div>
                <div class="photo-modal-info">
                    <h3 class="photo-modal-title" id="photoModalTitle">
                        📸 Селфи с места находки
                    </h3>
                    <div class="photo-modal-meta" id="photoModalMeta"></div>
                    <div class="photo-modal-details" id="photoModalDetails"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    // Открытие модального окна с фотографией
    function openPhotoModal(imageSrc, pointData) {
        createPhotoModal();
        
        const modal = document.getElementById('photoModal');
        const image = document.getElementById('photoModalImage');
        const title = document.getElementById('photoModalTitle');
        const meta = document.getElementById('photoModalMeta');
        const details = document.getElementById('photoModalDetails');
        
        // Устанавливаем данные
        image.src = imageSrc;
        title.innerHTML = `📸 ${pointData.name}`;
        
        // Мета информация в красивых карточках
        let metaHTML = '';
        if (pointData.collectorInfo) {
            metaHTML = `
                <div class="photo-modal-meta-item">
                    <strong>Сборщик</strong>
                    <span>${pointData.collectorInfo.name}</span>
                </div>
                <div class="photo-modal-meta-item">
                    <strong>Время сбора</strong>
                    <span>${new Date(pointData.collectedAt).toLocaleDateString('ru-RU')}</span>
                </div>
            `;
        }
        meta.innerHTML = metaHTML;
        
        // Детальная информация
        let detailsHTML = '';
        if (pointData.collectorInfo) {
            detailsHTML += `<p><strong>📍 Координаты:</strong> ${pointData.coordinates.lat.toFixed(4)}, ${pointData.coordinates.lng.toFixed(4)}</p>`;
            detailsHTML += `<p><strong>🕒 Полное время:</strong> ${new Date(pointData.collectedAt).toLocaleString('ru-RU')}</p>`;
            
            if (pointData.collectorInfo.signature) {
                detailsHTML += `
                    <div class="photo-modal-signature">
                        <strong>💬 Сообщение от сборщика:</strong>
                        "${pointData.collectorInfo.signature}"
                    </div>
                `;
            }
        }
        
        details.innerHTML = detailsHTML;
        
        // Показываем модальное окно
        modal.classList.add('show');
        
        // Предотвращаем скролл страницы
        document.body.style.overflow = 'hidden';
    }
    
    // Закрытие модального окна с фотографией
    window.closePhotoModal = function() {
        const modal = document.getElementById('photoModal');
        if (!modal) return;
        
        modal.classList.add('closing');
        
        setTimeout(() => {
            modal.classList.remove('show', 'closing');
            document.body.style.overflow = '';
        }, 300);
    };
    
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
                
                // Добавляем кликабельное селфи если есть
                if (point.collectorInfo.selfie) {
                    popupContent += '<div style="margin: 8px 0; text-align: center;">';
                    popupContent += '<div class="clickable-selfie" onclick="openPhotoModal(\'' + point.collectorInfo.selfie + '\', ' + JSON.stringify(point).replace(/"/g, '&quot;') + ')" style="display: inline-block; position: relative;">';
                    popupContent += '<img src="' + point.collectorInfo.selfie + '" style="max-width: 150px; max-height: 120px; border-radius: 8px; cursor: pointer;" title="Кликните для увеличения">';
                    popupContent += '</div>';
                    popupContent += '</div>';
                }
                
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
                        content += '<div class="clickable-selfie" onclick="openPhotoModal(\'' + point.collectorInfo.selfie + '\', ' + JSON.stringify(point).replace(/"/g, '&quot;') + ')" style="display: inline-block;">';
                        content += '<img src="' + point.collectorInfo.selfie + '" style="max-width: 100%; max-height: 200px; border-radius: 8px; cursor: pointer;" title="Кликните для увеличения">';
                        content += '</div>';
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
    
    // Делаем функцию openPhotoModal глобальной
    window.openPhotoModal = openPhotoModal;
    
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
    
    // Закрытие модального окна с фото по Escape
    window.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closePhotoModal();
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
