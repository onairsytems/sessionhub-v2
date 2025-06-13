#!/bin/bash

# Memory-Safe Build with electron-rebuild for native dependencies
# Session 2.29.2E - Handles Xcode CLT issues

set -e

echo "🛡️  SessionHub v1.01 Memory-Safe Production Build (with electron-rebuild)"
echo "========================================================================="
echo "Memory Limit: 4GB per Node process"
echo ""

# Clean previous builds
echo "🧹 Cleaning previous build artifacts..."
rm -rf dist dist-electron out .next
echo "✅ Build directories cleaned"

# Build timestamp
BUILD_TIME=$(date +"%Y%m%d-%H%M%S")
BUILD_LOG="build-v1.01-electron-rebuild-${BUILD_TIME}.log"

echo "📝 Build log: $BUILD_LOG"
echo ""

# Step 1: Build Next.js
echo "📦 Phase 1: Building Next.js (production)..."
NODE_OPTIONS="--max-old-space-size=4096" npm run build 2>&1 | tee -a "$BUILD_LOG"

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "❌ Next.js build failed"
    exit 1
fi
echo "✅ Next.js build completed"

# Step 2: Compile Electron
echo ""
echo "⚡ Phase 2: Compiling Electron main process..."
NODE_OPTIONS="--max-old-space-size=2048" npm run electron:compile 2>&1 | tee -a "$BUILD_LOG"

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "❌ Electron compile failed"
    exit 1
fi
echo "✅ Electron compile completed"

# Step 3: Rebuild native dependencies
echo ""
echo "🔧 Phase 3: Rebuilding native dependencies..."
NODE_OPTIONS="--max-old-space-size=2048" npx electron-rebuild 2>&1 | tee -a "$BUILD_LOG"

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "⚠️  Native dependency rebuild failed, continuing anyway..."
fi

# Step 4: Package Electron app
echo ""
echo "📱 Phase 4: Packaging Electron application..."
NODE_OPTIONS="--max-old-space-size=4096" npx electron-builder --mac --arm64 2>&1 | tee -a "$BUILD_LOG"

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "❌ Electron packaging failed"
    exit 1
fi

# Check results
echo ""
echo "📊 Build Results:"
echo "================"

if [ -d "dist-electron" ]; then
    echo "✅ Electron build directory created"
    ls -la dist-electron/*.dmg dist-electron/*.zip 2>/dev/null || echo "⚠️  No installer files found"
fi

echo ""
echo "✨ SessionHub v1.01 build completed!"
echo "📋 Build log saved to: $BUILD_LOG"