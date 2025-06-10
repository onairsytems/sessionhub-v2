/**
 * MCP Server Type Definitions
 */

export type MCPServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export interface MCPServerConfig {
  port: number;
  version?: string;
  security: MCPSecurityConfig;
  storage?: MCPStorageConfig;
  marketplace?: MCPMarketplaceConfig;
}

export interface MCPSecurityConfig {
  enableSandbox: boolean;
  maxExecutionTime: number;
  allowedDomains: string[];
  blockedDomains: string[];
  requireSignature: boolean;
  encryptionKey?: string;
}

export interface MCPStorageConfig {
  type: 'sqlite' | 'postgres' | 'memory';
  path?: string;
  connectionString?: string;
}

export interface MCPMarketplaceConfig {
  enabled: boolean;
  url?: string;
  apiKey?: string;
}

export interface MCPIntegration {
  id?: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon?: string;
  category: MCPIntegrationCategory;
  tools: MCPTool[];
  permissions: MCPPermission[];
  config?: MCPIntegrationConfig;
  signature?: string;
  sandboxConfig?: MCPSandboxConfig;
}

export type MCPIntegrationCategory = 
  | 'ai'
  | 'analytics'
  | 'automation'
  | 'communication'
  | 'database'
  | 'design'
  | 'development'
  | 'finance'
  | 'productivity'
  | 'security'
  | 'storage'
  | 'other';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPSchema;
  outputSchema?: MCPSchema;
  examples?: MCPToolExample[];
  rateLimit?: MCPRateLimit;
}

export interface MCPSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, MCPSchemaProperty>;
  required?: string[];
  items?: MCPSchema;
}

export interface MCPSchemaProperty {
  type: string;
  description?: string;
  enum?: any[];
  default?: any;
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

export interface MCPToolExample {
  name: string;
  input: any;
  output: any;
}

export interface MCPRateLimit {
  requests: number;
  window: number; // in seconds
}

export type MCPPermission = 
  | 'network'
  | 'filesystem'
  | 'process'
  | 'system'
  | 'clipboard'
  | 'notification'
  | 'camera'
  | 'microphone'
  | 'location';

export interface MCPIntegrationConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  headers?: Record<string, string>;
  custom?: Record<string, any>;
}

export interface MCPSandboxConfig {
  memory?: number;
  cpu?: number;
  timeout?: number;
  allowedHosts?: string[];
  env?: Record<string, string>;
}

export interface MCPExecutionContext {
  integrationId: string;
  tool: string;
  params: any;
  user?: string;
  sessionId?: string;
  timestamp: number;
}

export interface MCPExecutionResult {
  success: boolean;
  data?: any;
  error?: MCPError;
  metrics?: MCPExecutionMetrics;
}

export interface MCPError {
  code: string;
  message: string;
  details?: any;
}

export interface MCPExecutionMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsed?: number;
  cpuUsed?: number;
}

export interface MCPIntegrationManifest {
  integration: MCPIntegration;
  installation: MCPInstallationConfig;
  marketplace?: MCPMarketplaceMetadata;
}

export interface MCPInstallationConfig {
  dependencies?: string[];
  scripts?: {
    preInstall?: string;
    postInstall?: string;
    preUninstall?: string;
    postUninstall?: string;
  };
  files: MCPFileEntry[];
}

export interface MCPFileEntry {
  path: string;
  content?: string;
  url?: string;
  checksum?: string;
}

export interface MCPMarketplaceMetadata {
  featured: boolean;
  downloads: number;
  rating: number;
  reviews: number;
  tags: string[];
  screenshots?: string[];
  pricing?: MCPPricingModel;
}

export interface MCPPricingModel {
  type: 'free' | 'paid' | 'freemium' | 'subscription';
  price?: number;
  currency?: string;
  billingPeriod?: 'monthly' | 'yearly' | 'lifetime';
  features?: string[];
}