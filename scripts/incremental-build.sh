#!/bin/bash

# Incremental Build Script for SessionHub
# Builds components separately to prevent memory explosions
# Session 2.29.2D Emergency Recovery

set -e

echo "🔄 Incremental Build Process"
echo "==========================="

# Configuration
MAX_MEMORY="2048"  # 2GB per process
BUILD_DIR="dist"
ELECTRON_DIR="dist-electron"

# Function to run command with memory limit
run_with_limit() {
    local cmd=$1
    local name=$2
    
    echo ""
    echo "🔨 Running: $name"
    echo "Command: $cmd"
    
    NODE_OPTIONS="--max-old-space-size=$MAX_MEMORY" eval "$cmd"
    
    if [ $? -eq 0 ]; then
        echo "✅ $name completed"
    else
        echo "❌ $name failed"
        exit 1
    fi
}

# Step 1: TypeScript compilation only
echo "📝 Step 1: TypeScript Compilation"
run_with_limit "npx tsc --noEmit" "TypeScript Check"

# Step 2: Build renderer pages incrementally
echo ""
echo "📄 Step 2: Building Next.js pages incrementally"

# Create pages list
PAGES=(
    "index"
    "sessions"
    "library"
    "settings"
    "projects"
    "queue"
)

# Build each page separately
for page in "${PAGES[@]}"; do
    run_with_limit "npx next build --experimental-partial-build --page /$page" "Page: $page"
done

# Step 3: Build main process
echo ""
echo "⚡ Step 3: Building Electron main process"
run_with_limit "npx tsc -p tsconfig.electron.json" "Electron TypeScript"

# Step 4: Bundle main process
echo ""
echo "📦 Step 4: Bundling main process"
run_with_limit "npx esbuild main/background.ts --bundle --platform=node --target=node18 --external:electron --outfile=$ELECTRON_DIR/main/background.js" "Main Bundle"

# Step 5: Copy preload script
echo ""
echo "📋 Step 5: Copying preload script"
run_with_limit "npx esbuild main/preload.ts --bundle --platform=node --target=node18 --external:electron --outfile=$ELECTRON_DIR/main/preload.js" "Preload Bundle"

# Step 6: Package incrementally (without rebuilding)
echo ""
echo "📱 Step 6: Packaging app (no rebuild)"
run_with_limit "npx electron-builder --mac --arm64 --config.directories.buildResources=resources --config.directories.output=dist-electron" "Electron Package"

echo ""
echo "✨ Incremental build completed!"
echo ""
echo "📊 Build Summary:"
echo "================"
[ -d "$BUILD_DIR" ] && echo "Renderer: $(du -sh $BUILD_DIR | cut -f1)"
[ -d "$ELECTRON_DIR" ] && echo "Electron: $(du -sh $ELECTRON_DIR | cut -f1)"

echo ""
echo "💡 To run the app: npm run electron:serve"