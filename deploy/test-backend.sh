#!/bin/sh
# macOS-safe full regression run. Each invocation gets a disposable Linux database.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
project="polivalko-tests-$$"
cleanup() { docker compose -p "$project" -f "$root/deploy/compose.tests.yaml" down --volumes --remove-orphans; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker compose -p "$project" -f "$root/deploy/compose.tests.yaml" up --abort-on-container-exit --exit-code-from tests
