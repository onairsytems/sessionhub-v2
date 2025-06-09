export interface ProjectConfig {
  name: string;
  type: ProjectType;
  outputDir?: string;
  description?: string;
  author?: string;
  license?: string;
  features?: ProjectFeatures;
  github?: GitHubConfig;
  customConfig?: Record<string, any>;
}

export enum ProjectType {
  REACT_TYPESCRIPT = 'react-typescript',
  REACT_JAVASCRIPT = 'react-javascript',
  NEXTJS = 'nextjs',
  VUEJS = 'vuejs',
  EXPRESS_TYPESCRIPT = 'express-typescript',
  EXPRESS_JAVASCRIPT = 'express-javascript',
  PYTHON_FASTAPI = 'python-fastapi',
  PYTHON_DJANGO = 'python-django',
  ELECTRON = 'electron',
  NODEJS_CLI = 'nodejs-cli'
}

export interface ProjectFeatures {
  testing?: boolean;
  linting?: boolean;
  prettier?: boolean;
  husky?: boolean;
  docker?: boolean;
  cicd?: boolean;
  documentation?: boolean;
}

export interface GitHubConfig {
  enabled: boolean;
  repoName?: string;
  private?: boolean;
  description?: string;
  topics?: string[];
}

export interface GenerationResult {
  success: boolean;
  projectPath: string;
  duration: number;
  filesGenerated: number;
  qualityReport: QualityReport | null;
  gitInitialized: boolean;
  githubCreated: boolean;
  errors: string[];
}

export interface QualityReport {
  projectType: ProjectType;
  timestamp: Date;
  metrics: QualityMetrics;
  issues: QualityIssue[];
  passed: boolean;
}

export interface QualityMetrics {
  typeScriptErrors: number;
  eslintErrors: number;
  eslintWarnings: number;
  prettierIssues: number;
  testsPassing: boolean;
  buildSuccessful: boolean;
  dependencyVulnerabilities: number;
}

export interface QualityIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  file?: string;
  line?: number;
}

export class GenerationError extends Error {
  constructor(message: string, public errors: string[]) {
    super(message);
    this.name = 'GenerationError';
  }
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface GenerationContext {
  config: ProjectConfig;
  template: ProjectTemplate;
  outputDir: string;
}

export interface ProjectTemplate {
  name: string;
  type: ProjectType;
  files: TemplateFile[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  configuration: Record<string, any>;
}

export interface TemplateFile {
  path: string;
  content: string | Buffer;
  executable?: boolean;
}

export interface QualityEnforcementOptions {
  projectDir: string;
  projectType: ProjectType;
  strictMode: boolean;
  autoFix?: boolean;
}

export interface GitInitOptions {
  projectDir: string;
  projectType: ProjectType;
  enableHooks: boolean;
  includeGitIgnore: boolean;
}

export interface GitHubSetupOptions {
  projectDir: string;
  repoName: string;
  private: boolean;
  includeActions: boolean;
}

export interface VerificationOptions {
  projectDir: string;
  config: ProjectConfig;
  generatedFiles: string[];
}

export interface VerificationResult {
  success: boolean;
  errors: string[];
  warnings?: string[];
  metrics?: QualityMetrics;
}