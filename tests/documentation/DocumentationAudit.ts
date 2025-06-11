import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import * as glob from 'glob';

export interface DocumentationIssue {
  type: 'missing' | 'outdated' | 'incomplete' | 'broken-link' | 'formatting';
  severity: 'error' | 'warning' | 'info';
  file?: string;
  line?: number;
  description: string;
  recommendation: string;
}

export interface DocumentationAuditResult {
  passed: boolean;
  score: number;
  issues: DocumentationIssue[];
  coverage: {
    features: number;
    api: number;
    guides: number;
    examples: number;
  };
  metrics: {
    totalFiles: number;
    totalWords: number;
    avgReadability: number;
    lastUpdated: Date;
  };
}

export class DocumentationAudit {
  private issues: DocumentationIssue[] = [];
  private projectRoot: string;
  private featureList: string[] = [];
  private apiEndpoints: string[] = [];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async runComprehensiveAudit(): Promise<DocumentationAuditResult> {
    console.log('📚 Starting documentation completeness audit...');
    
    this.issues = [];
    
    // Discover features and APIs from code
    await this.discoverFeatures();
    await this.discoverAPIs();

    // Run all audit checks
    await Promise.all([
      this.auditReadme(),
      this.auditInstallationDocs(),
      this.auditAPIDocs(),
      this.auditFeatureDocs(),
      this.auditTutorials(),
      this.auditChangelog(),
      this.auditContributing(),
      this.auditArchitecture(),
      this.auditSecurity(),
      this.auditTroubleshooting(),
      this.checkBrokenLinks(),
      this.checkCodeExamples(),
      this.checkFormatting(),
      this.checkAccessibility()
    ]);

    // Calculate metrics
    const coverage = this.calculateCoverage();
    const metrics = await this.calculateMetrics();
    const score = this.calculateScore();

    return {
      passed: this.issues.filter(i => i.severity === 'error').length === 0,
      score,
      issues: this.issues,
      coverage,
      metrics
    };
  }

