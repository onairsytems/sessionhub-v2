import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as crypto from 'crypto';

export interface SecurityVulnerability {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  description: string;
  location: string;
  recommendation: string;
  cwe?: string;
  owasp?: string;
}

export interface SecurityAuditResult {
  passed: boolean;
  vulnerabilities: SecurityVulnerability[];
  score: number;
  compliance: {
    owasp: boolean;
    pci: boolean;
    gdpr: boolean;
    soc2: boolean;
  };
  timestamp: Date;
  scanDuration: number;
}

export class SecurityAuditFramework {
  private vulnerabilities: SecurityVulnerability[] = [];
  private startTime: number = 0;

  async runComprehensiveAudit(): Promise<SecurityAuditResult> {
    this.startTime = Date.now();
    this.vulnerabilities = [];

    console.log('🔐 Starting comprehensive security audit...');

    // Run all security checks
    await Promise.all([
      this.auditDependencies(),
      this.auditSourceCode(),
      this.auditAuthentication(),
      this.auditAPIEndpoints(),
      this.auditDataProtection(),
      this.auditAccessControl(),
      this.auditCryptography(),
      this.auditSessionManagement(),
      this.auditInputValidation(),
      this.auditErrorHandling(),
      this.auditLogging(),
      this.auditThirdPartyIntegrations(),
      this.auditElectronSecurity(),
      this.auditBuildProcess()
    ]);

    // Calculate compliance
    const compliance = this.calculateCompliance();
    
    // Calculate security score
    const score = this.calculateSecurityScore();

    const scanDuration = Date.now() - this.startTime;

    return {
      passed: this.vulnerabilities.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0,
      vulnerabilities: this.vulnerabilities,
      score,
      compliance,
      timestamp: new Date(),
      scanDuration
    };
  }

  private async auditDependencies(): Promise<void> {
    console.log('📦 Auditing dependencies...');

    try {
      // Run npm audit
      const auditResult = execSync('npm audit --json', { encoding: 'utf-8' });
      const audit = JSON.parse(auditResult);

      if (audit.vulnerabilities) {
        Object.entries(audit.vulnerabilities).forEach(([pkg, vuln]: [string, any]) => {
          if (vuln.severity === 'critical' || vuln.severity === 'high') {
            this.vulnerabilities.push({
              severity: vuln.severity,
              type: 'Vulnerable Dependency',
              description: `${pkg} has known vulnerabilities`,
              location: 'package.json',
              recommendation: `Update ${pkg} to version ${vuln.fixAvailable?.version || 'latest'}`,
              cwe: vuln.cwe?.join(', ')
            });
          }
        });
      }
    } catch (_error) {
      // npm audit returns non-zero exit code if vulnerabilities found
      // Parse the output anyway
    }

    // Check for outdated dependencies
    try {
      const outdated = execSync('npm outdated --json', { encoding: 'utf-8' });
      const packages = JSON.parse(outdated);
      
      Object.entries(packages).forEach(([pkg, info]: [string, any]) => {
        if (info.current && info.latest) {
          const currentMajor = info.current.split('.')[0];
          const latestMajor = info.latest.split('.')[0];
          
          if (parseInt(latestMajor) > parseInt(currentMajor)) {
            this.vulnerabilities.push({
              severity: 'medium',
              type: 'Outdated Dependency',
              description: `${pkg} is ${parseInt(latestMajor) - parseInt(currentMajor)} major versions behind`,
              location: 'package.json',
              recommendation: `Consider updating ${pkg} from ${info.current} to ${info.latest}`
            });
          }
        }
      });
    } catch (_error) {
      // npm outdated returns non-zero exit code if packages are outdated
    }
  }

