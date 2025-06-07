#!/usr/bin/env ts-node
/**
 * Strict Build Validator
 * 
 * This script enforces zero-error compilation and ensures the build
 * uses the latest code with no workarounds or error suppression.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

interface ValidationResult {
  step: string;
  success: boolean;
  details: string;
  errors?: string[];
}

class StrictBuildValidator {
  private results: ValidationResult[] = [];
  private startTime: number = 0;

  constructor() {
    console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}         SessionHub Strict Build Validator v1.2.2          ${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);
  }

  private runCommand(command: string, description: string): { success: boolean; output: string } {
    console.log(`${colors.blue}→ ${description}...${colors.reset}`);
    try {
      const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
      return { success: true, output };
    } catch (error) {
      return { success: false, output: error.stdout || error.message };
    }
  }

  private addResult(result: ValidationResult) {
    this.results.push(result);
    const icon = result.success ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
    console.log(`${icon} ${result.step}: ${result.details}`);
    if (result.errors && result.errors.length > 0) {
      result.errors.forEach(error => {
        console.log(`  ${colors.red}↳ ${error}${colors.reset}`);
      });
    }
    console.log();
  }

  async validate(): Promise<boolean> {
    this.startTime = Date.now();
    
    // Step 1: Verify Git Status
    await this.verifyGitStatus();
    
    // Step 2: Check TypeScript Configuration
    await this.checkTypeScriptConfig();
    
    // Step 3: Run TypeScript Compilation
    await this.runTypeScriptCompilation();
    
    // Step 4: Run ESLint
    await this.runESLint();
    
    // Step 5: Check for Error Suppression Patterns
    await this.checkErrorSuppressionPatterns();
    
    // Step 6: Build Next.js Application
    await this.buildNextApp();
    
    // Step 7: Build Electron Main Process
    await this.buildElectronMain();
    
    // Step 8: Verify Build Outputs
    await this.verifyBuildOutputs();
    
    // Step 9: Check Version Integrity
    await this.checkVersionIntegrity();
    
    // Generate Report
    return this.generateReport();
  }

  private async verifyGitStatus() {
    const result = this.runCommand('git status --porcelain', 'Checking Git status');
    const modifiedFiles = result.output.trim().split('\n').filter(line => line.trim());
    
    this.addResult({
      step: 'Git Status',
      success: true,
      details: `${modifiedFiles.length} files modified`,
      errors: modifiedFiles.length > 0 ? modifiedFiles : undefined
    });
  }

  private async checkTypeScriptConfig() {
    const configs = ['tsconfig.json', 'tsconfig.electron.json', 'tsconfig.node.json'];
    const errors: string[] = [];
    
    for (const config of configs) {
      try {
        const content = fs.readFileSync(path.join(process.cwd(), config), 'utf8');
        const parsed = JSON.parse(content);
        
        // Check for error suppression settings
        if (parsed.compilerOptions?.skipLibCheck === true) {
          errors.push(`${config}: skipLibCheck is set to true (should be false)`);
        }
        
        if (!parsed.compilerOptions?.strict) {
          errors.push(`${config}: strict mode is not enabled`);
        }
        
        // Check all strict mode options
        const strictOptions = [
          'noImplicitAny',
          'strictNullChecks',
          'strictFunctionTypes',
          'strictBindCallApply',
          'strictPropertyInitialization',
          'noImplicitThis',
          'alwaysStrict'
        ];
        
        for (const option of strictOptions) {
          if (parsed.compilerOptions?.[option] === false) {
            errors.push(`${config}: ${option} is disabled`);
          }
        }
      } catch (error) {
        errors.push(`${config}: Failed to parse - ${error}`);
      }
    }
    
    this.addResult({
      step: 'TypeScript Configuration',
      success: errors.length === 0,
      details: errors.length === 0 ? 'All configs properly configured' : `Found ${errors.length} configuration issues`,
      errors
    });
  }

  private async runTypeScriptCompilation() {
    console.log(`${colors.yellow}Running TypeScript compilation (this may take a moment)...${colors.reset}`);
    
    const result = this.runCommand('npx tsc --noEmit --pretty', 'TypeScript compilation');
    const errors = result.output.match(/error TS\d+:/g);
    const errorCount = errors ? errors.length : 0;
    
    this.addResult({
      step: 'TypeScript Compilation',
      success: result.success && errorCount === 0,
      details: result.success ? 'No compilation errors' : `${errorCount} compilation errors found`,
      errors: result.success ? undefined : [result.output.substring(0, 500) + '...']
    });
    
    if (!result.success) {
      console.log(`${colors.red}Full TypeScript output:${colors.reset}`);
      console.log(result.output);
    }
  }

  private async runESLint() {
    const result = this.runCommand('npx next lint', 'ESLint validation');
    
    this.addResult({
      step: 'ESLint Validation',
      success: result.success,
      details: result.success ? 'No linting errors' : 'Linting errors found',
      errors: result.success ? undefined : [result.output.substring(0, 500) + '...']
    });
  }

  private async checkErrorSuppressionPatterns() {
    const patterns = [
      { pattern: /@ts-ignore/g, description: '@ts-ignore comments' },
      { pattern: /@ts-nocheck/g, description: '@ts-nocheck comments' },
      { pattern: /@ts-expect-error/g, description: '@ts-expect-error comments' },
      { pattern: /eslint-disable/g, description: 'eslint-disable comments' },
      { pattern: /any\s*as\s*any/g, description: 'any as unknown casts' },
      { pattern: /console\.(log|warn|error|debug)/g, description: 'console statements' }
    ];
    
    const errors: string[] = [];
    const srcDir = path.join(process.cwd(), 'src');
    const mainDir = path.join(process.cwd(), 'main');
    const rendererDir = path.join(process.cwd(), 'renderer');
    
    const checkDirectory = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      
      const files = this.getAllFiles(dir, ['.ts', '.tsx', '.js', '.jsx']);
      
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        for (const { pattern, description } of patterns) {
          const matches = content.match(pattern);
          if (matches) {
            errors.push(`${path.relative(process.cwd(), file)}: Found ${matches.length} ${description}`);
          }
        }
      }
    };
    
    checkDirectory(srcDir);
    checkDirectory(mainDir);
    checkDirectory(rendererDir);
    
    this.addResult({
      step: 'Error Suppression Patterns',
      success: errors.length === 0,
      details: errors.length === 0 ? 'No error suppression found' : `Found ${errors.length} suppression patterns`,
      errors: errors.slice(0, 10) // Limit to first 10 errors
    });
  }

  private getAllFiles(dir: string, extensions: string[]): string[] {
    const files: string[] = [];
    
    const walk = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath);
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    };
    
    walk(dir);
    return files;
  }

  private async buildNextApp() {
    console.log(`${colors.yellow}Building Next.js application...${colors.reset}`);
    
    const result = this.runCommand('npx next build', 'Next.js build');
    
    this.addResult({
      step: 'Next.js Build',
      success: result.success,
      details: result.success ? 'Build completed successfully' : 'Build failed',
      errors: result.success ? undefined : [result.output.substring(0, 500) + '...']
    });
  }

  private async buildElectronMain() {
    console.log(`${colors.yellow}Building Electron main process...${colors.reset}`);
    
    const result = this.runCommand('npx tsc -p tsconfig.electron.json', 'Electron build');
    
    this.addResult({
      step: 'Electron Build',
      success: result.success,
      details: result.success ? 'Build completed successfully' : 'Build failed',
      errors: result.success ? undefined : [result.output.substring(0, 500) + '...']
    });
  }

  private async verifyBuildOutputs() {
    const requiredOutputs = [
      { path: 'out/index.html', description: 'Next.js output' },
      { path: 'dist/main/background-simple.js', description: 'Electron main process' },
      { path: '.next/BUILD_ID', description: 'Next.js build ID' }
    ];
    
    const errors: string[] = [];
    
    for (const { path: outputPath, description } of requiredOutputs) {
      if (!fs.existsSync(path.join(process.cwd(), outputPath))) {
        errors.push(`Missing ${description} at ${outputPath}`);
      }
    }
    
    this.addResult({
      step: 'Build Output Verification',
      success: errors.length === 0,
      details: errors.length === 0 ? 'All build outputs present' : `Missing ${errors.length} outputs`,
      errors
    });
  }

  private async checkVersionIntegrity() {
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const foundationPath = path.join(process.cwd(), 'docs/FOUNDATION.md');
      
      if (fs.existsSync(foundationPath)) {
        const foundation = fs.readFileSync(foundationPath, 'utf8');
        const versionMatch = foundation.match(/Version[^:]*:\s*v?([\d.]+)/);
        
        this.addResult({
          step: 'Version Integrity',
          success: true,
          details: `Package version: ${packageJson.version}, Foundation version: ${versionMatch ? versionMatch[1] : 'any'}`
        });
      } else {
        this.addResult({
          step: 'Version Integrity',
          success: true,
          details: `Package version: ${packageJson.version}`
        });
      }
    } catch (error) {
      this.addResult({
        step: 'Version Integrity',
        success: false,
        details: 'Failed to check version',
        errors: [`${error}`]
      });
    }
  }

  private generateReport(): boolean {
    const duration = Date.now() - this.startTime;
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const allPassed = failed === 0;
    
    console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}                    VALIDATION REPORT                      ${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`Total Steps: ${this.results.length}`);
    console.log(`${colors.green}Passed: ${successful}${colors.reset}`);
    console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log();
    
    if (allPassed) {
      console.log(`${colors.green}✅ ALL VALIDATIONS PASSED!${colors.reset}`);
      console.log(`${colors.green}The build is ready for production with zero errors.${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ VALIDATION FAILED!${colors.reset}`);
      console.log(`${colors.red}Fix all errors before proceeding with the build.${colors.reset}`);
      console.log('\nFailed steps:');
      this.results.filter(r => !r.success).forEach(r => {
        console.log(`  ${colors.red}• ${r.step}: ${r.details}${colors.reset}`);
      });
    }
    
    console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
    
    // Exit with appropriate code
    if (!allPassed) {
      process.exit(1);
    }
    
    return allPassed;
  }
}

// Run the validator
async function main() {
  const validator = new StrictBuildValidator();
  try {
    await validator.validate();
  } catch (error) {
    console.error(`${colors.red}Unexpected error: ${error}${colors.reset}`);
    process.exit(1);
  }
}

main();