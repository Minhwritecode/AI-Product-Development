.PHONY: help install dev build test lint typecheck infra-up infra-down logs

help:
	@echo "make install | dev | build | test | lint | typecheck | infra-up | infra-down | logs"

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

infra-up:
	docker compose up -d postgres redis

infra-down:
	docker compose down

logs:
	docker compose logs -f
