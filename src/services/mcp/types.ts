export type SupportedLanguage = 
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'kotlin'
  | 'scala';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  handler?: string; // Function name or path to handler
}

export interface MCPIntegration {
  name: string;
  type: string;
  config: Record<string, any>;
}

export interface MCPServerConfig {
  name: string;
  version: string;
  description?: string;
  tools: MCPTool[];
  integrations?: MCPIntegration[];
  resources?: MCPResource[];
  prompts?: MCPPrompt[];
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
}

export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface MCPGenerationOptions {
  language?: SupportedLanguage;
  outputPath?: string;
  customTools?: MCPTool[];
  integrations?: string[];
  generateDocs?: boolean;
  generateTests?: boolean;
  docFormat?: 'markdown' | 'html' | 'json';
  templateOverrides?: Record<string, any>;
}

export interface ProjectAnalysis {
  structure: ProjectStructure;
  dependencies: string[];
  apiEndpoints?: APIEndpoint[];
  databaseSchemas?: DatabaseSchema[];
  environmentVariables?: string[];
  buildTools?: string[];
  testFrameworks?: string[];
}

export interface ProjectStructure {
  rootPath: string;
  sourceDirectories: string[];
  testDirectories: string[];
  configFiles: string[];
  entryPoints: string[];
}

export interface APIEndpoint {
  path: string;
  method: string;
  description?: string;
  parameters?: any;
}

export interface DatabaseSchema {
  name: string;
  tables: DatabaseTable[];
}

export interface DatabaseTable {
  name: string;
  columns: DatabaseColumn[];
}

export interface DatabaseColumn {
  name: string;
  type: string;
  nullable?: boolean;
  primaryKey?: boolean;
}

export interface LanguageTemplate {
  language: SupportedLanguage;
  fileExtension: string;
  serverTemplate: string;
  toolTemplate: string;
  testTemplate: string;
  configTemplate: string;
  packageTemplate?: string;
  buildCommand?: string;
  runCommand?: string;
}