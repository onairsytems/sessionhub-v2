
/**
 * Development Instance Configuration
 * Isolated environment for self-development that runs alongside production
 */

export interface DevelopmentConfig {
  instanceId: string;
  dataDirectory: string;
  ipcPorts: {
    main: number;
    planning: number;
    execution: number;
  };
  supabase: {
    url: string;
    anonKey: string;
    projectId: string;
  };
  claude: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  updates: {
    channel: 'development' | 'beta' | 'stable';
    autoUpdate: boolean;
    checkInterval: number;
  };
  security: {
    allowSelfModification: boolean;
    requireSignature: boolean;
    auditLevel: 'minimal' | 'standard' | 'verbose';
  };
}

export const DEVELOPMENT_CONFIG: DevelopmentConfig = {
  instanceId: 'sessionhub-dev',
  dataDirectory: '~/Library/Application Support/SessionHub-Dev',
  
  // Use different ports to avoid conflicts with production
  ipcPorts: {
    main: 8001,
    planning: 8002,
    execution: 8003,
  },
  
  // Development Supabase project
  supabase: {
    url: process.env['SUPABASE_DEV_URL'] || 'https://sessionhub-dev.supabase.co',
    anonKey: process.env['SUPABASE_DEV_ANON_KEY'] || '',
    projectId: 'sessionhub-dev',
  },
  
  // Separate Claude API quota
  claude: {
    apiKey: process.env['CLAUDE_DEV_API_KEY'] || process.env['CLAUDE_API_KEY'] || '',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-20241022',
  },
  
  // Development update settings
  updates: {
    channel: 'development',
    autoUpdate: false, // Manual control for safety
    checkInterval: 300000, // 5 minutes
  },
  
  // Security configuration for self-development
  security: {
    allowSelfModification: true,
    requireSignature: true,
    auditLevel: 'verbose',
  },
};

export const PRODUCTION_CONFIG: DevelopmentConfig = {
  instanceId: 'sessionhub',
  dataDirectory: '~/Library/Application Support/SessionHub',
  
  // Production ports
  ipcPorts: {
    main: 9001,
    planning: 9002,
    execution: 9003,
  },
  
  // Production Supabase project
  supabase: {
    url: process.env['SUPABASE_URL'] || 'https://sessionhub.supabase.co',
    anonKey: process.env['SUPABASE_ANON_KEY'] || '',
    projectId: 'sessionhub',
  },
  
  // Production Claude API
  claude: {
    apiKey: process.env['CLAUDE_API_KEY'] || '',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-20241022',
  },
  
  // Production update settings
  updates: {
    channel: 'stable',
    autoUpdate: true,
    checkInterval: 3600000, // 1 hour
  },
  
  // Production security
  security: {
    allowSelfModification: false, // Only dev can modify production
    requireSignature: true,
    auditLevel: 'standard',
  },
};

/**
 * Get configuration based on environment
 */
export function getConfig(): DevelopmentConfig {
  const isDevelopment = process.env['NODE_ENV'] === 'development' || 
                       process.env['SESSIONHUB_INSTANCE'] === 'dev';
  
  return isDevelopment ? DEVELOPMENT_CONFIG : PRODUCTION_CONFIG;
}

/**
 * Validate configuration completeness
 */
export function validateConfig(config: DevelopmentConfig): string[] {
  const errors: string[] = [];
  
  if (!config.supabase.url) {
    errors.push('Supabase URL is required');
  }
  
  if (!config.supabase.anonKey) {
    errors.push('Supabase anonymous key is required');
  }
  
  if (!config.claude.apiKey) {
    errors.push('Claude API key is required');
  }
  
  if (config.security.allowSelfModification && !config.security.requireSignature) {
    errors.push('Self-modification requires signature verification');
  }
  
  return errors;
}