# Забивка

[![test](https://github.com/Azkvns/Zabivka/actions/workflows/test.yml/badge.svg)](https://github.com/Azkvns/Zabivka/actions/workflows/test.yml)
[![pages](https://github.com/Azkvns/Zabivka/actions/workflows/pages.yml/badge.svg)](https://github.com/Azkvns/Zabivka/actions/workflows/pages.yml)
[![license](https://img.shields.io/github/license/Azkvns/Zabivka)](LICENSE)
[![Maintainability](https://qlty.sh/gh/Azkvns/projects/Zabivka/maintainability.svg)](https://qlty.sh/gh/Azkvns/projects/Zabivka/metrics/code)

«Забивка» подбирает табачные смеси: гость крутит рулетку по общему каталогу, пользователь сохраняет смесь и ведёт свою полку, администратор правит каталог. Клиент — React и Vite, API — FastAPI, данные — PostgreSQL. Локально три сервиса поднимаются Compose: nginx отдаёт сайт и проксирует API.

**Стек:** React, Vite, TypeScript / FastAPI, SQLAlchemy, Alembic / PostgreSQL 16.

```bash
cp .env.example .env
make up
```

Сайт: http://localhost:8080

Ссылка на деплой — URL на Vercel, когда практика будет выложена. Документация: [docs/](docs/).
