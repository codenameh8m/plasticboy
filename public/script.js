// Инициализация карты
let map;
let markers = [];

// Координаты Алматы
const ALMATY_CENTER = [43.2220, 76.8512];

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    loadPoints();
    
    // Автообновление каждые 30 секунд
    setInterval(loadPoints, 30000);
});

// Инициализация карты
function initMap() {
    map = L.map('map').setView(ALMATY_CENTER, 12);
    
    // Используем минималистичную карту
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);
    
    // Стилизация карты
    map.getContainer().style.filter = 'grayscale(20%) contrast(1.1)';
}

// Загрузка точек с сервера
async function loadPoints() {
    try {
        const response = await fetch('/api/points', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error('Failed to load points');
        }
        
        const points = await response.json();
        updateMap(points);
        updateStats(points);
        
    } catch (error) {
        console.error('Error loading points:', error);
        showNotification('Error loading data', 'error');
    }
}

// Обновление карты
function updateMap(points) {
    // Очищаем существующие маркеры
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    points.forEach(point => {
        const isAvailable = point.status === 'available';
        
        // Создаем кастомную иконку
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-dot ${isAvailable ? 'available' : 'collected'}">
                     <div class="marker-pulse ${isAvailable ? 'pulse' : ''}"></div>
                   </div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        
        const marker = L.marker([point.coordinates.lat, point.coordinates.lng], { icon })
            .addTo(map);
        
        // Добавляем popup
        let popupContent = `
            <div class="popup-content">
                <h3>${point.name}</h3>
                <p class="status ${point.status}">
                    ${isAvailable ? '🟢 Доступна для сбора' : '🔴 Уже собрана'}
                </p>
        `;
        
        if (!isAvailable && point.collectorInfo) {
            popupContent += `
                <div class="collector-info">
                    <p><strong>Собрал:</strong> ${point.collectorInfo.name}</p>
                    ${point.collectorInfo.signature ? `<p><strong>Сообщение:</strong> ${point.collectorInfo.signature}</p>` : ''}
                    <p><strong>Время:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>
                </div>
            `;
            
            // Добавляем кнопку для просмотра подробностей
            popupContent += `<button onclick="showPointDetails('${point.id}')" class="details-btn">Подробнее</button>`;
        }
        
        popupContent += '</div>';
        marker.bindPopup(popupContent);
        markers.push(marker);
    });
    
    // Добавляем стили для маркеров
    addMarkerStyles();
}

// Добавление стилей для маркеров
function addMarkerStyles() {
    if (!document.getElementById('marker-styles')) {
        const style = document.createElement('style');
        style.id = 'marker-styles';
        style.textContent = `
            .custom-marker {
                background: none !important;
                border: none !important;
            }
            
            .marker-dot {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                position: relative;
                border: 3px solid white;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            }
            
            .marker-dot.available {
                background: #4CAF50;
            }
            
            .marker-dot.collected {
                background: #f44336;
            }
            
            .marker-pulse {
                position: absolute;
                top: -3px;
                left: -3px;
                right: -3px;
                bottom: -3px;
                border-radius: 50%;
                border: 2px solid #4CAF50;
                opacity: 0;
            }
            
            .marker-pulse.pulse {
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0% {
                    transform: scale(1);
                    opacity: 1;
                }
                50% {
                    opacity: 0.3;
                }
                100% {
                    transform: scale(1.5);
                    opacity: 0;
                }
            }
            
            .popup-content {
                min-width: 200px;
            }
            
            .popup-content h3 {
                margin: 0 0 10px 0;
                color: #333;
                font-size: 1.1rem;
            }
            
            .status {
                margin: 10px 0;
                font-weight: 600;
            }
            
            .status.available {
                color: #4CAF50;
            }
            
            .status.collected {
                color: #f44336;
            }
            
            .collector-info {
                background: #f8f9fa;
                padding: 10px;
                border-radius: 8px;
                margin: 10px 0;
                font-size: 0.9rem;
            }
            
            .collector-info p {
                margin: 5px 0;
            }
            
            .details-btn {
                background: #667eea;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.9rem;
                margin-top: 10px;
                width: 100%;
            }
            
            .details-btn:hover {
                background: #5a67d8;
            }
        `;
        document.head.appendChild(style);
    }
}

// Обновление статистики
function updateStats(points) {
    const available = points.filter(p => p.status === 'available').length;
    const collected = points.filter(p => p.status === 'collected').length;
    
    document.getElementById('availableCount').textContent = available;
    document.getElementById('collectedCount').textContent = collected;
}

// Показать подробности точки
async function showPointDetails(pointId) {
    try {
        const response = await fetch(`/api/point/${pointId}/info`);
        if (!response.ok) {
            throw new Error('Ошибка загрузки информации');
        }
        
        const point = await response.json();
        
        let modalContent = `
            <h3>${point.name}</h3>
            <p><strong>Статус:</strong> ${point.status === 'collected' ? 'Собрана' : 'Доступна'}</p>
            <p><strong>Координаты:</strong> ${point.coordinates.lat.toFixed(6)}, ${point.coordinates.lng.toFixed(6)}</p>
        `;
        
        if (point.status === 'collected' && point.collectorInfo) {
            modalContent += `
                <hr style="margin: 15px 0;">
                <h4>Информация о сборщике:</h4>
                <p><strong>Имя:</strong> ${point.collectorInfo.name}</p>
                ${point.collectorInfo.signature ? `<p><strong>Сообщение:</strong> ${point.collectorInfo.signature}</p>` : ''}
                <p><strong>Время сбора:</strong> ${new Date(point.collectedAt).toLocaleString('ru-RU')}</p>
            `;
            
            if (point.collectorInfo.selfie) {
                modalContent += `
                    <div style="margin-top: 15px;">
                        <strong>Селфи с места находки:</strong><br>
                        <img src="${point.collectorInfo.selfie}" 
                             style="max-width: 100%; max-height: 300px; border-radius: 8px; margin-top: 10px;"
                             alt="Селфи сборщика">
                    </div>
                `;
            }
        }
        
        document.getElementById('modalTitle').innerHTML = 'Информация о модели';
        document.getElementById('modalBody').innerHTML = modalContent;
        document.getElementById('infoModal').style.display = 'block';
        
    } catch (error) {
        console.error('Ошибка загрузки информации:', error);
        showNotification('Ошибка загрузки информации', 'error');
    }
}

// Закрыть модальное окно
function closeModal() {
    document.getElementById('infoModal').style.display = 'none';
}

// Показать уведомление
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Добавляем стили для уведомлений если их нет
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
    
    // Автоматически удаляем через 5 секунд
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Закрытие модального окна при клике вне его
window.addEventListener('click', function(event) {
    const modal = document.getElementById('infoModal');
    if (event.target === modal) {
        closeModal();
    }
});

// Обработка ошибок загрузки карты
window.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG' && e.target.src.includes('openstreetmap')) {
        console.warn('Ошибка загрузки тайлов карты');
        showNotification('Проблемы с загрузкой карты. Проверьте интернет-соединение.', 'error');
    }
});

// Добавляем обработчик для кнопки обновления
document.addEventListener('DOMContentLoaded', function() {
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            this.style.transform = 'rotate(360deg)';
            setTimeout(() => {
                this.style.transform = '';
            }, 500);
        });
    }
});
