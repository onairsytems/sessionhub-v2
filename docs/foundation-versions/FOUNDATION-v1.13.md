# SessionHub V2 Living Foundation Document

> Living document - Claude Code updates after each session
> Synced via Google Drive Desktop
> Version controlled in docs/foundation-versions/
> Current Version: 1.13

## 🚨 CRITICAL: Foundation.md Save Requirements

**This document MUST ALWAYS be saved to BOTH locations:**
1. **Local Repository**: `/Users/jonathanhoggard/Development/sessionhub-v2/docs/FOUNDATION.md`
2. **Google Drive Local Sync**: `/Users/jonathanhoggard/Library/CloudStorage/GoogleDrive-jonathan@onairsystems.org/My Drive/SessionHub/FOUNDATION.md`

**NEVER save to only one location!** The Google Drive local sync folder is the primary reference location.

## 🛡️ ACTOR ROLE ENFORCEMENT: System-Level Protection Active

**SessionHub now enforces actor boundaries at runtime!** The system will:
- 🚨 **BLOCK** Planning Actors from generating code
- 🚨 **BLOCK** Execution Actors from making strategic decisions
- 🚨 **ALERT** users when requesting inappropriate actions from actors
- ✅ **VALIDATE** all instructions before execution
- ✅ **DISPLAY** visual indicators showing which actor is active

**Enforcement Documentation:**
- `docs/two-actor-cheatsheet.md` - Quick reference and violation detection
- `docs/ACTOR-VIOLATIONS.md` - Examples of correct/incorrect patterns
- `docs/PLANNING-ACTOR-RULES.md` - Comprehensive planning guidelines
- `docs/architecture/TWO-ACTOR-ARCHITECTURE.md` - Full architectural blueprint

**Remember:** The Two-Actor Model is not just methodology - it's enforced by the system itself!

## ✅ Session 1.13: Admin Mode Architecture & Separation (COMPLETED)
- **Date**: 2025-09-01
- **Foundation Version**: v1.13
- **Status**: ADMIN ARCHITECTURE - ✅ COMPLETE
- **Key Achievements**:
  - **Database Schema for Admin System**:
    - Created user_role enum (user, admin, super_admin) 
    - user_profiles table extending auth.users with role management
    - admin_audit_logs table for comprehensive action tracking
    - system_health_metrics table for performance monitoring
    - admin_sessions table for admin-specific session management
    - emergency_access_logs table for critical interventions
    - Comprehensive RLS policies for role-based access control
  - **AdminService Implementation**:
    - Complete role-based authentication (admin/super_admin)
    - User management capabilities (suspend, activate, role changes)
    - System statistics and health monitoring
    - Audit log tracking for all admin actions
    - Emergency access logging with severity levels
    - Batch user operations support
  - **Admin IPC Handlers**:
    - Registered admin-specific endpoints in Electron
    - Role verification on all admin operations
    - Health check endpoints with system diagnostics
    - Batch operation support for user management
  - **Admin Dashboard UI**:
    - AdminDashboard component with role-based access
    - UserManagement with filtering, search, and batch operations
    - SystemMonitor with real-time metrics and health status
    - AuditLog viewer with export capabilities
    - EmergencyPanel for super admins with procedure templates
  - **Security Features**:
    - Complete separation of admin and user operations
    - Multi-level role verification (database + service layer)
    - All admin actions logged with full context
    - Emergency procedures with audit trail
    - IP address and user agent tracking