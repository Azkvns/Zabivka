# API

Интерактивная схема — FastAPI Swagger по пути `/docs`. Локально после `make up`: [http://localhost:8080/docs](http://localhost:8080/docs). Машина читает [http://localhost:8080/openapi.json](http://localhost:8080/openapi.json).

Порт API наружу не публикуется: nginx проксирует `/api`, `/docs` и `/openapi.json` на FastAPI.

| Группа | Путь | Назначение |
|---|---|---|
| Health | `GET /api/health` | Живость API, healthcheck Compose |
| Auth | `POST /api/auth/register`, `POST /api/auth/login` | Регистрация и JWT |
| Табаки | `GET /api/tobaccos` | Каталог, полка или оба источника |
| Рулетка | `POST /api/roulette/spin` | Подбор смеси без записи |
| Смеси | `POST/GET /api/mixes`, `PATCH /api/mixes/{id}` | Сохранение, история, заметка и оценка |
| Полка | `POST/PATCH/DELETE /api/shelf` | Свои табаки |
| Админ | `POST /api/admin/tobaccos`, `PATCH /api/admin/tobaccos/{id}`, `POST /api/admin/catalog/clear`, `POST /api/admin/catalog/import` | Каталог, очистка и заливка CSV |

Гость крутит только каталог. Полка, смеси и админка требуют Bearer JWT. Очистка каталога принимает `{"confirm":"CLEAR"}`.
