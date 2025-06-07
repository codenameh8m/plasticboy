// PlasticBoy v2.0 - Исправленная версия с улучшенной загрузкой и Telegram интеграцией
(function() {
    'use strict';
    
    console.log('🎯 PlasticBoy - Инициализация скрипта');
    
    // Глобальные переменные
    let map = null;
    let markers = [];
    let isInitialized = false;
    let initAttempts = 0;
    const MAX_INIT_ATTEMPTS = 10;
    
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
    
    // Проверка готовности DOM
    function waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }
    
    // Проверка загрузки Leaflet
    function waitForLeaflet() {
        return new Promise((resolve, reject) => {
            const checkLeaflet = () => {
                if (typeof L !== 'undefined' && L.map) {
                    console.log('✅ Leaflet загружен');
                    resolve();
                } else {
                    setTimeout(checkLeaflet, 100);
                }
            };
            
            checkLeaflet();
            
            // Таймаут для загрузки Leaflet
            setTimeout(() => {
                if (typeof L === 'undefined') {
                    console.error('❌ Leaflet не загрузился за 10 секунд');
                    reject(new Error('Leaflet timeout'));
                }
            }, 10000);
        });
    }
    
    // Основная инициализация
    async function init() {
        try {
            console.log('🚀 Начинаем инициализацию PlasticBoy');
            
            // Ждем DOM
            await waitForDOM();
            console.log('✅ DOM готов');
            
            // Уведомляем загрузчик о готовности DOM
            if (window.AppLoader && window.AppLoader.updateLoader) {
                window.AppLoader.updateLoader();
            }
            
            // Ждем Leaflet
            await waitForLeaflet();
            
            // Уведомляем загрузчик о готовности Leaflet
            if (window.AppLoader && window.AppLoader.onLeafletReady) {
                window.AppLoader.onLeafletReady();
            }
            
            // Инициализируем карту
            await initMap();
            
            // Загружаем точки
            await loadPoints();
            
            console.log('🎉 PlasticBoy успешно инициализирован');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            
            // Попытаемся переинициализировать через 2 секунды
            if (initAttempts < MAX_INIT_ATTEMPTS) {
                initAttempts++;
                console.log(`🔄 Попытка переинициализации ${initAttempts}/${MAX_INIT_ATTEMPTS}`);
                setTimeout(init, 2000);
            } else {
                console.error('💥 Превышено максимальное количество попыток инициализации');
                showErrorMessage('Не удалось загрузить приложение. Попробуйте обновить страницу.');
            }
        }
    }
    
    // Инициализация карты
    function initMap() {
        return new Promise((resolve, reject) => {
            if (isInitialized) {
                resolve();
                return;
            }
            
            const mapElement = document.getElementById('map');
            if (!mapElement) {
                reject(new Error('Элемент карты не найден'));
                return;
            }
            
            try {
                console.log('🗺️ Создание карты');
                
                // Проверяем, что Leaflet действительно доступен
                if (typeof L === 'undefined' || !L.map) {
                    throw new Error('Leaflet не загружен');
                }
                
                map.flyTo([lat, lng], 16);
                console.log('✅ Местоположение найдено');
                
                btn.innerHTML = originalText;
                btn.disabled = false;
            },
            function(error) {
                console.error('❌ Ошибка геолокации:', error);
                btn.innerHTML = originalText;
                btn.disabled = false;
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    };
    
    // Вспомогательная функция для показа изображения с данными из window.collectorData
    window.showFullImageWithData = function(imageSrc, title, imageId) {
        const collectorInfo = window.collectorData && window.collectorData[imageId];
        console.log('🖼️ Открытие изображения:', title, 'ID:', imageId, 'Данные сборщика:', collectorInfo);
        window.showFullImage(imageSrc, title, collectorInfo);
    };
    
    // Показ полного изображения с информацией о сборщике
    window.showFullImage = function(imageSrc, title, collectorInfo) {
        console.log('🖼️ showFullImage вызвана с параметрами:', { imageSrc, title, collectorInfo });
        
        // Fallback для старых вызовов без collectorInfo
        if (typeof title === 'object' && !collectorInfo) {
            collectorInfo = title;
            title = 'Модель';
        }
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 3000;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            backdrop-filter: blur(10px);
            animation: modalFadeIn 0.3s ease-out;
        `;
        
        // Определяем информацию о сборщике
        let collectorDisplay = '';
        if (collectorInfo) {
            if (collectorInfo.authMethod === 'telegram' && collectorInfo.telegramData) {
                const tgData = collectorInfo.telegramData;
                const fullName = [tgData.first_name, tgData.last_name].filter(Boolean).join(' ');
                
                collectorDisplay = `
                    <div style="
                        background: linear-gradient(135deg, #0088cc, #00a0ff);
                        color: white;
                        padding: 12px 16px;
                        border-radius: 10px;
                        margin-bottom: 15px;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        box-shadow: 0 4px 15px rgba(0, 136, 204, 0.3);
                    ">
                        ${tgData.photo_url ? `
                            <img src="${tgData.photo_url}" 
                                 style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.2);" 
                                 onerror="this.style.display='none';" 
                                 alt="Avatar">
                        ` : `
                            <div style="
                                width: 40px; 
                                height: 40px; 
                                border-radius: 50%; 
                                background: rgba(255,255,255,0.2); 
                                display: flex; 
                                align-items: center; 
                                justify-content: center; 
                                font-size: 18px;
                                border: 2px solid white;
                            ">👤</div>
                        `}
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 1rem; margin-bottom: 3px;">
                                ${fullName}
                            </div>
                            ${tgData.username ? `
                                <a href="https://t.me/${tgData.username}" 
                                   target="_blank" 
                                   style="
                                       color: white; 
                                       text-decoration: none; 
                                       font-size: 0.85rem; 
                                       opacity: 0.9; 
                                       display: flex; 
                                       align-items: center; 
                                       gap: 4px;
                                       transition: opacity 0.3s;
                                   "
                                   onmouseover="this.style.opacity='1'"
                                   onmouseout="this.style.opacity='0.9'">
                                    <span style="font-size: 0.8rem;">✈️</span>
                                    @${tgData.username}
                                </a>
                            ` : `
                                <div style="font-size: 0.8rem; opacity: 0.8;">
                                    <span style="font-size: 0.75rem;">🆔</span>
                                    ID: ${tgData.id}
                                </div>
                            `}
                        </div>
                        <div style="
                            background: rgba(255,255,255,0.15);
                            padding: 4px 8px;
                            border-radius: 12px;
                            font-size: 0.75rem;
                            font-weight: 500;
                        ">
                            Telegram
                        </div>
                    </div>
                `;
            } else {
                // Обычный сборщик (ручной ввод)
                collectorDisplay = `
                    <div style="
                        background: linear-gradient(135deg, #4CAF50, #45a049);
                        color: white;
                        padding: 12px 16px;
                        border-radius: 10px;
                        margin-bottom: 15px;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
                    ">
                        <div style="
                            width: 40px; 
                            height: 40px; 
                            border-radius: 50%; 
                            background: rgba(255,255,255,0.2); 
                            display: flex; 
                            align-items: center; 
                            justify-content: center; 
                            font-size: 18px;
                            border: 2px solid white;
                        ">👤</div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 1rem; margin-bottom: 3px;">
                                ${collectorInfo.name}
                            </div>
                            <div style="font-size: 0.8rem; opacity: 0.9;">
                                Ручной ввод
                            </div>
                        </div>
                        <div style="
                            background: rgba(255,255,255,0.15);
                            padding: 4px 8px;
                            border-radius: 12px;
                            font-size: 0.75rem;
                            font-weight: 500;
                        ">
                            Ручной
                        </div>
                    </div>
                `;
            }
        }
        
        modal.innerHTML = `
            <div style="
                max-width: 90vw;
                max-height: 90vh;
                background: white;
                border-radius: 15px;
                overflow: hidden;
                cursor: default;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                position: relative;
                display: flex;
                flex-direction: column;
            " onclick="event.stopPropagation()">
                <!-- Заголовок и закрытие -->
                <div style="
                    padding: 20px 20px 15px 20px;
                    background: #f8f9fa;
                    border-bottom: 1px solid #dee2e6;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    position: relative;
                ">
                    <div style="flex: 1; padding-right: 40px;">
                        <h3 style="
                            margin: 0 0 8px 0;
                            font-size: 1.1rem;
                            color: #333;
                            font-weight: 600;
                        ">${title}</h3>
                        <div style="font-size: 0.85rem; color: #666;">
                            Селфи с места находки
                        </div>
                    </div>
                    <button onclick="this.closest('[style*=\"position: fixed\"]').remove()" style="
                        position: absolute;
                        top: 15px;
                        right: 15px;
                        background: rgba(108, 117, 125, 0.1);
                        border: none;
                        border-radius: 50%;
                        width: 35px;
                        height: 35px;
                        font-size: 20px;
                        cursor: pointer;
                        color: #6c757d;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.3s;
                    " 
                    onmouseover="this.style.background='rgba(108, 117, 125, 0.2)'; this.style.color='#495057'"
                    onmouseout="this.style.background='rgba(108, 117, 125, 0.1)'; this.style.color='#6c757d'">
                        ×
                    </button>
                </div>
                
                <!-- Информация о сборщике -->
                <div style="padding: 0 20px;">
                    ${collectorDisplay}
                </div>
                
                <!-- Изображение -->
                <div style="
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0 20px 20px 20px;
                    overflow: hidden;
                ">
                    <img src="${imageSrc}" style="
                        max-width: 100%;
                        max-height: 60vh;
                        object-fit: contain;
                        border-radius: 8px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                    " alt="Селфи с места находки">
                </div>
                
                <!-- Дополнительные действия -->
                <div style="
                    padding: 15px 20px;
                    background: #f8f9fa;
                    border-top: 1px solid #dee2e6;
                    display: flex;
                    justify-content: center;
                    gap: 10px;
                ">
                    <button onclick="
                        const link = document.createElement('a');
                        link.download = 'plasticboy-selfie-${Date.now()}.jpg';
                        link.href = '${imageSrc}';
                        link.click();
                    " style="
                        background: linear-gradient(45deg, #007bff, #0056b3);
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        font-weight: 500;
                        transition: all 0.3s;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    "
                    onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0, 123, 255, 0.3)'"
                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                        📥 Скачать
                    </button>
                </div>
            </div>
        `;
        
        // Добавляем стили анимации если их еще нет
        if (!document.getElementById('modal-animation-styles')) {
            const style = document.createElement('style');
            style.id = 'modal-animation-styles';
            style.textContent = `
                @keyframes modalFadeIn {
                    from {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        modal.onclick = () => {
            console.log('🖼️ Закрытие модального окна');
            modal.remove();
        };
        document.body.appendChild(modal);
        
        // Обработка ESC для закрытия
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                console.log('🖼️ Закрытие модального окна по ESC');
                modal.remove();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
        
        console.log('🖼️ Модальное окно создано и добавлено в DOM');
    };
    
    // Обработчики событий
    window.addEventListener('resize', function() {
        if (map) {
            setTimeout(() => map.invalidateSize(), 100);
        }
    });
    
    // Запускаем инициализацию
    init();
    
    console.log('🚀 PlasticBoy скрипт загружен');
})(); = L.map('map', {
                    center: ALMATY_CENTER,
                    zoom: 13,
                    zoomControl: true,
                    preferCanvas: true // Улучшаем производительность на мобильных
                });
                
                // Добавляем тайлы
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 18,
                    tileSize: 256,
                    crossOrigin: true
                }).addTo(map);
                
                // Добавляем стили
                addMapStyles();
                
                // Уведомляем загрузчик о готовности карты
                if (window.AppLoader && window.AppLoader.onMapReady) {
                    window.AppLoader.onMapReady();
                }
                
                // Ждем полной загрузки карты
                map.whenReady(() => {
                    setTimeout(() => {
                        map.invalidateSize();
                        console.log('✅ Карта готова');
                        isInitialized = true;
                        
                        // Автообновление каждые 30 секунд
                        setInterval(loadPoints, 30000);
                        
                        resolve();
                    }, 200);
                });
                
            } catch (error) {
                console.error('❌ Ошибка создания карты:', error);
                reject(error);
            }
        });
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
                position: relative;
            }
            
            .user-dot::after {
                content: '';
                position: absolute;
                top: -4px;
                left: -4px;
                right: -4px;
                bottom: -4px;
                border-radius: 50%;
                border: 2px solid #007bff;
                opacity: 0.3;
                animation: userPulse 2s infinite;
            }
            
            @keyframes userPulse {
                0% { transform: scale(1); opacity: 0.7; }
                50% { opacity: 0.2; }
                100% { transform: scale(2); opacity: 0; }
            }

            /* Стили для Telegram данных в popup */
            .telegram-user-info {
                background: linear-gradient(135deg, #0088cc, #00a0ff);
                color: white;
                padding: 12px;
                border-radius: 10px;
                margin: 10px 0;
                text-align: center;
                box-shadow: 0 3px 10px rgba(0, 136, 204, 0.3);
            }

            .telegram-avatar {
                width: 50px;
                height: 50px;
                border-radius: 50%;
                border: 2px solid white;
                margin: 0 auto 8px;
                display: block;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }

            .telegram-name {
                font-weight: 600;
                font-size: 1rem;
                margin-bottom: 4px;
            }

            .telegram-username {
                font-size: 0.85rem;
                opacity: 0.9;
                text-decoration: none;
                color: white;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                transition: all 0.3s;
                padding: 4px 8px;
                border-radius: 15px;
                background: rgba(255,255,255,0.1);
            }

            .telegram-username:hover {
                background: rgba(255,255,255,0.2);
                transform: translateY(-1px);
            }

            .telegram-icon {
                font-size: 0.8rem;
            }

            .collector-info-enhanced {
                background: #f8f9fa;
                padding: 12px;
                border-radius: 10px;
                margin: 10px 0;
                border-left: 4px solid #4CAF50;
            }

            .collector-info-enhanced h4 {
                margin: 0 0 8px 0;
                color: #333;
                font-size: 0.95rem;
            }

            .collector-detail {
                margin: 4px 0;
                font-size: 0.9rem;
                color: #666;
            }

            .popup-collector-name {
                font-weight: 600;
                color: #333;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Загрузка точек
    function loadPoints() {
        return new Promise((resolve) => {
            console.log('📍 Загрузка точек');
            
            // Сначала проверяем кэш
            const cachedPoints = Cache.load();
            if (cachedPoints) {
                updateMap(cachedPoints);
                updateStats(cachedPoints);
                
                // Уведомляем загрузчик
                if (window.AppLoader && window.AppLoader.onPointsLoaded) {
                    window.AppLoader.onPointsLoaded();
                }
                
                // Обновляем в фоне
                setTimeout(() => fetchPointsFromServer(false), 1000);
                resolve();
                return;
            }
            
            // Загружаем с сервера
            fetchPointsFromServer(true).then(resolve);
        });
    }
    
    // Загрузка с сервера
    function fetchPointsFromServer(notifyLoader = true) {
        return new Promise((resolve) => {
            console.log('🌐 Загрузка точек с сервера');
            
            fetch('/api/points', {
                method: 'GET',
                headers: { 
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                cache: 'no-cache'
            })
            .then(response => {
                console.log('📡 Ответ сервера:', response.status);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                return response.json();
            })
            .then(points => {
                console.log('✅ Загружено ' + points.length + ' точек с сервера');
                
                // Сохраняем в кэш
                Cache.save(points);
                
                // Обновляем карту
                updateMap(points);
                updateStats(points);
                
                // Уведомляем загрузчик
                if (notifyLoader && window.AppLoader && window.AppLoader.onPointsLoaded) {
                    window.AppLoader.onPointsLoaded();
                }
                
                resolve();
            })
            .catch(error => {
                console.error('❌ Ошибка загрузки точек:', error);
                
                // Пытаемся загрузить из кэша как fallback
                const cachedPoints = Cache.load();
                if (cachedPoints) {
                    console.log('📦 Используем кэшированные данные как fallback');
                    updateMap(cachedPoints);
                    updateStats(cachedPoints);
                }
                
                // Уведомляем загрузчик даже при ошибке
                if (notifyLoader && window.AppLoader && window.AppLoader.onPointsLoaded) {
                    window.AppLoader.onPointsLoaded();
                }
                
                resolve();
            });
        });
    }
    
    // Обновление карты
    function updateMap(points) {
        if (!map || !points) {
            console.warn('⚠️ Карта или точки не готовы для обновления');
            return;
        }
        
        console.log('🗺️ Обновление карты (' + points.length + ' точек)');
        
        try {
            // Очищаем старые маркеры
            markers.forEach(marker => {
                if (map.hasLayer(marker)) {
                    map.removeLayer(marker);
                }
            });
            markers = [];
            
            // Добавляем новые маркеры
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
                    
                    // Создаем содержимое popup с улучшенной поддержкой Telegram
                    const popupContent = createPopupContent(point, isAvailable);
                    marker.bindPopup(popupContent);
                    
                    marker.addTo(map);
                    markers.push(marker);
                } catch (error) {
                    console.error('❌ Ошибка добавления маркера:', error, point);
                }
            });
            
            console.log('✅ Добавлено ' + markers.length + ' маркеров');
            
        } catch (error) {
            console.error('❌ Ошибка обновления карты:', error);
        }
    }
    
    // Создание содержимого popup с поддержкой Telegram
    function createPopupContent(point, isAvailable) {
        let popupContent = '<div style="min-width: 200px;">';
        popupContent += `<h3 style="margin: 0 0 10px 0;">${point.name}</h3>`;
        popupContent += `<p style="font-weight: 600; color: ${isAvailable ? '#4CAF50' : '#f44336'};">`;
        popupContent += isAvailable ? '🟢 Доступна для сбора' : '🔴 Уже собрана';
        popupContent += '</p>';
        
        if (!isAvailable && point.collectorInfo) {
            popupContent += '<div class="collector-info-enhanced">';
            popupContent += '<h4>Информация о сборщике:</h4>';
            
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
                                      <span class="telegram-icon">✈️</span>
                                      @${tgData.username}
                                    </a>`;
                } else {
                    // Если username нет, показываем Telegram ID
                    popupContent += `<div class="telegram-username" style="cursor: default;">
                                      <span class="telegram-icon">🆔</span>
                                      ID: ${tgData.id}
                                    </div>`;
                }
                
                popupContent += '</div>';
                
                // Дополнительная информация
                if (point.collectorInfo.signature) {
                    popupContent += `<div class="collector-detail">
                                      <strong>Сообщение:</strong> ${point.collectorInfo.signature}
                                    </div>`;
                }
            } else {
                // Обычный сборщик (ручной ввод)
                popupContent += `<div class="collector-detail">
                                  <span class="popup-collector-name">${point.collectorInfo.name}</span>
                                </div>`;
                
                if (point.collectorInfo.signature) {
                    popupContent += `<div class="collector-detail">
                                      <strong>Сообщение:</strong> ${point.collectorInfo.signature}
                                    </div>`;
                }
            }
            
            popupContent += `<div class="collector-detail">
                              <strong>Время сбора:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}
                            </div>`;
            
            // Добавляем селфи если есть - исправленная версия
            if (point.collectorInfo.selfie) {
                // Создаем уникальный ID для этого изображения
                const imageId = `selfie_${point.id}_${Date.now()}`;
                
                // Сохраняем данные сборщика в window для доступа из onclick
                if (!window.collectorData) {
                    window.collectorData = {};
                }
                window.collectorData[imageId] = point.collectorInfo;
                
                popupContent += '<div style="margin: 10px 0; text-align: center;">';
                popupContent += `<img src="${point.collectorInfo.selfie}" 
                                  style="max-width: 150px; max-height: 120px; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" 
                                  onclick="showFullImageWithData('${point.collectorInfo.selfie}', '${point.name}', '${imageId}')" 
                                  title="Кликните для увеличения">`;
                popupContent += '</div>';
            }
            
            popupContent += '</div>';
        }
        
        popupContent += '</div>';
        return popupContent;
    }
    
    // Обновление статистики
    function updateStats(points) {
        const available = points.filter(p => p.status === 'available').length;
        const collected = points.filter(p => p.status === 'collected').length;
        
        const availableEl = document.getElementById('availableCount');
        const collectedEl = document.getElementById('collectedCount');
        
        if (availableEl) {
            animateNumber(availableEl, available);
        }
        if (collectedEl) {
            animateNumber(collectedEl, collected);
        }
        
        console.log('📊 Статистика: ' + available + ' доступно, ' + collected + ' собрано');
    }
    
    // Анимация чисел
    function animateNumber(element, targetValue) {
        const currentValue = parseInt(element.textContent) || 0;
        if (currentValue === targetValue) return;
        
        const duration = 500;
        const steps = 10;
        const stepValue = (targetValue - currentValue) / steps;
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
    
    // Показ ошибки
    function showErrorMessage(message) {
        const container = document.querySelector('.container');
        if (container) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                background: rgba(244, 67, 54, 0.1);
                border: 1px solid #f44336;
                border-radius: 12px;
                padding: 20px;
                margin: 20px 0;
                text-align: center;
                color: #f44336;
                font-weight: 600;
            `;
            errorDiv.innerHTML = `
                <h3>❌ Ошибка загрузки</h3>
                <p>${message}</p>
                <button onclick="window.location.reload()" style="
                    background: #f44336;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    margin-top: 10px;
                ">Обновить страницу</button>
            `;
            container.appendChild(errorDiv);
        }
    }
    
    // Глобальные функции
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
                if (window.userMarker && map.hasLayer(window.userMarker)) {
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
                
                map
