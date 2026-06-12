.PHONY: setup bootstrap deploy restart stop migrate cognito-init validate help

REPO_ROOT         := $(shell pwd)
BACKEND_DIR       := $(REPO_ROOT)/Source/backend
INFRA_DIR         := $(REPO_ROOT)/Source/infra
BOOTSTRAP_SCRIPT  := $(REPO_ROOT)/scripts/local/bootstrap.sh
DEPLOY_SCRIPT     := $(REPO_ROOT)/scripts/local/deploy.sh

# Load config/local.env as the canonical local configuration source.
# .env.local is kept in sync by 'make setup' and 'make bootstrap' for
# tooling (Next.js, Jest, etc.) that expects it at the repo root.
ifneq (,$(wildcard config/local.env))
  include config/local.env
  export
endif

## setup: One-time developer setup — create symlinks and sync .env.local from config/local.env
setup:
	@[ -L $(REPO_ROOT)/backend ] || ln -sfn Source/backend $(REPO_ROOT)/backend
	@[ -L $(REPO_ROOT)/infra ]   || ln -sfn Source/infra   $(REPO_ROOT)/infra
	@cp config/local.env .env.local
	@cp config/local.env Source/webapp/.env.local
	@echo "  .env.local synced from config/local.env (root + Source/webapp)"
	@echo "  Setup complete. Symlinks: backend → Source/backend, infra → Source/infra"

## bootstrap: One-time full local environment bootstrap (Docker + LocalStack + DB extensions + migrations + seed)
bootstrap:
	$(BOOTSTRAP_SCRIPT)

## deploy: Start Docker, re-deploy LocalStack CDK stack, run pending migrations
deploy:
	$(DEPLOY_SCRIPT)

## restart: Start/restart Docker services (LocalStack, Postgres, Cognito Local)
restart:
	@docker compose -f scripts/local/docker-compose.yml up -d
	@echo "Docker services started/restarted"

## stop: Stop Docker services (data persists)
stop:
	@docker compose -f scripts/local/docker-compose.yml stop
	@echo "Docker services stopped"

## cognito-init: Initialize cognito-local user pool, client, and seed test user (dev@wobblio.local)
cognito-init:
	@bash scripts/local/init-cognito.sh

## migrate: Run pending database migrations against local Postgres
migrate:
	cd $(INFRA_DIR) && DATABASE_URL=$(DATABASE_URL) npm run migrate:up

## validate: Run hexagonal architecture validator + GDPR security auditor
validate:
	@echo "Running hexagonal architecture validator..."
	cd $(BACKEND_DIR) && npm run skill:hexagonal-architecture-validator
	@echo "Running GDPR/security auditor..."
	cd $(BACKEND_DIR) && npm run validate:security

## help: Show available commands
help:
	@echo "Wobblio — Local Development Commands\n"
	@grep -E '^## ' Makefile | sed 's/## //' | column -t -s ':'
	@echo "\nFor AWS deployment commands, see: scripts/aws/Makefile"
	@echo "  cd scripts/aws && make help"
	@echo ""
