# Vercel и Render

Публичная сдача: сайт на Vercel, API и PostgreSQL на Render. Compose это не заменяет.

## Render

Blueprint — [render.yaml](../render.yaml) в корне репозитория. Сервис `zabivka-api` собирает [backend/](../backend/), база — PostgreSQL 16.

При `SEED_ON_START=1` старт: `alembic upgrade head && python -m app.seed && uvicorn`.

В окружении сервиса:

| Переменная | Откуда |
|---|---|
| `DATABASE_URL` | connection string базы `zabivka-db` |
| `JWT_SECRET` | генерирует Render |
| `CORS_ORIGINS` | задать вручную: origin сайта на Vercel, без пути |
| `SEED_ON_START` | `1` |

`CORS_ORIGINS` в Blueprint с `sync: false`: значение вписывается в дашборде после того, как известен адрес Vercel. Несколько origin — через запятую.

## Vercel

Проект из каталога [frontend/](../frontend/). Root Directory: `frontend`. Сборка читает `VITE_API_URL` (origin API на Render, без выдуманного хоста). Пока URL Render нет, переменную не подставлять.

Конфиг: [frontend/vercel.json](../frontend/vercel.json). Маршруты `/login`, `/cabinet`, `/admin` отдаются через rewrite на `index.html`.
