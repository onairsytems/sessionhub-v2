
/**
 * Configuration models for Planning and Execution actors
 */

export interface ActorConfig {
  id: string;
  type: 'planning' | 'execution';
  name: string;
  description: string;
  enabled: boolean;
  
  model: ModelConfig;
  capabilities: string[];
  restrictions: string[];
  
  performance: PerformanceConfig;
  security: SecurityConfig;
  
  metadata?: Record<string, any>;
}

export interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'local';
  model: string;
  version?: string;
  
  // Model parameters
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  
  // System prompt
  systemPrompt?: string;
  
  // API configuration
  apiKey?: string;
  apiUrl?: string;
  timeout?: number;
}

export interface PerformanceConfig {
  maxConcurrent: number;
  queueSize: number;
  
  timeouts: {
    request: number;
    total: number;
    idle: number;
  };
  
  retries: {
    maxAttempts: number;
    backoffMs: number;
    maxBackoffMs: number;
  };
  
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface SecurityConfig {
  sandbox: boolean;
  allowedOperations: string[];
  forbiddenOperations: string[];
  
  resourceLimits: {
    maxMemoryMB: number;
    maxCpuPercent: number;
    maxFileSizeMB: number;
    maxFiles: number;
  };
  
  networkPolicy: {
    allowInternet: boolean;
    allowedDomains: string[];
    blockedDomains: string[];
  };
}

// Default configurations
export const DEFAULT_PLANNING_CONFIG: ActorConfig = {
  id: 'planning-actor-default',
  type: 'planning',
  name: 'Default Planning Actor',
  description: 'Generates instructions from user requests using Claude API',
  enabled: true,
  
  model: {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    temperature: 0.7,
    maxTokens: 4000,
    systemPrompt: `You are the Planning Actor in SessionHub's Two-Actor Architecture.
Your role is to analyze requests and generate instructions without code.`
  },
  
  capabilities: [
    'analyze_request',
    'generate_strategy',
    'create_instructions',
    'define_requirements'
  ],
  
  restrictions: [
    'no_code_generation',
    'no_implementation',
    'no_execution'
  ],
  
  performance: {
    maxConcurrent: 5,
    queueSize: 100,
    timeouts: {
      request: 30000,
      total: 300000,
      idle: 60000
    },
    retries: {
      maxAttempts: 3,
      backoffMs: 1000,
      maxBackoffMs: 10000
    }
  },
  
  security: {
    sandbox: false,
    allowedOperations: ['read', 'analyze'],
    forbiddenOperations: ['write', 'execute', 'network'],
    resourceLimits: {
      maxMemoryMB: 512,
      maxCpuPercent: 50,
      maxFileSizeMB: 10,
      maxFiles: 100
    },
    networkPolicy: {
      allowInternet: true,
      allowedDomains: ['api.anthropic.com'],
      blockedDomains: []
    }
  }
};

export const DEFAULT_EXECUTION_CONFIG: ActorConfig = {
  id: 'execution-actor-default',
  type: 'execution',
  name: 'Default Execution Actor',
  description: 'Executes instructions in a sandboxed environment',
  enabled: true,
  
  model: {
    provider: 'local',
    model: 'code-executor',
    temperature: 0.3,
    maxTokens: 8000
  },
  
  capabilities: [
    'execute_instructions',
    'write_files',
    'run_commands',
    'validate_output'
  ],
  
  restrictions: [
    'no_strategic_decisions',
    'no_planning',
    'follow_instructions_only'
  ],
  
  performance: {
    maxConcurrent: 3,
    queueSize: 50,
    timeouts: {
      request: 60000,
      total: 600000,
      idle: 30000
    },
    retries: {
      maxAttempts: 2,
      backoffMs: 2000,
      maxBackoffMs: 10000
    }
  },
  
  security: {
    sandbox: true,
    allowedOperations: ['read', 'write', 'execute'],
    forbiddenOperations: ['network_external'],
    resourceLimits: {
      maxMemoryMB: 1024,
      maxCpuPercent: 75,
      maxFileSizeMB: 50,
      maxFiles: 1000
    },
    networkPolicy: {
      allowInternet: false,
      allowedDomains: ['localhost', '127.0.0.1'],
      blockedDomains: ['*']
    }
  }
};