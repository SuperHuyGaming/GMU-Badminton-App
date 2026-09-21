#!/usr/bin/env bash
# ==============================================================================
# Production Smoke Test & Canary Healthcheck Script
# ==============================================================================

set -euo pipefail

TARGET_URL="${1:-http://localhost:8080}"
echo "========================================================"
echo " Running Production Smoke Tests against: ${TARGET_URL}"
echo "========================================================"

FAILED=0

check_endpoint() {
    local name="$1"
    local url="$2"
    local expected_code="$3"

    echo -n "Checking ${name} (${url})... "
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${url}" || echo "000")

    if [ "${HTTP_CODE}" -eq "${expected_code}" ]; then
        echo "PASS (HTTP ${HTTP_CODE})"
    else
        echo "FAIL (Expected ${expected_code}, got ${HTTP_CODE})"
        FAILED=$((FAILED + 1))
    fi
}

# 1. Check API Gateway Health
check_endpoint "API Gateway Health" "${TARGET_URL}/actuator/health" 200

# 2. Check Core Tournaments REST Endpoint
check_endpoint "Tournaments Discovery API" "${TARGET_URL}/api/v1/tournaments" 200

# 3. Check Scraper Ingestion Service Health
check_endpoint "Scraper Health" "${TARGET_URL}/api/v1/scraper/health" 200

echo "========================================================"
if [ "${FAILED}" -eq 0 ]; then
    echo " ALL PRODUCTION SMOKE TESTS PASSED!"
    echo "========================================================"
    exit 0
else
    echo " ${FAILED} SMOKE TESTS FAILED! Aborting deployment..."
    echo "========================================================"
    exit 1
fi

