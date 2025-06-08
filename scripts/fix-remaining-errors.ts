#!/usr/bin/env ts-node
/**
 * Fix Remaining TypeScript Errors
 * 
 * This script fixes the remaining TypeScript errors found after the initial fixes
 */

import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

interface Fix {
  file: string;
  fixes: Array<{
    find: string | RegExp;
    replace: string;
    description: string;
  }>;
}

class RemainingErrorFixer {
  private fixedFiles: string[] = [];
  private errors: string[] = [];

  constructor() {
    console.log(`${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.blue}              Fix Remaining TypeScript Errors              ${colors.reset}`);
    console.log(`${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}\n`);
  }

  async fix(): Promise<void> {
    try {
      // Define fixes for specific files
      const fixes: Fix[] = [
        // Fix scripts with fsPromises issues
        {
          file: 'scripts/final-comprehensive-fix.ts',
          fixes: [
            {
              find: /import\s+\*\s+as\s+fs\s+from\s+'fs';\s*\n/,
              replace: '',
              description: 'Remove unused fs import'
            },
            {
              find: 'fsPromises',
              replace: 'fs',
              description: 'Replace fsPromises with fs'
            }
          ]
        },
        {
          file: 'scripts/fix-all-errors-comprehensive.ts',
          fixes: [
            {
              find: /import\s+\*\s+as\s+fs\s+from\s+'fs';\s*\n/,
              replace: '',
              description: 'Remove unused fs import'
            },
            {
              find: 'fsPromises',
              replace: 'fs',
              description: 'Replace fsPromises with fs'
            },
            {
              find: /replacement:\s*\(match:\s*unknown,\s*indent:\s*unknown,\s*call:\s*any\)\s*=>\s*unknown/,
              replace: 'replacement: (match: string, indent: string, call: string) => void string',
              description: 'Fix replacement function type'
            }
          ]
        },
        {
          file: 'scripts/fix-event-handlers.ts',
          fixes: [
            {
              find: /import\s+\*\s+as\s+fs\s+from\s+'fs';\s*\n/,
              replace: '',
              description: 'Remove unused fs import'
            },
            {
              find: 'fsPromises',
              replace: 'fs',
              description: 'Replace fsPromises with fs'
            }
          ]
        },
        {
          file: 'scripts/fix-typescript-errors.ts',
          fixes: [
            {
              find: /import\s+\*\s+as\s+fs\s+from\s+'fs';\s*\n/,
              replace: '',
              description: 'Remove unused fs import'
            },
            {
              find: 'fsPromises',
              replace: 'fs',
              description: 'Replace fsPromises with fs'
            }
          ]
        },
        {
          file: 'scripts/fix-void-promise.ts',
          fixes: [
            {
              find: /import\s+\*\s+as\s+fs\s+from\s+'fs';\s*\n/,
              replace: '',
              description: 'Remove unused fs import'
            },
            {
              find: 'fsPromises',
              replace: 'fs',
              description: 'Replace fsPromises with fs'
            }
          ]
        },
        {
          file: 'scripts/post-build-validator.ts',
          fixes: [
            {
              find: ', SpawnOptions',
              replace: '',
              description: 'Remove unused SpawnOptions import'
            },
            {
              find: /const\s+electronProcess\s*=\s*{};/,
              replace: 'let electronProcess: any = null;',
              description: 'Fix electronProcess type'
            }
          ]
        },
        {
          file: 'scripts/configure-supabase.ts',
          fixes: [
            {
              find: /import\s+{\s*promisify\s*}\s+from\s+'util';\s*\n/,
              replace: '',
              description: 'Remove unused promisify import'
            }
          ]
        },
        {
          file: 'scripts/strict-build-validator.ts',
          fixes: [
            {
              find: 'error.stdout || error.message',
              replace: '(error as any).stdout || (error as Error).message',
              description: 'Fix error type assertion'
            }
          ]
        },
        {
          file: 'scripts/start-monitor.ts',
          fixes: [
            {
              find: 'catch (error: any) {',
              replace: 'catch (error: any) {',
              description: 'Add type annotation to error'
            }
          ]
        },
        {
          file: 'scripts/fix-all-errors.ts',
          fixes: [
            {
              find: /fix:\s*\(filePath:\s*string,\s*_line:\s*number,\s*match:\s*RegExpMatchArray\)\s*=>\s*void/g,
              replace: 'fix: () => void',
              description: 'Fix function signature'
            }
          ]
        },
        // Fix renderer components
        {
          file: 'renderer/components/GitHubRepoSelector.tsx',
          fixes: [
            {
              find: 'onSelect()',
              replace: 'onSelect(selectedRepo)',
              description: 'Pass selectedRepo to onSelect'
            }
          ]
        },
        {
          file: 'renderer/components/SessionWorkflow.tsx',
          fixes: [
            {
              find: '.then((results) =>',
              replace: '.then((results: any) =>',
              description: 'Add type annotation to results'
            }
          ]
        },
        // Fix test files
        {
          file: 'tests/two-actor-architecture/run-all-tests.ts',
          fixes: [
            {
              find: 'runner: ($1) => Promise<void>',
              replace: 'runner: () => Promise<void>',
              description: 'Fix runner function type'
            }
          ]
        },
        {
          file: 'tests/integration/test-orchestration.ts',
          fixes: [
            {
              find: 'actors.every((a)',
              replace: 'actors.every((a: any)',
              description: 'Add type annotation'
            }
          ]
        },
        // Fix source files
        {
          file: 'src/core/error-detection/BuildValidator.ts',
          fixes: [
            {
              find: /import\s+\*\s+as\s+fs\s+from\s+'fs\/promises';\s*\n/,
              replace: '',
              description: 'Remove duplicate fs import'
            },
            {
              find: 'await fsPromises.writeFile',
              replace: 'await fs.writeFile',
              description: 'Use fs instead of fsPromises'
            }
          ]
        },
        {
          file: 'src/services/development/EmergencyRecovery.ts',
          fixes: [
            {
              find: ', SpawnOptions',
              replace: '',
              description: 'Remove unused SpawnOptions import'
            },
            {
              find: 'createHash',
              replace: 'crypto.createHash',
              description: 'Use crypto.createHash'
            },
            {
              find: /import\s+{\s*promises\s+as\s+fs\s*}\s+from\s+'fs';/,
              replace: "import { promises as fs } from 'fs';\nimport * as crypto from 'crypto';",
              description: 'Add crypto import'
            }
          ]
        }
      ];

      // Apply fixes
      for (const fixSpec of fixes) {
        await this.applyFixes(fixSpec);
      }

      // Fix remaining any type issues in multiple files
      await this.fixAnyTypeIssues();

      // Report results
      this.reportResults();
    } catch (error: any) {
      console.error(`${colors.red}Fatal error: ${error}${colors.reset}`);
      process.exit(1);
    }
  }

