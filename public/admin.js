// ОБНОВЛЕННЫЙ ADMIN.JS с поддержкой серверного кэширования
// Оптимизирован для работы с новой системой кэша

// Переменные для админ панели
let adminMap;
let adminMarkers = [];
let isAddMode = false;
let currentPassword = '';
let allPoints = [];
let currentQRCode = '';

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// Кэш для админских данных
const AdminCache = {
    lastUpdate: 0,
    cacheStats: null,
    
    shouldRefresh() {
        return Date.now() - this.lastUpdate > 30000; // 30 секунд
    },
    
    updateTimestamp() {
        this.lastUpdate = Date.now();
    }
};

// Инициализация админ панели
document.addEventListener('DOMContentLoaded', function() {
    // Проверяем сохраненный пароль
    const savedPassword = sessionStorage.getItem('adminPassword');
    if (savedPassword) {
        currentPassword = savedPassword;
        showAdminPanel();
    }
    
    // Инициализация кнопок админа
    initAdminControlButtons();
    
    // Периодическое обновление статистики кэша
    setInterval(loadCacheStats, 60000); // каждую минуту
});

// Инициализация кнопок управления для админа
function initAdminControlButtons() {
    const checkAdminPanel = setInterval(() => {
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel && adminPanel.style.display !== 'none') {
            const locationBtn = document.querySelector('.location-btn');
            
            if (locationBtn) {
                locationBtn.addEventListener('mousedown', function() {
                    this.style.transform = 'translateY(-1px)';
                });
                
                locationBtn.addEventListener('mouseup', function() {
                    this.style.transform = '';
                });
                
                clearInterval(checkAdminPanel);
            }
        }
    }, 100);
}

// Вход в админ панель
function adminLogin() {
    const password = document.getElementById('adminPassword').value;
    
    if (!password) {
        showNotification('Введите пароль', 'error');
        return;
    }
    
    currentPassword = password;
    sessionStorage.setItem('adminPassword', password);
    showAdminPanel();
}

// Показать админ панель
async function showAdminPanel() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    
    // Инициализируем карту
    initAdminMap();
    
    // Загружаем точки и статистику кэша
    await Promise.all([
        loadAdminPoints(),
        loadCacheStats()
    ]);
}

