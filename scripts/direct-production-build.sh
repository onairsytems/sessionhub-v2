#!/bin/bash

# Direct Production Build Script for SessionHub v1.01
# Session 2.29.2E - Bypasses validation for faster build
# Uses memory limits and monitors progress

set -e

echo "🚀 SessionHub v1.01 Direct Production Build"
echo "=========================================="
echo "Memory Limit: 4GB per Node process"
echo ""

# Clean build directories
echo "🧹 Cleaning build directories..."
rm -rf .next out dist dist-electron
echo "✅ Cleaned"

# Build timestamp
BUILD_TIME=$(date +"%Y%m%d-%H%M%S")

# Step 1: Next.js build with memory limit
echo ""
echo "📦 Building Next.js..."
NODE_OPTIONS="--max-old-space-size=4096" NODE_ENV=production npx next build

# Step 2: Compile Electron
echo ""
echo "⚡ Compiling Electron..."
NODE_OPTIONS="--max-old-space-size=2048" npx tsc -p tsconfig.electron.json

# Step 3: Package app
echo ""
echo "📱 Packaging application..."
NODE_OPTIONS="--max-old-space-size=4096" npx electron-builder --mac --arm64

# Results
echo ""
echo "✨ Build completed!"
echo ""
echo "📊 Build artifacts:"
ls -la dist-electron/*.dmg dist-electron/*.zip 2>/dev/null || echo "No installers found"