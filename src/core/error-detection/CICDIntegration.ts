
/**
 * CICDIntegration.ts
 * CI/CD pipeline integration that blocks deployment on any error
 */

import { BuildValidator } from './BuildValidator';
import { ErrorDetectionEngine } from './ErrorDetectionEngine';
import { CICDIntegration as CICDConfig, ErrorReport } from './types';
import { Logger } from '../../lib/logging/Logger';
import * as fs from 'fs/promises';
import * as path from 'path';

interface CICDResult {
  success: boolean;
  errors: ErrorReport[];
  warnings: ErrorReport[];
  reportPath?: string;
  exitCode: number;
}

export class CICDIntegration {
  private engine: ErrorDetectionEngine;
  private validator: BuildValidator;
  private logger: Logger;
  private config: CICDConfig;

  constructor(config: CICDConfig) {
    this.config = config;
    this.logger = new Logger('CICDIntegration');
    this.engine = new ErrorDetectionEngine();
    this.validator = new BuildValidator(this.engine, {
      failOnWarning: config.blockOnWarning,
      reportPath: '.sessionhub/build-report.json'
    });
  }

  /**
   * Run CI/CD validation
   */
  public async run(): Promise<CICDResult> {
    if (!this.config.enabled) {
      this.logger.info('CI/CD integration disabled');
      return {
        success: true,
        errors: [],
        warnings: [],
        exitCode: 0
      };
    }

    this.logger.info(`Running CI/CD validation for ${this.config.provider}`);

    try {
      // Run build validation
      const validation: any = await this.validator.validateBuild();
      
      // Determine success based on configuration
      let success = validation.canBuild;
      
      if (this.config.blockOnError && validation.blockingErrors.length > 0) {
        success = false;
      }
      
      if (this.config.blockOnWarning && validation.warnings.length > 0) {
        success = false;
      }

      // Generate report in specified format
      const reportPath = await this.generateReport(validation, this.config.reportFormat);

      // Set environment variables for CI/CD
      await this.setEnvironmentVariables(validation);

      // Create annotations for GitHub Actions
      if (this.config.provider === 'github') {
        await this.createGitHubAnnotations(validation);
      }

      const result: CICDResult = {
        success,
        errors: validation.blockingErrors,
        warnings: validation.warnings,
        reportPath,
        exitCode: success ? 0 : 1
      };

      // Log summary
      this.logCICDSummary(result);

      return result;

    } catch (error) {
      this.logger.error('CI/CD validation failed', error as Error);
      
      return {
        success: false,
        errors: [{
          filePath: 'ci/cd',
          line: 0,
          column: 0,
          severity: 'error',
          category: 'CI/CD',
          code: 'CICD_VALIDATION_FAILED',
          message: `CI/CD validation failed: ${error}`,
          timestamp: new Date().toISOString()
        }],
        warnings: [],
        exitCode: 1
      };
    }
  }

  /**
   * Generate report in specified format
   */
  private async generateReport(
    validation: any, 
    format: 'json' | 'junit' | 'markdown'
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportDir = '.sessionhub/reports';
    await fs.mkdir(reportDir, { recursive: true });

    let reportPath: string;
    let content: string;

    switch (format) {
      case 'junit':
        reportPath = path.join(reportDir, `validation-${timestamp}.xml`);
        content = this.generateJUnitReport(validation);
        break;

      case 'markdown':
        reportPath = path.join(reportDir, `validation-${timestamp}.md`);
        content = this.generateMarkdownReport(validation);
        break;

      case 'json':
      default:
        reportPath = path.join(reportDir, `validation-${timestamp}.json`);
        content = JSON.stringify(validation, null, 2);
    }

    await fs.writeFile(reportPath, content);
    this.logger.info(`Generated ${format} report: ${reportPath}`);

    return reportPath;
  }

