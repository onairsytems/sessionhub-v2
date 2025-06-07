
/**
 * System-wide configuration
 */

export const SYSTEM_CONFIG = {
  // Environment
  environment: process.env['NODE_ENV'] || 'development',
  port: parseInt(process.env['PORT'] || '3000'),
  
  // API Configuration
  api: {
    provider: process.env['API_PROVIDER'] || 'anthropic',
    baseUrl: process.env['API_BASE_URL'] || 'https://api.anthropic.com',
    version: process.env['API_VERSION'] || 'v1',
    timeout: parseInt(process.env['API_TIMEOUT'] || '30000')
  },
  
  // Session Management
  sessions: {
    maxConcurrent: parseInt(process.env['MAX_CONCURRENT_SESSIONS'] || '5'),
    timeout: parseInt(process.env['SESSION_TIMEOUT'] || '3600000'), // 1 hour
    cleanupInterval: parseInt(process.env['SESSION_CLEANUP_INTERVAL'] || '3600000'),
    retentionDays: parseInt(process.env['SESSION_RETENTION_DAYS'] || '30')
  },
  
  // Queue Configuration
  queue: {
    maxSize: parseInt(process.env['QUEUE_MAX_SIZE'] || '100'),
    processingInterval: parseInt(process.env['QUEUE_PROCESSING_INTERVAL'] || '1000'),
    priorityLevels: ['critical', 'high', 'normal', 'low'],
    defaultPriority: 'normal'
  },
  
  // Security
  security: {
    encryptionAlgorithm: process.env['ENCRYPTION_ALGORITHM'] || 'aes-256-gcm',
    tokenExpiry: parseInt(process.env['TOKEN_EXPIRY'] || '86400000'), // 24 hours
    maxLoginAttempts: parseInt(process.env['MAX_LOGIN_ATTEMPTS'] || '5'),
    lockoutDuration: parseInt(process.env['LOCKOUT_DURATION'] || '900000') // 15 minutes
  },
  
  // Storage (Mac app directories)
  storage: {
    dataDir: process.env['DATA_DIR'] || '~/Library/Application Support/SessionHub',
    logsDir: process.env['LOGS_DIR'] || '~/Library/Logs/SessionHub',
    tempDir: process.env['TEMP_DIR'] || '/tmp/SessionHub',
    cacheDir: process.env['CACHE_DIR'] || '~/Library/Caches/SessionHub',
    maxFileSizeMB: parseInt(process.env['MAX_FILE_SIZE_MB'] || '100')
  },
  
  // Monitoring
  monitoring: {
    metricsEnabled: process.env['METRICS_ENABLED'] !== 'false',
    metricsInterval: parseInt(process.env['METRICS_INTERVAL'] || '60000'),
    healthCheckInterval: parseInt(process.env['HEALTH_CHECK_INTERVAL'] || '30000'),
    alertingEnabled: process.env['ALERTING_ENABLED'] === 'true'
  },
  
  // Logging
  logging: {
    level: process.env['LOG_LEVEL'] || 'info',
    format: process.env['LOG_FORMAT'] || 'json',
    maxFiles: parseInt(process.env['LOG_MAX_FILES'] || '10'),
    maxFileSize: process.env['LOG_MAX_FILE_SIZE'] || '10m',
    auditEnabled: process.env['AUDIT_ENABLED'] !== 'false'
  },
  
  // Features
  features: {
    twoActorModel: process.env['TWO_ACTOR_MODEL'] !== 'false',
    apiIntegration: process.env['API_INTEGRATION'] !== 'false',
    sandboxExecution: process.env['SANDBOX_EXECUTION'] !== 'false',
    autoRetry: process.env['AUTO_RETRY'] !== 'false',
    caching: process.env['CACHING'] === 'true',
    debugging: process.env['DEBUGGING'] === 'true'
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW'] || '60000'),
    maxRequests: parseInt(process.env['RATE_LIMIT_MAX'] || '100'),
    skipSuccessfulRequests: process.env['RATE_LIMIT_SKIP_SUCCESS'] === 'true'
  }
};