// Инициализация админ карты
function initAdminMap() {
    if (adminMap) {
        adminMap.remove();
    }
    
    adminMap = L.map('adminMap').setView(ALMATY_CENTER, 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(adminMap);
    
    // Добавляем обработчик клика для добавления точек
    adminMap.on('click', function(e) {
        if (isAddMode) {
            openAddPointModal(e.latlng);
        }
    });
    
    // Принудительно обновляем размер карты после инициализации
    setTimeout(() => {
        adminMap.invalidateSize();
    }, 100);
}

// Функция получения геолокации для админа
function getAdminLocation() {
    const locationBtn = document.querySelector('.location-btn');
    
    if (!navigator.geolocation) {
        showNotification('Геолокация не поддерживается', 'error');
        return;
    }
    
    const originalText = locationBtn.innerHTML;
    locationBtn.innerHTML = '⏳ Определение...';
    locationBtn.disabled = true;
    locationBtn.style.opacity = '0.8';
    locationBtn.style.animation = 'pulse 1.5s infinite';
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Создаем улучшенный маркер пользователя для админа
            const userIcon = L.divIcon({
                className: 'admin-user-location-marker',
                html: `<div style="
                    background: linear-gradient(45deg, #667eea, #764ba2);
                    width: 26px; 
                    height: 26px; 
                    border-radius: 50%; 
                    border: 3px solid white; 
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                    position: relative;
                    transition: all 0.3s ease;
                ">
                    <div style="
                        position: absolute;
                        top: -6px;
                        left: -6px;
                        right: -6px;
                        bottom: -6px;
                        border-radius: 50%;
                        border: 2px solid #667eea;
                        opacity: 0.3;
                        animation: adminUserPulse 2s infinite;
                    "></div>
                </div>`,
                iconSize: [26, 26],
                iconAnchor: [13, 13]
            });
            
            // Добавляем стили для анимации пульса админа
            if (!document.getElementById('admin-user-pulse-styles')) {
                const style = document.createElement('style');
                style.id = 'admin-user-pulse-styles';
                style.textContent = `
                    @keyframes adminUserPulse {
                        0% {
                            transform: scale(1);
                            opacity: 0.7;
                        }
                        50% {
                            opacity: 0.2;
                        }
                        100% {
                            transform: scale(2.2);
                            opacity: 0;
                        }
                    }
                    
                    .admin-user-location-marker:hover > div {
                        transform: scale(1.1);
                        box-shadow: 0 6px 20px rgba(0,0,0,0.4);
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Удаляем предыдущий маркер админа если есть
            if (window.adminUserMarker) {
                adminMap.removeLayer(window.adminUserMarker);
            }
            
            // Добавляем новый маркер
            window.adminUserMarker = L.marker([lat, lng], { icon: userIcon })
                .addTo(adminMap)
                .bindPopup(`
                    <div style="text-align: center; min-width: 150px;">
                        <strong>🛡️ Местоположение админа</strong><br>
                        <small style="color: #666;">
                            ${lat.toFixed(6)}, ${lng.toFixed(6)}
                        </small>
                    </div>
                `);
            
            // Плавно центрируем карту на админе
            adminMap.flyTo([lat, lng], 16, {
                duration: 1.5,
                easeLinearity: 0.5
            });
            
            showNotification('Местоположение определено', 'success');
            
            // Восстанавливаем кнопку
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
            locationBtn.style.opacity = '';
            locationBtn.style.animation = '';
        },
        function(error) {
            console.error('Ошибка геолокации:', error);
            let errorMessage = 'Не удалось определить местоположение';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Доступ к геолокации запрещен';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Местоположение недоступно';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Превышено время ожидания';
                    break;
            }
            
            showNotification(errorMessage, 'error');
            
            // Восстанавливаем кнопку
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
            locationBtn.style.opacity = '';
            locationBtn.style.animation = '';
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        }
    );
}

// Загрузка точек для админа с поддержкой кэша
async function loadAdminPoints(forceRefresh = false) {
    try {
        console.log('🛡️ Загрузка админских точек...');
        
        const headers = {
            'Accept': 'application/json',
            'X-Admin-Password': encodeURIComponent(currentPassword)
        };
        
        // Добавляем заголовок для принудительного обновления кэша
        if (forceRefresh) {
            headers['Cache-Control'] = 'no-cache';
        }
        
        const response = await fetch('/api/admin/points', {
            method: 'GET',
            headers: headers
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                showNotification('Неверный пароль', 'error');
                sessionStorage.removeItem('adminPassword');
                location.reload();
                return;
            }
            throw new Error('Failed to load points');
        }
        
        allPoints = await response.json();
        
        // Проверяем заголовки кэша
        const cacheStatus = response.headers.get('X-Cache');
        const cacheKey = response.headers.get('X-Cache-Key');
        
        if (cacheStatus) {
            console.log(`💾 Админские точки: Cache ${cacheStatus} (${cacheKey})`);
        }
        
        updateAdminMap();
        updateAdminStats();
        updatePointsList();
        
        AdminCache.updateTimestamp();
        
        console.log(`✅ Загружено ${allPoints.length} админских точек`);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки админских точек:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

// Загрузка статистики кэша
async function loadCacheStats() {
    try {
        const response = await fetch('/api/admin/cache/stats', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Admin-Password': encodeURIComponent(currentPassword)
            }
        });
        
        if (response.ok) {
            const stats = await response.json();
            AdminCache.cacheStats = stats;
            displayCacheStats(stats);
            console.log('📊 Статистика кэша загружена:', stats.cache);
        }
    } catch (error) {
        console.warn('⚠️ Не удалось загрузить статистику кэша:', error);
    }
}

// Отображение статистики кэша в админ панели
function displayCacheStats(stats) {
    // Добавляем блок статистики кэша если его нет
    let cacheStatsElement = document.getElementById('cacheStats');
    if (!cacheStatsElement) {
        const adminStatsContainer = document.querySelector('.admin-stats');
        if (adminStatsContainer) {
            const cacheStatsHTML = `
                <div id="cacheStats" class="cache-stats" style="
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 15px;
                    padding: 15px;
                    margin-top: 15px;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                ">
                    <h4 style="margin-bottom: 10px; color: #333;">📊 Статистика кэша</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.85rem;">
                        <div>Размер: <strong id="cacheSize">-</strong></div>
                        <div>Попадания: <strong id="cacheHits">-</strong></div>
                        <div>Промахи: <strong id="cacheMisses">-</strong></div>
                        <div>Hit Rate: <strong id="cacheHitRate">-</strong></div>
                    </div>
                    <div style="margin-top: 10px;">
                        <button onclick="clearServerCache()" style="
                            background: #f44336; 
                            color: white; 
                            border: none; 
                            padding: 5px 10px; 
                            border-radius: 5px; 
                            cursor: pointer;
                            font-size: 0.8rem;
                            margin-right: 10px;
                        ">Очистить кэш</button>
                        <button onclick="loadAdminPoints(true)" style="
                            background: #4CAF50; 
                            color: white; 
                            border: none; 
                            padding: 5px 10px; 
                            border-radius: 5px; 
                            cursor: pointer;
                            font-size: 0.8rem;
                        ">Обновить</button>
                    </div>
                </div>
            `;
            adminStatsContainer.insertAdjacentHTML('afterend', cacheStatsHTML);
        }
    }
    
    // Обновляем значения
    const updateElement = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };
    
    if (stats.cache) {
        updateElement('cacheSize', stats.cache.size);
        updateElement('cacheHits', stats.cache.hits);
        updateElement('cacheMisses', stats.cache.misses);
        updateElement('cacheHitRate', stats.cache.hitRate);
    }
}

// Очистка серверного кэша
async function clearServerCache() {
    if (!confirm('Вы уверены, что хотите очистить серверный кэш?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/admin/cache/clear', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'X-Admin-Password': encodeURIComponent(currentPassword)
            }
        });
        
        if (response.ok) {
            showNotification('Серверный кэш очищен', 'success');
            // Обновляем данные после очистки кэша
            setTimeout(() => {
                loadAdminPoints(true);
                loadCacheStats();
            }, 500);
        } else {
            throw new Error('Failed to clear cache');
        }
    } catch (error) {
        console.error('❌ Ошибка очистки кэша:', error);
        showNotification('Ошибка очистки кэша', 'error');
    }
}

// Обновление админ карты с улучшенными маркерами
function updateAdminMap() {
    // Очищаем существующие маркеры
    adminMarkers.forEach(marker => adminMap.removeLayer(marker));
    adminMarkers = [];
    
    allPoints.forEach(point => {
        const now = new Date();
        const isScheduled = new Date(point.scheduledTime) > now;
        const isCollected = point.status === 'collected';
        
        let iconColor = '#4CAF50'; // зеленый для доступных
        if (isCollected) iconColor = '#f44336'; // красный для собранных
        else if (isScheduled) iconColor = '#ff9800'; // оранжевый для запланированных
        
        const icon = L.divIcon({
            className: 'admin-marker',
            html: `<div class="admin-marker-dot" style="background: ${iconColor};">
                     ${isScheduled ? '⏱️' : (isCollected ? '✅' : '📦')}
                   </div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
        
        const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon })
            .addTo(adminMap);
        
        // Улучшенный popup для админа
        let popupContent = `
            <div class="admin-popup">
                <h3>${point.name}</h3>
                <p><strong>ID:</strong> ${point.id}</p>
                <p><strong>Статус:</strong> ${getStatusText(point, isScheduled)}</p>
                <p><strong>Создана:</strong> ${new Date(point.createdAt).toLocaleString('ru-RU')}</p>
        `;
        
        if (isScheduled) {
            popupContent += `<p><strong>Появится:</strong> ${new Date(point.scheduledTime).toLocaleString('ru-RU')}</p>`;
        }
        
        if (point.status === 'collected') {
            popupContent += `
                <p><strong>Собрана:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>
                <p><strong>Сборщик:</strong> ${point.collectorInfo.name}</p>
            `;
        }
        
        popupContent += `
                <div style="margin-top: 12px;">
                    <button onclick="showQRCode('${point.id}')" class="admin-btn">Показать QR</button>
                    <button onclick="deletePoint('${point.id}')" class="admin-btn delete-btn">Удалить</button>
                </div>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        adminMarkers.push(marker);
    });
    
    addAdminMarkerStyles();
}

// Получить текст статуса
function getStatusText(point, isScheduled) {
    if (point.status === 'collected') return '🔴 Собрана';
    if (isScheduled) return '🟡 Запланирована';
    return '🟢 Доступна';
}

// Обновление админ статистики с анимацией
function updateAdminStats() {
    const now = new Date();
    const total = allPoints.length;
    const scheduled = allPoints.filter(p => new Date(p.scheduledTime) > now && p.status !== 'collected').length;
    const active = allPoints.filter(p => new Date(p.scheduledTime) <= now && p.status === 'available').length;
    
    // Анимированное обновление
    animateAdminNumber(document.getElementById('totalPoints'), total);
    animateAdminNumber(document.getElementById('activePoints'), active);
    animateAdminNumber(document.getElementById('scheduledPoints'), scheduled);
}

// Анимация чисел для админ панели
function animateAdminNumber(element, targetValue) {
    if (!element) return;
    
    const currentValue = parseInt(element.textContent) || 0;
    if (currentValue === targetValue) return;
    
    const duration = 600;
    const steps = 20;
    const stepValue = (targetValue - currentValue) / steps;
    const stepDuration = duration / steps;
    
    let current = currentValue;
    let step = 0;
    
    element.style.transform = 'scale(1.1)';
    element.style.transition = 'transform 0.3s ease';
    
    const timer = setInterval(() => {
        step++;
        current += stepValue;
        
        if (step >= steps) {
            element.textContent = targetValue;
            element.style.transform = 'scale(1)';
            clearInterval(timer);
        } else {
            element.textContent = Math.round(current);
        }
    }, stepDuration);
}

// Обновление списка точек
function updatePointsList() {
    const container = document.getElementById('pointsList');
    
    if (allPoints.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Нет созданных точек</p>';
        return;
    }
    
    const sortedPoints = [...allPoints].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    container.innerHTML = sortedPoints.map(point => {
        const now = new Date();
        const isScheduled = new Date(point.scheduledTime) > now;
        const statusClass = point.status === 'collected' ? 'collected' : (isScheduled ? 'scheduled' : 'available');
        
        return `
            <div class="point-item ${statusClass}">
                <div class="point-header">
                    <h4>${point.name}</h4>
                    <span class="point-status">${getStatusText(point, isScheduled)}</span>
                </div>
                <p><strong>ID:</strong> ${point.id}</p>
                <p><strong>Координаты:</strong> ${point.coordinates.lat.toFixed(6)}, ${point.coordinates.lng.toFixed(6)}</p>
                <p><strong>Создана:</strong> ${new Date(point.createdAt).toLocaleString('ru-RU')}</p>
                ${isScheduled ? `<p><strong>Появится:</strong> ${new Date(point.scheduledTime).toLocaleString('ru-RU')}</p>` : ''}
                ${point.status === 'collected' ? `
                    <p><strong>Собрана:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>
                    <p><strong>Сборщик:</strong> ${point.collectorInfo.name}</p>
                ` : ''}
                <div class="point-actions">
                    <button onclick="showQRCode('${point.id}')" class="admin-btn">QR код</button>
                    <button onclick="deletePoint('${point.id}')" class="admin-btn delete-btn">Удалить</button>
                </div>
            </div>
        `;
    }).join('');
}

// Переключение режима добавления
function toggleAddMode() {
    isAddMode = !isAddMode;
    const btn = document.getElementById('addModeBtn');
    
    if (isAddMode) {
        btn.textContent = 'Режим добавления: ВКЛ';
        btn.classList.add('active');
        adminMap.getContainer().style.cursor = 'crosshair';
        showNotification('Кликните по карте для добавления точки', 'info');
    } else {
        btn.textContent = 'Режим добавления: ВЫКЛ';
        btn.classList.remove('active');
        adminMap.getContainer().style.cursor = '';
    }
}

// Открыть модальное окно добавления точки
function openAddPointModal(latlng) {
    window.tempCoordinates = latlng;
    document.getElementById('addPointModal').style.display = 'block';
    document.getElementById('modelName').focus();
}

// Закрыть модальное окно добавления
function closeAddModal() {
    document.getElementById('addPointModal').style.display = 'none';
    document.getElementById('addPointForm').reset();
}

// Альтернативная функция для отправки данных через POST body
async function createPointAlternative(pointData) {
    try {
        const response = await fetch('/api/admin/points/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify({
                ...pointData,
                adminPassword: currentPassword
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Server error');
        }
        
        return await response.json();
    } catch (error) {
        throw error;
    }
}

// Показать QR код для только что созданной точки
function showQRCodeForNewPoint(point) {
    currentQRCode = point.qrCode;
    
    document.getElementById('qrCodeDisplay').innerHTML = `
        <img src="${point.qrCode}" alt="QR код для ${point.name}" style="max-width: 280px; border-radius: 12px;">
        <p style="font-weight: 600; margin-top: 15px;"><strong>${point.name}</strong></p>
        <p style="color: #666;">ID: ${pointId}</p>
    `;
    
    document.getElementById('qrModal').style.display = 'block';
}

// Закрыть QR модальное окно
function closeQrModal() {
    document.getElementById('qrModal').style.display = 'none';
}

// Скачать QR код
function downloadQR() {
    if (!currentQRCode) return;
    
    const link = document.createElement('a');
    link.download = `plasticboy-qr-${Date.now()}.png`;
    link.href = currentQRCode;
    link.click();
}

// Удалить точку с инвалидацией кэша
async function deletePoint(pointId) {
    if (!confirm('Вы уверены, что хотите удалить эту точку?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/points/${pointId}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'X-Admin-Password': encodeURIComponent(currentPassword),
                'Cache-Control': 'no-cache' // Принудительно обновляем кэш
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete point');
        }
        
        showNotification('Точка удалена', 'success');
        
        // Обновляем данные с принудительным обновлением кэша
        await loadAdminPoints(true);
        await loadCacheStats();
        
    } catch (error) {
        console.error('❌ Ошибка удаления:', error);
        showNotification('Ошибка удаления точки', 'error');
    }
}

// Добавление улучшенных стилей для админ маркеров
function addAdminMarkerStyles() {
    if (!document.getElementById('admin-marker-styles')) {
        const style = document.createElement('style');
        style.id = 'admin-marker-styles';
        style.textContent = `
            .admin-marker {
                background: none !important;
                border: none !important;
            }
            
            .admin-marker-dot {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 3px solid white;
                box-shadow: 0 4px 15px rgba(0,0,0,0.25);
                font-size: 16px;
                color: white;
                font-weight: bold;
                transition: all 0.3s ease;
                cursor: pointer;
            }
            
            .admin-marker-dot:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(0,0,0,0.35);
            }
            
            .admin-popup {
                min-width: 220px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .admin-popup h3 {
                margin: 0 0 12px 0;
                color: #333;
                font-size: 1.1rem;
                font-weight: 600;
            }
            
            .admin-popup p {
                margin: 6px 0;
                font-size: 0.9rem;
            }
            
            .admin-btn {
                background: linear-gradient(45deg, #667eea, #764ba2);
                color: white;
                border: none;
                padding: 8px 14px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.85rem;
                margin: 6px 6px 0 0;
                min-width: 90px;
                transition: all 0.3s;
                font-weight: 500;
            }
            
            .admin-btn:hover {
                background: linear-gradient(45deg, #5a67d8, #6b46c1);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            }
            
            .delete-btn {
                background: linear-gradient(45deg, #f44336, #e53935) !important;
            }
            
            .delete-btn:hover {
                background: linear-gradient(45deg, #d32f2f, #c62828) !important;
                box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3) !important;
            }
            
            .point-item {
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 16px;
                background: white;
                box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                transition: all 0.3s ease;
            }
            
            .point-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0,0,0,0.12);
            }
            
            .point-item.available {
                border-left: 4px solid #4CAF50;
            }
            
            .point-item.collected {
                border-left: 4px solid #f44336;
            }
            
            .point-item.scheduled {
                border-left: 4px solid #ff9800;
            }
            
            .point-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            
            .point-header h4 {
                margin: 0;
                color: #333;
                font-size: 1.1rem;
                font-weight: 600;
            }
            
            .point-status {
                font-size: 0.9rem;
                font-weight: 600;
                padding: 4px 8px;
                border-radius: 12px;
                background: rgba(255,255,255,0.8);
            }
            
            .point-actions {
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid #eee;
            }
            
            .cache-stats {
                animation: fadeIn 0.5s ease-in;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Улучшенная функция показа уведомлений для админа
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${getNotificationIcon(type)} ${message}</span>
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 2000;
                background: rgba(255, 255, 255, 0.98);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                backdrop-filter: blur(10px);
                padding: 16px;
                min-width: 280px;
                max-width: 400px;
                animation: slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                border: 1px solid rgba(255,255,255,0.2);
                font-weight: 500;
            }
            
            .notification.error {
                border-left: 4px solid #f44336;
                background: linear-gradient(135deg, rgba(244, 67, 54, 0.05), rgba(255, 255, 255, 0.98));
            }
            
            .notification.success {
                border-left: 4px solid #4CAF50;
                background: linear-gradient(135deg, rgba(76, 175, 80, 0.05), rgba(255, 255, 255, 0.98));
            }
            
            .notification.info {
                border-left: 4px solid #2196F3;
                background: linear-gradient(135deg, rgba(33, 150, 243, 0.05), rgba(255, 255, 255, 0.98));
            }
            
            .notification.warning {
                border-left: 4px solid #ff9800;
                background: linear-gradient(135deg, rgba(255, 152, 0, 0.05), rgba(255, 255, 255, 0.98));
            }
            
            .notification-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .notification-content button {
                background: none;
                border: none;
                font-size: 1.3rem;
                cursor: pointer;
                color: #999;
                padding: 0;
                margin: 0;
                width: auto;
                margin-left: 12px;
                transition: color 0.3s;
            }
            
            .notification-content button:hover {
                color: #666;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%) scale(0.9);
                    opacity: 0;
                }
                to {
                    transform: translateX(0) scale(1);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Получить иконку для уведомления
function getNotificationIcon(type) {
    const icons = {
        error: '❌',
        success: '✅',
        info: 'ℹ️',
        warning: '⚠️'
    };
    return icons[type] || icons.info;
}

// Закрытие модальных окон при клике вне их
window.addEventListener('click', function(event) {
    const addModal = document.getElementById('addPointModal');
    const qrModal = document.getElementById('qrModal');
    
    if (event.target === addModal) {
        closeAddModal();
    }
    
    if (event.target === qrModal) {
        closeQrModal();
    }
});

// Обработка Enter в поле пароля
document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('adminPassword');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                adminLogin();
            }
        });
    }
});

