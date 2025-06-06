#!/bin/bash

echo "🧪 SessionHub Integration Tests"
echo "=============================="
echo ""

# Clean test data
rm -rf ./test-data

# Run orchestration tests
echo "Running orchestration integration tests..."
npx ts-node -r tsconfig-paths/register tests/integration/test-orchestration.ts

# Check if all previous tests passed
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All integration tests passed!"
else
    echo ""
    echo "❌ Some integration tests failed"
    exit 1
fi