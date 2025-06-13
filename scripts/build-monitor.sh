#!/bin/bash

# Build Process Monitor
# Monitors system resources during build and kills if exceeds limits
# Session 2.29.2D Emergency Recovery

# Configuration
MAX_MEMORY_MB=8192  # 8GB max
MAX_DISK_USAGE_GB=10  # 10GB max for build artifacts
CHECK_INTERVAL=3  # Check every 3 seconds
LOG_FILE="build-monitor.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Build Monitor Started"
echo "======================="
echo "Memory Limit: ${MAX_MEMORY_MB}MB"
echo "Disk Limit: ${MAX_DISK_USAGE_GB}GB"
echo "Check Interval: ${CHECK_INTERVAL}s"
echo ""

# Initialize log
echo "Build Monitor Started: $(date)" > $LOG_FILE

# Function to get current memory usage in MB
get_memory_usage() {
    ps aux | awk 'NR>1 {sum+=$6} END {print int(sum/1024)}'
}

# Function to get disk usage of build directories in GB
get_disk_usage() {
    local size=0
    for dir in dist dist-electron out node_modules/.cache; do
        if [ -d "$dir" ]; then
            local dir_size=$(du -sm "$dir" 2>/dev/null | cut -f1)
            size=$((size + dir_size))
        fi
    done
    echo $((size / 1024))
}

# Function to kill node/electron processes
kill_build_processes() {
    echo -e "${RED}⚠️  EMERGENCY: Killing build processes!${NC}"
    
    # Kill node processes
    pkill -f "node.*build" || true
    pkill -f "node.*webpack" || true
    pkill -f "node.*next" || true
    pkill -f "electron-builder" || true
    
    # Force kill if needed
    sleep 2
    pkill -9 -f "node.*build" || true
    pkill -9 -f "electron-builder" || true
    
    echo "Build processes terminated" >> $LOG_FILE
}

# Function to clean build artifacts
emergency_cleanup() {
    echo -e "${YELLOW}🧹 Emergency cleanup initiated${NC}"
    rm -rf dist-electron/mac-arm64
    rm -rf node_modules/.cache
    find . -name "*.log" -size +100M -delete
    echo "Emergency cleanup completed" >> $LOG_FILE
}

# Monitoring loop
while true; do
    # Check memory
    CURRENT_MEM=$(get_memory_usage)
    MEM_PERCENT=$((CURRENT_MEM * 100 / MAX_MEMORY_MB))
    
    # Check disk
    CURRENT_DISK=$(get_disk_usage)
    
    # Display status
    printf "\r📊 Memory: ${CURRENT_MEM}MB/${MAX_MEMORY_MB}MB (${MEM_PERCENT}%%) | Disk: ${CURRENT_DISK}GB/${MAX_DISK_USAGE_GB}GB"
    
    # Log status
    echo "$(date): Memory=${CURRENT_MEM}MB, Disk=${CURRENT_DISK}GB" >> $LOG_FILE
    
    # Check memory threshold
    if [ $CURRENT_MEM -gt $MAX_MEMORY_MB ]; then
        echo ""
        echo -e "${RED}❌ MEMORY LIMIT EXCEEDED!${NC}"
        echo "Memory spike detected: ${CURRENT_MEM}MB" >> $LOG_FILE
        kill_build_processes
        emergency_cleanup
        exit 1
    fi
    
    # Check disk threshold
    if [ $CURRENT_DISK -gt $MAX_DISK_USAGE_GB ]; then
        echo ""
        echo -e "${RED}❌ DISK LIMIT EXCEEDED!${NC}"
        echo "Disk spike detected: ${CURRENT_DISK}GB" >> $LOG_FILE
        emergency_cleanup
    fi
    
    # Warning thresholds
    if [ $MEM_PERCENT -gt 80 ]; then
        echo ""
        echo -e "${YELLOW}⚠️  Warning: Memory usage at ${MEM_PERCENT}%${NC}"
    fi
    
    # Check if build processes are still running
    if ! pgrep -f "node.*build\|webpack\|next\|electron-builder" > /dev/null; then
        echo ""
        echo -e "${GREEN}✅ Build processes completed${NC}"
        echo "Build completed at $(date)" >> $LOG_FILE
        break
    fi
    
    sleep $CHECK_INTERVAL
done

echo ""
echo "📋 Final Report:"
echo "==============="
echo "Peak Memory: ${CURRENT_MEM}MB"
echo "Peak Disk: ${CURRENT_DISK}GB"
echo "Log saved to: $LOG_FILE"