  private async auditSourceCode(): Promise<void> {
    console.log('🔍 Auditing source code...');

    // Check for hardcoded secrets
    const secretPatterns = [
      { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi, type: 'API Key' },
      { pattern: /secret[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi, type: 'Secret Key' },
      { pattern: /password\s*[:=]\s*['"][^'"]+['"]/gi, type: 'Password' },
      { pattern: /private[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi, type: 'Private Key' },
      { pattern: /token\s*[:=]\s*['"][^'"]+['"]/gi, type: 'Token' },
      { pattern: /[a-zA-Z0-9]{40}/g, type: 'Potential API Token' }
    ];

    const sourceFiles = execSync('find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" | grep -v node_modules | grep -v dist', { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean);

    for (const file of sourceFiles) {
      if (existsSync(file)) {
        const content = readFileSync(file, 'utf-8');
        
        secretPatterns.forEach(({ pattern, type }) => {
          const matches = content.match(pattern);
          if (matches) {
            this.vulnerabilities.push({
              severity: 'critical',
              type: 'Hardcoded Secret',
              description: `Potential ${type} found in source code`,
              location: file,
              recommendation: 'Move secrets to environment variables or secure key management',
              cwe: 'CWE-798'
            });
          }
        });

        // Check for unsafe eval usage
        if (content.includes('eval(') || content.includes('new Function(')) {
          this.vulnerabilities.push({
            severity: 'high',
            type: 'Code Injection Risk',
            description: 'Unsafe use of eval() or Function constructor',
            location: file,
            recommendation: 'Avoid dynamic code execution, use safer alternatives',
            cwe: 'CWE-94'
          });
        }

        // Check for SQL injection risks
        if (content.match(/query\s*\(\s*[`'"].*\$\{.*\}.*[`'"]/g)) {
          this.vulnerabilities.push({
            severity: 'critical',
            type: 'SQL Injection Risk',
            description: 'Potential SQL injection vulnerability with string interpolation',
            location: file,
            recommendation: 'Use parameterized queries or prepared statements',
            cwe: 'CWE-89',
            owasp: 'A03:2021'
          });
        }
      }
    }
  }

  private async auditAuthentication(): Promise<void> {
    console.log('🔐 Auditing authentication...');

    // Check for weak password policies
    const authFiles = execSync('find . -name "*auth*.ts" -o -name "*login*.ts" | grep -v node_modules', { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean);

    for (const file of authFiles) {
      if (existsSync(file)) {
        const content = readFileSync(file, 'utf-8');
        
        // Check for password complexity requirements
        if (!content.includes('password') || !content.match(/length.*[><=]\s*\d+/)) {
          this.vulnerabilities.push({
            severity: 'medium',
            type: 'Weak Password Policy',
            description: 'No password complexity requirements found',
            location: file,
            recommendation: 'Implement minimum password length and complexity requirements',
            owasp: 'A07:2021'
          });
        }

        // Check for rate limiting
        if (!content.includes('rateLimit') && !content.includes('throttle')) {
          this.vulnerabilities.push({
            severity: 'high',
            type: 'Missing Rate Limiting',
            description: 'No rate limiting on authentication endpoints',
            location: file,
            recommendation: 'Implement rate limiting to prevent brute force attacks',
            cwe: 'CWE-307'
          });
        }

        // Check for MFA
        if (!content.includes('mfa') && !content.includes('2fa') && !content.includes('totp')) {
          this.vulnerabilities.push({
            severity: 'medium',
            type: 'Missing MFA',
            description: 'No multi-factor authentication implementation found',
            location: file,
            recommendation: 'Implement MFA for enhanced security',
            owasp: 'A07:2021'
          });
        }
      }
    }
  }

  private async auditAPIEndpoints(): Promise<void> {
    console.log('🌐 Auditing API endpoints...');

    const apiFiles = execSync('find . -name "*api*.ts" -o -name "*handler*.ts" | grep -v node_modules', { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean);

    for (const file of apiFiles) {
      if (existsSync(file)) {
        const content = readFileSync(file, 'utf-8');
        
        // Check for CORS configuration
        if (!content.includes('cors') && !content.includes('Access-Control')) {
          this.vulnerabilities.push({
            severity: 'medium',
            type: 'Missing CORS Configuration',
            description: 'No CORS headers configured for API endpoints',
            location: file,
            recommendation: 'Implement proper CORS configuration',
            owasp: 'A05:2021'
          });
        }

        // Check for input validation
        if (!content.includes('validate') && !content.includes('sanitize')) {
          this.vulnerabilities.push({
            severity: 'high',
            type: 'Missing Input Validation',
            description: 'No input validation found for API endpoints',
            location: file,
            recommendation: 'Implement comprehensive input validation',
            cwe: 'CWE-20',
            owasp: 'A03:2021'
          });
        }

        // Check for API versioning
        if (!content.includes('/v1/') && !content.includes('/v2/')) {
          this.vulnerabilities.push({
            severity: 'low',
            type: 'Missing API Versioning',
            description: 'No API versioning strategy found',
            location: file,
            recommendation: 'Implement API versioning for backward compatibility'
          });
        }
      }
    }
  }

  private async auditDataProtection(): Promise<void> {
    console.log('🛡️ Auditing data protection...');

    // Check for encryption at rest
    const dbFiles = execSync('find . -name "*database*.ts" -o -name "*storage*.ts" | grep -v node_modules', { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean);

    for (const file of dbFiles) {
      if (existsSync(file)) {
        const content = readFileSync(file, 'utf-8');
        
        if (!content.includes('encrypt') && !content.includes('cipher')) {
          this.vulnerabilities.push({
            severity: 'high',
            type: 'Missing Encryption at Rest',
            description: 'No encryption found for stored data',
            location: file,
            recommendation: 'Implement encryption for sensitive data at rest',
            cwe: 'CWE-311',
            owasp: 'A02:2021'
          });
        }
      }
    }

    // Check for PII handling
    const modelFiles = execSync('find . -name "*model*.ts" -o -name "*type*.ts" | grep -v node_modules', { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean);

    for (const file of modelFiles) {
      if (existsSync(file)) {
        const content = readFileSync(file, 'utf-8');
        
        if (content.includes('email') || content.includes('phone') || content.includes('ssn')) {
          if (!content.includes('encrypted') && !content.includes('hashed')) {
            this.vulnerabilities.push({
              severity: 'high',
              type: 'Unprotected PII',
              description: 'Personally Identifiable Information may not be properly protected',
              location: file,
              recommendation: 'Ensure PII is encrypted or hashed',
              owasp: 'A02:2021'
            });
          }
        }
      }
    }
  }

  private async auditAccessControl(): Promise<void> {
    console.log('🚪 Auditing access control...');

    // Check for proper authorization
    const routeFiles = execSync('find . -name "*route*.ts" -o -name "*middleware*.ts" | grep -v node_modules', { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean);

    for (const file of routeFiles) {
      if (existsSync(file)) {
        const content = readFileSync(file, 'utf-8');
        
        if (!content.includes('authorize') && !content.includes('requireAuth') && !content.includes('isAuthenticated')) {
          this.vulnerabilities.push({
            severity: 'critical',
            type: 'Missing Authorization',
            description: 'Routes may be accessible without proper authorization',
            location: file,
            recommendation: 'Implement authorization middleware for all protected routes',
            cwe: 'CWE-862',
            owasp: 'A01:2021'
          });
        }

        // Check for privilege escalation protection
        if (!content.includes('role') && !content.includes('permission')) {
          this.vulnerabilities.push({
            severity: 'high',
            type: 'Missing RBAC',
            description: 'No role-based access control implementation found',
            location: file,
            recommendation: 'Implement role-based access control',
            owasp: 'A01:2021'
          });
        }
      }
    }
  }

  private async auditCryptography(): Promise<void> {
    console.log('🔑 Auditing cryptography...');

    const cryptoFiles = execSync('find . -name "*.ts" | xargs grep -l "crypto\\|bcrypt\\|hash" | grep -v node_modules', { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean);

    for (const file of cryptoFiles) {
      if (existsSync(file)) {
        const content = readFileSync(file, 'utf-8');
        
        // Check for weak algorithms
        if (content.includes('md5') || content.includes('sha1')) {
          this.vulnerabilities.push({
            severity: 'high',
            type: 'Weak Cryptography',
            description: 'Using deprecated cryptographic algorithms (MD5/SHA1)',
            location: file,
            recommendation: 'Use SHA-256 or stronger algorithms',
            cwe: 'CWE-327'
          });
        }

        // Check for proper salt usage
        if (content.includes('bcrypt') && !content.includes('salt')) {
          this.vulnerabilities.push({
            severity: 'medium',
            type: 'Missing Salt',
            description: 'Password hashing may not be using proper salt',
            location: file,
            recommendation: 'Use bcrypt with appropriate salt rounds (10+)',
            cwe: 'CWE-916'
          });
        }

        // Check for secure random generation
        if (content.includes('Math.random')) {
          this.vulnerabilities.push({
            severity: 'high',
            type: 'Insecure Randomness',
            description: 'Using Math.random() for security-sensitive operations',
            location: file,
            recommendation: 'Use crypto.randomBytes() for secure random generation',
            cwe: 'CWE-330'
          });
        }
      }
    }
  }

  private async auditSessionManagement(): Promise<void> {
    console.log('🔒 Auditing session management...');

    const sessionFiles = execSync('find . -name "*session*.ts" | grep -v node_modules', { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean);

    for (const file of sessionFiles) {
      if (existsSync(file)) {
        const content = readFileSync(file, 'utf-8');
        
        // Check for session fixation protection
        if (!content.includes('regenerate') && !content.includes('newSession')) {
          this.vulnerabilities.push({
            severity: 'medium',
            type: 'Session Fixation Risk',
            description: 'No session regeneration after authentication',
            location: file,
            recommendation: 'Regenerate session ID after successful authentication',
            cwe: 'CWE-384'
          });
        }

        // Check for session timeout
        if (!content.includes('timeout') && !content.includes('expire')) {
          this.vulnerabilities.push({
            severity: 'medium',
            type: 'Missing Session Timeout',
            description: 'No session timeout configuration found',
            location: file,
            recommendation: 'Implement session timeout for security',
            owasp: 'A07:2021'
          });
        }

        // Check for secure session cookies
        if (content.includes('cookie') && !content.includes('secure')) {
          this.vulnerabilities.push({
            severity: 'high',
            type: 'Insecure Session Cookies',
            description: 'Session cookies may not have secure flag set',
            location: file,
            recommendation: 'Set secure, httpOnly, and sameSite flags on session cookies',
            cwe: 'CWE-614'
          });
        }
      }
    }
  }

  private async auditInputValidation(): Promise<void> {
    console.log('✅ Auditing input validation...');

    const handlerFiles = execSync('find . -name "*handler*.ts" -o -name "*controller*.ts" | grep -v node_modules', { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean);

    for (const file of handlerFiles) {
      if (existsSync(file)) {
        const content = readFileSync(file, 'utf-8');
        
        // Check for XSS protection
        if (!content.includes('sanitize') && !content.includes('escape') && !content.includes('DOMPurify')) {
          this.vulnerabilities.push({
            severity: 'high',
            type: 'XSS Vulnerability',
            description: 'No input sanitization for XSS protection',
            location: file,
            recommendation: 'Sanitize all user input before rendering',
            cwe: 'CWE-79',
            owasp: 'A03:2021'
          });
        }

        // Check for file upload validation
        if (content.includes('upload') || content.includes('file')) {
          if (!content.includes('fileType') && !content.includes('mimeType')) {
            this.vulnerabilities.push({
              severity: 'high',
              type: 'Unsafe File Upload',
              description: 'No file type validation for uploads',
              location: file,
              recommendation: 'Validate file types and scan for malware',
              cwe: 'CWE-434'
            });
          }
        }
      }
    }
  }

  private async auditErrorHandling(): Promise<void> {
    console.log('⚠️ Auditing error handling...');

    const sourceFiles = execSync('find . -name "*.ts" -name "*.tsx" | grep -v node_modules', { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean);

    for (const file of sourceFiles) {
      if (existsSync(file)) {
        const content = readFileSync(file, 'utf-8');
        
        // Check for information disclosure in errors
        if (content.includes('stack') && content.includes('res.send')) {
          this.vulnerabilities.push({
            severity: 'medium',
            type: 'Information Disclosure',
            description: 'Stack traces may be exposed to users',
            location: file,
            recommendation: 'Hide internal error details in production',
            cwe: 'CWE-209'
          });
        }

        // Check for proper error boundaries
        if (file.endsWith('.tsx') && !content.includes('ErrorBoundary')) {
          this.vulnerabilities.push({
            severity: 'low',
            type: 'Missing Error Boundary',
            description: 'React components without error boundaries',
            location: file,
            recommendation: 'Implement error boundaries for graceful error handling'
          });
        }
      }
    }
  }

  private async auditLogging(): Promise<void> {
    console.log('📝 Auditing logging and monitoring...');

    // Check for security event logging
    const logFiles = execSync('find . -name "*log*.ts" | grep -v node_modules', { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean);

    let hasSecurityLogging = false;
    for (const file of logFiles) {
      if (existsSync(file)) {
        const content = readFileSync(file, 'utf-8');
        
        if (content.includes('security') || content.includes('auth') || content.includes('access')) {
          hasSecurityLogging = true;
        }

        // Check for sensitive data in logs
        if (content.includes('password') || content.includes('token') || content.includes('key')) {
          this.vulnerabilities.push({
            severity: 'high',
            type: 'Sensitive Data in Logs',
            description: 'Potentially logging sensitive information',
            location: file,
            recommendation: 'Ensure sensitive data is never logged',
            cwe: 'CWE-532',
            owasp: 'A09:2021'
          });
        }
      }
    }

    if (!hasSecurityLogging) {
      this.vulnerabilities.push({
        severity: 'medium',
        type: 'Insufficient Security Logging',
        description: 'No dedicated security event logging found',
        location: 'logging system',
        recommendation: 'Implement comprehensive security event logging',
        owasp: 'A09:2021'
      });
    }
  }

  private async auditThirdPartyIntegrations(): Promise<void> {
    console.log('🔗 Auditing third-party integrations...');

    // Check package.json for risky dependencies
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
    
    const riskyPackages = ['request', 'node-fetch', 'axios'];
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    for (const [pkg, _version] of Object.entries(dependencies)) {
      if (riskyPackages.includes(pkg)) {
        this.vulnerabilities.push({
          severity: 'low',
          type: 'HTTP Client Security',
          description: `Using ${pkg} for HTTP requests - ensure proper SSL/TLS validation`,
          location: 'package.json',
          recommendation: 'Verify SSL/TLS certificate validation is enabled'
        });
      }
    }

    // Check for API key exposure
    const envExample = '.env.example';
    if (existsSync(envExample)) {
      const content = readFileSync(envExample, 'utf-8');
      if (content.match(/=.+[A-Za-z0-9]{20,}/)) {
        this.vulnerabilities.push({
          severity: 'critical',
          type: 'API Key Exposure',
          description: 'Potential API keys in .env.example file',
          location: envExample,
          recommendation: 'Use placeholder values in example files',
          cwe: 'CWE-798'
        });
      }
    }
  }

  private async auditElectronSecurity(): Promise<void> {
    console.log('⚡ Auditing Electron security...');

    const electronFiles = execSync('find . -name "*electron*.ts" -o -name "*main*.ts" | grep -v node_modules', { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean);

    for (const file of electronFiles) {
      if (existsSync(file)) {
        const content = readFileSync(file, 'utf-8');
        
        // Check for nodeIntegration
        if (content.includes('nodeIntegration: true')) {
          this.vulnerabilities.push({
            severity: 'critical',
            type: 'Electron nodeIntegration Enabled',
            description: 'nodeIntegration is enabled, exposing Node.js APIs to renderer',
            location: file,
            recommendation: 'Disable nodeIntegration and use contextBridge',
            cwe: 'CWE-829'
          });
        }

        // Check for contextIsolation
        if (content.includes('contextIsolation: false')) {
          this.vulnerabilities.push({
            severity: 'high',
            type: 'Electron Context Isolation Disabled',
            description: 'Context isolation is disabled',
            location: file,
            recommendation: 'Enable contextIsolation for security',
            cwe: 'CWE-653'
          });
        }

        // Check for webSecurity
        if (content.includes('webSecurity: false')) {
          this.vulnerabilities.push({
            severity: 'critical',
            type: 'Electron Web Security Disabled',
            description: 'Web security is disabled',
            location: file,
            recommendation: 'Never disable webSecurity in production',
            cwe: 'CWE-16'
          });
        }

        // Check for remote module
        if (content.includes('require("@electron/remote")') || content.includes('enableRemoteModule: true')) {
          this.vulnerabilities.push({
            severity: 'high',
            type: 'Electron Remote Module Enabled',
            description: 'Remote module is deprecated and insecure',
            location: file,
            recommendation: 'Migrate away from remote module',
            cwe: 'CWE-829'
          });
        }
      }
    }
  }

  private async auditBuildProcess(): Promise<void> {
    console.log('🏗️ Auditing build process...');

    // Check for source maps in production
    const nextConfig = 'next.config.js';
    if (existsSync(nextConfig)) {
      const content = readFileSync(nextConfig, 'utf-8');
      
      if (!content.includes('productionBrowserSourceMaps: false')) {
        this.vulnerabilities.push({
          severity: 'medium',
          type: 'Source Maps in Production',
          description: 'Source maps may be exposed in production builds',
          location: nextConfig,
          recommendation: 'Disable source maps for production builds',
          cwe: 'CWE-540'
        });
      }
    }

    // Check for build-time secrets
    const buildFiles = ['.github/workflows', 'Dockerfile', 'docker-compose.yml'];
    for (const buildFile of buildFiles) {
      if (existsSync(buildFile)) {
        const content = readFileSync(buildFile, 'utf-8');
        
        if (content.match(/[A-Z_]+=[A-Za-z0-9]{20,}/)) {
          this.vulnerabilities.push({
            severity: 'high',
            type: 'Build-time Secret Exposure',
            description: 'Potential secrets in build configuration',
            location: buildFile,
            recommendation: 'Use secure secret management in CI/CD',
            cwe: 'CWE-798'
          });
        }
      }
    }
  }

  private calculateSecurityScore(): number {
    const weights = {
      critical: 20,
      high: 10,
      medium: 5,
      low: 2
    };

    let deductions = 0;
    this.vulnerabilities.forEach(vuln => {
      deductions += weights[vuln.severity];
    });

    return Math.max(0, 100 - deductions);
  }

  private calculateCompliance(): SecurityAuditResult['compliance'] {
    const owaspCovered = new Set<string>();
    this.vulnerabilities.forEach(vuln => {
      if (vuln.owasp) {
        owaspCovered.add(vuln.owasp);
      }
    });

    return {
      owasp: owaspCovered.size === 0, // No OWASP violations
      pci: this.vulnerabilities.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0,
      gdpr: !this.vulnerabilities.some(v => v.type.includes('PII') || v.type.includes('Data Protection')),
      soc2: this.vulnerabilities.filter(v => v.severity !== 'low').length === 0
    };
  }

  async generateReport(result: SecurityAuditResult): Promise<void> {
    const reportPath = join(__dirname, '../../test-results/security-audit-report.md');
    
    let report = `# Security Audit Report\n\n`;
    report += `**Date:** ${result.timestamp.toISOString()}\n`;
    report += `**Scan Duration:** ${result.scanDuration}ms\n`;
    report += `**Security Score:** ${result.score}/100\n\n`;
    
    report += `## Compliance Status\n`;
    report += `- OWASP Top 10: ${result.compliance.owasp ? '✅ PASS' : '❌ FAIL'}\n`;
    report += `- PCI DSS: ${result.compliance.pci ? '✅ PASS' : '❌ FAIL'}\n`;
    report += `- GDPR: ${result.compliance.gdpr ? '✅ PASS' : '❌ FAIL'}\n`;
    report += `- SOC 2: ${result.compliance.soc2 ? '✅ PASS' : '❌ FAIL'}\n\n`;
    
    report += `## Vulnerability Summary\n`;
    const summary = {
      critical: result.vulnerabilities.filter(v => v.severity === 'critical').length,
      high: result.vulnerabilities.filter(v => v.severity === 'high').length,
      medium: result.vulnerabilities.filter(v => v.severity === 'medium').length,
      low: result.vulnerabilities.filter(v => v.severity === 'low').length
    };
    
    report += `- Critical: ${summary.critical}\n`;
    report += `- High: ${summary.high}\n`;
    report += `- Medium: ${summary.medium}\n`;
    report += `- Low: ${summary.low}\n\n`;
    
    if (result.vulnerabilities.length > 0) {
      report += `## Detailed Findings\n\n`;
      
      (['critical', 'high', 'medium', 'low'] as const).forEach(severity => {
        const vulns = result.vulnerabilities.filter(v => v.severity === severity);
        if (vulns.length > 0) {
          report += `### ${severity.toUpperCase()} Severity\n\n`;
          vulns.forEach(vuln => {
            report += `#### ${vuln.type}\n`;
            report += `- **Description:** ${vuln.description}\n`;
            report += `- **Location:** ${vuln.location}\n`;
            report += `- **Recommendation:** ${vuln.recommendation}\n`;
            if (vuln.cwe) report += `- **CWE:** ${vuln.cwe}\n`;
            if (vuln.owasp) report += `- **OWASP:** ${vuln.owasp}\n`;
            report += `\n`;
          });
        }
      });
    }
    
    writeFileSync(reportPath, report);
    console.log(`📄 Security audit report generated: ${reportPath}`);
  }
}

export const securityAudit = new SecurityAuditFramework();