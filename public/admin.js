// Переменные для админ панели
let adminMap;
let adminMarkers = [];
let isAddMode = false;
let currentPassword = '';
let allPoints = [];
let currentQRCode = '';

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// Инициализация админ панели
document.addEventListener('DOMContentLoaded', function() {
    // Проверяем сохраненный пароль
    const savedPassword = sessionStorage.getItem('adminPassword');
    if (savedPassword) {
        currentPassword = savedPassword;
        showAdminPanel();
    }
});

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
    
    // Загружаем точки
    await loadAdminPoints();
}

// Инициализация админ карты
function initAdminMap() {
    if (adminMap) {
        adminMap.remove();
    }
    
    adminMap = L.map('adminMap').setView(ALMATY_CENTER, 12);
    
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
}

// Загрузка точек для админа
async function loadAdminPoints() {
    try {
        const response = await fetch('/api/admin/points', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Admin-Password': encodeURIComponent(currentPassword)
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                showNotification('Invalid password', 'error');
                sessionStorage.removeItem('adminPassword');
                location.reload();
                return;
            }
            throw new Error('Failed to load points');
        }
        
        allPoints = await response.json();
        updateAdminMap();
        updateAdminStats();
        updatePointsList();
        
    } catch (error) {
        console.error('Error loading points:', error);
        showNotification('Error loading data', 'error');
    }
}

// Обновление админ карты
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
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon })
            .addTo(adminMap);
        
        // Popup для админа
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
                <button onclick="showQRCode('${point.id}')" class="admin-btn">Показать QR</button>
                <button onclick="deletePoint('${point.id}')" class="admin-btn delete-btn">Удалить</button>
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

// Обновление админ статистики
function updateAdminStats() {
    const now = new Date();
    const total = allPoints.length;
    const scheduled = allPoints.filter(p => new Date(p.scheduledTime) > now && p.status !== 'collected').length;
    const active = allPoints.filter(p => new Date(p.scheduledTime) <= now && p.status === 'available').length;
    
    document.getElementById('totalPoints').textContent = total;
    document.getElementById('activePoints').textContent = active;
    document.getElementById('scheduledPoints').textContent = scheduled;
}

// Обновление списка точек
function updatePointsList() {
    const container = document.getElementById('pointsList');
    
    if (allPoints.length === 0) {
        container.innerHTML = '<p>Нет созданных точек</p>';
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

// НОВАЯ ФУНКЦИЯ: Показать QR код для только что созданной точки
function showQRCodeForNewPoint(point) {
    currentQRCode = point.qrCode;
    
    document.getElementById('qrCodeDisplay').innerHTML = `
        <img src="${point.qrCode}" alt="QR код для ${point.name}">
        <p><strong>${point.name}</strong></p>
        <p>ID: ${point.id}</p>
    `;
    
    document.getElementById('qrModal').style.display = 'block';
}

// Обработка формы добавления точки - ИСПРАВЛЕННАЯ ВЕРСИЯ
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('addPointForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('modelName').value;
        const delayMinutes = document.getElementById('delayMinutes').value;
        
        if (!window.tempCoordinates) {
            showNotification('Coordinate error', 'error');
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

            // Сначала пробуем основной метод
            let response;
            let newPoint;
            
            try {
                response = await fetch('/api/admin/points', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'X-Admin-Password': encodeURIComponent(currentPassword)
                    },
                    body: JSON.stringify(requestData)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Server error');
                }
                
                newPoint = await response.json();
                
            } catch (fetchError) {
                // Если основной метод не работает, используем альтернативный
                console.log('Using alternative method...');
                newPoint = await createPointAlternative(requestData);
            }
            
            closeAddModal();
            showNotification('Point created successfully!', 'success');
            
            // ИСПРАВЛЕНИЕ: Показываем QR код для новой точки БЕЗ попытки найти её в старом списке
            showQRCodeForNewPoint(newPoint);
            
            // Обновляем данные
            await loadAdminPoints();
            
        } catch (error) {
            console.error('Error creating point:', error);
            showNotification(error.message, 'error');
        }
    });
});

// ИСПРАВЛЕННАЯ функция показа QR кода для существующих точек
function showQRCode(pointId, qrCodeData = null) {
    // Если передан готовый QR код (для новых точек), используем его
    if (qrCodeData) {
        currentQRCode = qrCodeData;
        document.getElementById('qrCodeDisplay').innerHTML = `
            <img src="${qrCodeData}" alt="QR код">
            <p>ID: ${pointId}</p>
        `;
        document.getElementById('qrModal').style.display = 'block';
        return;
    }
    
    // Для существующих точек ищем в списке
    const point = allPoints.find(p => p.id === pointId);
    if (!point) {
        showNotification('Точка не найдена', 'error');
        return;
    }
    
    currentQRCode = point.qrCode;
    
    document.getElementById('qrCodeDisplay').innerHTML = `
        <img src="${point.qrCode}" alt="QR код для ${point.name}">
        <p><strong>${point.name}</strong></p>
        <p>ID: ${pointId}</p>
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

// Удалить точку
async function deletePoint(pointId) {
    if (!confirm('Are you sure you want to delete this point?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/points/${pointId}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'X-Admin-Password': encodeURIComponent(currentPassword)
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete point');
        }
        
        showNotification('Point deleted', 'success');
        await loadAdminPoints();
        
    } catch (error) {
        console.error('Delete error:', error);
        showNotification('Error deleting point', 'error');
    }
}

// Добавление стилей для админ маркеров
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
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 3px solid white;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                font-size: 14px;
                color: white;
                font-weight: bold;
            }
            
            .admin-popup {
                min-width: 200px;
            }
            
            .admin-popup h3 {
                margin: 0 0 10px 0;
                color: #333;
            }
            
            .admin-popup p {
                margin: 5px 0;
                font-size: 0.9rem;
            }
            
            .admin-btn {
                background: #667eea;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.8rem;
                margin: 5px 5px 0 0;
                min-width: 80px;
            }
            
            .admin-btn:hover {
                background: #5a67d8;
            }
            
            .delete-btn {
                background: #f44336 !important;
            }
            
            .delete-btn:hover {
                background: #d32f2f !important;
            }
            
            .point-item {
                border-radius: 10px;
                padding: 15px;
                margin-bottom: 15px;
                background: white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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
                margin-bottom: 10px;
            }
            
            .point-header h4 {
                margin: 0;
                color: #333;
            }
            
            .point-status {
                font-size: 0.9rem;
                font-weight: 600;
            }
            
            .point-actions {
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid #eee;
            }
        `;
        document.head.appendChild(style);
    }
}

// Показать уведомление (используется та же функция что и в основном приложении)
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
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
                background: white;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                padding: 15px;
                min-width: 250px;
                max-width: 350px;
                animation: slideIn 0.3s ease-out;
            }
            
            .notification.error {
                border-left: 4px solid #f44336;
            }
            
            .notification.success {
                border-left: 4px solid #4CAF50;
            }
            
            .notification.info {
                border-left: 4px solid #2196F3;
            }
            
            .notification-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .notification-content button {
                background: none;
                border: none;
                font-size: 1.2rem;
                cursor: pointer;
                color: #999;
                padding: 0;
                margin: 0;
                width: auto;
                margin-left: 10px;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
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
    document.getElementById('adminPassword').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            adminLogin();
        }
    });
});
