# Bookcrossing REST API

Веб-приложение для организации буккроссинга: регистрация книг в каталоге, поиск нужных изданий, оформление запросов на передачу и ведение личных списков (желаемое, отданное). Реализована серверная часть с REST API.

## Стек

- Node.js + Express
- PostgreSQL (клиент `pg`)
- JWT (`jsonwebtoken`) — аутентификация
- bcrypt — хеширование паролей
- dotenv — переменные окружения

## Требования

- Node.js 18+
- PostgreSQL 14+

## Установка и запуск

1. Клонировать репозиторий:

   ```bash
   git clone https://github.com/<логин>/bookcrossing.git
   cd bookcrossing