// Обработка изменения размера окна для админ карты
window.addEventListener('resize', function() {
    if (adminMap) {
        clearTimeout(window.adminResizeTimeout);
        window.adminResizeTimeout = setTimeout(() => {
            adminMap.invalidateSize();
        }, 150);
    }
});

// Улучшенная обработка клавиш для админа
document.addEventListener('keydown', function(event) {
    // Закрытие модальных окон по Escape
    if (event.key === 'Escape') {
        closeAddModal();
        closeQrModal();
    }
    
    // Определение местоположения по Ctrl+L
    if (event.ctrlKey && event.key === 'l') {
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel && adminPanel.style.display !== 'none') {
            event.preventDefault();
            getAdminLocation();
        }
    }
    
    // Переключение режима добавления по Ctrl+A
    if (event.ctrlKey && event.key === 'a') {
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel && adminPanel.style.display !== 'none') {
            event.preventDefault();
            toggleAddMode();
        }
    }
    
    // Принудительное обновление данных по Ctrl+R
    if (event.ctrlKey && event.key === 'r') {
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel && adminPanel.style.display !== 'none') {
            event.preventDefault();
            loadAdminPoints(true);
            loadCacheStats();
        }
    }
    
    // Очистка кэша по Ctrl+Shift+C
    if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel && adminPanel.style.display !== 'none') {
            event.preventDefault();
            clearServerCache();
        }
    }
});

