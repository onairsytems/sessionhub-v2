#!/bin/bash

# Simple Memory-Safe Build for SessionHub v1.01
# Session 2.29.2E - Direct approach without stress tests

set -e

echo "🛡️  SessionHub v1.01 Simple Memory-Safe Build"
echo "============================================="
echo ""

# Set environment for node-gyp
export SDKROOT=$(xcrun --sdk macosx --show-sdk-path 2>/dev/null || echo "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk")

# Clean
echo "🧹 Cleaning build directories..."
rm -rf dist dist-electron out .next
echo "✅ Cleaned"

# Build Next.js with memory limit
echo ""
echo "📦 Building Next.js..."
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Compile Electron
echo ""
echo "⚡ Compiling Electron..."
NODE_OPTIONS="--max-old-space-size=2048" npm run electron:compile

# Package without rebuilding native deps (they're already built)
echo ""
echo "📱 Packaging application..."
NODE_OPTIONS="--max-old-space-size=4096" npx electron-builder --mac --arm64 --publish never

# Results
echo ""
echo "✨ Build completed!"
echo ""
echo "📊 Build artifacts:"
ls -la dist-electron/ 2>/dev/null || echo "No build artifacts found"