#!/bin/bash

# Session 1.3 Validation Script
# Validates the Real Two-Actor Model Implementation

echo "🚀 Session 1.3: Real Two-Actor Model Implementation - Validation"
echo "=============================================================="
echo ""

# Check for API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  Warning: ANTHROPIC_API_KEY not set"
    echo "   Tests will run in mock mode (limited functionality)"
    echo ""
    read -p "Continue with mock mode? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Compile TypeScript
echo "🔧 Compiling TypeScript..."
npx tsc --project tsconfig.json

# Run validation tests
echo ""
echo "🧪 Running validation tests..."
echo ""

# Set test environment
export NODE_ENV=test
export TS_NODE_PROJECT=tsconfig.json

# Run the test
npx ts-node tests/integration/test-two-actor-workflow.ts

# Capture exit code
TEST_EXIT_CODE=$?

echo ""
echo "=============================================================="

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ Session 1.3 validation completed successfully!"
else
    echo "❌ Session 1.3 validation failed with exit code: $TEST_EXIT_CODE"
fi

exit $TEST_EXIT_CODE