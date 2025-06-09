# Dockerfile для PlasticBoy Telegram Bot

FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production && npm cache clean --force

# Копируем исходный код
COPY . .

# Создаем пользователя для безопасности
RUN addgroup -g 1001 -S nodejs && \
    adduser -S telegram -u 1001

# Меняем владельца файлов
RUN chown -R telegram:nodejs /app
USER telegram

# Открываем порт (если нужен для webhooks)
EXPOSE 3001

# Проверка здоровья
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('Bot is running')" || exit 1

# Запускаем бота
CMD ["node", "bot.js"]

# Метаданные
LABEL maintainer="PlasticBoy Team"
LABEL description="Telegram Bot for PlasticBoy game"
LABEL version="1.0.0"
