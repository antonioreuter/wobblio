---
name: local-aws-simulator
description: Manages local emulators (LocalStack, Postgres, Cognito-local) for rapid backend validation without AWS connection costs.
---

# Local AWS Simulator

This skill sets up and starts local docker containers and mock emulators to run the serverless TypeScript backend locally.

## Description
It provides automated scripts to launch:
- A local PostgreSQL database instance pre-configured with RLS.
- A LocalStack container for mock S3 buckets and SQS queues.
- A local cognito mock server for JWT token sign-ins.

## How to Use
Run the script to launch or stop the emulator:
```bash
# To spin up the emulator
./.agents/skills/local-aws-simulator/scripts/run-simulator.sh start

# To stop the emulator
./.agents/skills/local-aws-simulator/scripts/run-simulator.sh stop
```

## Details
* Script Location: `/.agents/skills/local-aws-simulator/scripts/run-simulator.sh`
* Configuration File: `/.agents/skills/local-aws-simulator/resources/docker-compose.local.yml`
