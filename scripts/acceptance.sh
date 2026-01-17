#!/bin/bash
# scripts/acceptance.sh
# Automated acceptance test runner

set -e

echo "======================================"
echo "  Desk Agent Automated Acceptance"
echo "======================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILURES=0

run_step() {
  local name=$1
  shift
  local cmd=("$@")

  echo -e "\n${YELLOW}[STEP] $name${NC}"
  if "${cmd[@]}"; then
    echo -e "${GREEN}[PASS] $name${NC}"
  else
    echo -e "${RED}[FAIL] $name${NC}"
    FAILURES=$((FAILURES + 1))
  fi
}

# Step 1: Build Check
run_step "Build All Packages" pnpm build

# Step 2: TypeScript Check
run_step "TypeScript Check" pnpm -r tsc --noEmit

# Step 3: Start Test Databases (if docker-compose exists)
if [ -f "docker-compose.test.yml" ]; then
  echo -e "\n${YELLOW}[STEP] Starting Test Databases${NC}"
  docker compose -f docker-compose.test.yml up -d
  sleep 5  # Wait for services
fi

# Step 4: Unit/Integration Tests
run_step "Unit & Integration Tests" pnpm test

# Step 5: E2E Tests (if web exists)
if [ -d "apps/web" ] && [ -d "apps/web/e2e" ]; then
  run_step "E2E Tests" pnpm --filter @desk-agent/web test:e2e
fi

# Step 6: Stop Test Databases
if [ -f "docker-compose.test.yml" ]; then
  echo -e "\n${YELLOW}[STEP] Stopping Test Databases${NC}"
  docker compose -f docker-compose.test.yml down -v
fi

# Summary
echo ""
echo "======================================"
if [ $FAILURES -eq 0 ]; then
  echo -e "  ${GREEN}ALL CHECKS PASSED${NC}"
  echo "======================================"
  exit 0
else
  echo -e "  ${RED}$FAILURES CHECK(S) FAILED${NC}"
  echo "======================================"
  exit 1
fi