  private async discoverFeatures() {
    // Scan code for features
    const componentFiles = glob.sync('**/*.{tsx,jsx}', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**', 'build/**']
    });

    const featurePattern = /(?:export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)|(?:function|const|class)\s+(\w+))/g;
    
    for (const file of componentFiles) {
      const content = readFileSync(join(this.projectRoot, file), 'utf-8');
      const matches = content.matchAll(featurePattern);
      
      for (const match of matches) {
        const componentName = match[1] || match[2];
        if (componentName && componentName[0] === componentName[0].toUpperCase()) {
          this.featureList.push(componentName);
        }
      }
    }

    // Add known features
    this.featureList.push(
      'SessionManagement',
      'TwoActorModel',
      'CloudSync',
      'ProjectImport',
      'MCPGeneration',
      'CostCalculation',
      'ValidationEngine',
      'GitIntegration',
      'IDEIntegration'
    );
  }

  private async discoverAPIs() {
    // Scan for API endpoints
    const apiFiles = glob.sync('**/api/**/*.{ts,js}', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**']
    });

    const routePattern = /(?:router\.|app\.)(?:get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)/g;
    
    for (const file of apiFiles) {
      const content = readFileSync(join(this.projectRoot, file), 'utf-8');
      const matches = content.matchAll(routePattern);
      
      for (const match of matches) {
        this.apiEndpoints.push(match[1]);
      }
    }

    // Add IPC handlers as API endpoints
    const ipcFiles = glob.sync('**/ipc/**/*.ts', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**']
    });

    for (const file of ipcFiles) {
      const content = readFileSync(join(this.projectRoot, file), 'utf-8');
      const ipcPattern = /ipcMain\.handle\s*\(\s*['"`]([^'"`]+)/g;
      const matches = content.matchAll(ipcPattern);
      
      for (const match of matches) {
        this.apiEndpoints.push(`ipc:${match[1]}`);
      }
    }
  }

  private async auditReadme() {
    console.log('📄 Auditing README...');
    
    const readmePath = join(this.projectRoot, 'README.md');
    
    if (!existsSync(readmePath)) {
      this.issues.push({
        type: 'missing',
        severity: 'error',
        description: 'README.md is missing',
        recommendation: 'Create a comprehensive README.md file'
      });
      return;
    }

    const content = readFileSync(readmePath, 'utf-8');
    const sections = this.extractSections(content);

    // Check required sections
    const requiredSections = [
      'Installation',
      'Usage',
      'Features',
      'Requirements',
      'License'
    ];

    for (const section of requiredSections) {
      if (!sections.some(s => s.toLowerCase().includes(section.toLowerCase()))) {
        this.issues.push({
          type: 'incomplete',
          severity: 'error',
          file: 'README.md',
          description: `Missing "${section}" section`,
          recommendation: `Add a ${section} section to README.md`
        });
      }
    }

    // Check for badges
    if (!content.includes('![')) {
      this.issues.push({
        type: 'incomplete',
        severity: 'warning',
        file: 'README.md',
        description: 'No status badges found',
        recommendation: 'Add build status, coverage, and version badges'
      });
    }

    // Check for examples
    if (!content.includes('```')) {
      this.issues.push({
        type: 'incomplete',
        severity: 'warning',
        file: 'README.md',
        description: 'No code examples found',
        recommendation: 'Add code examples demonstrating basic usage'
      });
    }
  }

  private async auditInstallationDocs() {
    console.log('🔧 Auditing installation documentation...');
    
    const installPaths = [
      'docs/installation.md',
      'docs/INSTALLATION.md',
      'docs/getting-started.md',
      'INSTALL.md'
    ];

    const installDoc = installPaths.find(p => existsSync(join(this.projectRoot, p)));
    
    if (!installDoc) {
      // Check if installation is in README
      const readme = readFileSync(join(this.projectRoot, 'README.md'), 'utf-8');
      if (!readme.toLowerCase().includes('install')) {
        this.issues.push({
          type: 'missing',
          severity: 'error',
          description: 'No installation documentation found',
          recommendation: 'Create detailed installation instructions'
        });
      }
      return;
    }

    const content = readFileSync(join(this.projectRoot, installDoc), 'utf-8');

    // Check for platform-specific instructions
    const platforms = ['macOS', 'Windows', 'Linux'];
    for (const platform of platforms) {
      if (!content.includes(platform)) {
        this.issues.push({
          type: 'incomplete',
          severity: 'warning',
          file: installDoc,
          description: `Missing ${platform} installation instructions`,
          recommendation: `Add installation steps for ${platform}`
        });
      }
    }

    // Check for prerequisites
    if (!content.toLowerCase().includes('prerequisite') && !content.toLowerCase().includes('requirement')) {
      this.issues.push({
        type: 'incomplete',
        severity: 'error',
        file: installDoc,
        description: 'No prerequisites section found',
        recommendation: 'List all required software and versions'
      });
    }
  }

  private async auditAPIDocs() {
    console.log('🌐 Auditing API documentation...');
    
    const apiDocPath = join(this.projectRoot, 'docs/api');
    const apiReadmePath = join(this.projectRoot, 'docs/API.md');
    
    if (!existsSync(apiDocPath) && !existsSync(apiReadmePath)) {
      this.issues.push({
        type: 'missing',
        severity: 'error',
        description: 'No API documentation found',
        recommendation: 'Create comprehensive API documentation'
      });
      return;
    }

    // Check coverage of discovered APIs
    const documentedAPIs = new Set<string>();
    
    if (existsSync(apiDocPath)) {
      const apiFiles = readdirSync(apiDocPath);
      for (const file of apiFiles) {
        const content = readFileSync(join(apiDocPath, file), 'utf-8');
        const endpoints = content.match(/(?:GET|POST|PUT|PATCH|DELETE)\s+([^\s]+)/g) || [];
        endpoints.forEach(e => documentedAPIs.add(e));
      }
    }

    // Check for undocumented APIs
    for (const endpoint of this.apiEndpoints) {
      if (!Array.from(documentedAPIs).some(doc => doc.includes(endpoint))) {
        this.issues.push({
          type: 'missing',
          severity: 'error',
          description: `API endpoint "${endpoint}" is not documented`,
          recommendation: `Document the ${endpoint} endpoint with parameters and responses`
        });
      }
    }

    // Check for API authentication docs
    const hasAuthDocs = existsSync(join(apiDocPath, 'authentication.md')) ||
                       (existsSync(apiReadmePath) && 
                        readFileSync(apiReadmePath, 'utf-8').toLowerCase().includes('authentication'));

    if (!hasAuthDocs) {
      this.issues.push({
        type: 'missing',
        severity: 'error',
        description: 'No API authentication documentation',
        recommendation: 'Document API authentication methods and requirements'
      });
    }
  }

  private async auditFeatureDocs() {
    console.log('✨ Auditing feature documentation...');
    
    const featureDocPath = join(this.projectRoot, 'docs/features');
    const documentedFeatures = new Set<string>();

    if (existsSync(featureDocPath)) {
      const files = readdirSync(featureDocPath);
      files.forEach(file => {
        const name = file.replace(/\.(md|mdx)$/, '');
        documentedFeatures.add(name);
      });
    }

    // Check main features are documented
    const coreFeatures = [
      'session-management',
      'two-actor-model',
      'cloud-sync',
      'project-import',
      'git-integration'
    ];

    for (const feature of coreFeatures) {
      if (!Array.from(documentedFeatures).some(doc => 
        doc.toLowerCase().includes(feature.replace('-', ''))
      )) {
        this.issues.push({
          type: 'missing',
          severity: 'error',
          description: `Core feature "${feature}" is not documented`,
          recommendation: `Create documentation for ${feature} feature`
        });
      }
    }

    // Check for feature screenshots
    if (existsSync(featureDocPath)) {
      const files = readdirSync(featureDocPath);
      for (const file of files) {
        const content = readFileSync(join(featureDocPath, file), 'utf-8');
        if (!content.includes('![') && !content.includes('<img')) {
          this.issues.push({
            type: 'incomplete',
            severity: 'warning',
            file: `docs/features/${file}`,
            description: 'Feature documentation lacks visual aids',
            recommendation: 'Add screenshots or diagrams to illustrate the feature'
          });
        }
      }
    }
  }

  private async auditTutorials() {
    console.log('📖 Auditing tutorials...');
    
    const tutorialPaths = [
      'docs/tutorials',
      'docs/guides',
      'tutorials',
      'examples'
    ];

    const tutorialDir = tutorialPaths.find(p => existsSync(join(this.projectRoot, p)));
    
    if (!tutorialDir) {
      this.issues.push({
        type: 'missing',
        severity: 'warning',
        description: 'No tutorials or guides found',
        recommendation: 'Create step-by-step tutorials for common use cases'
      });
      return;
    }

    // Check for essential tutorials
    const essentialTutorials = [
      'getting-started',
      'first-session',
      'project-setup',
      'basic-workflow'
    ];

    const tutorials = readdirSync(join(this.projectRoot, tutorialDir));
    
    for (const tutorial of essentialTutorials) {
      if (!tutorials.some(t => t.toLowerCase().includes(tutorial.replace('-', '')))) {
        this.issues.push({
          type: 'missing',
          severity: 'warning',
          description: `Missing "${tutorial}" tutorial`,
          recommendation: `Create a ${tutorial} tutorial for new users`
        });
      }
    }
  }

  private async auditChangelog() {
    console.log('📝 Auditing changelog...');
    
    const changelogPath = join(this.projectRoot, 'CHANGELOG.md');
    
    if (!existsSync(changelogPath)) {
      this.issues.push({
        type: 'missing',
        severity: 'error',
        description: 'CHANGELOG.md is missing',
        recommendation: 'Create a changelog following Keep a Changelog format'
      });
      return;
    }

    const content = readFileSync(changelogPath, 'utf-8');
    
    // Check for semantic versioning
    if (!content.match(/## \[\d+\.\d+\.\d+\]/)) {
      this.issues.push({
        type: 'formatting',
        severity: 'error',
        file: 'CHANGELOG.md',
        description: 'Changelog does not follow semantic versioning',
        recommendation: 'Use semantic version numbers (e.g., [1.0.0])'
      });
    }

    // Check for standard sections
    const standardSections = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
    const hasSections = standardSections.some(section => content.includes(`### ${section}`));
    
    if (!hasSections) {
      this.issues.push({
        type: 'formatting',
        severity: 'warning',
        file: 'CHANGELOG.md',
        description: 'Changelog lacks standard sections',
        recommendation: 'Use standard sections: Added, Changed, Deprecated, Removed, Fixed, Security'
      });
    }

    // Check for recent updates
    const matches = content.match(/## \[.*?\] - (\d{4}-\d{2}-\d{2})/);
    if (matches) {
      const lastUpdate = new Date(matches[1]);
      const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceUpdate > 90) {
        this.issues.push({
          type: 'outdated',
          severity: 'warning',
          file: 'CHANGELOG.md',
          description: `Changelog not updated in ${Math.floor(daysSinceUpdate)} days`,
          recommendation: 'Update changelog with recent changes'
        });
      }
    }
  }

  private async auditContributing() {
    console.log('🤝 Auditing contributing guidelines...');
    
    const contributingPath = join(this.projectRoot, 'CONTRIBUTING.md');
    
    if (!existsSync(contributingPath)) {
      this.issues.push({
        type: 'missing',
        severity: 'warning',
        description: 'CONTRIBUTING.md is missing',
        recommendation: 'Create contributing guidelines for potential contributors'
      });
      return;
    }

    const content = readFileSync(contributingPath, 'utf-8');
    const sections = this.extractSections(content);

    // Check required sections
    const requiredSections = [
      'Code of Conduct',
      'How to Contribute',
      'Pull Request',
      'Code Style',
      'Testing'
    ];

    for (const section of requiredSections) {
      if (!sections.some(s => s.toLowerCase().includes(section.toLowerCase()))) {
        this.issues.push({
          type: 'incomplete',
          severity: 'warning',
          file: 'CONTRIBUTING.md',
          description: `Missing "${section}" section`,
          recommendation: `Add ${section} guidelines`
        });
      }
    }
  }

  private async auditArchitecture() {
    console.log('🏗️ Auditing architecture documentation...');
    
    const archPaths = [
      'docs/architecture.md',
      'docs/ARCHITECTURE.md',
      'docs/design.md',
      'ARCHITECTURE.md'
    ];

    const archDoc = archPaths.find(p => existsSync(join(this.projectRoot, p)));
    
    if (!archDoc) {
      this.issues.push({
        type: 'missing',
        severity: 'warning',
        description: 'No architecture documentation found',
        recommendation: 'Document system architecture and design decisions'
      });
      return;
    }

    const content = readFileSync(join(this.projectRoot, archDoc), 'utf-8');

    // Check for diagrams
    if (!content.includes('![') && !content.includes('```mermaid')) {
      this.issues.push({
        type: 'incomplete',
        severity: 'warning',
        file: archDoc,
        description: 'Architecture documentation lacks diagrams',
        recommendation: 'Add architecture diagrams to visualize system design'
      });
    }

    // Check for key architectural concepts
    const concepts = ['Two-Actor Model', 'Session Management', 'Data Flow'];
    for (const concept of concepts) {
      if (!content.includes(concept)) {
        this.issues.push({
          type: 'incomplete',
          severity: 'info',
          file: archDoc,
          description: `Architecture docs missing "${concept}" explanation`,
          recommendation: `Document the ${concept} architecture`
        });
      }
    }
  }

  private async auditSecurity() {
    console.log('🔒 Auditing security documentation...');
    
    const securityPath = join(this.projectRoot, 'SECURITY.md');
    
    if (!existsSync(securityPath)) {
      this.issues.push({
        type: 'missing',
        severity: 'error',
        description: 'SECURITY.md is missing',
        recommendation: 'Create security policy and vulnerability reporting guidelines'
      });
      return;
    }

    const content = readFileSync(securityPath, 'utf-8');

    // Check for vulnerability reporting
    if (!content.toLowerCase().includes('vulnerability') || !content.toLowerCase().includes('report')) {
      this.issues.push({
        type: 'incomplete',
        severity: 'error',
        file: 'SECURITY.md',
        description: 'Missing vulnerability reporting process',
        recommendation: 'Add clear instructions for reporting security vulnerabilities'
      });
    }

    // Check for supported versions
    if (!content.toLowerCase().includes('supported versions')) {
      this.issues.push({
        type: 'incomplete',
        severity: 'warning',
        file: 'SECURITY.md',
        description: 'Missing supported versions information',
        recommendation: 'Specify which versions receive security updates'
      });
    }
  }

  private async auditTroubleshooting() {
    console.log('🔍 Auditing troubleshooting documentation...');
    
    const troubleshootingPaths = [
      'docs/troubleshooting.md',
      'docs/TROUBLESHOOTING.md',
      'docs/faq.md',
      'TROUBLESHOOTING.md'
    ];

    const troubleshootingDoc = troubleshootingPaths.find(p => 
      existsSync(join(this.projectRoot, p))
    );
    
    if (!troubleshootingDoc) {
      this.issues.push({
        type: 'missing',
        severity: 'warning',
        description: 'No troubleshooting documentation found',
        recommendation: 'Create troubleshooting guide for common issues'
      });
      return;
    }

    const content = readFileSync(join(this.projectRoot, troubleshootingDoc), 'utf-8');

    // Check for common issues
    const commonIssues = [
      'installation',
      'connection',
      'performance',
      'error',
      'crash'
    ];

    for (const issue of commonIssues) {
      if (!content.toLowerCase().includes(issue)) {
        this.issues.push({
          type: 'incomplete',
          severity: 'info',
          file: troubleshootingDoc,
          description: `Missing troubleshooting for ${issue} issues`,
          recommendation: `Add solutions for common ${issue} problems`
        });
      }
    }
  }

  private async checkBrokenLinks() {
    console.log('🔗 Checking for broken links...');
    
    const mdFiles = glob.sync('**/*.md', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**']
    });

    for (const file of mdFiles) {
      const content = readFileSync(join(this.projectRoot, file), 'utf-8');
      const links = this.extractLinks(content);

      for (const link of links) {
        if (link.url.startsWith('http')) {
          // Skip external links in this audit
          continue;
        }

        if (link.url.startsWith('#')) {
          // Check internal anchor
          const anchor = link.url.substring(1);
          const headings = this.extractHeadings(content);
          
          if (!headings.some(h => this.slugify(h) === anchor)) {
            this.issues.push({
              type: 'broken-link',
              severity: 'error',
              file,
              line: link.line,
              description: `Broken anchor link: ${link.url}`,
              recommendation: 'Fix or remove the broken anchor link'
            });
          }
        } else {
          // Check relative file link
          const linkPath = join(this.projectRoot, file, '..', link.url);
          
          if (!existsSync(linkPath) && !existsSync(linkPath + '.md')) {
            this.issues.push({
              type: 'broken-link',
              severity: 'error',
              file,
              line: link.line,
              description: `Broken file link: ${link.url}`,
              recommendation: 'Fix the link or create the missing file'
            });
          }
        }
      }
    }
  }

  private async checkCodeExamples() {
    console.log('💻 Checking code examples...');
    
    const mdFiles = glob.sync('**/*.md', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**']
    });

    for (const file of mdFiles) {
      const content = readFileSync(join(this.projectRoot, file), 'utf-8');
      const codeBlocks = this.extractCodeBlocks(content);

      for (const block of codeBlocks) {
        // Check for language specification
        if (!block.language) {
          this.issues.push({
            type: 'formatting',
            severity: 'warning',
            file,
            line: block.line,
            description: 'Code block missing language specification',
            recommendation: 'Add language identifier to code block (e.g., ```javascript)'
          });
        }

        // Check for syntax errors in JavaScript/TypeScript
        if (['javascript', 'js', 'typescript', 'ts'].includes(block.language)) {
          try {
            // Basic syntax check
            new Function(block.code);
          } catch (error) {
            if (!block.code.includes('...') && !block.code.includes('// ...')) {
              this.issues.push({
                type: 'formatting',
                severity: 'warning',
                file,
                line: block.line,
                description: 'Code example may have syntax errors',
                recommendation: 'Verify code example is syntactically correct'
              });
            }
          }
        }
      }
    }
  }

  private async checkFormatting() {
    console.log('📐 Checking documentation formatting...');
    
    const mdFiles = glob.sync('**/*.md', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**']
    });

    for (const file of mdFiles) {
      const content = readFileSync(join(this.projectRoot, file), 'utf-8');
      const lines = content.split('\n');

      // Check for consistent heading hierarchy
      let lastHeadingLevel = 0;
      lines.forEach((line, index) => {
        const headingMatch = line.match(/^(#+)\s+(.+)/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          
          if (level > lastHeadingLevel + 1 && lastHeadingLevel > 0) {
            this.issues.push({
              type: 'formatting',
              severity: 'warning',
              file,
              line: index + 1,
              description: 'Skipped heading level',
              recommendation: 'Use sequential heading levels (h1 → h2 → h3)'
            });
          }
          
          lastHeadingLevel = level;
        }
      });

      // Check line length
      lines.forEach((line, index) => {
        if (line.length > 120 && !line.includes('http') && !line.startsWith('|')) {
          this.issues.push({
            type: 'formatting',
            severity: 'info',
            file,
            line: index + 1,
            description: 'Line exceeds 120 characters',
            recommendation: 'Consider breaking long lines for better readability'
          });
        }
      });

      // Check for trailing whitespace
      lines.forEach((line, index) => {
        if (line.endsWith(' ') || line.endsWith('\t')) {
          this.issues.push({
            type: 'formatting',
            severity: 'info',
            file,
            line: index + 1,
            description: 'Trailing whitespace',
            recommendation: 'Remove trailing whitespace'
          });
        }
      });
    }
  }

  private async checkAccessibility() {
    console.log('♿ Checking documentation accessibility...');
    
    const mdFiles = glob.sync('**/*.md', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**']
    });

    for (const file of mdFiles) {
      const content = readFileSync(join(this.projectRoot, file), 'utf-8');

      // Check images for alt text
      const images = content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g);
      let imageIndex = 0;
      
      for (const image of images) {
        imageIndex++;
        const altText = image[1];
        
        if (!altText || altText.trim() === '') {
          this.issues.push({
            type: 'formatting',
            severity: 'error',
            file,
            description: `Image #${imageIndex} missing alt text`,
            recommendation: 'Add descriptive alt text for accessibility'
          });
        }
      }

      // Check for proper link text
      const links = content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
      
      for (const link of links) {
        const linkText = link[1];
        
        if (linkText.toLowerCase() === 'click here' || linkText.toLowerCase() === 'here') {
          this.issues.push({
            type: 'formatting',
            severity: 'warning',
            file,
            description: `Non-descriptive link text: "${linkText}"`,
            recommendation: 'Use descriptive link text that explains the destination'
          });
        }
      }
    }
  }

  private extractSections(content: string): string[] {
    const headings = content.match(/^#{1,3}\s+(.+)$/gm) || [];
    return headings.map(h => h.replace(/^#+\s+/, ''));
  }

  private extractLinks(content: string): Array<{ url: string; line: number }> {
    const links: Array<{ url: string; line: number }> = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const linkMatches = line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
      
      for (const match of linkMatches) {
        links.push({
          url: match[2],
          line: index + 1
        });
      }
    });
    
    return links;
  }

  private extractHeadings(content: string): string[] {
    const headings = content.match(/^#{1,6}\s+(.+)$/gm) || [];
    return headings.map(h => h.replace(/^#+\s+/, ''));
  }

  private extractCodeBlocks(content: string): Array<{ 
    language: string; 
    code: string; 
    line: number 
  }> {
    const blocks: Array<{ language: string; code: string; line: number }> = [];
    const lines = content.split('\n');
    
    let inCodeBlock = false;
    let currentBlock = { language: '', code: '', line: 0 };
    
    lines.forEach((line, index) => {
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          currentBlock = {
            language: line.substring(3).trim(),
            code: '',
            line: index + 1
          };
        } else {
          inCodeBlock = false;
          blocks.push(currentBlock);
        }
      } else if (inCodeBlock) {
        currentBlock.code += line + '\n';
      }
    });
    
    return blocks;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private calculateCoverage(): DocumentationAuditResult['coverage'] {
    const totalFeatures = this.featureList.length;
    const documentedFeatures = this.featureList.filter(feature => 
      !this.issues.some(issue => 
        issue.description.includes(feature) && issue.type === 'missing'
      )
    ).length;

    const totalAPIs = this.apiEndpoints.length;
    const documentedAPIs = this.apiEndpoints.filter(api => 
      !this.issues.some(issue => 
        issue.description.includes(api) && issue.type === 'missing'
      )
    ).length;

    return {
      features: totalFeatures > 0 ? (documentedFeatures / totalFeatures) * 100 : 0,
      api: totalAPIs > 0 ? (documentedAPIs / totalAPIs) * 100 : 0,
      guides: this.issues.filter(i => i.description.includes('tutorial')).length === 0 ? 100 : 50,
      examples: this.issues.filter(i => i.description.includes('example')).length === 0 ? 100 : 50
    };
  }

  private async calculateMetrics(): Promise<DocumentationAuditResult['metrics']> {
    const mdFiles = glob.sync('**/*.md', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**']
    });

    let totalWords = 0;
    let lastUpdated = new Date(0);

    for (const file of mdFiles) {
      const content = readFileSync(join(this.projectRoot, file), 'utf-8');
      const words = content.split(/\s+/).length;
      totalWords += words;

      const stats = statSync(join(this.projectRoot, file));
      if (stats.mtime > lastUpdated) {
        lastUpdated = stats.mtime;
      }
    }

    return {
      totalFiles: mdFiles.length,
      totalWords,
      avgReadability: 8.5, // Placeholder - could implement Flesch score
      lastUpdated
    };
  }

  private calculateScore(): number {
    const errorCount = this.issues.filter(i => i.severity === 'error').length;
    const warningCount = this.issues.filter(i => i.severity === 'warning').length;
    const infoCount = this.issues.filter(i => i.severity === 'info').length;

    const deductions = (errorCount * 10) + (warningCount * 5) + (infoCount * 2);
    
    return Math.max(0, 100 - deductions);
  }

  async generateReport(result: DocumentationAuditResult): Promise<void> {
    const reportPath = join(this.projectRoot, 'test-results/documentation-audit-report.md');
    
    let report = `# Documentation Audit Report\n\n`;
    report += `**Date:** ${new Date().toISOString()}\n`;
    report += `**Score:** ${result.score}/100\n`;
    report += `**Result:** ${result.passed ? '✅ PASS' : '❌ FAIL'}\n\n`;
    
    report += `## Coverage Summary\n`;
    report += `- Features: ${result.coverage.features.toFixed(1)}%\n`;
    report += `- API: ${result.coverage.api.toFixed(1)}%\n`;
    report += `- Guides: ${result.coverage.guides.toFixed(1)}%\n`;
    report += `- Examples: ${result.coverage.examples.toFixed(1)}%\n\n`;
    
    report += `## Metrics\n`;
    report += `- Total Files: ${result.metrics.totalFiles}\n`;
    report += `- Total Words: ${result.metrics.totalWords.toLocaleString()}\n`;
    report += `- Average Readability: ${result.metrics.avgReadability}/10\n`;
    report += `- Last Updated: ${result.metrics.lastUpdated.toLocaleDateString()}\n\n`;
    
    report += `## Issues Summary\n`;
    const issueCounts = {
      error: result.issues.filter(i => i.severity === 'error').length,
      warning: result.issues.filter(i => i.severity === 'warning').length,
      info: result.issues.filter(i => i.severity === 'info').length
    };
    
    report += `- Errors: ${issueCounts.error}\n`;
    report += `- Warnings: ${issueCounts.warning}\n`;
    report += `- Info: ${issueCounts.info}\n\n`;
    
    if (result.issues.length > 0) {
      report += `## Detailed Issues\n\n`;
      
      ['error', 'warning', 'info'].forEach(severity => {
        const issues = result.issues.filter(i => i.severity === severity);
        if (issues.length > 0) {
          report += `### ${severity.toUpperCase()} Issues\n\n`;
          
          issues.forEach(issue => {
            report += `#### ${issue.type}: ${issue.description}\n`;
            if (issue.file) report += `- **File:** ${issue.file}\n`;
            if (issue.line) report += `- **Line:** ${issue.line}\n`;
            report += `- **Recommendation:** ${issue.recommendation}\n\n`;
          });
        }
      });
    }
    
    const { writeFileSync, mkdirSync, existsSync } = await import('fs');
    const { dirname } = await import('path');
    
    const dir = dirname(reportPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(reportPath, report);
    console.log(`📄 Documentation audit report generated: ${reportPath}`);
  }
}

// Export singleton instance
export const documentationAudit = new DocumentationAudit(process.cwd());