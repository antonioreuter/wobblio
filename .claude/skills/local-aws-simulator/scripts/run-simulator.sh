#!/usr/bin/env bash
# Thin wrapper — delegates to the repo-root Makefile.
# Preferred usage: run make targets directly from the repository root.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$REPO_ROOT"

case "${1:-}" in
  start)  make start ;;
  stop)   make stop ;;
  status) docker compose ps ;;
  reset)  make reset ;;
  logs)   make logs ;;
  *)
    echo "Usage: $0 [start|stop|status|reset|logs]"
    echo ""
    echo "Delegates to the Makefile at $REPO_ROOT."
    echo "Run 'make help' for all available targets."
    exit 1
    ;;
esac
