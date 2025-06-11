/**
 * Security Audit Framework for SessionHub
 * Verifies credential handling, data protection, and access control
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface SecurityCheck {
  id: string;
  name: string;
  category: 'credentials' | 'data-protection' | 'access-control' | 'dependencies' | 'code-security';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  automated: boolean;
  validator: () => Promise<SecurityCheckResult>;
}

export interface SecurityCheckResult {
  checkId: string;
  passed: boolean;
  severity: string;
  message: string;
  vulnerabilities?: SecurityVulnerability[];
  evidence?: string[];
  recommendations?: string[];
  timestamp: number;
}

export interface SecurityVulnerability {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  location?: {
    file: string;
    line?: number;
    column?: number;
  };
  description: string;
  cwe?: string; // Common Weakness Enumeration
  fix?: string;
}

export interface SecurityAuditReport {
  timestamp: Date;
  summary: SecuritySummary;
  categories: Map<string, CategoryAudit>;
  vulnerabilities: SecurityVulnerability[];
  passedChecks: number;
  failedChecks: number;
  criticalIssues: number;
  recommendations: string[];
  complianceScore: number;
}

export interface SecuritySummary {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  criticalVulnerabilities: number;
  highVulnerabilities: number;
  mediumVulnerabilities: number;
  lowVulnerabilities: number;
  overallRisk: 'critical' | 'high' | 'medium' | 'low';
}

export interface CategoryAudit {
  category: string;
  checkCount: number;
  passedCount: number;
  failedCount: number;
  vulnerabilities: SecurityVulnerability[];
}

export class SecurityAuditFramework extends EventEmitter {
  private checks: Map<string, SecurityCheck> = new Map();
  private results: SecurityCheckResult[] = [];
  private vulnerabilities: SecurityVulnerability[] = [];

  constructor() {
    super();
    this.initializeChecks();
  }

  private initializeChecks(): void {
    // Credential Security Checks
    this.addCheck({
      id: 'cred-001',
      name: 'Hardcoded Credentials',
      category: 'credentials',
      severity: 'critical',
      description: 'Check for hardcoded passwords, API keys, and secrets',
      automated: true,
      validator: this.checkHardcodedCredentials.bind(this)
    });

    this.addCheck({
      id: 'cred-002',
      name: 'Environment Variable Security',
      category: 'credentials',
      severity: 'high',
      description: 'Verify environment variables are properly handled',
      automated: true,
      validator: this.checkEnvironmentVariables.bind(this)
    });

    this.addCheck({
      id: 'cred-003',
      name: 'Credential Storage',
      category: 'credentials',
      severity: 'critical',
      description: 'Verify credentials are stored securely',
      automated: true,
      validator: this.checkCredentialStorage.bind(this)
    });

    this.addCheck({
      id: 'cred-004',
      name: 'API Key Management',
      category: 'credentials',
      severity: 'high',
      description: 'Check API key handling and rotation',
      automated: true,
      validator: this.checkAPIKeyManagement.bind(this)
    });

    // Data Protection Checks
    this.addCheck({
      id: 'data-001',
      name: 'Data Encryption',
      category: 'data-protection',
      severity: 'high',
      description: 'Verify sensitive data is encrypted',
      automated: true,
      validator: this.checkDataEncryption.bind(this)
    });

    this.addCheck({
      id: 'data-002',
      name: 'Data Transmission Security',
      category: 'data-protection',
      severity: 'high',
      description: 'Verify data is transmitted securely',
      automated: true,
      validator: this.checkDataTransmission.bind(this)
    });

    this.addCheck({
      id: 'data-003',
      name: 'Data Sanitization',
      category: 'data-protection',
      severity: 'high',
      description: 'Check input validation and sanitization',
      automated: true,
      validator: this.checkDataSanitization.bind(this)
    });

    this.addCheck({
      id: 'data-004',
      name: 'Sensitive Data Exposure',
      category: 'data-protection',
      severity: 'critical',
      description: 'Check for exposed sensitive data',
      automated: true,
      validator: this.checkSensitiveDataExposure.bind(this)
    });

    // Access Control Checks
    this.addCheck({
      id: 'access-001',
      name: 'Authentication Mechanisms',
      category: 'access-control',
      severity: 'critical',
      description: 'Verify authentication is properly implemented',
      automated: true,
      validator: this.checkAuthentication.bind(this)
    });

    this.addCheck({
      id: 'access-002',
      name: 'Authorization Controls',
      category: 'access-control',
      severity: 'high',
      description: 'Verify authorization controls are in place',
      automated: true,
      validator: this.checkAuthorization.bind(this)
    });

    this.addCheck({
      id: 'access-003',
      name: 'Session Management',
      category: 'access-control',
      severity: 'high',
      description: 'Check session handling security',
      automated: true,
      validator: this.checkSessionManagement.bind(this)
    });

    this.addCheck({
      id: 'access-004',
      name: 'Permission Model',
      category: 'access-control',
      severity: 'medium',
      description: 'Verify permission model implementation',
      automated: true,
      validator: this.checkPermissionModel.bind(this)
    });

    // Dependency Security Checks
    this.addCheck({
      id: 'dep-001',
      name: 'Vulnerable Dependencies',
      category: 'dependencies',
      severity: 'high',
      description: 'Check for known vulnerabilities in dependencies',
      automated: true,
      validator: this.checkVulnerableDependencies.bind(this)
    });

    this.addCheck({
      id: 'dep-002',
      name: 'Outdated Dependencies',
      category: 'dependencies',
      severity: 'medium',
      description: 'Check for outdated dependencies',
      automated: true,
      validator: this.checkOutdatedDependencies.bind(this)
    });

    this.addCheck({
      id: 'dep-003',
      name: 'License Compliance',
      category: 'dependencies',
      severity: 'low',
      description: 'Verify dependency license compliance',
      automated: true,
      validator: this.checkLicenseCompliance.bind(this)
    });

    // Code Security Checks
    this.addCheck({
      id: 'code-001',
      name: 'Injection Vulnerabilities',
      category: 'code-security',
      severity: 'critical',
      description: 'Check for SQL, command, and other injection vulnerabilities',
      automated: true,
      validator: this.checkInjectionVulnerabilities.bind(this)
    });

    this.addCheck({
      id: 'code-002',
      name: 'XSS Prevention',
      category: 'code-security',
      severity: 'high',
      description: 'Check for cross-site scripting vulnerabilities',
      automated: true,
      validator: this.checkXSSPrevention.bind(this)
    });

    this.addCheck({
      id: 'code-003',
      name: 'Path Traversal',
      category: 'code-security',
      severity: 'high',
      description: 'Check for path traversal vulnerabilities',
      automated: true,
      validator: this.checkPathTraversal.bind(this)
    });

    this.addCheck({
      id: 'code-004',
      name: 'Error Handling',
      category: 'code-security',
      severity: 'medium',
      description: 'Verify secure error handling',
      automated: true,
      validator: this.checkErrorHandling.bind(this)
    });
  }

  private addCheck(check: SecurityCheck): void {
    this.checks.set(check.id, check);
  }

  /**
   * Run full security audit
   */
  public async runAudit(): Promise<SecurityAuditReport> {
    this.emit('audit:start');
    this.results = [];
    this.vulnerabilities = [];

    const categoryAudits = new Map<string, CategoryAudit>();
    const categories = ['credentials', 'data-protection', 'access-control', 'dependencies', 'code-security'];
    
    // Initialize categories
    categories.forEach(cat => {
      categoryAudits.set(cat, {
        category: cat,
        checkCount: 0,
        passedCount: 0,
        failedCount: 0,
        vulnerabilities: []
      });
    });

    // Run all checks
    for (const [id, check] of this.checks) {
      this.emit('check:start', check);
      
      try {
        const result = await check.validator();
        this.results.push(result);

        const categoryAudit = categoryAudits.get(check.category)!;
        categoryAudit.checkCount++;

        if (result.passed) {
          categoryAudit.passedCount++;
        } else {
          categoryAudit.failedCount++;
          if (result.vulnerabilities) {
            categoryAudit.vulnerabilities.push(...result.vulnerabilities);
            this.vulnerabilities.push(...result.vulnerabilities);
          }
        }

        this.emit('check:complete', { check, result });
      } catch (error) {
        const errorResult: SecurityCheckResult = {
          checkId: id,
          passed: false,
          severity: check.severity,
          message: `Check failed: ${(error as any).message || String(error)}`,
          timestamp: Date.now()
        };
        this.results.push(errorResult);
        categoryAudits.get(check.category)!.failedCount++;
      }
    }

    // Calculate summary
    const summary = this.calculateSummary();
    const complianceScore = this.calculateComplianceScore();
    const recommendations = this.generateRecommendations();

    const report: SecurityAuditReport = {
      timestamp: new Date(),
      summary,
      categories: categoryAudits,
      vulnerabilities: this.vulnerabilities,
      passedChecks: summary.passedChecks,
      failedChecks: summary.failedChecks,
      criticalIssues: summary.criticalVulnerabilities,
      recommendations,
      complianceScore
    };

    this.emit('audit:complete', report);
    return report;
  }

  /**
   * Security check implementations
   */
  private async checkHardcodedCredentials(): Promise<SecurityCheckResult> {
    const patterns = [
      { regex: /password\s*[:=]\s*["'][^"']+["']/gi, type: 'password' },
      { regex: /api[_-]?key\s*[:=]\s*["'][^"']+["']/gi, type: 'api_key' },
      { regex: /secret\s*[:=]\s*["'][^"']+["']/gi, type: 'secret' },
      { regex: /token\s*[:=]\s*["'][^"']+["']/gi, type: 'token' },
      { regex: /private[_-]?key\s*[:=]\s*["'][^"']+["']/gi, type: 'private_key' }
    ];

    const vulnerabilities: SecurityVulnerability[] = [];
    const srcFiles = this.getSourceFiles();

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      // const lines = content.split('\n'); // unused

      for (const pattern of patterns) {
        const matches = content.matchAll(pattern.regex);
        for (const match of matches) {
          const lineNumber = content.substring(0, match.index!).split('\n').length;
          
          // Check if it's not a placeholder or example
          if (!match[0].includes('example') && 
              !match[0].includes('placeholder') &&
              !match[0].includes('YOUR_') &&
              !match[0].includes('xxx')) {
            vulnerabilities.push({
              type: 'hardcoded_credential',
              severity: 'critical',
              location: {
                file: path.relative(process.cwd(), file),
                line: lineNumber
              },
              description: `Potential hardcoded ${pattern.type} found`,
              cwe: 'CWE-798',
              fix: 'Use environment variables or secure credential storage'
            });
          }
        }
      }
    }

    return {
      checkId: 'cred-001',
      passed: vulnerabilities.length === 0,
      severity: 'critical',
      message: vulnerabilities.length === 0 
        ? 'No hardcoded credentials found'
        : `Found ${vulnerabilities.length} potential hardcoded credentials`,
      vulnerabilities,
      timestamp: Date.now()
    };
  }

  private async checkEnvironmentVariables(): Promise<SecurityCheckResult> {
    const envUsagePattern = /process\.env\.(\w+)/g;
    const sensitiveEnvVars = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'CREDENTIAL'];
    const issues: string[] = [];

    const srcFiles = this.getSourceFiles();
    
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const matches = content.matchAll(envUsagePattern);
      
      for (const match of matches) {
        const envVar = match[1] || '';
        
        // Check if sensitive env var is used without validation
        if (sensitiveEnvVars.some(sensitive => envVar.includes(sensitive))) {
          const lineNumber = content.substring(0, match.index!).split('\n').length;
          const line = content.split('\n')[lineNumber - 1] || '';
          
          if (!line.includes('||') && !line.includes('??') && !line.includes('if')) {
            issues.push(`${path.relative(process.cwd(), file)}:${lineNumber} - ${envVar} used without fallback`);
          }
        }
      }
    }

    return {
      checkId: 'cred-002',
      passed: issues.length === 0,
      severity: 'high',
      message: issues.length === 0
        ? 'Environment variables are properly handled'
        : `Found ${issues.length} environment variable security issues`,
      evidence: issues,
      recommendations: issues.length > 0
        ? ['Always provide fallback values for environment variables', 'Validate environment variables before use']
        : [],
      timestamp: Date.now()
    };
  }

  private async checkCredentialStorage(): Promise<SecurityCheckResult> {
    const credentialFiles = [
      '.env',
      'config.json',
      'secrets.json',
      'credentials.json'
    ];

    const vulnerabilities: SecurityVulnerability[] = [];

    // Check for credential files in repository
    for (const file of credentialFiles) {
      if (fs.existsSync(file)) {
        // Check if file is in .gitignore
        let inGitignore = false;
        if (fs.existsSync('.gitignore')) {
          const gitignore = fs.readFileSync('.gitignore', 'utf-8');
          inGitignore = gitignore.includes(file);
        }

        if (!inGitignore) {
          vulnerabilities.push({
            type: 'exposed_credential_file',
            severity: 'critical',
            location: { file },
            description: `Credential file ${file} is not in .gitignore`,
            cwe: 'CWE-312',
            fix: 'Add credential files to .gitignore'
          });
        }
      }
    }

    // Check for encrypted credential storage
    const hasEncryption = this.getSourceFiles().some(file => {
      const content = fs.readFileSync(file, 'utf-8');
      return content.includes('crypto') || content.includes('encrypt');
    });

    if (!hasEncryption) {
      vulnerabilities.push({
        type: 'unencrypted_storage',
        severity: 'high',
        description: 'No encryption mechanism found for credential storage',
        cwe: 'CWE-256',
        fix: 'Implement encryption for stored credentials'
      });
    }

    return {
      checkId: 'cred-003',
      passed: vulnerabilities.length === 0,
      severity: 'critical',
      message: vulnerabilities.length === 0
        ? 'Credential storage is secure'
        : `Found ${vulnerabilities.length} credential storage issues`,
      vulnerabilities,
      timestamp: Date.now()
    };
  }

  private async checkAPIKeyManagement(): Promise<SecurityCheckResult> {
    const apiKeyPatterns = [
      /api[_-]?key/gi,
      /access[_-]?token/gi,
      /auth[_-]?token/gi
    ];

    const issues: string[] = [];
    const srcFiles = this.getSourceFiles();

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      for (const pattern of apiKeyPatterns) {
        if (pattern.test(content)) {
          // Check if there's key rotation logic
          if (!content.includes('rotate') && !content.includes('refresh') && !content.includes('renew')) {
            issues.push(`${path.relative(process.cwd(), file)} - No key rotation logic found`);
          }
        }
      }
    }

    return {
      checkId: 'cred-004',
      passed: issues.length === 0,
      severity: 'high',
      message: issues.length === 0
        ? 'API key management appears secure'
        : `Found ${issues.length} API key management issues`,
      evidence: issues,
      recommendations: issues.length > 0
        ? ['Implement API key rotation', 'Use short-lived tokens where possible']
        : [],
      timestamp: Date.now()
    };
  }

  private async checkDataEncryption(): Promise<SecurityCheckResult> {
    const encryptionModules = ['crypto', 'bcrypt', 'argon2', 'scrypt'];
    const hasEncryption = this.getSourceFiles().some(file => {
      const content = fs.readFileSync(file, 'utf-8');
      return encryptionModules.some(module => content.includes(module));
    });

    const sensitiveDataPatterns = [
      /password/i,
      /credit[_-]?card/i,
      /ssn/i,
      /social[_-]?security/i
    ];

    const unencryptedData: string[] = [];
    
    if (!hasEncryption) {
      const srcFiles = this.getSourceFiles();
      for (const file of srcFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        for (const pattern of sensitiveDataPatterns) {
          if (pattern.test(content)) {
            unencryptedData.push(path.relative(process.cwd(), file));
            break;
          }
        }
      }
    }

    return {
      checkId: 'data-001',
      passed: hasEncryption || unencryptedData.length === 0,
      severity: 'high',
      message: hasEncryption
        ? 'Data encryption is implemented'
        : `${unencryptedData.length} files may contain unencrypted sensitive data`,
      evidence: unencryptedData,
      recommendations: !hasEncryption
        ? ['Implement encryption for sensitive data', 'Use industry-standard encryption algorithms']
        : [],
      timestamp: Date.now()
    };
  }

  private async checkDataTransmission(): Promise<SecurityCheckResult> {
    const insecureProtocols = ['http://', 'ftp://', 'telnet://'];
    const vulnerabilities: SecurityVulnerability[] = [];
    
    const srcFiles = this.getSourceFiles();
    
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line: string, index: number) => {
        for (const protocol of insecureProtocols) {
          if (line.includes(protocol) && 
              !line.includes('localhost') && 
              !line.includes('127.0.0.1') &&
              !line.includes('example.com')) {
            vulnerabilities.push({
              type: 'insecure_transmission',
              severity: 'high',
              location: {
                file: path.relative(process.cwd(), file),
                line: index + 1
              },
              description: `Insecure protocol ${protocol} used`,
              cwe: 'CWE-319',
              fix: 'Use HTTPS or other secure protocols'
            });
          }
        }
      });
    }

    return {
      checkId: 'data-002',
      passed: vulnerabilities.length === 0,
      severity: 'high',
      message: vulnerabilities.length === 0
        ? 'Data transmission uses secure protocols'
        : `Found ${vulnerabilities.length} insecure data transmission issues`,
      vulnerabilities,
      timestamp: Date.now()
    };
  }

  private async checkDataSanitization(): Promise<SecurityCheckResult> {
    const sanitizationPatterns = [
      /sanitize/i,
      /escape/i,
      /validate/i,
      /clean/i
    ];

    const inputPatterns = [
      /req\.body/g,
      /req\.query/g,
      /req\.params/g,
      /user[Ii]nput/g
    ];

    const unsanitizedInputs: string[] = [];
    const srcFiles = this.getSourceFiles();

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Check if file has input handling
      let hasInput = false;
      for (const pattern of inputPatterns) {
        if (pattern.test(content)) {
          hasInput = true;
          break;
        }
      }

      if (hasInput) {
        // Check if it has sanitization
        let hasSanitization = false;
        for (const pattern of sanitizationPatterns) {
          if (pattern.test(content)) {
            hasSanitization = true;
            break;
          }
        }

        if (!hasSanitization) {
          unsanitizedInputs.push(path.relative(process.cwd(), file));
        }
      }
    }

    return {
      checkId: 'data-003',
      passed: unsanitizedInputs.length === 0,
      severity: 'high',
      message: unsanitizedInputs.length === 0
        ? 'Input sanitization is properly implemented'
        : `Found ${unsanitizedInputs.length} files with potentially unsanitized inputs`,
      evidence: unsanitizedInputs,
      recommendations: unsanitizedInputs.length > 0
        ? ['Implement input validation and sanitization', 'Use parameterized queries', 'Escape output data']
        : [],
      timestamp: Date.now()
    };
  }

  private async checkSensitiveDataExposure(): Promise<SecurityCheckResult> {
    const sensitivePatterns = [
      { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, type: 'SSN' },
      { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, type: 'Credit Card' },
      { pattern: /private[_-]?key/gi, type: 'Private Key' },
      { pattern: /BEGIN\s+(RSA|DSA|EC)\s+PRIVATE\s+KEY/g, type: 'Cryptographic Key' }
    ];

    const vulnerabilities: SecurityVulnerability[] = [];
    const srcFiles = this.getSourceFiles();

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      for (const { pattern, type } of sensitivePatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          const lineNumber = content.substring(0, match.index!).split('\n').length;
          vulnerabilities.push({
            type: 'sensitive_data_exposure',
            severity: 'critical',
            location: {
              file: path.relative(process.cwd(), file),
              line: lineNumber
            },
            description: `Potential ${type} exposed`,
            cwe: 'CWE-200',
            fix: 'Remove or encrypt sensitive data'
          });
        }
      }
    }

    return {
      checkId: 'data-004',
      passed: vulnerabilities.length === 0,
      severity: 'critical',
      message: vulnerabilities.length === 0
        ? 'No sensitive data exposure found'
        : `Found ${vulnerabilities.length} instances of exposed sensitive data`,
      vulnerabilities,
      timestamp: Date.now()
    };
  }

  private async checkAuthentication(): Promise<SecurityCheckResult> {
    const authPatterns = [
      /auth/i,
      /authenticate/i,
      /login/i,
      /signin/i
    ];

    const authFiles = this.getSourceFiles().filter(file => {
      const content = fs.readFileSync(file, 'utf-8');
      return authPatterns.some(pattern => pattern.test(content));
    });

    const issues: string[] = [];

    // Check for common authentication issues
    for (const file of authFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Check for weak authentication
      if (!content.includes('bcrypt') && 
          !content.includes('argon2') && 
          !content.includes('scrypt') &&
          !content.includes('crypto')) {
        issues.push(`${path.relative(process.cwd(), file)} - No secure password hashing found`);
      }

      // Check for session management
      if (content.includes('login') && !content.includes('session')) {
        issues.push(`${path.relative(process.cwd(), file)} - No session management found`);
      }
    }

    return {
      checkId: 'access-001',
      passed: authFiles.length > 0 && issues.length === 0,
      severity: 'critical',
      message: authFiles.length === 0
        ? 'No authentication mechanism found'
        : issues.length === 0
        ? 'Authentication is properly implemented'
        : `Found ${issues.length} authentication issues`,
      evidence: issues,
      timestamp: Date.now()
    };
  }

  private async checkAuthorization(): Promise<SecurityCheckResult> {
    const authzPatterns = [
      /authorize/i,
      /permission/i,
      /role/i,
      /access[_-]?control/i
    ];

    const hasAuthorization = this.getSourceFiles().some(file => {
      const content = fs.readFileSync(file, 'utf-8');
      return authzPatterns.some(pattern => pattern.test(content));
    });

    return {
      checkId: 'access-002',
      passed: hasAuthorization,
      severity: 'high',
      message: hasAuthorization
        ? 'Authorization controls are implemented'
        : 'No authorization controls found',
      recommendations: !hasAuthorization
        ? ['Implement role-based access control', 'Add authorization checks to sensitive operations']
        : [],
      timestamp: Date.now()
    };
  }

  private async checkSessionManagement(): Promise<SecurityCheckResult> {
    const sessionPatterns = [
      /session/i,
      /cookie/i,
      /jwt/i,
      /token/i
    ];

    const sessionFiles = this.getSourceFiles().filter(file => {
      const content = fs.readFileSync(file, 'utf-8');
      return sessionPatterns.some(pattern => pattern.test(content));
    });

    const issues: string[] = [];

    for (const file of sessionFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Check for secure session configuration
      if (content.includes('cookie') && !content.includes('httpOnly')) {
        issues.push(`${path.relative(process.cwd(), file)} - Cookies not marked as httpOnly`);
      }

      if (content.includes('cookie') && !content.includes('secure')) {
        issues.push(`${path.relative(process.cwd(), file)} - Cookies not marked as secure`);
      }

      // Check for session timeout
      if (!content.includes('expire') && !content.includes('timeout')) {
        issues.push(`${path.relative(process.cwd(), file)} - No session timeout configured`);
      }
    }

    return {
      checkId: 'access-003',
      passed: sessionFiles.length > 0 && issues.length === 0,
      severity: 'high',
      message: sessionFiles.length === 0
        ? 'No session management found'
        : issues.length === 0
        ? 'Session management is secure'
        : `Found ${issues.length} session management issues`,
      evidence: issues,
      timestamp: Date.now()
    };
  }

  private async checkPermissionModel(): Promise<SecurityCheckResult> {
    const permissionPatterns = [
      /can[A-Z]\w+/g,  // canRead, canWrite, etc.
      /has[A-Z]\w+Permission/g,
      /isAuthorized/g,
      /checkPermission/g
    ];

    const hasPermissionModel = this.getSourceFiles().some(file => {
      const content = fs.readFileSync(file, 'utf-8');
      return permissionPatterns.some(pattern => pattern.test(content));
    });

    return {
      checkId: 'access-004',
      passed: hasPermissionModel,
      severity: 'medium',
      message: hasPermissionModel
        ? 'Permission model is implemented'
        : 'No permission model found',
      recommendations: !hasPermissionModel
        ? ['Implement a granular permission system', 'Use principle of least privilege']
        : [],
      timestamp: Date.now()
    };
  }

  private async checkVulnerableDependencies(): Promise<SecurityCheckResult> {
    try {
      // Run npm audit
      const auditResult = execSync('npm audit --json', { encoding: 'utf-8' }) || '{}';
      const audit = JSON.parse(auditResult);
      
      const vulnerabilities: SecurityVulnerability[] = [];
      
      if (audit.vulnerabilities) {
        Object.entries(audit.vulnerabilities).forEach(([pkg, data]: [string, any]) => {
          vulnerabilities.push({
            type: 'vulnerable_dependency',
            severity: data.severity,
            description: `${pkg}: ${data.title}`,
            cwe: data.cwe,
            fix: data.fixAvailable ? `Update to ${data.fixAvailable}` : 'No fix available'
          });
        });
      }

      return {
        checkId: 'dep-001',
        passed: vulnerabilities.length === 0,
        severity: 'high',
        message: vulnerabilities.length === 0
          ? 'No vulnerable dependencies found'
          : `Found ${vulnerabilities.length} vulnerable dependencies`,
        vulnerabilities,
        timestamp: Date.now()
      };
    } catch (error) {
      // npm audit returns non-zero exit code if vulnerabilities found
      return {
        checkId: 'dep-001',
        passed: false,
        severity: 'high',
        message: 'Vulnerable dependencies detected',
        recommendations: ['Run npm audit fix to resolve vulnerabilities'],
        timestamp: Date.now()
      };
    }
  }

  private async checkOutdatedDependencies(): Promise<SecurityCheckResult> {
    try {
      const outdated = execSync('npm outdated --json', { encoding: 'utf-8' }) || '{}';
      const packages = JSON.parse(outdated || '{}');
      
      const outdatedCount = Object.keys(packages).length;
      
      return {
        checkId: 'dep-002',
        passed: outdatedCount < 10,
        severity: 'medium',
        message: outdatedCount === 0
          ? 'All dependencies are up to date'
          : `${outdatedCount} dependencies are outdated`,
        recommendations: outdatedCount > 0
          ? ['Regularly update dependencies', 'Use npm update or npm-check-updates']
          : [],
        timestamp: Date.now()
      };
    } catch {
      // npm outdated returns non-zero if outdated packages exist
      return {
        checkId: 'dep-002',
        passed: true,
        severity: 'medium',
        message: 'Dependencies check completed',
        timestamp: Date.now()
      };
    }
  }

  private async checkLicenseCompliance(): Promise<SecurityCheckResult> {
    const restrictedLicenses = ['GPL', 'AGPL', 'LGPL'];
    const packageJsonContent = fs.readFileSync('package.json', 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    const issues: string[] = [];

    // Check main license
    if (packageJson.license && restrictedLicenses.some(l => packageJson.license.includes(l))) {
      issues.push(`Main package uses restricted license: ${packageJson.license}`);
    }

    return {
      checkId: 'dep-003',
      passed: issues.length === 0,
      severity: 'low',
      message: issues.length === 0
        ? 'License compliance verified'
        : `Found ${issues.length} license compliance issues`,
      evidence: issues,
      timestamp: Date.now()
    };
  }

  private async checkInjectionVulnerabilities(): Promise<SecurityCheckResult> {
    const injectionPatterns = [
      { pattern: /query\s*\(\s*['"`].*\$\{.*\}.*['"`]/g, type: 'SQL Injection' },
      { pattern: /exec\s*\(\s*['"`].*\$\{.*\}.*['"`]/g, type: 'Command Injection' },
      { pattern: /eval\s*\(/g, type: 'Code Injection' },
      { pattern: /innerHTML\s*=.*\$\{/g, type: 'HTML Injection' }
    ];

    const vulnerabilities: SecurityVulnerability[] = [];
    const srcFiles = this.getSourceFiles();

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      for (const { pattern, type } of injectionPatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          const lineNumber = content.substring(0, match.index!).split('\n').length;
          vulnerabilities.push({
            type: 'injection_vulnerability',
            severity: 'critical',
            location: {
              file: path.relative(process.cwd(), file),
              line: lineNumber
            },
            description: `Potential ${type} vulnerability`,
            cwe: 'CWE-89',
            fix: 'Use parameterized queries or proper escaping'
          });
        }
      }
    }

    return {
      checkId: 'code-001',
      passed: vulnerabilities.length === 0,
      severity: 'critical',
      message: vulnerabilities.length === 0
        ? 'No injection vulnerabilities found'
        : `Found ${vulnerabilities.length} potential injection vulnerabilities`,
      vulnerabilities,
      timestamp: Date.now()
    };
  }

  private async checkXSSPrevention(): Promise<SecurityCheckResult> {
    const xssPatterns = [
      /innerHTML\s*=/g,
      /document\.write/g,
      /\$\{.*\}/g  // Unescaped template literals in HTML context
    ];

    const vulnerabilities: SecurityVulnerability[] = [];
    const srcFiles = this.getSourceFiles().filter(f => 
      f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.html')
    );

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      for (const pattern of xssPatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          const lineNumber = content.substring(0, match.index!).split('\n').length;
          
          // Check if it's properly escaped
          const line = content.split('\n')[lineNumber - 1] || '';
          if (!line.includes('escape') && !line.includes('sanitize')) {
            vulnerabilities.push({
              type: 'xss_vulnerability',
              severity: 'high',
              location: {
                file: path.relative(process.cwd(), file),
                line: lineNumber
              },
              description: 'Potential XSS vulnerability',
              cwe: 'CWE-79',
              fix: 'Escape or sanitize user input before rendering'
            });
          }
        }
      }
    }

    return {
      checkId: 'code-002',
      passed: vulnerabilities.length === 0,
      severity: 'high',
      message: vulnerabilities.length === 0
        ? 'XSS prevention measures in place'
        : `Found ${vulnerabilities.length} potential XSS vulnerabilities`,
      vulnerabilities,
      timestamp: Date.now()
    };
  }

  private async checkPathTraversal(): Promise<SecurityCheckResult> {
    const pathPatterns = [
      /path\.join\s*\([^)]*\.\.[^)]*\)/g,
      /readFile[^(]*\([^)]*\.\.[^)]*\)/g,
      /require\s*\([^)]*\.\.[^)]*\)/g
    ];

    const vulnerabilities: SecurityVulnerability[] = [];
    const srcFiles = this.getSourceFiles();

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      for (const pattern of pathPatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          const lineNumber = content.substring(0, match.index!).split('\n').length;
          
          // Check if path is validated
          const context = content.substring(Math.max(0, match.index! - 200), match.index! + 200);
          if (!context.includes('normalize') && !context.includes('resolve')) {
            vulnerabilities.push({
              type: 'path_traversal',
              severity: 'high',
              location: {
                file: path.relative(process.cwd(), file),
                line: lineNumber
              },
              description: 'Potential path traversal vulnerability',
              cwe: 'CWE-22',
              fix: 'Validate and normalize file paths'
            });
          }
        }
      }
    }

    return {
      checkId: 'code-003',
      passed: vulnerabilities.length === 0,
      severity: 'high',
      message: vulnerabilities.length === 0
        ? 'No path traversal vulnerabilities found'
        : `Found ${vulnerabilities.length} potential path traversal vulnerabilities`,
      vulnerabilities,
      timestamp: Date.now()
    };
  }

  private async checkErrorHandling(): Promise<SecurityCheckResult> {
    const issues: string[] = [];
    const srcFiles = this.getSourceFiles();

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Check for stack traces in error responses
      if (content.includes('stack') && content.includes('res.send')) {
        issues.push(`${path.relative(process.cwd(), file)} - Potential stack trace exposure`);
      }

      // Check for detailed error messages
      if (content.includes('error.message') && content.includes('res.')) {
        issues.push(`${path.relative(process.cwd(), file)} - Detailed error messages exposed`);
      }
    }

    return {
      checkId: 'code-004',
      passed: issues.length === 0,
      severity: 'medium',
      message: issues.length === 0
        ? 'Error handling is secure'
        : `Found ${issues.length} error handling issues`,
      evidence: issues,
      recommendations: issues.length > 0
        ? ['Avoid exposing stack traces in production', 'Use generic error messages for users']
        : [],
      timestamp: Date.now()
    };
  }

  /**
   * Helper methods
   */
  private getSourceFiles(): string[] {
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    const files: string[] = [];
    
    const walkDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && 
            !entry.name.startsWith('.') && 
            entry.name !== 'node_modules' &&
            entry.name !== 'dist' &&
            entry.name !== 'build') {
          walkDir(fullPath);
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    };

    walkDir(process.cwd());
    return files;
  }

  private calculateSummary(): SecuritySummary {
    const summary: SecuritySummary = {
      totalChecks: this.checks.size,
      passedChecks: this.results.filter(r => r.passed).length,
      failedChecks: this.results.filter(r => !r.passed).length,
      criticalVulnerabilities: this.vulnerabilities.filter(v => v.severity === 'critical').length,
      highVulnerabilities: this.vulnerabilities.filter(v => v.severity === 'high').length,
      mediumVulnerabilities: this.vulnerabilities.filter(v => v.severity === 'medium').length,
      lowVulnerabilities: this.vulnerabilities.filter(v => v.severity === 'low').length,
      overallRisk: 'low'
    };

    // Determine overall risk
    if (summary.criticalVulnerabilities > 0) {
      summary.overallRisk = 'critical';
    } else if (summary.highVulnerabilities > 2) {
      summary.overallRisk = 'high';
    } else if (summary.highVulnerabilities > 0 || summary.mediumVulnerabilities > 5) {
      summary.overallRisk = 'medium';
    }

    return summary;
  }

  private calculateComplianceScore(): number {
    // Weight by severity
    let weightedScore = 0;
    let totalWeight = 0;
    
    this.results.forEach(result => {
      const check = Array.from(this.checks.values()).find(c => c.id === result.checkId);
      if (check) {
        const weight = check.severity === 'critical' ? 4 :
                      check.severity === 'high' ? 3 :
                      check.severity === 'medium' ? 2 : 1;
        
        totalWeight += weight;
        if (result.passed) {
          weightedScore += weight;
        }
      }
    });

    return Math.round((weightedScore / totalWeight) * 100);
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Critical recommendations
    if (this.vulnerabilities.filter(v => v.severity === 'critical').length > 0) {
      recommendations.push('Address all critical security vulnerabilities immediately');
    }

    // Category-specific recommendations
    const categoryFailures = new Map<string, number>();
    this.results.filter(r => !r.passed).forEach(result => {
      const check = Array.from(this.checks.values()).find(c => c.id === result.checkId);
      if (check) {
        categoryFailures.set(
          check.category,
          (categoryFailures.get(check.category) || 0) + 1
        );
      }
    });

    categoryFailures.forEach((count, category) => {
      if (count > 0) {
        switch (category) {
          case 'credentials':
            recommendations.push('Implement secure credential management practices');
            break;
          case 'data-protection':
            recommendations.push('Enhance data protection measures');
            break;
          case 'access-control':
            recommendations.push('Strengthen access control mechanisms');
            break;
          case 'dependencies':
            recommendations.push('Regularly update and audit dependencies');
            break;
          case 'code-security':
            recommendations.push('Implement secure coding practices');
            break;
        }
      }
    });

    // Add specific recommendations from checks
    this.results.forEach(result => {
      if (result.recommendations) {
        recommendations.push(...result.recommendations);
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Generate detailed report
   */
  public generateDetailedReport(report: SecurityAuditReport): string {
    const lines: string[] = [];
    
    lines.push('# Security Audit Report');
    lines.push(`Generated: ${report.timestamp.toISOString()}`);
    lines.push(`Compliance Score: ${report.complianceScore}%`);
    lines.push(`Overall Risk: ${report.summary.overallRisk.toUpperCase()}`);
    lines.push('');
    
    lines.push('## Summary');
    lines.push(`Total Checks: ${report.summary.totalChecks}`);
    lines.push(`Passed: ${report.summary.passedChecks}`);
    lines.push(`Failed: ${report.summary.failedChecks}`);
    lines.push('');
    
    lines.push('## Vulnerabilities by Severity');
    lines.push(`- Critical: ${report.summary.criticalVulnerabilities}`);
    lines.push(`- High: ${report.summary.highVulnerabilities}`);
    lines.push(`- Medium: ${report.summary.mediumVulnerabilities}`);
    lines.push(`- Low: ${report.summary.lowVulnerabilities}`);
    lines.push('');
    
    if (report.vulnerabilities.length > 0) {
      lines.push('## Vulnerabilities');
      report.vulnerabilities.forEach(vuln => {
        lines.push(`### ${vuln.type} (${vuln.severity.toUpperCase()})`);
        lines.push(vuln.description);
        if (vuln.location) {
          lines.push(`Location: ${vuln.location.file}${vuln.location.line ? ':' + vuln.location.line : ''}`);
        }
        if (vuln.cwe) {
          lines.push(`CWE: ${vuln.cwe}`);
        }
        if (vuln.fix) {
          lines.push(`Fix: ${vuln.fix}`);
        }
        lines.push('');
      });
    }
    
    lines.push('## Category Results');
    report.categories.forEach((audit, category) => {
      lines.push(`### ${category}`);
      lines.push(`Passed: ${audit.passedCount}/${audit.checkCount}`);
      if (audit.vulnerabilities.length > 0) {
        lines.push(`Vulnerabilities: ${audit.vulnerabilities.length}`);
      }
      lines.push('');
    });
    
    if (report.recommendations.length > 0) {
      lines.push('## Recommendations');
      report.recommendations.forEach(rec => {
        lines.push(`- ${rec}`);
      });
    }
    
    return lines.join('\n');
  }
}

// Export singleton instance
let auditInstance: SecurityAuditFramework | null = null;

export const getSecurityAudit = (): SecurityAuditFramework => {
  if (!auditInstance) {
    auditInstance = new SecurityAuditFramework();
  }
  return auditInstance;
};

export const runSecurityAudit = async (): Promise<SecurityAuditReport> => {
  const audit = getSecurityAudit();
  return audit.runAudit();
};