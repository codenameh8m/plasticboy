// Добавить в admin.js после существующего кода

// Показать статистику пользователей в админ панели
function showUserStats() {
    fetch('/api/leaderboard?limit=100')
        .then(response => response.json())
        .then(data => {
            let content = '<h3>👥 Статистика пользователей</h3>';
            content += '<table style="width: 100%; border-collapse: collapse;">';
            content += '<thead><tr>';
            content += '<th style="text-align: left; padding: 10px; border-bottom: 2px solid #ddd;">Позиция</th>';
            content += '<th style="text-align: left; padding: 10px; border-bottom: 2px solid #ddd;">Instagram</th>';
            content += '<th style="text-align: left; padding: 10px; border-bottom: 2px solid #ddd;">Собрано</th>';
            content += '<th style="text-align: left; padding: 10px; border-bottom: 2px solid #ddd;">Достижения</th>';
            content += '</tr></thead><tbody>';
            
            data.users.forEach((user, index) => {
                const badges = user.badges ? user.badges.map(b => getBadgeEmoji(b)).join(' ') : '-';
                content += '<tr>';
                content += `<td style="padding: 10px; border-bottom: 1px solid #eee;">#${index + 1}</td>`;
                content += `<td style="padding: 10px; border-bottom: 1px solid #eee;">@${user.instagramUsername}</td>`;
                content += `<td style="padding: 10px; border-bottom: 1px solid #eee;">${user.collectedCount}</td>`;
                content += `<td style="padding: 10px; border-bottom: 1px solid #eee;">${badges}</td>`;
                content += '</tr>';
            });
            
            content += '</tbody></table>';
            
            showNotification('Статистика пользователей загружена', 'success');
            
            // Показываем в модальном окне
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px;">
                    <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                    ${content}
                </div>
            `;
            document.body.appendChild(modal);
        })
        .catch(error => {
            console.error('Error loading user stats:', error);
            showNotification('Ошибка загрузки статистики', 'error');
        });
}

// Получить эмодзи для бейджа (дублируем функцию)
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

// Добавляем кнопку для просмотра статистики пользователей
document.addEventListener('DOMContentLoaded', function() {
    // Ждем загрузку админ панели
    const checkAdminPanel = setInterval(() => {
        const adminControls = document.querySelector('.admin-controls');
        if (adminControls && !document.getElementById('userStatsBtn')) {
            const statsBtn = document.createElement('button');
            statsBtn.id = 'userStatsBtn';
            statsBtn.textContent = '👥 Статистика пользователей';
            statsBtn.onclick = showUserStats;
            statsBtn.style.marginLeft = '10px';
            adminControls.appendChild(statsBtn);
            clearInterval(checkAdminPanel);
        }
    }, 100);
});
