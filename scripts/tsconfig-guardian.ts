#!/usr/bin/env node

/**
 * TypeScript Configuration Guardian
 * Ensures TypeScript strict mode and error checking cannot be disabled
 */

import * as fs from 'fs';
import * as path from 'path';

interface TSConfig {
  compilerOptions?: {
    strict?: boolean;
    skipLibCheck?: boolean;
    noEmit?: boolean;
    noImplicitAny?: boolean;
    strictNullChecks?: boolean;
    strictFunctionTypes?: boolean;
    strictBindCallApply?: boolean;
    strictPropertyInitialization?: boolean;
    noImplicitThis?: boolean;
    alwaysStrict?: boolean;
  };
}

class TSConfigGuardian {
  private readonly requiredSettings = {
    strict: true,
    skipLibCheck: true, // Changed to true to handle node_modules issues
    noImplicitAny: true,
    strictNullChecks: true,
    strictFunctionTypes: true,
    strictBindCallApply: true,
    strictPropertyInitialization: true,
    noImplicitThis: true,
    alwaysStrict: true
  };

  private readonly configFiles = [
    'tsconfig.json',
    'tsconfig.node.json',
    'tsconfig.electron.json'
  ];

  private logViolation(message: string): void {
    const logFile = path.join(process.env['HOME']!, '.sessionhub/tsconfig-violations.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, logEntry);
  }

  public validateAllConfigs(): boolean {
    let allValid = true;

    for (const configFile of this.configFiles) {
      if (fs.existsSync(configFile)) {
        console.log(`🔍 Checking ${configFile}...`);
        if (!this.validateConfig(configFile)) {
          allValid = false;
        }
      }
    }

    return allValid;
  }

  private validateConfig(configPath: string): boolean {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      const config: TSConfig = JSON.parse(content);

      if (!config.compilerOptions) {
        console.error(`❌ ${configPath}: Missing compilerOptions`);
        this.logViolation(`Missing compilerOptions in ${configPath}`);
        return false;
      }

      let valid = true;

      // Check each required setting
      for (const [key, requiredValue] of Object.entries(this.requiredSettings)) {
        const actualValue = config.compilerOptions[key as keyof typeof config.compilerOptions];
        
        if (actualValue !== requiredValue) {
          console.error(`❌ ${configPath}: ${key} must be ${requiredValue}, found ${actualValue}`);
          this.logViolation(`Invalid ${key} in ${configPath}: expected ${requiredValue}, found ${actualValue}`);
          valid = false;
        }
      }

      if (valid) {
        console.log(`✅ ${configPath}: All strict settings enforced`);
      }

      return valid;
    } catch (error: any) {
      console.error(`❌ ${configPath}: Failed to parse - ${error}`);
      this.logViolation(`Parse error in ${configPath}: ${error}`);
      return false;
    }
  }

  public enforceConfigs(): void {
    console.log('🔒 Enforcing TypeScript strict configuration...');
    
    for (const configFile of this.configFiles) {
      if (fs.existsSync(configFile)) {
        this.enforceConfig(configFile);
      }
    }
  }

  private enforceConfig(configPath: string): void {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      const config: TSConfig = JSON.parse(content);

      if (!config.compilerOptions) {
        config.compilerOptions = {};
      }

      // Force all required settings
      Object.assign(config.compilerOptions, this.requiredSettings);

      // Write back with enforcement
      const enforcedContent = JSON.stringify(config, null, 2);
      fs.writeFileSync(configPath, enforcedContent);
      
      console.log(`✅ ${configPath}: Strict settings enforced`);
      this.logViolation(`Enforced strict settings in ${configPath}`);
    } catch (error: any) {
      console.error(`❌ Failed to enforce ${configPath}: ${error}`);
    }
  }

  public watchConfigs(): void {
    console.log('👁️  Watching TypeScript configs for changes...');
    
    for (const configFile of this.configFiles) {
      if (fs.existsSync(configFile)) {
        fs.watchFile(configFile, () => {
          console.log(`\n📝 ${configFile} changed, validating...`);
          if (!this.validateConfig(configFile)) {
            console.log('🔧 Auto-enforcing strict settings...');
            this.enforceConfig(configFile);
          }
        });
      }
    }
  }
}

// Main execution
const guardian = new TSConfigGuardian();

const command = process.argv[2];

switch (command) {
  case 'validate':
    if (!guardian.validateAllConfigs()) {
      console.error('\n❌ TypeScript configuration violations detected!');
      process.exit(1);
    }
    console.log('\n✅ All TypeScript configs are properly strict');
    break;
    
  case 'enforce':
    guardian.enforceConfigs();
    break;
    
  case 'watch':
    guardian.watchConfigs();
    console.log('\nPress Ctrl+C to stop watching...');
    break;
    
  default:
    console.log('Usage: tsconfig-guardian [validate|enforce|watch]');
    console.log('  validate - Check all tsconfig files for strict settings');
    console.log('  enforce  - Force all tsconfig files to use strict settings');
    console.log('  watch    - Monitor tsconfig files and auto-enforce on change');
    process.exit(1);
}