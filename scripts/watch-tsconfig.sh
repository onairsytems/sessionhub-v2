#!/bin/bash
# Watch TypeScript configuration for changes
node scripts/tsconfig-guardian.ts --watch &
echo $! > "$HOME/.sessionhub/tsconfig-guardian.pid"
echo "TypeScript configuration guardian started (PID: $!)"
