#!/bin/bash
# SessionHub V2 Validation Runner

echo "🚀 Running SessionHub V2 Bootstrap Validation"
echo "=========================================="

cd ~/Development/sessionhub-v2

# Run the validator
node src/validation/validator.js

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All validations passed!"
    echo "SessionHub V2 is operating correctly."
else
    echo ""
    echo "❌ Validation failures detected!"
    echo "Please check the validation report."
fi