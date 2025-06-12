#!/bin/bash

# Quick Deploy Script for SessionHub
# This script provides a one-click deployment to Applications folder

set -e  # Exit on error

echo "🚀 SessionHub Quick Deploy"
echo "========================="
echo ""

# Change to project directory
cd "$(dirname "$0")/.."

# Check if we should watch for changes
WATCH_MODE=false
if [[ "$1" == "--watch" ]] || [[ "$1" == "-w" ]]; then
    WATCH_MODE=true
fi

# Check if app is already running
if pgrep -x "SessionHub" > /dev/null; then
    echo "⚠️  SessionHub is currently running."
    echo "   Please quit the app before deploying."
    echo ""
    read -p "Press Enter to continue after quitting the app..."
fi

# Run the deployment
if [ "$WATCH_MODE" = true ]; then
    echo "🔄 Starting deployment with watch mode..."
    npm run deploy:app:watch
else
    echo "📦 Starting one-time deployment..."
    npm run deploy:app
fi