// Автообновление данных для админ панели
setInterval(() => {
    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel && adminPanel.style.display !== 'none' && AdminCache.shouldRefresh()) {
        loadAdminPoints();
        loadCacheStats();
    }
}, 60000); // каждую минуту

console.log('🛡️ Админская панель с поддержкой кэширования готова');<p style="font-weight: 600; margin-top: 15px;"><strong>${point.name}</strong></p>
        <p style="color: #666;">ID: ${point.id}</p>
    `;
    
    document.getElementById('qrModal').style.display = 'block';
}

// Обработка формы добавления точки с инвалидацией кэша
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('addPointForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('modelName').value;
        const delayMinutes = document.getElementById('delayMinutes').value;
        
        if (!window.tempCoordinates) {
            showNotification('Ошибка координат', 'error');
            return;
        }
        
        try {
            const requestData = {
                name: name,
                coordinates: {
                    lat: window.tempCoordinates.lat,
                    lng: window.tempCoordinates.lng
                },
                delayMinutes: delayMinutes || 0
            };

            let response;
            let newPoint;
            
            try {
                response = await fetch('/api/admin/points', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'X-Admin-Password': encodeURIComponent(currentPassword),
                        'Cache-Control': 'no-cache' // Принудительно обновляем кэш
                    },
                    body: JSON.stringify(requestData)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Server error');
                }
                
                newPoint = await response.json();
                
            } catch (fetchError) {
                console.log('Использование альтернативного метода...');
                newPoint = await createPointAlternative(requestData);
            }
            
            closeAddModal();
            showNotification('Точка успешно создана!', 'success');
            
            // Показываем QR код для новой точки
            showQRCodeForNewPoint(newPoint);
            
            // Обновляем данные с принудительным обновлением кэша
            await loadAdminPoints(true);
            await loadCacheStats();
            
        } catch (error) {
            console.error('❌ Ошибка создания точки:', error);
            showNotification(error.message, 'error');
        }
    });
});

// Показать QR код для существующих точек
function showQRCode(pointId, qrCodeData = null) {
    if (qrCodeData) {
        currentQRCode = qrCodeData;
        document.getElementById('qrCodeDisplay').innerHTML = `
            <img src="${qrCodeData}" alt="QR код" style="max-width: 280px; border-radius: 12px;">
            <p style="color: #666; margin-top: 15px;">ID: ${pointId}</p>
        `;
        document.getElementById('qrModal').style.display = 'block';
        return;
    }
    
    const point = allPoints.find(p => p.id === pointId);
    if (!point) {
        showNotification('Точка не найдена', 'error');
        return;
    }
    
    currentQRCode = point.qrCode;
    
    document.getElementById('qrCodeDisplay').innerHTML = `
        <img src="${point.qrCode}" alt="QR код для ${point.name}" style="max-width: 280px; border-radius: 12px;">
