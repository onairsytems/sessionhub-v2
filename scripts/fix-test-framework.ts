#!/usr/bin/env ts-node
/**
 * Fix Test Framework and Script Errors
 * 
 * This script:
 * 1. Installs Jest and related dependencies
 * 2. Creates Jest configuration
 * 3. Fixes test imports and syntax
 * 4. Fixes Node.js API usage issues
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

class TestFrameworkFixer {
  private fixedFiles: string[] = [];
  private errors: string[] = [];

  constructor() {
    console.log(`${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.blue}         Test Framework and Script Error Fixer             ${colors.reset}`);
    console.log(`${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}\n`);
  }

  async fix(): Promise<void> {
    try {
      // Step 1: Install Jest dependencies
      await this.installJestDependencies();

      // Step 2: Create Jest configuration
      await this.createJestConfig();

      // Step 3: Fix test file imports
      await this.fixTestImports();

      // Step 4: Fix Node.js API usage
      await this.fixNodeJsApiUsage();

      // Step 5: Fix script shebangs and permissions
      await this.fixScriptShebangs();

      // Step 6: Update package.json test script
      await this.updatePackageJsonTestScript();

      // Report results
      this.reportResults();
    } catch (error: any) {
      console.error(`${colors.red}Fatal error: ${error}${colors.reset}`);
      process.exit(1);
    }
  }

  private async installJestDependencies(): Promise<void> {
    console.log(`${colors.yellow}Installing Jest dependencies...${colors.reset}`);
    
    const dependencies = [
      'jest',
      '@types/jest',
      'ts-jest',
      '@jest/types',
      '@jest/globals'
    ];

    try {
      const cmd = `npm install --save-dev ${dependencies.join(' ')}`;
      console.log(`Running: ${cmd}`);
      execSync(cmd, { stdio: 'inherit' });
      console.log(`${colors.green}✓ Jest dependencies installed${colors.reset}\n`);
    } catch (error: any) {
      console.log(`${colors.yellow}⚠ Failed to install dependencies automatically${colors.reset}`);
      console.log(`Please run manually: npm install --save-dev ${dependencies.join(' ')}\n`);
    }
  }

  private async createJestConfig(): Promise<void> {
    console.log(`${colors.yellow}Creating Jest configuration...${colors.reset}`);

    const jestConfig = `import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'es2020',
        lib: ['es2020'],
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        moduleResolution: 'node',
        baseUrl: '.',
        paths: {
          '@/*': ['./*']
        }
      }
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/dist-electron/',
    '/out/',
    '/.next/'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  }
};

export default config;
`;

    fs.writeFileSync(path.join(process.cwd(), 'jest.config.ts'), jestConfig);
    console.log(`${colors.green}✓ Created jest.config.ts${colors.reset}\n`);

    // Create test setup file
    const setupContent = `// Test environment setup
import '@jest/globals';

// Mock electron modules
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(),
    getName: jest.fn(() => 'SessionHub'),
    getVersion: jest.fn(() => '1.0.0')
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
  BrowserWindow: jest.fn()
}));

// Mock fs promises for tests
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  access: jest.fn()
}));

// Global test timeout
jest.setTimeout(10000);
`;

    const testsDir = path.join(process.cwd(), 'tests');
    if (!fs.existsSync(testsDir)) {
      fs.mkdirSync(testsDir, { recursive: true });
    }
    fs.writeFileSync(path.join(testsDir, 'setup.ts'), setupContent);
    console.log(`${colors.green}✓ Created tests/setup.ts${colors.reset}\n`);
  }

  private async fixTestImports(): Promise<void> {
    console.log(`${colors.yellow}Fixing test file imports...${colors.reset}`);

    const testFiles = [
      'src/core/verification/__tests__/SessionVerification.test.ts',
      'src/services/cache/LocalCacheService.test.ts'
    ];

    for (const file of testFiles) {
      const filePath = path.join(process.cwd(), file);
      if (!fs.existsSync(filePath)) {
        console.log(`${colors.yellow}⚠ File not found: ${file}${colors.reset}`);
        continue;
      }

      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;

      // Add Jest imports at the top if missing
      if (!content.includes("import { describe, it, expect, beforeEach") && 
          !content.includes("from '@jest/globals'")) {
        const importStatement = "import { describe, it, expect, beforeEach, jest } from '@jest/globals';\n";
        
        // Find the first import statement or the beginning of the file
        const firstImportIndex = content.indexOf('import');
        if (firstImportIndex !== -1) {
          content = content.slice(0, firstImportIndex) + importStatement + content.slice(firstImportIndex);
        } else {
          content = importStatement + '\n' + content;
        }
      }

      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        this.fixedFiles.push(file);
        console.log(`${colors.green}✓ Fixed imports in ${file}${colors.reset}`);
      }
    }
  }

  private async fixNodeJsApiUsage(): Promise<void> {
    console.log(`${colors.yellow}Fixing Node.js API usage...${colors.reset}`);

    // Fix fs.promises usage in script files
    const scriptFiles = this.getAllFiles(path.join(process.cwd(), 'scripts'), ['.ts']);
    const srcFiles = this.getAllFiles(path.join(process.cwd(), 'src'), ['.ts']);
    const mainFiles = this.getAllFiles(path.join(process.cwd(), 'main'), ['.ts']);
    
    const allFiles = [...scriptFiles, ...srcFiles, ...mainFiles];

    for (const file of allFiles) {
      let content = fs.readFileSync(file, 'utf8');
      const originalContent = content;
      let modified = false;

      // Fix fs.promises imports
      if (content.includes('import fs from') && content.includes('fs.promises')) {
        content = content.replace(
          /import\s+fs\s+from\s+['"]fs['"]/g,
          "import * as fs from 'fs'"
        );
        
        // Add fs/promises import if not present
        if (!content.includes("from 'fs/promises'") && !content.includes('from "fs/promises"')) {
          const fsImportMatch = content.match(/import\s+\*\s+as\s+fs\s+from\s+['"]fs['"]/);
          if (fsImportMatch) {
            const insertPos = fsImportMatch.index! + fsImportMatch[0].length;
            content = content.slice(0, insertPos) + 
                     ";\nimport { promises as fsPromises } from 'fs'" + 
                     content.slice(insertPos);
            
            // Replace fs.promises with fsPromises
            content = content.replace(/fs\.promises\./g, 'fsPromises.');
          }
        }
        modified = true;
      }

      // Fix standalone fs.promises usage
      if (content.includes("from 'fs/promises'") || content.includes('from "fs/promises"')) {
        content = content.replace(
          /import\s+\{\s*promises\s+as\s+fs\s*\}\s+from\s+['"]fs['"]/g,
          "import { promises as fsPromises } from 'fs'"
        );
        content = content.replace(
          /import\s+fs\s+from\s+['"]fs\/promises['"]/g,
          "import { promises as fsPromises } from 'fs'"
        );
        
        // Update usage
        if (content.includes('fs.')) {
          // Find if there's a conflicting fs import
          const hasFsImport = /import\s+\*\s+as\s+fs\s+from\s+['"]fs['"]/.test(content);
          if (!hasFsImport) {
            content = content.replace(/\bfs\./g, 'fsPromises.');
          }
        }
        modified = true;
      }

      // Fix child_process spawn type issues
      if (content.includes('spawn(') && content.includes("from 'child_process'")) {
        // Ensure proper typing for spawn
        if (!content.includes('SpawnOptions')) {
          content = content.replace(
            /import\s+\{([^}]+)\}\s+from\s+['"]child_process['"]/,
            (_match, imports) => {
              const importList = imports.split(',').map((s: string) => s.trim());
              if (!importList.includes('SpawnOptions')) {
                importList.push('SpawnOptions');
              }
              return `import { ${importList.join(', ')} } from 'child_process'`;
            }
          );
        }
        modified = true;
      }

      if (modified && content !== originalContent) {
        fs.writeFileSync(file, content);
        this.fixedFiles.push(path.relative(process.cwd(), file));
        console.log(`${colors.green}✓ Fixed Node.js API usage in ${path.relative(process.cwd(), file)}${colors.reset}`);
      }
    }
  }

  private async fixScriptShebangs(): Promise<void> {
    console.log(`${colors.yellow}Fixing script shebangs...${colors.reset}`);

    const scriptFiles = this.getAllFiles(path.join(process.cwd(), 'scripts'), ['.ts', '.sh']);

    for (const file of scriptFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      
      if (file.endsWith('.ts') && lines[0] && !lines[0].startsWith('#!/usr/bin/env')) {
        // Add shebang for TypeScript files
        lines.unshift('#!/usr/bin/env ts-node');
        fs.writeFileSync(file, lines.join('\n'));
        this.fixedFiles.push(path.relative(process.cwd(), file));
        console.log(`${colors.green}✓ Added shebang to ${path.relative(process.cwd(), file)}${colors.reset}`);
      }

      // Make executable
      try {
        fs.chmodSync(file, '755');
      } catch (error: any) {
        // Ignore chmod errors on Windows
      }
    }
  }

  private async updatePackageJsonTestScript(): Promise<void> {
    console.log(`${colors.yellow}Updating package.json test script...${colors.reset}`);

    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    packageJson.scripts.test = 'jest';
    packageJson.scripts['test:watch'] = 'jest --watch';
    packageJson.scripts['test:coverage'] = 'jest --coverage';
    packageJson.scripts['test:integration'] = 'ts-node tests/integration/test-orchestration.ts';
    packageJson.scripts['test:two-actor'] = 'ts-node tests/two-actor-architecture/run-all-tests.ts';

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`${colors.green}✓ Updated package.json test scripts${colors.reset}\n`);
  }

  private getAllFiles(dir: string, extensions: string[]): string[] {
    const files: string[] = [];
    
    if (!fs.existsSync(dir)) {
      return files;
    }

    const walk = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            walk(fullPath);
          } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch (error: any) {
        // Skip directories we can't read
      }
    };
    
    walk(dir);
    return files;
  }

  private reportResults(): void {
    console.log(`${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.blue}                        RESULTS                            ${colors.reset}`);
    console.log(`${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`);
    
    console.log(`\n${colors.green}Fixed ${this.fixedFiles.length} files:${colors.reset}`);
    this.fixedFiles.forEach(file => {
      console.log(`  ✓ ${file}`);
    });

    if (this.errors.length > 0) {
      console.log(`\n${colors.red}Errors encountered:${colors.reset}`);
      this.errors.forEach(error => {
        console.log(`  ✗ ${error}`);
      });
    }

    console.log(`\n${colors.yellow}Next steps:${colors.reset}`);
    console.log('1. Run: npm install (to install Jest dependencies)');
    console.log('2. Run: npm test (to run Jest tests)');
    console.log('3. Run: npm run test:integration (to run integration tests)');
    console.log('4. Run: npm run test:two-actor (to run two-actor architecture tests)');
    console.log('5. Run: npm run validate:strict (to validate the build)\n');
  }
}

// Run the fixer
async function main() {
  const fixer = new TestFrameworkFixer();
  await fixer.fix();
}

main().catch(console.error);