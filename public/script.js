// PlasticBoy v2.0 - С поддержкой Instagram авторизации
(function() {
    'use strict';
    
    console.log('🎯 PlasticBoy - Инициализация скрипта с Instagram поддержкой');
    
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
                
                map = L.map('map', {
                    center: ALMATY_CENTER,
                    zoom: 13,
                    zoomControl: true,
                    preferCanvas: true // Улучшаем производительность на мобильных
                });
                
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
            
            .instagram-popup-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 15px;
                padding-bottom: 12px;
                border-bottom: 1px solid #eee;
            }
            
            .instagram-avatar-small {
                width: 50px;
                height: 50px;
                border-radius: 50%;
                border: 2px solid #e6683c;
                object-fit: cover;
            }
            
            .instagram-user-info h4 {
                margin: 0 0 4px 0;
                color: #333;
                font-size: 1.1rem;
            }
            
            .instagram-username {
                color: #666;
                font-size: 0.9rem;
                margin: 0;
            }
            
            .instagram-stats-popup {
                display: flex;
                justify-content: space-around;
                margin: 12px 0;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 8px;
            }
            
            .instagram-stat-popup {
                text-align: center;
            }
            
            .instagram-stat-number-popup {
                font-weight: 600;
                color: #333;
                display: block;
                font-size: 0.9rem;
            }
            
            .instagram-stat-label-popup {
                font-size: 0.7rem;
                color: #666;
            }
            
            .auth-method-badge {
                display: inline-block;
                padding: 4px 8px;
                border-radius: 6px;
                font-size: 0.8rem;
                font-weight: 600;
                margin-bottom: 10px;
            }
            
            .auth-method-badge.instagram {
                background: linear-gradient(45deg, rgba(240, 148, 51, 0.1), rgba(188, 24, 136, 0.1));
                color: #e6683c;
                border: 1px solid rgba(230, 104, 60, 0.3);
            }
            
            .auth-method-badge.manual {
                background: rgba(76, 175, 80, 0.1);
                color: #4CAF50;
                border: 1px solid rgba(76, 175, 80, 0.3);
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
                    
                    // Создаем содержимое popup
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
    
    // Создание содержимого popup с поддержкой Instagram
    function createPopupContent(point, isAvailable) {
        let popupContent = '<div style="min-width: 200px;">';
        popupContent += `<h3 style="margin: 0 0 10px 0;">${point.name}</h3>`;
        popupContent += `<p style="font-weight: 600; color: ${isAvailable ? '#4CAF50' : '#f44336'};">`;
        popupContent += isAvailable ? '🟢 Доступна для сбора' : '🔴 Уже собрана';
        popupContent += '</p>';
        
        if (!isAvailable && point.collectorInfo) {
            // Определяем метод авторизации
            const authMethod = point.collectorInfo.authMethod || 'manual';
            
            // Бейдж метода авторизации
            popupContent += `<div class="auth-method-badge ${authMethod}">`;
            popupContent += authMethod === 'instagram' ? '📸 Instagram' : '👤 Ручной ввод';
            popupContent += '</div>';
            
            popupContent += '<div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin: 10px 0;">';
            
            // Если собрано через Instagram, показываем профиль
            if (authMethod === 'instagram' && point.collectorInfo.instagram) {
                const instagram = point.collectorInfo.instagram;
                
                popupContent += '<div class="instagram-popup-header">';
                popupContent += `<img src="${instagram.profile_picture}" alt="Avatar" class="instagram-avatar-small" onerror="this.src='https://via.placeholder.com/50x50?text=👤'">`;
                popupContent += '<div class="instagram-user-info">';
                popupContent += `<h4>${instagram.full_name || instagram.username}</h4>`;
                popupContent += `<p class="instagram-username">@${instagram.username}`;
                if (instagram.is_verified) {
                    popupContent += ' ✓';
                }
                popupContent += '</p>';
                popupContent += '</div>';
                popupContent += '</div>';
                
                // Статистика Instagram
                if (instagram.followers_count !== undefined) {
                    popupContent += '<div class="instagram-stats-popup">';
                    popupContent += '<div class="instagram-stat-popup">';
                    popupContent += `<span class="instagram-stat-number-popup">${formatNumber(instagram.posts_count || 0)}</span>`;
                    popupContent += '<span class="instagram-stat-label-popup">постов</span>';
                    popupContent += '</div>';
                    popupContent += '<div class="instagram-stat-popup">';
                    popupContent += `<span class="instagram-stat-number-popup">${formatNumber(instagram.followers_count)}</span>`;
                    popupContent += '<span class="instagram-stat-label-popup">подписчиков</span>';
                    popupContent += '</div>';
                    popupContent += '<div class="instagram-stat-popup">';
                    popupContent += `<span class="instagram-stat-number-popup">${formatNumber(instagram.following_count || 0)}</span>`;
                    popupContent += '<span class="instagram-stat-label-popup">подписок</span>';
                    popupContent += '</div>';
                    popupContent += '</div>';
                }
            } else {
                // Обычное отображение для ручного ввода
                popupContent += `<p style="margin: 4px 0;"><strong>Собрал:</strong> ${point.collectorInfo.name}</p>`;
            }
            
            // Подпись (для всех методов)
            if (point.collectorInfo.signature) {
                popupContent += `<p style="margin: 8px 0 4px 0;"><strong>Сообщение:</strong></p>`;
                popupContent += `<p style="margin: 4px 0; font-style: italic; color: #555;">"${point.collectorInfo.signature}"</p>`;
            }
            
            popupContent += `<p style="margin: 8px 0 4px 0;"><strong>Время:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>`;
            
            // Добавляем селфи если есть
            if (point.collectorInfo.selfie) {
                popupContent += '<div style="margin: 12px 0; text-align: center;">';
                popupContent += `<img src="${point.collectorInfo.selfie}" style="max-width: 150px; max-height: 120px; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" onclick="showFullImage('${point.collectorInfo.selfie}', '${point.name}')" title="Кликните для увеличения">`;
                popupContent += '</div>';
            }
            
            popupContent += '</div>';
        }
        
        popupContent += '</div>';
        return popupContent;
    }
    
    // Форматирование чисел для Instagram статистики
    function formatNumber(num) {
        if (!num) return '0';
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
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
    
    // Показ полного изображения
    window.showFullImage = function(imageSrc, title) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 3000;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        `;
        
        modal.innerHTML = `
            <div style="
                max-width: 90%;
                max-height: 90%;
                background: white;
                border-radius: 12px;
                overflow: hidden;
                cursor: default;
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
    window.addEventListener('resize', function() {
        if (map) {
            setTimeout(() => map.invalidateSize(), 100);
        }
    });
    
    // Запускаем инициализацию
    init();
    
    // Дополнительные функции для Instagram интеграции
    
    // Глобальный объект для управления Instagram функциональностью
    window.PlasticBoyInstagram = {
        // Проверка валидности Instagram username
        validateUsername: function(username) {
            if (!username || typeof username !== 'string') return false;
            if (username.length < 1 || username.length > 30) return false;
            return /^[a-zA-Z0-9._]+$/.test(username);
        },
        
        // Получение цвета для verified badge
        getVerifiedBadgeColor: function(isVerified) {
            return isVerified ? '#1DA1F2' : 'transparent';
        },
        
        // Форматирование времени для Instagram стиля
        formatInstagramTime: function(date) {
            const now = new Date();
            const diff = now - new Date(date);
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);
            
            if (minutes < 1) return 'только что';
            if (minutes < 60) return `${minutes}м`;
            if (hours < 24) return `${hours}ч`;
            if (days < 7) return `${days}д`;
            return new Date(date).toLocaleDateString('ru-RU');
        },
        
        // Генерация цветового градиента для аватаров
        generateAvatarGradient: function(username) {
            let hash = 0;
            for (let i = 0; i < username.length; i++) {
                hash = username.charCodeAt(i) + ((hash << 5) - hash);
            }
            
            const hue1 = Math.abs(hash) % 360;
            const hue2 = (hue1 + 60) % 360;
            
            return `linear-gradient(45deg, hsl(${hue1}, 70%, 60%), hsl(${hue2}, 70%, 70%))`;
        }
    };
    
    // Расширенная статистика для администраторов
    window.PlasticBoyAnalytics = {
        // Подсчет статистики по методам авторизации
        calculateAuthStats: function(points) {
            const stats = {
                total: points.length,
                collected: 0,
                instagram: 0,
                manual: 0,
                totalFollowers: 0,
                avgFollowers: 0,
                verifiedUsers: 0
            };
            
            const collectedPoints = points.filter(p => p.status === 'collected');
            stats.collected = collectedPoints.length;
            
            let instagramFollowers = [];
            
            collectedPoints.forEach(point => {
                if (point.collectorInfo) {
                    const authMethod = point.collectorInfo.authMethod || 'manual';
                    stats[authMethod]++;
                    
                    if (authMethod === 'instagram' && point.collectorInfo.instagram) {
                        const followers = point.collectorInfo.instagram.followers_count || 0;
                        stats.totalFollowers += followers;
                        instagramFollowers.push(followers);
                        
                        if (point.collectorInfo.instagram.is_verified) {
                            stats.verifiedUsers++;
                        }
                    }
                }
            });
            
            if (instagramFollowers.length > 0) {
                stats.avgFollowers = Math.round(stats.totalFollowers / instagramFollowers.length);
            }
            
            stats.instagramPercentage = stats.collected > 0 ? 
                Math.round((stats.instagram / stats.collected) * 100) : 0;
            
            return stats;
        },
        
        // Создание отчета для консоли
        logDetailedStats: function(points) {
            const stats = this.calculateAuthStats(points);
            
            console.group('📊 PlasticBoy Analytics');
            console.log('📍 Общая статистика:');
            console.log(`   Всего точек: ${stats.total}`);
            console.log(`   Собрано: ${stats.collected}`);
            console.log(`   Доступно: ${stats.total - stats.collected}`);
            
            console.log('👥 По методам авторизации:');
            console.log(`   📸 Instagram: ${stats.instagram} (${stats.instagramPercentage}%)`);
            console.log(`   👤 Ручной ввод: ${stats.manual} (${100 - stats.instagramPercentage}%)`);
            
            if (stats.instagram > 0) {
                console.log('📱 Instagram статистика:');
                console.log(`   Всего подписчиков: ${formatNumber(stats.totalFollowers)}`);
                console.log(`   Средние подписчики: ${formatNumber(stats.avgFollowers)}`);
                console.log(`   Верифицированных: ${stats.verifiedUsers}`);
            }
            
            console.groupEnd();
            
            return stats;
        }
    };
    
    // Утилиты для работы с геолокацией
    window.PlasticBoyGeo = {
        // Определение района Алматы по координатам
        getAlmatyDistrict: function(lat, lng) {
            const districts = [
                { name: 'Алмалинский', bounds: [[43.210, 76.840], [43.240, 76.890]] },
                { name: 'Ауэзовский', bounds: [[43.180, 76.820], [43.220, 76.880]] },
                { name: 'Бостандыкский', bounds: [[43.220, 76.880], [43.280, 76.940]] },
                { name: 'Жетысуский', bounds: [[43.200, 76.880], [43.250, 76.920]] },
                { name: 'Медеуский', bounds: [[43.220, 76.920], [43.280, 76.980]] },
                { name: 'Наурызбайский', bounds: [[43.200, 76.800], [43.240, 76.860]] },
                { name: 'Турксибский', bounds: [[43.180, 76.860], [43.220, 76.920]] },
                { name: 'Алатауский', bounds: [[43.150, 76.820], [43.200, 76.880]] }
            ];
            
            for (const district of districts) {
                const [[minLat, minLng], [maxLat, maxLng]] = district.bounds;
                if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
                    return district.name;
                }
            }
            
            return 'Алматы';
        },
        
        // Расчет расстояния между точками
        calculateDistance: function(lat1, lng1, lat2, lng2) {
            const R = 6371; // Радиус Земли в км
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLng = (lng2 - lng1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                     Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                     Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        },
        
        // Поиск ближайших точек
        findNearestPoints: function(userLat, userLng, points, limit = 5) {
            return points
                .map(point => ({
                    ...point,
                    distance: this.calculateDistance(
                        userLat, userLng, 
                        point.coordinates.lat, point.coordinates.lng
                    )
                }))
                .sort((a, b) => a.distance - b.distance)
                .slice(0, limit);
        }
    };
    
    // Система уведомлений
    window.PlasticBoyNotifications = {
        // Показ toast уведомления
        showToast: function(message, type = 'info', duration = 4000) {
            const toast = document.createElement('div');
            toast.className = `plasticboy-toast toast-${type}`;
            
            const icons = {
                success: '✅',
                error: '❌',
                warning: '⚠️',
                info: 'ℹ️',
                instagram: '📸'
            };
            
            toast.innerHTML = `
                <div class="toast-content">
                    <span class="toast-icon">${icons[type] || icons.info}</span>
                    <span class="toast-message">${message}</span>
                    <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
                </div>
            `;
            
            // Добавляем стили если их нет
            this.addToastStyles();
            
            document.body.appendChild(toast);
            
            // Автоматическое удаление
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.classList.add('toast-fade-out');
                    setTimeout(() => toast.remove(), 300);
                }
            }, duration);
            
            return toast;
        },
        
        addToastStyles: function() {
            if (document.getElementById('toast-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                .plasticboy-toast {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 3000;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                    padding: 12px 16px;
                    min-width: 280px;
                    max-width: 400px;
                    animation: toastSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    border-left: 4px solid #2196F3;
                    backdrop-filter: blur(10px);
                }
                
                .plasticboy-toast.toast-success { border-left-color: #4CAF50; }
                .plasticboy-toast.toast-error { border-left-color: #f44336; }
                .plasticboy-toast.toast-warning { border-left-color: #ff9800; }
                .plasticboy-toast.toast-instagram { 
                    border-left-color: #e6683c;
                    background: linear-gradient(135deg, rgba(240, 148, 51, 0.05), white);
                }
                
                .toast-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .toast-icon {
                    font-size: 1.2rem;
                    flex-shrink: 0;
                }
                
                .toast-message {
                    flex: 1;
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: #333;
                }
                
                .toast-close {
                    background: none;
                    border: none;
                    font-size: 1.2rem;
                    cursor: pointer;
                    color: #999;
                    padding: 0;
                    transition: color 0.3s;
                    flex-shrink: 0;
                }
                
                .toast-close:hover {
                    color: #666;
                }
                
                .toast-fade-out {
                    animation: toastFadeOut 0.3s ease forwards;
                }
                
                @keyframes toastSlideIn {
                    from {
                        transform: translateX(100%) scale(0.9);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0) scale(1);
                        opacity: 1;
                    }
                }
                
                @keyframes toastFadeOut {
                    to {
                        transform: translateX(100%) scale(0.9);
                        opacity: 0;
                    }
                }
                
                @media (max-width: 480px) {
                    .plasticboy-toast {
                        left: 10px;
                        right: 10px;
                        max-width: none;
                        min-width: auto;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    };
    
    // Система кэширования для Instagram данных
    window.PlasticBoyCache = {
        instagramKey: 'plasticboy_instagram_cache',
        ttl: 24 * 60 * 60 * 1000, // 24 часа
        
        saveInstagramProfile: function(username, profile) {
            try {
                const cache = this.getInstagramCache();
                cache[username] = {
                    profile: profile,
                    timestamp: Date.now()
                };
                localStorage.setItem(this.instagramKey, JSON.stringify(cache));
                console.log('💾 Instagram профиль сохранен в кэш:', username);
            } catch (e) {
                console.warn('⚠️ Ошибка сохранения Instagram кэша:', e);
            }
        },
        
        getInstagramProfile: function(username) {
            try {
                const cache = this.getInstagramCache();
                const item = cache[username];
                
                if (!item) return null;
                
                const age = Date.now() - item.timestamp;
                if (age > this.ttl) {
                    delete cache[username];
                    localStorage.setItem(this.instagramKey, JSON.stringify(cache));
                    return null;
                }
                
                console.log('📦 Instagram профиль загружен из кэша:', username);
                return item.profile;
            } catch (e) {
                console.warn('⚠️ Ошибка чтения Instagram кэша:', e);
                return null;
            }
        },
        
        getInstagramCache: function() {
            try {
                const cache = localStorage.getItem(this.instagramKey);
                return cache ? JSON.parse(cache) : {};
            } catch (e) {
                return {};
            }
        },
        
        clearInstagramCache: function() {
            localStorage.removeItem(this.instagramKey);
            console.log('🗑️ Instagram кэш очищен');
        }
    };
    
    // Обработчики клавиатурных сокращений
    document.addEventListener('keydown', function(event) {
        // Только если нет активных модальных окон или input полей
        if (document.activeElement.tagName === 'INPUT' || 
            document.activeElement.tagName === 'TEXTAREA' ||
            document.querySelector('.modal[style*="block"]')) {
            return;
        }
        
        // Ctrl+Shift+D - показать детальную статистику
        if (event.ctrlKey && event.shiftKey && event.key === 'D') {
            event.preventDefault();
            
            fetch('/api/points')
                .then(response => response.json())
                .then(points => {
                    const stats = window.PlasticBoyAnalytics.logDetailedStats(points);
                    window.PlasticBoyNotifications.showToast(
                        `Статистика: ${stats.collected} собрано, ${stats.instagramPercentage}% через Instagram`,
                        'info',
                        6000
                    );
                })
                .catch(error => {
                    console.error('Ошибка загрузки статистики:', error);
                });
        }
        
        // Ctrl+Shift+C - очистить весь кэш
        if (event.ctrlKey && event.shiftKey && event.key === 'C') {
            event.preventDefault();
            Cache.clear();
            window.PlasticBoyCache.clearInstagramCache();
            window.PlasticBoyNotifications.showToast('Кэш очищен', 'success');
        }
        
        // Ctrl+Shift+R - принудительно перезагрузить данные
        if (event.ctrlKey && event.shiftKey && event.key === 'R') {
            event.preventDefault();
            Cache.clear();
            loadPoints().then(() => {
                window.PlasticBoyNotifications.showToast('Данные обновлены', 'success');
            });
        }
    });
    
    // Автоматическое обновление статистики в консоли (для разработки)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setInterval(() => {
            fetch('/api/points')
                .then(response => response.json())
                .then(points => {
                    const stats = window.PlasticBoyAnalytics.calculateAuthStats(points);
                    console.log(`📊 Live Stats: ${stats.collected} collected (${stats.instagramPercentage}% Instagram)`);
                })
                .catch(() => {}); // Игнорируем ошибки для live stats
        }, 60000); // Каждую минуту
    }
    
    // Экспорт основных функций в глобальную область
    window.PlasticBoy = {
        Cache,
        Instagram: window.PlasticBoyInstagram,
        Analytics: window.PlasticBoyAnalytics,
        Geo: window.PlasticBoyGeo,
        Notifications: window.PlasticBoyNotifications,
        
        // Основные методы
        refreshData: loadPoints,
        clearCache: () => {
            Cache.clear();
            window.PlasticBoyCache.clearInstagramCache();
        },
        getStats: (points) => window.PlasticBoyAnalytics.calculateAuthStats(points || []),
        
        // Информация о версии
        version: '2.1.0',
        features: ['instagram_auth', 'enhanced_popups', 'analytics', 'geolocation']
    };
    
    console.log('🚀 PlasticBoy v2.1.0 с Instagram поддержкой полностью загружен');
    console.log('📚 Доступные команды:');
    console.log('   PlasticBoy.refreshData() - обновить данные');
    console.log('   PlasticBoy.clearCache() - очистить кэш');
    console.log('   PlasticBoy.Analytics.logDetailedStats(points) - показать статистику');
    console.log('   Ctrl+Shift+D - детальная статистика');
    console.log('   Ctrl+Shift+C - очистить кэш');
    console.log('   Ctrl+Shift+R - обновить данные');
})();ляем тайлы
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 18,
                    tileSize: 256,
                    crossOrigin: true
                }).addTo(map);
                
                // Добав
