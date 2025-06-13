#!/bin/bash

# Memory-Safe Build with fixes for macOS CLT issues
# Session 2.29.2E - Production Build

set -e

echo "🛡️  SessionHub v1.01 Memory-Safe Production Build"
echo "================================================="
echo "Memory Limit: 4GB per Node process"
echo ""

# Set environment to help with node-gyp issues
export SDKROOT=$(xcrun --sdk macosx --show-sdk-path 2>/dev/null || echo "/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk")
export CC=$(which clang)
export CXX=$(which clang++)

echo "Build environment:"
echo "SDKROOT: $SDKROOT"
echo "CC: $CC"
echo "CXX: $CXX"
echo ""

# Clean previous builds
echo "🧹 Cleaning previous build artifacts..."
rm -rf dist dist-electron out .next
echo "✅ Build directories cleaned"

# Build timestamp
BUILD_TIME=$(date +"%Y%m%d-%H%M%S")
BUILD_LOG="build-v1.01-fixed-${BUILD_TIME}.log"

echo "📝 Build log: $BUILD_LOG"
echo ""

# Function to run build with monitoring
run_monitored_build() {
    local cmd="$1"
    local name="$2"
    local memory_limit="${3:-4096}"
    
    echo "🔨 Starting $name..."
    echo "Command: NODE_OPTIONS='--max-old-space-size=$memory_limit' $cmd"
    
    # Run command with memory limit
    NODE_OPTIONS="--max-old-space-size=$memory_limit" bash -c "$cmd" 2>&1 | tee -a "$BUILD_LOG"
    
    local exit_code=${PIPESTATUS[0]}
    
    if [ $exit_code -eq 0 ]; then
        echo "✅ $name completed successfully"
    else
        echo "❌ $name failed with exit code $exit_code"
        return $exit_code
    fi
}

# Use the production deployment script which should handle everything correctly
echo "📦 Running production deployment build..."
run_monitored_build "npm run production:deploy" "Production Deploy" 4096

# Check results
echo ""
echo "📊 Build Results:"
echo "================"

if [ -d "dist-electron" ]; then
    echo "✅ Electron build directory created"
    ls -la dist-electron/*.dmg dist-electron/*.zip 2>/dev/null || echo "⚠️  No installer files found"
    
    # Show app size
    if [ -f "dist-electron/SessionHub-1.0.0-arm64-mac.zip" ]; then
        echo ""
        echo "📱 Application size:"
        du -h dist-electron/SessionHub-1.0.0-arm64-mac.zip
    fi
fi

echo ""
echo "✨ SessionHub v1.01 build completed!"
echo "📋 Build log saved to: $BUILD_LOG"