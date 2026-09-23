.PHONY: up down logs test

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

test:
	set -a; [ -f .env ] && . ./.env; set +a; \
	if [ -x .venv/bin/python ]; then \
		.venv/bin/python -m pytest backend; \
	else \
		python3 -m pytest backend; \
	fi
