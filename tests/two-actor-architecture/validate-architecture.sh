#!/bin/bash

# Two-Actor Architecture Validation Script
# This script runs all validation tests for the Two-Actor Model implementation

echo "🎯 Two-Actor Architecture Validation"
echo "===================================="
echo

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if TypeScript is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: npx not found. Please install Node.js and npm.${NC}"
    exit 1
fi

# Check if ts-node is available
if ! npx ts-node --version &> /dev/null; then
    echo -e "${YELLOW}Installing ts-node...${NC}"
    npm install -g ts-node typescript
fi

# Navigate to the project root
cd "$(dirname "$0")/../.." || exit 1

echo "Running Two-Actor Architecture validation tests..."
echo

# Run the test suite
npx ts-node tests/two-actor-architecture/run-all-tests.ts

# Capture exit code
EXIT_CODE=$?

echo
echo "===================================="

if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All validations passed!${NC}"
    echo -e "${GREEN}The Two-Actor Architecture is properly implemented.${NC}"
else
    echo -e "${RED}❌ Some validations failed!${NC}"
    echo -e "${RED}Please review the errors above and fix the implementation.${NC}"
fi

exit $EXIT_CODE