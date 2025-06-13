#!/bin/bash

# Memory-Safe Build Script for SessionHub
# Created after Terminal memory explosion incident (138GB)
# Session 2.29.2D Emergency Recovery

set -e

echo "🛡️  Memory-Safe Build Process Started"
echo "=================================="

# Function to check memory usage
check_memory() {
    local mem_used=$(ps aux | awk 'NR>1 {sum+=$6} END {print int(sum/1024)}')
    local mem_limit=4096  # 4GB limit for safety
    
    if [ $mem_used -gt $mem_limit ]; then
        echo "❌ Memory usage exceeds limit: ${mem_used}MB > ${mem_limit}MB"
        echo "🛑 Terminating build to prevent system crash"
        exit 1
    fi
    
    echo "✓ Memory usage: ${mem_used}MB / ${mem_limit}MB"
}

# Function to monitor build process
monitor_build() {
    local pid=$1
    local process_name=$2
    
    echo "📊 Monitoring $process_name (PID: $pid)"
    
    while kill -0 $pid 2>/dev/null; do
        check_memory
        sleep 5
    done
    
    wait $pid
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        echo "❌ $process_name failed with exit code $exit_code"
        exit $exit_code
    fi
    
    echo "✅ $process_name completed successfully"
}

# Clean previous builds
echo "🧹 Cleaning previous build artifacts..."
rm -rf dist dist-electron out

# Step 1: Build renderer with memory constraints
echo ""
echo "📦 Building renderer (Next.js) with memory constraints..."
NODE_OPTIONS="--max-old-space-size=4096" npm run build:renderer &
monitor_build $! "Renderer Build"

# Step 2: Build main process with memory constraints
echo ""
echo "⚡ Building main process (Electron) with memory constraints..."
NODE_OPTIONS="--max-old-space-size=2048" npm run build:main &
monitor_build $! "Main Build"

# Step 3: Package application with memory constraints
echo ""
echo "📱 Packaging Electron app with memory constraints..."
NODE_OPTIONS="--max-old-space-size=4096" npm run electron:build -- --mac --arm64 &
monitor_build $! "Electron Packaging"

# Final memory check
echo ""
check_memory

echo ""
echo "✨ Memory-safe build completed successfully!"
echo "📊 Build artifacts:"
du -sh dist dist-electron 2>/dev/null || echo "No build artifacts found"

# Cleanup large temporary files
echo ""
echo "🧹 Cleaning up temporary files..."
find . -name "*.log" -size +100M -delete
find . -name "*.tmp" -size +100M -delete

echo ""
echo "🎉 Build process completed safely!"