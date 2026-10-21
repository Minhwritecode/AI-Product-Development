.PHONY: help install dev build test lint typecheck db-migrate db-seed cloud-config-check docker-build app-up app-down logs

help:
	@echo "make install | dev | build | test | lint | typecheck | db-migrate | db-seed | cloud-config-check | docker-build | app-up | app-down | logs"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

test:
	npm test

lint:
	npm run lint

typecheck:
	npm run typecheck

db-migrate:
	npm run db:migrate --workspace backend

db-seed:
	npm run db:seed --workspace backend

cloud-config-check:
	docker compose config >/dev/null
	@echo "Cloud runtime configuration syntax is valid."

docker-build:
	docker compose build

app-up:
	docker compose up -d --build

app-down:
	docker compose down

logs:
	docker compose logs -f
