.PHONY: start stop reset deploy seed migrate logs validate setup help

REPO_ROOT    := $(shell pwd)
BACKEND_DIR  := $(REPO_ROOT)/Source/backend
COMPOSE_FILE := $(REPO_ROOT)/scripts/local-dev/docker-compose.yml
DEPLOY_SCRIPT := $(REPO_ROOT)/scripts/local-dev/deploy-local.sh

# Load .env.local if it exists (for AWS CLI targets)
ifneq (,$(wildcard .env.local))
  include .env.local
  export
endif

AWS_LOCAL_OPTS := AWS_ENDPOINT_URL=http://localhost:4566 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=$(or $(AWS_REGION),eu-west-1)

## start: Start all local services (Postgres, LocalStack, Cognito, Bedrock mock)
start:
	docker compose -f $(COMPOSE_FILE) up -d
	@echo "Waiting for services to become healthy..."
	@until docker compose -f $(COMPOSE_FILE) ps --format json 2>/dev/null | python3 -c "import sys,json; [print(s['Name'],s['Health']) for line in sys.stdin for s in [json.loads(line)]]" 2>/dev/null | grep -v healthy | grep -v ""; do sleep 2; done; true
	@$(MAKE) --no-print-directory _print-endpoints

## stop: Stop all local services
stop:
	docker compose -f $(COMPOSE_FILE) down

## reset: Destroy all local data volumes and restart clean
reset:
	@printf "This will delete all local data (Postgres, LocalStack, Cognito). Continue? [y/N] " && \
	  read ans && [ "$${ans:-N}" = "y" ] || (echo "Aborted." && exit 1)
	docker compose -f $(COMPOSE_FILE) down -v
	$(MAKE) start
	$(DEPLOY_SCRIPT)

## deploy: Bootstrap CDK, deploy stack, run migrations, seed data
deploy:
	$(DEPLOY_SCRIPT)

## seed: Re-run seed scripts only (services must be running)
seed:
	cd $(BACKEND_DIR) && \
	  $(AWS_LOCAL_OPTS) DATABASE_URL=$(DATABASE_URL) \
	  npx ts-node src/local/seed.ts

## migrate: Run pending database migrations
migrate:
	cd $(BACKEND_DIR) && DATABASE_URL=$(DATABASE_URL) npm run migrate:up

## logs: Tail all service logs (pass service= to filter, e.g. make logs service=localstack)
logs:
	docker compose -f $(COMPOSE_FILE) logs -f $(service)

## validate: Run hexagonal architecture validator + security auditor
validate:
	@echo "Running hexagonal architecture validator..."
	cd $(BACKEND_DIR) && npm run skill:hexagonal-architecture-validator
	@echo "Running GDPR/security auditor..."
	cd $(BACKEND_DIR) && npm run validate:security

## setup: One-time developer setup (symlink fix for hexagonal validator)
setup:
	@[ -L $(REPO_ROOT)/backend ] || ln -sfn Source/backend $(REPO_ROOT)/backend
	@echo "Setup complete. 'backend' symlink points to Source/backend."
	@echo "Copy your env file: cp .env.local.template .env.local"

## help: Show available targets
help:
	@grep -E '^## ' Makefile | sed 's/## //' | column -t -s ':'

_print-endpoints:
	@echo ""
	@echo "  Local stack endpoints:"
	@printf "  %-26s %s\n" "PostgreSQL"         "localhost:5432  (db: wobblio_local)"
	@printf "  %-26s %s\n" "LocalStack"         "http://localhost:4566"
	@printf "  %-26s %s\n" "Cognito local"      "http://localhost:9229"
	@printf "  %-26s %s\n" "Bedrock mock"       "http://localhost:4577"
	@echo ""
	@printf "  %-26s %s\n" "LocalStack Desktop" "https://docs.localstack.cloud/user-guide/tools/localstack-desktop/"
	@printf "  %-26s %s\n" "  → connect to:"   "http://localhost:4566"
	@echo ""
	@echo "  Run 'make deploy' to bootstrap CDK and seed data."
