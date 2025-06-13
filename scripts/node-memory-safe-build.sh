#!/bin/bash

# Node Process Memory-Safe Build Script for SessionHub v1.01
# Session 2.29.2E - Production Build with 4GB memory limit
# Monitors only Node process memory, not system-wide

set -e

echo "🛡️  SessionHub v1.01 Memory-Safe Production Build"
echo "================================================"
echo "Memory Limit: 4GB per Node process"
echo "Build Mode: Production with optimizations"
echo ""

# Clean previous builds
echo "🧹 Cleaning previous build artifacts..."
rm -rf dist dist-electron out .next
echo "✅ Build directories cleaned"

# Check disk space
echo ""
echo "💾 Checking disk space..."
df -h . | grep -E "Filesystem|/"
echo ""

# Build timestamp
BUILD_TIME=$(date +"%Y%m%d-%H%M%S")
BUILD_LOG="build-v1.01-${BUILD_TIME}.log"

echo "📝 Build log: $BUILD_LOG"
echo ""

# Function to run build with monitoring
run_monitored_build() {
    local cmd="$1"
    local name="$2"
    local memory_limit="${3:-4096}"
    
    echo "🔨 Starting $name..."
    echo "Command: NODE_OPTIONS='--max-old-space-size=$memory_limit' $cmd"
    
    # Run command with memory limit and capture output
    NODE_OPTIONS="--max-old-space-size=$memory_limit" bash -c "$cmd" 2>&1 | tee -a "$BUILD_LOG"
    
    local exit_code=${PIPESTATUS[0]}
    
    if [ $exit_code -eq 0 ]; then
        echo "✅ $name completed successfully"
    else
        echo "❌ $name failed with exit code $exit_code"
        echo "Check $BUILD_LOG for details"
        exit $exit_code
    fi
}

# Step 1: Build Next.js (renderer) with production optimizations
echo ""
echo "📦 Phase 1: Building Next.js (production)..."
run_monitored_build "npm run build" "Next.js Production Build" 4096

# Step 2: Compile Electron main process
echo ""
echo "⚡ Phase 2: Compiling Electron main process..."
run_monitored_build "npm run electron:compile" "Electron Compile" 2048

# Step 3: Package Electron app for macOS ARM64
echo ""
echo "📱 Phase 3: Packaging Electron application..."
run_monitored_build "electron-builder --mac --arm64" "Electron Packaging" 4096

# Check build results
echo ""
echo "📊 Build Results:"
echo "================"

if [ -d "dist-electron" ]; then
    echo "✅ Electron build directory created"
    ls -la dist-electron/*.dmg dist-electron/*.zip 2>/dev/null || echo "⚠️  No installer files found"
fi

if [ -d "out" ]; then
    echo "✅ Next.js build directory created"
    du -sh out
fi

# Memory usage summary
echo ""
echo "💾 Final disk usage:"
du -sh dist dist-electron out 2>/dev/null || echo "Build directories not found"

echo ""
echo "✨ SessionHub v1.01 build completed successfully!"
echo "📋 Build log saved to: $BUILD_LOG"
echo ""
echo "Next steps:"
echo "1. Run verification tests"
echo "2. Deploy to Applications folder"
echo "3. Update Foundation.md"