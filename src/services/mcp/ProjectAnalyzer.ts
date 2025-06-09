import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../lib/logging/Logger';
import { 
  ProjectAnalysis, 
  ProjectStructure, 
  APIEndpoint, 
  DatabaseSchema,
  SupportedLanguage
} from './types';

export class ProjectAnalyzer {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ProjectAnalyzer');
  }

  /**
   * Analyze project structure and extract metadata
   */
  async analyze(projectPath: string, language: SupportedLanguage): Promise<ProjectAnalysis> {
    this.logger.info('Analyzing project:', { projectPath, language });

    const analysis: ProjectAnalysis = {
      structure: await this.analyzeStructure(projectPath),
      dependencies: await this.analyzeDependencies(projectPath, language),
      apiEndpoints: await this.analyzeAPIEndpoints(projectPath, language),
      databaseSchemas: await this.analyzeDatabaseSchemas(projectPath, language),
      environmentVariables: await this.analyzeEnvironmentVariables(projectPath),
      buildTools: await this.analyzeBuildTools(projectPath, language),
      testFrameworks: await this.analyzeTestFrameworks(projectPath, language)
    };

    this.logger.info('Project analysis complete:', analysis);
    return analysis;
  }

  /**
   * Analyze project directory structure
   */
  private async analyzeStructure(projectPath: string): Promise<ProjectStructure> {
    const structure: ProjectStructure = {
      rootPath: projectPath,
      sourceDirectories: [],
      testDirectories: [],
      configFiles: [],
      entryPoints: []
    };

    // Common source directory patterns
    const sourcePatterns = ['src', 'lib', 'app', 'source', 'sources'];
    const testPatterns = ['test', 'tests', 'spec', 'specs', '__tests__'];
    const configPatterns = ['config', 'configs', 'configuration'];

    await this.scanProjectStructure(projectPath, structure, sourcePatterns, testPatterns, configPatterns);

    return structure;
  }

  /**
   * Scan project structure recursively
   */
  private async scanProjectStructure(
    dirPath: string,
    structure: ProjectStructure,
    sourcePatterns: string[],
    testPatterns: string[],
    configPatterns: string[],
    depth: number = 0,
    maxDepth: number = 3
  ): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(structure.rootPath, fullPath);

        if (entry.isDirectory()) {
          const lowerName = entry.name.toLowerCase();

          if (sourcePatterns.includes(lowerName)) {
            structure.sourceDirectories.push(relativePath);
          } else if (testPatterns.includes(lowerName)) {
            structure.testDirectories.push(relativePath);
          }

          // Continue scanning subdirectories
          await this.scanProjectStructure(
            fullPath,
            structure,
            sourcePatterns,
            testPatterns,
            configPatterns,
            depth + 1,
            maxDepth
          );
        } else if (entry.isFile()) {
          // Check for config files
          if (this.isConfigFile(entry.name)) {
            structure.configFiles.push(relativePath);
          }

          // Check for entry points
          if (this.isEntryPoint(entry.name)) {
            structure.entryPoints.push(relativePath);
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Error scanning directory ${dirPath}:`, error as Error);
    }
  }

  /**
   * Analyze project dependencies
   */
  private async analyzeDependencies(projectPath: string, language: SupportedLanguage): Promise<string[]> {
    const dependencies: string[] = [];

    try {
      switch (language) {
        case 'typescript':
        case 'javascript': {
          const packageJsonPath = path.join(projectPath, 'package.json');
          const packageJson = await this.readJsonFile(packageJsonPath);
          if (packageJson) {
            if (packageJson.dependencies) {
              dependencies.push(...Object.keys(packageJson.dependencies));
            }
            if (packageJson.devDependencies) {
              dependencies.push(...Object.keys(packageJson.devDependencies));
            }
          }
          break;
        }

        case 'python': {
          // Check requirements.txt
          const requirementsPath = path.join(projectPath, 'requirements.txt');
          const requirements = await this.readTextFile(requirementsPath);
          if (requirements) {
            const lines = requirements.split('\n').filter(line => line.trim() && !line.startsWith('#'));
            dependencies.push(...lines.map(line => line.split(/[<>=]/)[0]?.trim() || '').filter(Boolean));
          }

          // Check pyproject.toml
          const pyprojectPath = path.join(projectPath, 'pyproject.toml');
          if (await this.fileExists(pyprojectPath)) {
            // TODO: Parse TOML file for dependencies
          }
          break;
        }

        case 'java': {
          // Check pom.xml for Maven projects
          const pomPath = path.join(projectPath, 'pom.xml');
          if (await this.fileExists(pomPath)) {
            // TODO: Parse XML for dependencies
          }

          // Check build.gradle for Gradle projects
          const gradlePath = path.join(projectPath, 'build.gradle');
          if (await this.fileExists(gradlePath)) {
            // TODO: Parse Gradle file for dependencies
          }
          break;
        }

        case 'go': {
          const goModPath = path.join(projectPath, 'go.mod');
          const goMod = await this.readTextFile(goModPath);
          if (goMod) {
            const requireRegex = /require\s+\(([\s\S]*?)\)/;
            const match = goMod.match(requireRegex);
            if (match && match[1]) {
              const requires = match[1].split('\n').filter(line => line.trim());
              dependencies.push(...requires.map(line => line.split(/\s+/)[0] || '').filter(Boolean));
            }
          }
          break;
        }

        case 'rust': {
          const cargoPath = path.join(projectPath, 'Cargo.toml');
          if (await this.fileExists(cargoPath)) {
            // TODO: Parse TOML file for dependencies
          }
          break;
        }

        // Add more language-specific dependency parsing as needed
      }
    } catch (error) {
      this.logger.warn('Error analyzing dependencies:', error as Error);
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }

  /**
   * Analyze API endpoints in the project
   */
  private async analyzeAPIEndpoints(projectPath: string, language: SupportedLanguage): Promise<APIEndpoint[]> {
    const endpoints: APIEndpoint[] = [];

    try {
      // Language-specific API analysis
      switch (language) {
        case 'typescript':
        case 'javascript': {
          // Look for Express/Fastify/Koa routes
          await this.findExpressRoutes(projectPath, endpoints);
          break;
        }

        case 'python': {
          // Look for Flask/FastAPI/Django routes
          await this.findPythonRoutes(projectPath, endpoints);
          break;
        }

        case 'java': {
          // Look for Spring annotations
          await this.findSpringEndpoints(projectPath, endpoints);
          break;
        }

        // Add more framework-specific endpoint detection
      }
    } catch (error) {
      this.logger.warn('Error analyzing API endpoints:', error as Error);
    }

    return endpoints;
  }

  /**
   * Analyze database schemas
   */
  private async analyzeDatabaseSchemas(projectPath: string, language: SupportedLanguage): Promise<DatabaseSchema[]> {
    const schemas: DatabaseSchema[] = [];

    try {
      // Look for schema definitions
      const schemaFiles = await this.findSchemaFiles(projectPath);
      
      for (const schemaFile of schemaFiles) {
        const schema = await this.parseSchemaFile(schemaFile);
        if (schema) {
          schemas.push(schema);
        }
      }

      // Language-specific ORM analysis
      switch (language) {
        case 'typescript':
        case 'javascript': {
          // Look for Prisma/TypeORM/Sequelize models
          await this.findORMModels(projectPath, schemas, 'javascript');
          break;
        }

        case 'python': {
          // Look for SQLAlchemy/Django models
          await this.findORMModels(projectPath, schemas, 'python');
          break;
        }

        // Add more ORM-specific schema detection
      }
    } catch (error) {
      this.logger.warn('Error analyzing database schemas:', error as Error);
    }

    return schemas;
  }

  /**
   * Analyze environment variables
   */
  private async analyzeEnvironmentVariables(projectPath: string): Promise<string[]> {
    const envVars: Set<string> = new Set();

    try {
      // Check .env files
      const envFiles = ['.env', '.env.example', '.env.sample', '.env.local'];
      for (const envFile of envFiles) {
        const envPath = path.join(projectPath, envFile);
        const content = await this.readTextFile(envPath);
        if (content) {
          const lines = content.split('\n');
          for (const line of lines) {
            const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=/);
            if (match && match[1]) {
              envVars.add(match[1]);
            }
          }
        }
      }

      // TODO: Scan source files for process.env references
    } catch (error) {
      this.logger.warn('Error analyzing environment variables:', error as Error);
    }

    return Array.from(envVars);
  }

  /**
   * Analyze build tools
   */
  private async analyzeBuildTools(projectPath: string, language: SupportedLanguage): Promise<string[]> {
    const buildTools: string[] = [];

    const buildToolMap: Record<string, string[]> = {
      'typescript': ['tsc', 'webpack', 'rollup', 'vite', 'esbuild', 'parcel'],
      'javascript': ['webpack', 'rollup', 'vite', 'esbuild', 'parcel', 'gulp', 'grunt'],
      'python': ['setuptools', 'poetry', 'pipenv', 'pyproject', 'make'],
      'java': ['maven', 'gradle', 'ant'],
      'csharp': ['msbuild', 'dotnet'],
      'go': ['go build', 'make'],
      'rust': ['cargo'],
      'ruby': ['bundler', 'rake'],
      'php': ['composer'],
      'swift': ['xcodebuild', 'swift build'],
      'kotlin': ['gradle', 'maven'],
      'scala': ['sbt', 'maven']
    };

    // Check for build tool files
    const toolFiles: Record<string, string> = {
      'webpack.config.js': 'webpack',
      'rollup.config.js': 'rollup',
      'vite.config.js': 'vite',
      'gulpfile.js': 'gulp',
      'Gruntfile.js': 'grunt',
      'Makefile': 'make',
      'pom.xml': 'maven',
      'build.gradle': 'gradle',
      'build.xml': 'ant',
      'Cargo.toml': 'cargo',
      'Gemfile': 'bundler',
      'Rakefile': 'rake',
      'composer.json': 'composer',
      'Package.swift': 'swift build',
      'build.sbt': 'sbt'
    };

    for (const [file, tool] of Object.entries(toolFiles)) {
      if (await this.fileExists(path.join(projectPath, file))) {
        buildTools.push(tool);
      }
    }

    // Add language-specific default tools
    const languageTools = buildToolMap[language] || [];
    for (const tool of languageTools) {
      if (!buildTools.includes(tool)) {
        // Check if tool is configured in package.json scripts or similar
        if (await this.isToolConfigured(projectPath, tool, language)) {
          buildTools.push(tool);
        }
      }
    }

    return buildTools;
  }

  /**
   * Analyze test frameworks
   */
  private async analyzeTestFrameworks(projectPath: string, language: SupportedLanguage): Promise<string[]> {
    const testFrameworks: string[] = [];

    const frameworkMap: Record<string, string[]> = {
      'typescript': ['jest', 'mocha', 'vitest', 'jasmine', 'ava', 'tap'],
      'javascript': ['jest', 'mocha', 'vitest', 'jasmine', 'ava', 'tap', 'qunit'],
      'python': ['pytest', 'unittest', 'nose', 'doctest'],
      'java': ['junit', 'testng', 'mockito', 'spock'],
      'csharp': ['nunit', 'xunit', 'mstest'],
      'go': ['testing', 'testify', 'ginkgo'],
      'rust': ['cargo test'],
      'ruby': ['rspec', 'minitest', 'test-unit'],
      'php': ['phpunit', 'codeception', 'behat'],
      'swift': ['xctest', 'quick'],
      'kotlin': ['junit', 'kotlintest', 'spek'],
      'scala': ['scalatest', 'specs2', 'junit']
    };

    // Check for test framework configuration files
    const testFiles: Record<string, string> = {
      'jest.config.js': 'jest',
      'jest.config.ts': 'jest',
      'vitest.config.js': 'vitest',
      'vitest.config.ts': 'vitest',
      'mocha.opts': 'mocha',
      '.mocharc.js': 'mocha',
      'pytest.ini': 'pytest',
      'phpunit.xml': 'phpunit',
      '.rspec': 'rspec'
    };

    for (const [file, framework] of Object.entries(testFiles)) {
      if (await this.fileExists(path.join(projectPath, file))) {
        testFrameworks.push(framework);
      }
    }

    // Check package.json for test dependencies
    if (language === 'typescript' || language === 'javascript') {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = await this.readJsonFile(packageJsonPath);
      if (packageJson) {
        const allDeps = {
          ...(packageJson.dependencies || {}),
          ...(packageJson.devDependencies || {})
        };
        
        const frameworks = frameworkMap[language] || [];
        for (const framework of frameworks) {
          if (allDeps[framework]) {
            testFrameworks.push(framework);
          }
        }
      }
    }

    return [...new Set(testFrameworks)];
  }

  // Helper methods
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async readJsonFile(filePath: string): Promise<any> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async readTextFile(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  private isConfigFile(fileName: string): boolean {
    const configPatterns = [
      /^\..*rc$/,
      /^.*\.config\.(js|ts|json)$/,
      /^config\.(js|ts|json|yml|yaml)$/,
      /^.*\.conf$/,
      /^.*\.ini$/,
      /^.*\.toml$/,
      /^.*\.properties$/
    ];

    return configPatterns.some(pattern => pattern.test(fileName));
  }

  private isEntryPoint(fileName: string): boolean {
    const entryPatterns = [
      'index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts',
      'server.js', 'server.ts', 'index.py', 'main.py', 'app.py',
      'Main.java', 'App.java', 'main.go', 'main.rs', 'main.swift',
      'Program.cs', 'Main.cs'
    ];

    return entryPatterns.includes(fileName);
  }

  private async findExpressRoutes(_projectPath: string, _endpoints: APIEndpoint[]): Promise<void> {
    // TODO: Implement Express route detection
    // This would scan for app.get(), app.post(), router.get(), etc.
  }

  private async findPythonRoutes(_projectPath: string, _endpoints: APIEndpoint[]): Promise<void> {
    // TODO: Implement Python route detection
    // This would scan for @app.route(), @router.get(), etc.
  }

  private async findSpringEndpoints(_projectPath: string, _endpoints: APIEndpoint[]): Promise<void> {
    // TODO: Implement Spring endpoint detection
    // This would scan for @GetMapping, @PostMapping, etc.
  }

  private async findSchemaFiles(_projectPath: string): Promise<string[]> {
    const schemaFiles: string[] = [];
    // TODO: Implement schema file detection using patterns:
    // ['schema.sql', 'schema.prisma', 'migrations', 'models']
    return schemaFiles;
  }

  private async parseSchemaFile(_schemaFile: string): Promise<DatabaseSchema | null> {
    // TODO: Implement schema file parsing
    return null;
  }

  private async findORMModels(_projectPath: string, _schemas: DatabaseSchema[], _language: string): Promise<void> {
    // TODO: Implement ORM model detection
  }

  private async isToolConfigured(projectPath: string, tool: string, language: SupportedLanguage): Promise<boolean> {
    // Check if tool is referenced in build scripts
    if (language === 'typescript' || language === 'javascript') {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = await this.readJsonFile(packageJsonPath);
      if (packageJson && packageJson.scripts) {
        const scriptsString = JSON.stringify(packageJson.scripts);
        return scriptsString.includes(tool);
      }
    }
    
    return false;
  }
}