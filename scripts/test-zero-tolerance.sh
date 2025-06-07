#!/bin/bash

# Test script for zero-tolerance enforcement

echo "🧪 Testing Zero-Tolerance Enforcement..."
echo ""

# Test 1: Check if git wrapper blocks --no-verify
echo "Test 1: Attempting git commit with --no-verify flag..."
./scripts/git-wrapper.sh commit --no-verify -m "test" 2>&1 | grep -q "ERROR: Attempt to bypass verification detected"
if [ $? -eq 0 ]; then
  echo "✅ PASS: --no-verify flag blocked"
else
  echo "❌ FAIL: --no-verify flag not blocked"
fi

# Test 2: Check if TypeScript configs are enforced
echo ""
echo "Test 2: Validating TypeScript strict mode..."
npm run tsconfig:validate > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ PASS: TypeScript configs are strict"
else
  echo "❌ FAIL: TypeScript configs not strict"
fi

# Test 3: Check if build requires validation
echo ""
echo "Test 3: Checking build validation requirement..."
grep -q "zero-tolerance:enforce" package.json
if [ $? -eq 0 ]; then
  echo "✅ PASS: Build enforces zero-tolerance"
else
  echo "❌ FAIL: Build doesn't enforce zero-tolerance"
fi

# Test 4: Check if monitoring logs exist
echo ""
echo "Test 4: Checking monitoring setup..."
if [ -d "$HOME/.sessionhub" ]; then
  echo "✅ PASS: Monitoring directory exists"
else
  echo "❌ FAIL: Monitoring directory missing"
fi

# Test 5: Check pre-commit hook enhancement
echo ""
echo "Test 5: Checking pre-commit hook..."
grep -q "Zero-Tolerance Policy Enforcement" .husky/pre-commit
if [ $? -eq 0 ]; then
  echo "✅ PASS: Pre-commit hook enhanced"
else
  echo "❌ FAIL: Pre-commit hook not enhanced"
fi

# Test 6: Check post-commit hook
echo ""
echo "Test 6: Checking post-commit hook..."
if [ -f ".husky/post-commit" ]; then
  echo "✅ PASS: Post-commit hook exists"
else
  echo "❌ FAIL: Post-commit hook missing"
fi

echo ""
echo "🎯 Zero-Tolerance Testing Complete!"