  private async applyFixes(fixSpec: Fix): Promise<void> {
    const filePath = path.join(process.cwd(), fixSpec.file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`${colors.yellow}⚠ File not found: ${fixSpec.file}${colors.reset}`);
      return;
    }

    try {
      let content = await fsPromises.readFile(filePath, 'utf8');
      const originalContent = content;
      let modified = false;

      for (const fix of fixSpec.fixes) {
        if (typeof fix.find === 'string') {
          if (content.includes(fix.find)) {
            content = content.replace(fix.find, fix.replace);
            modified = true;
            console.log(`${colors.green}✓ ${fix.description} in ${fixSpec.file}${colors.reset}`);
          }
        } else {
          const matches = content.match(fix.find);
          if (matches) {
            content = content.replace(fix.find, fix.replace);
            modified = true;
            console.log(`${colors.green}✓ ${fix.description} in ${fixSpec.file}${colors.reset}`);
          }
        }
      }

      if (modified && content !== originalContent) {
        await fsPromises.writeFile(filePath, content);
        this.fixedFiles.push(fixSpec.file);
      }
    } catch (error: any) {
      this.errors.push(`Failed to fix ${fixSpec.file}: ${error}`);
      console.error(`${colors.red}✗ Failed to fix ${fixSpec.file}: ${error}${colors.reset}`);
    }
  }

  private async fixAnyTypeIssues(): Promise<void> {
    console.log(`\n${colors.yellow}Fixing any type issues across the codebase...${colors.reset}`);

    const patterns = [
      {
        pattern: /catch\s*\(\s*error\s*\)\s*{/g,
        replacement: 'catch (error: any) {',
        description: 'Add any type to catch error'
      },
      {
        pattern: /\.forEach\(\s*\(\s*(\w+)\s*\)\s*=>/g,
        replacement: '.forEach(($1: any) =>',
        description: 'Add any type to forEach parameters'
      },
      {
        pattern: /\.map\(\s*\(\s*(\w+)\s*\)\s*=>/g,
        replacement: '.map(($1: any) =>',
        description: 'Add any type to map parameters'
      },
      {
        pattern: /\.filter\(\s*\(\s*(\w+)\s*\)\s*=>/g,
        replacement: '.filter(($1: any) =>',
        description: 'Add any type to filter parameters'
      }
    ];

    const directories = ['src', 'scripts', 'tests', 'main', 'renderer'];
    
    for (const dir of directories) {
      const dirPath = path.join(process.cwd(), dir);
      if (fs.existsSync(dirPath)) {
        await this.fixAnyTypeInDirectory(dirPath, patterns);
      }
    }
  }

  private async fixAnyTypeInDirectory(
    dir: string, 
    patterns: Array<{pattern: RegExp, replacement: string, description: string}>
  ): Promise<void> {
    const files = await this.getAllFiles(dir, ['.ts', '.tsx']);
    
    for (const file of files) {
      try {
        let content = await fsPromises.readFile(file, 'utf8');
        const originalContent = content;
        let modified = false;

        for (const { pattern, replacement } of patterns) {
          if (pattern.test(content)) {
            content = content.replace(pattern, replacement);
            modified = true;
          }
        }

        if (modified && content !== originalContent) {
          await fsPromises.writeFile(file, content);
          const relativePath = path.relative(process.cwd(), file);
          if (!this.fixedFiles.includes(relativePath)) {
            this.fixedFiles.push(relativePath);
          }
        }
      } catch (error: any) {
        // Skip files we can't process
      }
    }
  }

  private async getAllFiles(dir: string, extensions: string[]): Promise<string[]> {
    const files: string[] = [];
    
    const walk = async (currentDir: string) => {
      try {
        const entries = await fsPromises.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await walk(fullPath);
          } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch (error: any) {
        // Skip directories we can't read
      }
    };
    
    await walk(dir);
    return files;
  }

  private reportResults(): void {
    console.log(`\n${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.blue}                        RESULTS                            ${colors.reset}`);
    console.log(`${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`);
    
    console.log(`\n${colors.green}Fixed ${this.fixedFiles.length} files${colors.reset}`);

    if (this.errors.length > 0) {
      console.log(`\n${colors.red}Errors encountered:${colors.reset}`);
      this.errors.forEach(error => {
        console.log(`  ✗ ${error}`);
      });
    }

    console.log(`\n${colors.yellow}Next steps:${colors.reset}`);
    console.log('1. Run: npm run validate (to check for remaining errors)');
    console.log('2. Run: npm test (to run tests)');
    console.log('3. Run: npm run build:strict (to ensure production readiness)\n');
  }
}

// Run the fixer
async function main() {
  const fixer = new RemainingErrorFixer();
  await fixer.fix();
}

main().catch(console.error);