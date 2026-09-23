# Docker-стек «Забивка»

Три сервиса: сайт (`web`), API (`api`) и PostgreSQL (`db`). Стек поднимается одной командой и отдаёт сайт на одном порту.

## Переменные

Скопируйте [.env.example](../.env.example) в `.env` и задайте боевые значения на сервере. Файл `.env` в git не попадает.

| Переменная | Назначение |
|---|---|
| `POSTGRES_PASSWORD` | Пароль пользователя `zabivka` в PostgreSQL |
| `JWT_SECRET` | Секрет подписи JWT |
| `WEB_PORT` | Порт сайта на хосте (по умолчанию `8080`) |
| `PUBLIC_ORIGIN` | Публичный адрес сайта, например `http://localhost:8080` |
| `DATABASE_URL` | Только для локального pytest на хосте (`127.0.0.1:5432`). Контейнер `api` задаёт свой URL на хост `db` |

Демо-логины те же, что в сидах: `user` / `User12345` и `admin` / `Admin12345`.

## Запуск

```bash
make up
make logs
make down
```

Сайт: http://localhost:8080

`make up` это `docker compose up -d --build`. После старта:

- `GET /` — собранный клиент
- `GET /api/health` — 200, healthcheck Compose для `api`
- `GET /docs` и `GET /openapi.json` — прокси на FastAPI

Порт API наружу не публикуется. PostgreSQL слушает только `127.0.0.1:5432`.

## Сервисы

- `db` — `postgres:16`, пользователь и база `zabivka`, том `pgdata`, healthcheck `pg_isready`.
- `api` — `python:3.12-slim`. При старте: `alembic upgrade head && python -m app.seed && uvicorn`. Сид идемпотентный: повторный `make up` не дублирует пользователей и табаки.
- `web` — Node собирает Vite с пустым `VITE_API_URL`, nginx отдаёт `dist` и проксирует `/api`, `/docs` и `/openapi.json` на `http://api:8000`.
