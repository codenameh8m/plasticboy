# PlasticBoy Telegram Bot 🤖

Telegram бот для игры PlasticBoy - сбор 3D моделей в Алматы.

## 🚀 Функции бота

### 📋 Основные команды
- `/start` - Запуск бота и главное меню
- `/map` - Открытие интерактивной карты с моделями  
- `/leaderboard` - Рейтинг Telegram пользователей
- `/stats` - Статистика игры и активности
- `/help` - Подробная помощь

### 🎮 Возможности
- **Web App интеграция** - полноценное веб-приложение внутри Telegram
- **Inline клавиатура** - удобная навигация
- **Рейтинг игроков** - топ пользователей авторизованных через Telegram
- **Статистика в реальном времени** - актуальные данные об игре
- **Уведомления** - информация о новых моделях и событиях

## 📁 Структура проекта

```
telegram-bot/
├── bot.js              # Основной файл бота
├── setup-bot.js        # Скрипт настройки бота
├── package.json        # Зависимости
├── .env                # Конфигурация (создать самостоятельно)
└── README.md           # Эта документация
```

## ⚙️ Установка и настройка

### 1. Создание бота в Telegram

1. Перейдите к [@BotFather](https://t.me/botfather)
2. Создайте нового бота командой `/newbot`
3. Следуйте инструкциям для получения токена
4. Сохраните токен для настройки

### 2. Настройка проекта

```bash
# Клонируйте репозиторий
git clone <repository>
cd telegram-bot

# Установите зависимости
npm install

# Создайте .env файл
cp .env.example .env
```

### 3. Конфигурация .env

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=ваш_токен_от_botfather
TELEGRAM_BOT_USERNAME=имя_бота_без_@

# Web App URL
WEB_APP_URL=https://ваш_домен.com

# MongoDB (используется основным приложением)
MONGODB_URI=mongodb://localhost:27017/plasticboy
```

### 4. Настройка бота

```bash
# Автоматическая настройка команд и описания
npm run setup
```

### 5. Запуск

```bash
# Продакшн
npm start

# Разработка с автообновлением
npm run dev
```

## 🌐 Web App настройка

### Локальная разработка с ngrok

Для локального тестирования Web App нужен HTTPS URL:

```bash
# Установите ngrok
npm install -g ngrok

# Запустите веб-приложение
cd ../
npm start

# В новом терминале создайте туннель
ngrok http 3000

# Скопируйте HTTPS URL и обновите .env
WEB_APP_URL=https://12345678.ngrok.io
```

### Настройка в BotFather

1. Перейдите к [@BotFather](https://t.me/botfather)
2. Выберите вашего бота
3. Используйте `/setdomain` для установки домена Web App
4. Укажите ваш HTTPS URL

## 🔧 API интеграция

Бот использует следующие endpoints основного приложения:

### Публичные endpoints
- `GET /api/points` - Список доступных точек
- `GET /api/telegram/leaderboard` - Рейтинг Telegram пользователей
- `GET /health` - Проверка состояния сервера

### Формат ответов

```javascript
// GET /api/telegram/leaderboard
{
  "leaderboard": [
    {
      "telegramId": 12345678,
      "totalCollections": 5,
      "firstCollection": "2024-01-01T12:00:00.000Z",
      "lastCollection": "2024-01-15T15:30:00.000Z",
      "first_name": "Иван",
      "last_name": "Петров",
      "username": "ivan_petrov",
      "photo_url": "https://..."
    }
  ],
  "stats": {
    "totalUsers": 25,
    "totalCollections": 150
  }
}
```

## 🎯 Использование

### Пользователи

1. Найдите бота по username: `@PlasticBoyBot`
2. Нажмите `/start` для начала
3. Используйте кнопку "🗺️ Карта" для открытия Web App
4. Сканируйте QR-коды и авторизуйтесь через Telegram

### Команды бота

- **Главное меню** - `/start`
- **Карта моделей** - `/map` 
- **Рейтинг** - `/leaderboard`
- **Статистика** - `/stats`
- **Помощь** - `/help`

## 🔍 Отладка и логи

### Логирование

Бот логирует все важные события:

```javascript
console.log('👋 Новый пользователь: Иван (ID: 12345678)');
console.log('🔘 Callback: leaderboard от Петра');
console.log('🏆 Загружаем рейтинг...');
console.log('📊 Загружаем статистику...');
```

### Обработка ошибок

- Автоматическое восстановление при сбоях API
- Показ пользователю понятных сообщений об ошибках
- Fallback на веб-версию при недоступности данных

### Проверка работоспособности

```bash
# Проверка подключения к Telegram API
curl -X GET "https://api.telegram.org/bot<TOKEN>/getMe"

# Проверка основного приложения
curl -X GET "http://localhost:3000/health"
```

## 🚀 Деплой

### Локальный запуск

```bash
npm start
```

### VPS/сервер

```bash
# Использование PM2 для автозапуска
npm install -g pm2

pm2 start bot.js --name "plasticboy-bot"
pm2 startup
pm2 save
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "bot.js"]
```

## 📊 Мониторинг

### Статистика использования

Бот автоматически логирует:
- Количество активных пользователей
- Популярные команды
- Ошибки и их частоту
- Время отклика API

### Алерты

Настройте мониторинг для:
- Падения бота
- Недоступности основного приложения
- Превышения лимитов Telegram API

## 🔒 Безопасность

### Токены и API ключи

- Никогда не коммитьте .env файлы
- Используйте переменные окружения в продакшене
- Регулярно меняйте токены

### Ограничения

- Rate limiting для предотвращения спама
- Валидация входящих данных
- Обработка злоупотреблений

## 🤝 Поддержка

### Известные проблемы

1. **Web App не открывается**
   - Проверьте HTTPS URL
   - Убедитесь что домен настроен в BotFather

2. **Команды не работают**
   - Запустите `npm run setup`
   - Проверьте токен бота

3. **Данные не загружаются**
   - Проверьте работу основного приложения
   - Убедитесь в доступности API endpoints

### Контакты

- GitHub Issues: [создать issue](https://github.com/your-repo/issues)
- Telegram: @your_support_username

## 📝 Changelog

### v1.0.0
- ✅ Базовая функциональность бота
- ✅ Web App интеграция  
- ✅ Команды навигации
- ✅ Рейтинг пользователей
- ✅ Статистика игры
- ✅ Обработка ошибок

---

**PlasticBoy Telegram Bot** - Collect'em all через Telegram! 🎯🤖
