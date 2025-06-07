/**
 * Production Environment Configuration
 * Security-hardened settings for SessionHub production deployment
 */

export interface ProductionConfig {
  instanceId: string;
  environment: 'production';
  dataDirectory: string;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
  deployment: DeploymentConfig;
  appStore: AppStoreConfig;
}

export interface SecurityConfig {
  encryption: {
    algorithm: 'AES-256-GCM';
    keyDerivation: 'PBKDF2';
    iterations: number;
  };
  certificates: {
    codeSigningId: string;
    notarization: boolean;
    hardenedRuntime: boolean;
  };
  sandbox: {
    enabled: boolean;
    entitlements: string[];
  };
  keychain: {
    serviceName: string;
    accessGroup: string;
  };
}

export interface MonitoringConfig {
  telemetry: {
    enabled: boolean;
    endpoint: string;
    sampleRate: number;
  };
  errorReporting: {
    enabled: boolean;
    endpoint: string;
    includeStackTrace: boolean;
  };
  analytics: {
    enabled: boolean;
    anonymized: boolean;
    optOut: boolean;
  };
  healthChecks: {
    interval: number;
    endpoints: string[];
  };
}

export interface DeploymentConfig {
  autoUpdater: {
    enabled: boolean;
    updateServer: string;
    checkInterval: number;
    downloadInBackground: boolean;
  };
  rollback: {
    enabled: boolean;
    retainVersions: number;
    automaticRollback: boolean;
  };
}

export interface AppStoreConfig {
  bundleId: string;
  teamId: string;
  category: string;
  version: string;
  buildNumber: string;
  minimumMacOSVersion: string;
}

// Production configuration with security hardening
export const PRODUCTION_CONFIG: ProductionConfig = {
  instanceId: 'sessionhub-production',
  environment: 'production',
  dataDirectory: '~/Library/Application Support/SessionHub',
  
  security: {
    encryption: {
      algorithm: 'AES-256-GCM',
      keyDerivation: 'PBKDF2',
      iterations: 100000
    },
    certificates: {
      codeSigningId: 'Developer ID Application: SessionHub (TEAMID)',
      notarization: true,
      hardenedRuntime: true
    },
    sandbox: {
      enabled: true,
      entitlements: [
        'com.apple.security.app-sandbox',
        'com.apple.security.network.client',
        'com.apple.security.files.user-selected.read-write',
        'com.apple.security.keychain-access-groups'
      ]
    },
    keychain: {
      serviceName: 'SessionHub',
      accessGroup: 'TEAMID.com.sessionhub.keychain'
    }
  },
  
  monitoring: {
    telemetry: {
      enabled: true,
      endpoint: 'https://telemetry.sessionhub.com/v1/events',
      sampleRate: 0.1 // 10% sampling for production
    },
    errorReporting: {
      enabled: true,
      endpoint: 'https://errors.sessionhub.com/v1/reports',
      includeStackTrace: true
    },
    analytics: {
      enabled: true,
      anonymized: true,
      optOut: true // Users can opt out
    },
    healthChecks: {
      interval: 300000, // 5 minutes
      endpoints: [
        'https://api.anthropic.com/health',
        'https://api.supabase.co/health'
      ]
    }
  },
  
  deployment: {
    autoUpdater: {
      enabled: true,
      updateServer: 'https://releases.sessionhub.com',
      checkInterval: 3600000, // 1 hour
      downloadInBackground: true
    },
    rollback: {
      enabled: true,
      retainVersions: 5,
      automaticRollback: true
    }
  },
  
  appStore: {
    bundleId: 'com.sessionhub.desktop',
    teamId: 'SESSIONHUB_TEAM_ID',
    category: 'public.app-category.developer-tools',
    version: '1.0.0',
    buildNumber: '1',
    minimumMacOSVersion: '13.0'
  }
};

// Security validation for production environment
export function validateProductionSecurity(): boolean {
  const checks = [
    process.env['NODE_ENV'] === 'production',
    PRODUCTION_CONFIG.security.certificates.notarization,
    PRODUCTION_CONFIG.security.certificates.hardenedRuntime,
    PRODUCTION_CONFIG.security.sandbox.enabled,
    PRODUCTION_CONFIG.monitoring.telemetry.enabled
  ];
  
  return checks.every(check => check === true);
}

// Production health check
export async function performProductionHealthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, boolean>;
  timestamp: string;
}> {
  const checks = {
    encryption: PRODUCTION_CONFIG.security.encryption.algorithm === 'AES-256-GCM',
    certificates: PRODUCTION_CONFIG.security.certificates.notarization,
    sandbox: PRODUCTION_CONFIG.security.sandbox.enabled,
    monitoring: PRODUCTION_CONFIG.monitoring.telemetry.enabled,
    autoUpdater: PRODUCTION_CONFIG.deployment.autoUpdater.enabled
  };
  
  const healthyChecks = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;
  
  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (healthyChecks === totalChecks) {
    status = 'healthy';
  } else if (healthyChecks >= totalChecks * 0.8) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }
  
  return {
    status,
    checks,
    timestamp: new Date().toISOString()
  };
}