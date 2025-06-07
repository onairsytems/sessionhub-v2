#!/bin/bash

# Fix all shebang lines that are not on the first line
echo "🔧 Fixing shebang lines..."

# Find all .ts files in scripts directory
for file in scripts/*.ts; do
  if [ -f "$file" ]; then
    # Check if file starts with a blank line followed by shebang
    if head -n 2 "$file" | grep -q "^$" && head -n 2 "$file" | tail -n 1 | grep -q "^#!/usr/bin/env"; then
      echo "Fixing: $file"
      # Remove the first blank line
      tail -n +2 "$file" > "$file.tmp" && mv "$file.tmp" "$file"
    fi
  fi
done

echo "✅ Shebang fixes complete"