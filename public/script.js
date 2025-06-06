// PlasticBoy v3.0 - С Instagram и рейтингом
(function() {
    'use strict';
    
    // Глобальные переменные
    let map = null;
    let markers = [];
    let isInitialized = false;
    let currentPage = 1;
    let totalPages = 1;
    
    // Координаты Алматы
    const ALMATY_CENTER = [43.2220, 76.8512];
    
    // Система кэширования
    const Cache = {
        key: 'plasticboy_points_v3',
        leaderboardKey: 'plasticboy_leaderboard_v3',
        ttl: 5 * 60 * 1000, // 5 минут
        
        save: function(key, data) {
            try {
                const item = {
                    data: data,
                    timestamp: Date.now()
                };
                localStorage.setItem(key, JSON.stringify(item));
                console.log('💾 Сохранено в кэш:', key);
            } catch (e) {
                console.warn('⚠️ Ошибка сохранения кэша:', e);
            }
        },
        
        load: function(key) {
            try {
                const item = localStorage.getItem(key);
                if (!item) return null;
                
                const parsed = JSON.parse(item);
                const age = Date.now() - parsed.timestamp;
                
                if (age > this.ttl) {
                    console.log('⏰ Кэш устарел:', key);
                    return null;
                }
                
                console.log('📦 Загружено из кэша:', key);
                return parsed.data;
            } catch (e) {
                console.warn('⚠️ Ошибка чтения кэша:', e);
                return null;
            }
        },
        
        clear: function() {
            localStorage.removeItem(this.key);
            localStorage.removeItem(this.leaderboardKey);
            console.log('🗑️ Кэш очищен');
        }
    };
    
    // Ожидание загрузки DOM
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🎯 PlasticBoy v3.0 - Инициализация');
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
            Cache.save(Cache.key, points);
            
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
                popupContent += '<p style="margin: 4px 0;"><strong>Собрал:</strong> <a href="#" onclick="showUserProfile(\'' + point.collectorInfo.instagramUsername + '\'); return false;">@' + point.collectorInfo.instagramUsername + '</a></p>';
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
                    content += '<p><strong>Собрал:</strong> <a href="#" onclick="showUserProfile(\'' + point.collectorInfo.instagramUsername + '\'); return false;">@' + point.collectorInfo.instagramUsername + '</a></p>';
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
    
    // Показ уведомлений
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            error: '❌',
            success: '✅',
            info: 'ℹ️',
            warning: '⚠️'
        };
        
        notification.innerHTML = `
            <div class="notification-content">
                <span>${icons[type] || icons.info} ${message}</span>
                <button onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 4000);
    }
    
    // Обработчики событий
    window.addEventListener('click', function(e) {
        if (e.target === document.getElementById('infoModal')) {
            closeModal();
        }
        if (e.target === document.getElementById('userModal')) {
            closeUserModal();
        }
    });
    
    window.addEventListener('resize', function() {
        if (map) {
            setTimeout(function() { map.invalidateSize(); }, 100);
        }
    });
    
    console.log('🚀 PlasticBoy v3.0 готов к работе');
})();ружаем рейтинг
        loadLeaderboard(1);
    }
    
    // Переключение вкладок
    window.showTab = function(tabName) {
        // Скрываем все вкладки
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.style.display = 'none';
        });
        
        // Убираем активный класс со всех кнопок
        document.querySelectorAll('.nav-tab').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Показываем выбранную вкладку
        if (tabName === 'map') {
            document.getElementById('mapTab').style.display = 'block';
            document.querySelector('.nav-tab:nth-child(1)').classList.add('active');
            // Обновляем размер карты
            if (map) {
                setTimeout(() => map.invalidateSize(), 100);
            }
        } else if (tabName === 'leaderboard') {
            document.getElementById('leaderboardTab').style.display = 'block';
            document.querySelector('.nav-tab:nth-child(2)').classList.add('active');
            // Обновляем рейтинг
            loadLeaderboard(currentPage);
        }
    };
    
    // Загрузка рейтинга
    window.loadLeaderboard = function(page = 1) {
        console.log('🏆 Загрузка рейтинга, страница:', page);
        
        // Проверяем кэш
        const cacheKey = `${Cache.leaderboardKey}_page_${page}`;
        const cachedData = Cache.load(cacheKey);
        
        if (cachedData) {
            displayLeaderboard(cachedData);
            return;
        }
        
        // Загружаем с сервера
        fetch(`/api/leaderboard?page=${page}&limit=10`)
            .then(response => response.json())
            .then(data => {
                Cache.save(cacheKey, data);
                displayLeaderboard(data);
            })
            .catch(error => {
                console.error('❌ Ошибка загрузки рейтинга:', error);
                showNotification('Не удалось загрузить рейтинг', 'error');
            });
    };
    
    // Отображение рейтинга
    function displayLeaderboard(data) {
        const listContainer = document.getElementById('leaderboardList');
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        currentPage = data.currentPage;
        totalPages = data.totalPages;
        
        // Обновляем информацию о странице
        pageInfo.textContent = `Страница ${currentPage} из ${totalPages}`;
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
        
        // Очищаем список
        listContainer.innerHTML = '';
        
        if (data.users.length === 0) {
            listContainer.innerHTML = '<p class="no-data">Пока никто не собрал модели</p>';
            return;
        }
        
        // Добавляем пользователей
        data.users.forEach((user, index) => {
            const position = (currentPage - 1) * 10 + index + 1;
            const userItem = createLeaderboardItem(user, position);
            listContainer.appendChild(userItem);
        });
    }
    
    // Создание элемента рейтинга
    function createLeaderboardItem(user, position) {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        
        // Определяем медаль для топ-3
        let medal = '';
        if (position === 1) medal = '🥇';
        else if (position === 2) medal = '🥈';
        else if (position === 3) medal = '🥉';
        else medal = `#${position}`;
        
        // Создаем аватар
        const firstLetter = user.instagramUsername.charAt(0).toUpperCase();
        const avatarColor = getColorForLetter(firstLetter);
        
        // Бейджи
        const badges = user.badges ? user.badges.map(b => getBadgeEmoji(b)).join(' ') : '';
        
        item.innerHTML = `
            <div class="leaderboard-position">${medal}</div>
            <div class="leaderboard-avatar" style="background: linear-gradient(45deg, ${avatarColor})">
                ${firstLetter}
            </div>
            <div class="leaderboard-info">
                <div class="leaderboard-username">@${user.instagramUsername}</div>
                <div class="leaderboard-stats">
                    <span class="collected-count">🎯 ${user.collectedCount} моделей</span>
                    ${badges ? `<span class="badges">${badges}</span>` : ''}
                </div>
            </div>
            <button class="view-profile-btn" onclick="showUserProfile('${user.instagramUsername}')">
                Профиль
            </button>
        `;
        
        return item;
    }
    
    // Показать профиль пользователя
    window.showUserProfile = function(username) {
        console.log('👤 Загрузка профиля:', username);
        
        fetch(`/api/user/${username}`)
            .then(response => response.json())
            .then(data => {
                displayUserProfile(data);
            })
            .catch(error => {
                console.error('❌ Ошибка загрузки профиля:', error);
                showNotification('Не удалось загрузить профиль', 'error');
            });
    };
    
    // Отображение профиля пользователя
    function displayUserProfile(data) {
        const { user, collectedModels } = data;
        const firstLetter = user.instagramUsername.charAt(0).toUpperCase();
        const avatarColor = getColorForLetter(firstLetter);
        
        // Форматируем даты
        const firstCollected = user.firstCollectedAt 
            ? new Date(user.firstCollectedAt).toLocaleDateString('ru-RU')
            : 'Нет данных';
        const lastCollected = user.lastCollectedAt
            ? new Date(user.lastCollectedAt).toLocaleDateString('ru-RU')
            : 'Нет данных';
        
        // Создаем список моделей
        const modelsListHTML = collectedModels.length > 0
            ? collectedModels.map(model => `
                <div class="collected-model-item">
                    <span class="model-name">📦 ${model.name}</span>
                    <span class="model-date">${new Date(model.collectedAt).toLocaleDateString('ru-RU')}</span>
                </div>
            `).join('')
            : '<p class="no-models">Пока нет собранных моделей</p>';
        
        // Бейджи
        const badgesHTML = user.badges && user.badges.length > 0
            ? user.badges.map(badge => `
                <div class="badge-item">
                    <span class="badge-emoji">${getBadgeEmoji(badge)}</span>
                    <span class="badge-name">${getBadgeDescription(badge)}</span>
                </div>
            `).join('')
            : '<p class="no-badges">Пока нет достижений</p>';
        
        const content = `
            <div class="user-profile-header">
                <div class="profile-avatar-large" style="background: linear-gradient(45deg, ${avatarColor})">
                    ${firstLetter}
                </div>
                <div class="profile-info">
                    <h2>@${user.instagramUsername}</h2>
                    <div class="profile-stats">
                        <div class="stat-box">
                            <span class="stat-value">${user.collectedCount}</span>
                            <span class="stat-label">Моделей</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-value">${user.badges ? user.badges.length : 0}</span>
                            <span class="stat-label">Достижений</span>
                        </div>
                    </div>
                    <div class="profile-dates">
                        <p>🗓️ Первая находка: ${firstCollected}</p>
                        <p>📅 Последняя находка: ${lastCollected}</p>
                    </div>
                </div>
            </div>
            
            <div class="profile-sections">
                <div class="profile-section">
                    <h3>🏆 Достижения</h3>
                    <div class="badges-list">
                        ${badgesHTML}
                    </div>
                </div>
                
                <div class="profile-section">
                    <h3>📦 Собранные модели</h3>
                    <div class="models-list">
                        ${modelsListHTML}
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('userProfileContent').innerHTML = content;
        document.getElementById('userModal').style.display = 'block';
    }
    
    // Закрыть модальное окно профиля
    window.closeUserModal = function() {
        document.getElementById('userModal').style.display = 'none';
    };
    
    // Получить цвет для буквы
    function getColorForLetter(letter) {
        const colors = [
            '#667eea, #764ba2',
            '#f093fb, #f5576c',
            '#4facfe, #00f2fe',
            '#fa709a, #fee140',
            '#30cfd0, #330867',
            '#a8edea, #fed6e3',
            '#ff9a9e, #fecfef',
            '#fbc2eb, #a6c1ee'
        ];
        
        const index = letter.charCodeAt(0) % colors.length;
        return colors[index];
    }
    
    // Получить эмодзи для бейджа
    function getBadgeEmoji(badge) {
        const badges = {
            'first_collect': '🌟',
            'collector_5': '🥉',
            'collector_10': '🥈',
            'collector_25': '🥇',
            'collector_50': '💎',
            'collector_100': '👑'
        };
        return badges[badge] || '🏆';
    }
    
    // Получить описание бейджа
    function getBadgeDescription(badge) {
        const descriptions = {
            'first_collect': 'Первая находка',
            'collector_5': 'Бронзовый коллекционер',
            'collector_10': 'Серебряный коллекционер',
            'collector_25': 'Золотой коллекционер',
            'collector_50': 'Платиновый коллекционер',
            'collector_100': 'Легендарный коллекционер'
        };
        return descriptions[badge] || 'Достижение';
    }
    
    // Инициализация карты (остается прежней)
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
                // Обновляем рейтинг если открыт
                if (document.getElementById('leaderboardTab').style.display !== 'none') {
                    loadLeaderboard(currentPage);
                }
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
        const cachedPoints = Cache.load(Cache.key);
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
        
        // Заг
