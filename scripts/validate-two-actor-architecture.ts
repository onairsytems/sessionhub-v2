#!/usr/bin/env node
import * as fs from 'fs';
import { glob } from 'glob';

interface ValidationResult {
  passed: boolean;
  violations: string[];
  summary: string;
}

class TwoActorArchitectureValidator {
  private violations: string[] = [];
  
  async validate(): Promise<ValidationResult> {
    console.log('🎯 Validating Two-Actor Model Architecture\n');
    
    // Check Planning Actor boundaries
    await this.validatePlanningActor();
    
    // Check Execution Actor boundaries
    await this.validateExecutionActor();
    
    // Check protocol adherence
    await this.validateProtocol();
    
    // Check separation of concerns
    await this.validateSeparation();
    
    const passed = this.violations.length === 0;
    
    return {
      passed,
      violations: this.violations,
      summary: passed 
        ? '✅ All Two-Actor Model boundaries are properly maintained!' 
        : `❌ Found ${this.violations.length} architecture violations`
    };
  }
  
  private async validatePlanningActor(): Promise<void> {
    console.log('📋 Validating Planning Actor boundaries...');
    
    const planningFiles = await glob('src/core/orchestrator/planning/**/*.ts', {
      ignore: ['**/*.test.ts', '**/*.d.ts']
    });
    
    for (const file of planningFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Planning Actor should NOT:
      // 1. Generate code
      if (content.includes('fs.writeFileSync') || content.includes('fs.writeFile')) {
        this.violations.push(`${file}: Planning Actor is writing files (code generation)`);
      }
      
      // 2. Execute commands
      if (content.includes('execSync') || content.includes('spawn')) {
        this.violations.push(`${file}: Planning Actor is executing commands`);
      }
      
      // 3. Make direct API calls
      if (content.includes('fetch(') || content.includes('axios')) {
        this.violations.push(`${file}: Planning Actor is making direct API calls`);
      }
    }
    
    console.log(`  ✓ Checked ${planningFiles.length} planning files`);
  }
  
  private async validateExecutionActor(): Promise<void> {
    console.log('📋 Validating Execution Actor boundaries...');
    
    const executionFiles = await glob('src/core/orchestrator/execution/**/*.ts', {
      ignore: ['**/*.test.ts', '**/*.d.ts']
    });
    
    for (const file of executionFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Execution Actor should NOT:
      // 1. Make strategic decisions
      if (content.includes('strategy') || content.includes('decide') || content.includes('plan')) {
        // Check if it's actually strategic planning
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes('strategy') && !line.includes('executeStrategy')) {
            this.violations.push(`${file}:${idx + 1}: Execution Actor contains strategic planning`);
          }
        });
      }
      
      // 2. Analyze requirements
      if (content.includes('analyzeRequirements') || content.includes('gatherRequirements')) {
        this.violations.push(`${file}: Execution Actor is analyzing requirements`);
      }
    }
    
    console.log(`  ✓ Checked ${executionFiles.length} execution files`);
  }
  
  private async validateProtocol(): Promise<void> {
    console.log('📋 Validating protocol adherence...');
    
    // Check InstructionProtocol usage
    const protocolFiles = await glob('src/**/*.ts', {
      ignore: ['**/*.test.ts', '**/*.d.ts', 'node_modules/**']
    });
    
    let instructionUsageCount = 0;
    
    for (const file of protocolFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      if (content.includes('InstructionProtocol')) {
        instructionUsageCount++;
        
        // Check for proper protocol structure
        if (content.includes('execute') && !content.includes('protocol:')) {
          this.violations.push(`${file}: Missing protocol structure in instruction`);
        }
      }
    }
    
    console.log(`  ✓ Found ${instructionUsageCount} files using InstructionProtocol`);
  }
  
  private async validateSeparation(): Promise<void> {
    console.log('📋 Validating separation of concerns...');
    
    // Check for cross-dependencies
    const planningImports = await this.getImports('src/core/orchestrator/planning');
    const executionImports = await this.getImports('src/core/orchestrator/execution');
    
    // Planning should not import from execution
    for (const [file, imports] of planningImports) {
      const executionImport = imports.find(imp => imp.includes('/execution/'));
      if (executionImport) {
        this.violations.push(`${file}: Planning Actor imports from Execution Actor`);
      }
    }
    
    // Execution should not import from planning (except through protocol)
    for (const [file, imports] of executionImports) {
      const planningImport = imports.find(imp => 
        imp.includes('/planning/') && !imp.includes('Protocol')
      );
      if (planningImport) {
        this.violations.push(`${file}: Execution Actor imports from Planning Actor`);
      }
    }
    
    console.log(`  ✓ Validated actor separation`);
  }
  
  private async getImports(dir: string): Promise<Map<string, string[]>> {
    const imports = new Map<string, string[]>();
    const files = await glob(`${dir}/**/*.ts`, {
      ignore: ['**/*.test.ts', '**/*.d.ts']
    });
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const importMatches = content.match(/import.*from\s+['"]([^'"]+)['"]/g) || [];
      imports.set(file, importMatches.map(m => m.match(/['"]([^'"]+)['"]/)?.[1] || ''));
    }
    
    return imports;
  }
}

// Run validation
async function main() {
  const validator = new TwoActorArchitectureValidator();
  const result = await validator.validate();
  
  console.log('\n' + '='.repeat(50));
  console.log(result.summary);
  
  if (!result.passed) {
    console.log('\nViolations found:');
    result.violations.forEach(v => console.log(`  ❌ ${v}`));
    process.exit(1);
  }
  
  process.exit(0);
}

main().catch(console.error);