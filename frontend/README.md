# Забивка — клиент

Vite + React. Запросы идут на `/api` текущего хоста, если `VITE_API_URL` пустой.
Локально Vite проксирует `/api` на `http://127.0.0.1:8000`.
На Vercel задайте `VITE_API_URL` origin API на Render — см. [docs/deploy.md](../docs/deploy.md).