  /**
   * Generate JUnit XML report
   */
  private generateJUnitReport(validation: any): string {
    const totalErrors = validation.blockingErrors.length;
    const totalWarnings = validation.warnings.length;
    const total = totalErrors + totalWarnings;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="SessionHub Validation" tests="${total}" failures="${totalErrors}" warnings="${totalWarnings}" time="0">
  <testsuite name="Error Detection" tests="${total}" failures="${totalErrors}" warnings="${totalWarnings}" time="0">
`;

    // Add error test cases
    validation.blockingErrors.forEach((error: ErrorReport, _index: number) => {
      xml += `    <testcase name="${error.code}: ${error.filePath}:${error.line}" classname="${error.category}" time="0">
      <failure message="${this.escapeXml(error.message)}" type="${error.code}">
        File: ${error.filePath}
        Line: ${error.line}
        Column: ${error.column}
        ${error.suggestion ? `Suggestion: ${error.suggestion}` : ''}
      </failure>
    </testcase>
`;
    });

    // Add warning test cases
    validation.warnings.forEach((warning: ErrorReport, _index: number) => {
      xml += `    <testcase name="${warning.code}: ${warning.filePath}:${warning.line}" classname="${warning.category}" time="0">
      <system-out>${this.escapeXml(warning.message)}</system-out>
    </testcase>
`;
    });

    xml += `  </testsuite>
</testsuites>`;

    return xml;
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdownReport(validation: any): string {
    const totalErrors = validation.blockingErrors.length;
    const totalWarnings = validation.warnings.length;
    
    let markdown = `# SessionHub Build Validation Report

Generated: ${new Date().toISOString()}

## Summary

- **Status**: ${validation.canBuild ? '✅ PASSED' : '❌ FAILED'}
- **Errors**: ${totalErrors}
- **Warnings**: ${totalWarnings}

`;

    if (totalErrors > 0) {
      markdown += `## Errors\n\n`;
      
      validation.blockingErrors.forEach((error: ErrorReport) => {
        markdown += `### ${error.code}: ${error.message}\n\n`;
        markdown += `- **File**: \`${error.filePath}:${error.line}:${error.column}\`\n`;
        markdown += `- **Category**: ${error.category}\n`;
        if (error.suggestion) {
          markdown += `- **Suggestion**: ${error.suggestion}\n`;
        }
        markdown += '\n';
      });
    }

    if (totalWarnings > 0) {
      markdown += `## Warnings\n\n`;
      
      validation.warnings.forEach((warning: ErrorReport) => {
        markdown += `### ${warning.code}: ${warning.message}\n\n`;
        markdown += `- **File**: \`${warning.filePath}:${warning.line}:${warning.column}\`\n`;
        markdown += `- **Category**: ${warning.category}\n`;
        if (warning.suggestion) {
          markdown += `- **Suggestion**: ${warning.suggestion}\n`;
        }
        markdown += '\n';
      });
    }

    return markdown;
  }

  /**
   * Set environment variables for CI/CD
   */
  private async setEnvironmentVariables(validation: any): Promise<void> {
    // Set variables that can be used by subsequent CI/CD steps
    process.env['SESSIONHUB_VALIDATION_PASSED'] = validation.canBuild ? 'true' : 'false';
    process.env['SESSIONHUB_ERROR_COUNT'] = validation.blockingErrors.length.toString();
    process.env['SESSIONHUB_WARNING_COUNT'] = validation.warnings.length.toString();

    // For GitHub Actions
    if (this.config.provider === 'github' && process.env['GITHUB_OUTPUT']) {
      const output = `
validation_passed=${validation.canBuild}
error_count=${validation.blockingErrors.length}
warning_count=${validation.warnings.length}
`;
      await fs.appendFile(process.env['GITHUB_OUTPUT'], output);
    }
  }

  /**
   * Create GitHub Actions annotations
   */
  private async createGitHubAnnotations(validation: any): Promise<void> {
    // GitHub Actions uses special commands to create annotations
    validation.blockingErrors.forEach((error: ErrorReport) => {
      console.log(`::error file=${error.filePath},line=${error.line},col=${error.column}::${error.message}`);
    });

    validation.warnings.forEach((warning: ErrorReport) => {
      console.log(`::warning file=${warning.filePath},line=${warning.line},col=${warning.column}::${warning.message}`);
    });
  }

  /**
   * Log CI/CD summary
   */
  private logCICDSummary(result: CICDResult): void {
    if (result.success) {
      this.logger.info('✅ CI/CD validation PASSED', {
        warnings: result.warnings.length
      });
    } else {
      this.logger.error('❌ CI/CD validation FAILED', undefined, {
        errorCount: result.errors.length,
        warningCount: result.warnings.length
      });

      // Show blocking configuration
      if (this.config.blockOnError) {
        this.logger.error('Build blocked due to errors (blockOnError enabled)');
      }
      if (this.config.blockOnWarning && result.warnings.length > 0) {
        this.logger.error('Build blocked due to warnings (blockOnWarning enabled)');
      }
    }
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Create pre-commit hook
   */
  public static async createPreCommitHook(): Promise<void> {
    const hookPath = '.git/hooks/pre-commit';
    const hookContent = `#!/bin/sh
# SessionHub pre-commit hook
# Prevents commits with TypeScript/ESLint errors

echo "Running SessionHub error detection..."

# Run validation
npx ts-node -e "
const { CICDIntegration } = require('./src/core/error-detection/CICDIntegration');
const cicd = new CICDIntegration({
  provider: 'custom',
  enabled: true,
  blockOnError: true,
  blockOnWarning: false,
  reportFormat: 'json'
});

cicd.run().then(result => {
  process.exit(result.exitCode);
}).catch(err => {
  console.error('Pre-commit validation failed:', err);
  process.exit(1);
});
"

exit $?
`;

    await fs.writeFile(hookPath, hookContent);
    await fs.chmod(hookPath, '755');
    
    console.log('✅ Pre-commit hook installed');
  }
}