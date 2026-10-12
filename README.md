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

## Основные эндпоинты

### Аутентификация

- `POST /api/auth/register` — регистрация
- `POST /api/auth/login` — вход, выдача JWT
- `GET  /api/auth/me` — текущий профиль

### Книги

- `GET    /api/books` — список с фильтрами `title`, `author`, `city_id`, `status_id`, `owner_id`
- `GET    /api/books/:id` — одна книга
- `POST   /api/books` — создать (требуется токен)
- `PATCH  /api/books/:id` — изменить (владелец или admin)
- `DELETE /api/books/:id` — удалить (владелец или admin)
- `GET    /api/books/export?format=csv` — выгрузка каталога в CSV

### Запросы на обмен

- `GET    /api/requests` — мои запросы
- `POST   /api/requests` — создать
- `PATCH  /api/requests/:id/status` — смена статуса
- `DELETE /api/requests/:id` — удалить

### Обмены

- `GET    /api/exchanges` — мои обмены
- `POST   /api/exchanges` — создать по принятому запросу
- `PUT    /api/exchanges/:id/confirm` — подтвердить передачу книги
- `DELETE /api/exchanges/:id` — удалить

### Отзывы

- `GET    /api/reviews/book/:bookId` — отзывы книги и средняя оценка
- `POST   /api/reviews` — оставить отзыв
- `PATCH  /api/reviews/:id` — редактировать (автор или admin)
- `DELETE /api/reviews/:id` — удалить (автор или admin)

### Список желаемого

- `GET    /api/wishlist` — мой вишлист
- `POST   /api/wishlist` — добавить книгу
- `DELETE /api/wishlist/:bookId` — удалить

### Отчёты (admin, moderator)

- `GET /api/reports/exchanges?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/reports/catalog`

## Формат ответов

- Список: `{ "items": [...] }`
- Одиночный объект: `{ ... }`
- Создание: `201` + объект
- Удаление: `204` без тела
- Ошибка: `{ "error": "текст" }` с кодом `400 / 401 / 403 / 404 / 409 / 500`

## Структура проекта


src/index.js — точка входа
src/db.js — пул соединений pg
src/auth.js — хеширование паролей
src/middleware/auth.js — requireAuth, requireRole
src/repositories/.js — слой доступа к данным (SQL)
src/routes/.js — REST-эндпоинты


## Лицензия

ISC (учебный проект).