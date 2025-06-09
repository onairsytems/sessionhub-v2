export interface BaseProjectContext {
  projectId: string;
  projectType: ProjectType;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Core metadata
  name: string;
  description?: string;
  language: string;
  
  // Framework and library detection
  frameworks: Framework[];
  libraries: Library[];
  
  // Architecture patterns
  architecturePatterns: ArchitecturePattern[];
  
  // Development patterns
  testingFrameworks: TestingFramework[];
  buildTools: BuildTool[];
  
  // Project structure
  structure: ProjectStructure;
  
  // Quality metrics
  metrics: QualityMetrics;
  
  // Context embeddings for RAG
  embeddings?: number[];
  
  // Summary for quick reference
  summary: string;
}

export enum ProjectType {
  WEB_APP = 'web_app',
  API = 'api',
  LIBRARY = 'library',
  CLI = 'cli',
  MOBILE = 'mobile',
  DESKTOP = 'desktop',
  MACHINE_LEARNING = 'machine_learning',
  DATA_PIPELINE = 'data_pipeline',
  MICROSERVICE = 'microservice',
  MONOREPO = 'monorepo',
  ELECTRON = 'electron',
  NEXTJS = 'nextjs',
  REACT = 'react',
  NODE = 'node',
  PYTHON = 'python',
  UNKNOWN = 'unknown'
}

export interface Framework {
  name: string;
  version?: string;
  category: 'frontend' | 'backend' | 'fullstack' | 'testing' | 'other';
  confidence: number; // 0-1
}

export interface Library {
  name: string;
  version?: string;
  purpose: string;
  isDevDependency: boolean;
}

export interface ArchitecturePattern {
  pattern: string;
  confidence: number;
  locations: string[];
  description?: string;
}

export interface TestingFramework {
  name: string;
  type: 'unit' | 'integration' | 'e2e' | 'other';
  configFile?: string;
}

export interface BuildTool {
  name: string;
  configFile: string;
  scripts?: Record<string, string>;
}

export interface ProjectStructure {
  rootPath: string;
  sourceDirectories: string[];
  testDirectories: string[];
  configFiles: ConfigFile[];
  entryPoints: string[];
  outputDirectories: string[];
  totalFiles: number;
  totalLines: number;
  primaryLanguages: LanguageStats[];
}

export interface ConfigFile {
  path: string;
  type: string;
  purpose: string;
}

export interface LanguageStats {
  language: string;
  files: number;
  lines: number;
  percentage: number;
}

export interface QualityMetrics {
  codeComplexity?: number;
  testCoverage?: number;
  lintingErrors?: number;
  typeErrors?: number;
  securityIssues?: number;
  performanceScore?: number;
  lastAnalyzed: Date;
}

// Specialized context schemas for different project types
export interface WebAppContext extends BaseProjectContext {
  projectType: ProjectType.WEB_APP | ProjectType.NEXTJS | ProjectType.REACT;
  
  // Web-specific metadata
  webFramework: 'next' | 'react' | 'vue' | 'angular' | 'svelte' | 'other';
  cssFramework?: 'tailwind' | 'mui' | 'bootstrap' | 'styled-components' | 'other';
  stateManagement?: 'redux' | 'zustand' | 'mobx' | 'context' | 'other';
  routing?: 'pages' | 'app' | 'react-router' | 'other';
  
  // API integration
  apiIntegration?: {
    type: 'rest' | 'graphql' | 'trpc' | 'other';
    client?: string;
  };
  
  // Build configuration
  buildConfig: {
    bundler: 'webpack' | 'vite' | 'parcel' | 'turbopack' | 'other';
    transpiler: 'babel' | 'swc' | 'tsc' | 'other';
    outputFormat: 'esm' | 'cjs' | 'umd' | 'iife';
  };
}

export interface APIContext extends BaseProjectContext {
  projectType: ProjectType.API | ProjectType.MICROSERVICE;
  
  // API-specific metadata
  apiFramework: 'express' | 'fastify' | 'koa' | 'hapi' | 'nestjs' | 'other';
  apiProtocol: 'rest' | 'graphql' | 'grpc' | 'websocket' | 'other';
  
  // Database configuration
  databases?: {
    type: 'postgres' | 'mysql' | 'mongodb' | 'redis' | 'other';
    orm?: string;
    migrations?: boolean;
  }[];
  
  // API documentation
  documentation?: {
    type: 'openapi' | 'graphql-schema' | 'asyncapi' | 'other';
    path?: string;
  };
  
  // Authentication
  authentication?: {
    type: 'jwt' | 'oauth' | 'basic' | 'api-key' | 'other';
    provider?: string;
  };
}

export interface ElectronContext extends BaseProjectContext {
  projectType: ProjectType.ELECTRON;
  
  // Electron-specific metadata
  electronVersion: string;
  nodeIntegration: boolean;
  contextIsolation: boolean;
  
  // Process architecture
  mainProcess: {
    entryPoint: string;
    ipcHandlers: string[];
    services: string[];
  };
  
  rendererProcess: {
    framework: 'react' | 'vue' | 'angular' | 'vanilla' | 'other';
    entryPoints: string[];
  };
  
  // Platform features
  platformFeatures: {
    autoUpdater: boolean;
    nativeModules: string[];
    systemIntegration: string[];
  };
}

export interface MLContext extends BaseProjectContext {
  projectType: ProjectType.MACHINE_LEARNING;
  
  // ML-specific metadata
  mlFramework: 'tensorflow' | 'pytorch' | 'scikit-learn' | 'keras' | 'other';
  mlType: 'classification' | 'regression' | 'clustering' | 'nlp' | 'cv' | 'other';
  
  // Model information
  models?: {
    name: string;
    type: string;
    path: string;
    format: string;
  }[];
  
  // Data pipeline
  dataPipeline?: {
    sources: string[];
    preprocessing: string[];
    features: string[];
  };
  
  // Training configuration
  training?: {
    framework: string;
    distributed: boolean;
    gpu: boolean;
  };
}

// Context versioning
export interface ContextVersion {
  version: string;
  timestamp: Date;
  changes: ContextChange[];
  snapshot: BaseProjectContext;
}

export interface ContextChange {
  field: string;
  oldValue: any;
  newValue: any;
  reason?: string;
}

// Context analysis result
export interface ContextAnalysisResult {
  context: BaseProjectContext;
  confidence: number;
  warnings?: string[];
  suggestions?: string[];
  relatedPatterns?: string[];
}