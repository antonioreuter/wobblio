.PHONY: bootstrap-dev bootstrap-prod deploy-dev deploy-prod help

## bootstrap-dev: One-time AWS bootstrap for dev (create DB, install extensions, seed SSM)
bootstrap-dev:
	./bootstrap.sh --stage dev

## bootstrap-prod: One-time AWS bootstrap for prod (create DB, install extensions, seed SSM)
bootstrap-prod:
	./bootstrap.sh --stage prod

## deploy-dev: Deploy to dev (CDK stacks + migrations + webapp)
deploy-dev:
	./deploy.sh --stage dev

## deploy-prod: Deploy to prod (CDK stacks + migrations + webapp)
deploy-prod:
	./deploy.sh --stage prod

## help: Show available AWS commands
help:
	@echo "Wobblio — AWS Deployment Commands\n"
	@grep -E '^## ' Makefile | sed 's/## //' | column -t -s ':'
	@echo ""
