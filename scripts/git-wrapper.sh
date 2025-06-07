#!/bin/bash

# SessionHub Zero-Tolerance Git Wrapper
# This script enforces quality gates and prevents bypassing of hooks

# Log all git commands for audit trail
LOG_FILE="$HOME/.sessionhub/git-audit.log"
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log attempts
log_command() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $USER: git $*" >> "$LOG_FILE"
}

# Function to check for bypass attempts
check_bypass_attempt() {
    for arg in "$@"; do
        case "$arg" in
            --no-verify|--no-gpg-sign|-n)
                echo "❌ ERROR: Attempt to bypass verification detected!"
                echo "Zero-tolerance policy: All commits must pass quality gates."
                echo "This attempt has been logged."
                log_command "BYPASS_ATTEMPT: $*"
                
                # Send alert (if monitoring system is available)
                if command -v osascript &> /dev/null; then
                    osascript -e 'display notification "Git bypass attempt blocked" with title "SessionHub Security Alert"'
                fi
                
                exit 1
                ;;
        esac
    done
}

# Function to check for force push
check_force_push() {
    for arg in "$@"; do
        case "$arg" in
            --force|-f|--force-with-lease)
                echo "⚠️  WARNING: Force push detected!"
                echo "Force pushing is strongly discouraged."
                echo "Please ensure all quality gates have passed."
                log_command "FORCE_PUSH: $*"
                
                # Add a delay to make developer think twice
                echo "Waiting 5 seconds before proceeding..."
                sleep 5
                ;;
        esac
    done
}

# Main logic
log_command "$@"

# Check the git command
case "$1" in
    commit)
        check_bypass_attempt "$@"
        # Always run pre-commit hooks
        export HUSKY=1
        export HUSKY_SKIP_HOOKS=0
        ;;
    push)
        check_force_push "$@"
        ;;
    config)
        # Prevent disabling of hooks
        for arg in "$@"; do
            if [[ "$arg" == *"core.hooksPath"* ]] || [[ "$arg" == *"hooks.enabled"* ]]; then
                echo "❌ ERROR: Attempt to modify hook configuration detected!"
                echo "Hook configuration changes are not allowed."
                log_command "CONFIG_CHANGE_BLOCKED: $*"
                exit 1
            fi
        done
        ;;
esac

# Execute the real git command
/usr/bin/git "$@"