.PHONY: help install dev build test lint typecheck db-migrate db-seed infra-up infra-down logs

help:
	@echo "make install | dev | build | test | lint | typecheck | db-migrate | db-seed | infra-up | infra-down | logs"

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

infra-up:
	docker compose up -d postgres redis

infra-down:
	docker compose down

logs:
	docker compose logs -f
