import fs from 'fs/promises';
import path from 'path';

export interface TestStep {
  id: string;
  title: string;
  description: string;
  expectedResult: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  preconditions?: string[];
  steps: string[];
  validationCriteria: string[];
  troubleshooting?: {
    commonIssues: { issue: string; solution: string }[];
    fallbackSteps?: string[];
  };
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  category: 'onboarding' | 'core' | 'integration' | 'performance' | 'security' | 'edge-cases';
  estimatedDuration: number; // minutes
  prerequisites: string[];
  testSteps: TestStep[];
}

export interface TestResult {
  testId: string;
  passed: boolean;
  notes?: string;
  issues?: string[];
  timestamp: Date;
  tester: string;
  duration: number;
}

export interface TestReport {
  session: {
    id: string;
    timestamp: Date;
    tester: string;
    environment: string;
    version: string;
  };
  results: TestResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    criticalFailures: number;
    duration: number;
  };
  blockers: string[];
  recommendations: string[];
}

export class ManualTestingChecklists {
  private testSuites: TestSuite[] = [
    // Onboarding Test Suite
    {
      id: 'onboarding-flow',
      name: 'First-Run Onboarding Experience',
      description: 'Complete validation of the onboarding wizard and service setup',
      category: 'onboarding',
      estimatedDuration: 20,
      prerequisites: [
        'Fresh installation of SessionHub',
        'No previous configuration data',
        'Test API keys available'
      ],
      testSteps: [
        {
          id: 'onboarding-welcome',
          title: 'Welcome Screen Display',
          description: 'Verify the welcome screen appears on first launch',
          expectedResult: 'Onboarding wizard opens with welcome screen',
          priority: 'critical',
          category: 'onboarding',
          steps: [
            'Launch SessionHub for the first time',
            'Verify onboarding wizard appears automatically',
            'Check welcome screen content and branding'
          ],
          validationCriteria: [
            'Onboarding wizard overlay is visible',
            'Welcome message is displayed correctly',
            'SessionHub logo and branding are present',
            'Next button is enabled and responsive'
          ],
          troubleshooting: {
            commonIssues: [
              {
                issue: 'Onboarding wizard does not appear',
                solution: 'Clear app data and restart, check console for errors'
              },
              {
                issue: 'Welcome screen appears blank',
                solution: 'Check network connectivity, verify React components loaded'
              }
            ]
          }
        },
        {
          id: 'user-level-selection',
          title: 'User Experience Level Selection',
          description: 'Test user level selection and UI adaptation',
          expectedResult: 'User can select experience level and UI adapts accordingly',
          priority: 'critical',
          category: 'onboarding',
          steps: [
            'Navigate to user level selection screen',
            'Test each experience level option (Beginner, Intermediate, Advanced)',
            'Verify descriptions and feature lists are accurate',
            'Select each level and proceed to next step'
          ],
          validationCriteria: [
            'All three experience levels are selectable',
            'Selection highlights the chosen option',
            'Feature descriptions match the selected level',
            'Next button enables after selection'
          ]
        },
        {
          id: 'service-priority-selection',
          title: 'Service Priority Selection',
          description: 'Test service selection and estimated time calculation',
          expectedResult: 'User can select services with accurate time estimates',
          priority: 'critical',
          category: 'onboarding',
          steps: [
            'Navigate to service selection screen',
            'Toggle each service on and off',
            'Verify estimated setup time updates dynamically',
            'Test "Select All" and "Select None" functionality'
          ],
          validationCriteria: [
            'Services can be selected/deselected via checkbox',
            'Estimated time calculation is accurate',
            'Recommended services are clearly marked',
            'Service descriptions are informative'
          ]
        },
        {
          id: 'claude-api-setup',
          title: 'Claude API Configuration',
          description: 'Test Claude API key validation and configuration',
          expectedResult: 'Valid API key is accepted and configuration is saved',
          priority: 'critical',
          category: 'onboarding',
          preconditions: ['Valid Claude API key available'],
          steps: [
            'Enter invalid API key and attempt to continue',
            'Verify error message appears',
            'Enter valid API key',
            'Select model preference',
            'Complete configuration and verify validation'
          ],
          validationCriteria: [
            'Invalid API key shows clear error message',
            'Valid API key passes validation',
            'Model selection works correctly',
            'Configuration is saved persistently'
          ],
          troubleshooting: {
            commonIssues: [
              {
                issue: 'Valid API key rejected',
                solution: 'Check API key format, verify network connectivity'
              },
              {
                issue: 'Configuration not saved',
                solution: 'Check electron-store permissions and storage'
              }
            ]
          }
        },
        {
          id: 'supabase-setup',
          title: 'Supabase Database Configuration',
          description: 'Test Supabase connection and database setup',
          expectedResult: 'Supabase connection is established and validated',
          priority: 'high',
          category: 'onboarding',
          preconditions: ['Valid Supabase project credentials available'],
          steps: [
            'Enter invalid URL and verify error handling',
            'Enter valid project URL',
            'Enter anon key',
            'Test connection validation',
            'Complete configuration'
          ],
          validationCriteria: [
            'Invalid URLs show appropriate error messages',
            'Valid credentials pass connection test',
            'Database connection is established',
            'Configuration persists across restarts'
          ]
        },
        {
          id: 'ide-integration-setup',
          title: 'IDE Integration Configuration',
          description: 'Test IDE detection and integration setup',
          expectedResult: 'IDE is detected and integration is configured',
          priority: 'high',
          category: 'onboarding',
          steps: [
            'Verify auto-detection of installed IDEs',
            'Select preferred IDE',
            'Configure auto-launch preferences',
            'Test IDE availability check'
          ],
          validationCriteria: [
            'Installed IDEs are automatically detected',
            'IDE selection persists',
            'Auto-launch preferences are saved',
            'IDE integration works correctly'
          ]
        },
        {
          id: 'onboarding-completion',
          title: 'Onboarding Completion',
          description: 'Test completion flow and transition to main application',
          expectedResult: 'Onboarding completes successfully and main app loads',
          priority: 'critical',
          category: 'onboarding',
          steps: [
            'Complete all selected service configurations',
            'Review completion screen',
            'Click Complete Setup button',
            'Verify transition to main application',
            'Confirm onboarding does not appear on restart'
          ],
          validationCriteria: [
            'Completion screen shows accurate summary',
            'All configured services are listed',
            'Main application loads after completion',
            'Onboarding wizard does not re-appear'
          ]
        }
      ]
    },

    // Core Functionality Test Suite
    {
      id: 'core-functionality',
      name: 'Core Application Features',
      description: 'Test main application functionality after onboarding',
      category: 'core',
      estimatedDuration: 30,
      prerequisites: [
        'Completed onboarding flow',
        'At least one service configured'
      ],
      testSteps: [
        {
          id: 'main-navigation',
          title: 'Main Navigation Functionality',
          description: 'Test navigation between application sections',
          expectedResult: 'All navigation elements work correctly',
          priority: 'critical',
          category: 'core',
          steps: [
            'Test sidebar navigation to each main section',
            'Verify breadcrumb navigation',
            'Test back/forward browser controls',
            'Check mobile responsiveness of navigation'
          ],
          validationCriteria: [
            'All navigation links are functional',
            'Active page is highlighted correctly',
            'Breadcrumbs show correct path',
            'Navigation works on different screen sizes'
          ]
        },
        {
          id: 'project-creation',
          title: 'Project Creation Workflow',
          description: 'Test creating new projects with various configurations',
          expectedResult: 'Projects can be created successfully',
          priority: 'critical',
          category: 'core',
          steps: [
            'Click "New Project" button',
            'Fill out project creation form',
            'Select project template',
            'Configure project settings',
            'Complete project creation'
          ],
          validationCriteria: [
            'Project creation dialog opens correctly',
            'All form fields accept input properly',
            'Project templates are selectable',
            'Project appears in project list after creation'
          ]
        },
        {
          id: 'session-management',
          title: 'Session Management',
          description: 'Test session creation, editing, and management',
          expectedResult: 'Sessions can be managed effectively',
          priority: 'critical',
          category: 'core',
          steps: [
            'Create new session within a project',
            'Add session content and save',
            'Edit existing session',
            'Delete session and confirm removal'
          ],
          validationCriteria: [
            'Sessions can be created and saved',
            'Session content persists correctly',
            'Session editing works properly',
            'Session deletion requires confirmation'
          ]
        }
      ]
    },

    // Performance Test Suite
    {
      id: 'performance-validation',
      name: 'Performance and Responsiveness',
      description: 'Validate application performance under various conditions',
      category: 'performance',
      estimatedDuration: 25,
      prerequisites: [
        'Application fully configured',
        'Multiple projects and sessions available'
      ],
      testSteps: [
        {
          id: 'startup-performance',
          title: 'Application Startup Time',
          description: 'Measure and validate application startup performance',
          expectedResult: 'Application starts within acceptable time limits',
          priority: 'high',
          category: 'performance',
          steps: [
            'Close application completely',
            'Start timer and launch application',
            'Measure time to first usable state',
            'Record startup time and compare to baseline'
          ],
          validationCriteria: [
            'Application launches within 5 seconds',
            'Main interface is responsive within 3 seconds',
            'All services connect within 10 seconds',
            'No visible loading delays for basic operations'
          ]
        },
        {
          id: 'memory-usage',
          title: 'Memory Usage Validation',
          description: 'Monitor memory consumption during normal usage',
          expectedResult: 'Memory usage remains within acceptable limits',
          priority: 'high',
          category: 'performance',
          steps: [
            'Monitor initial memory usage',
            'Perform typical user operations',
            'Create and manage multiple projects',
            'Check for memory leaks after extended use'
          ],
          validationCriteria: [
            'Initial memory usage under 200MB',
            'Memory growth is controlled during use',
            'No significant memory leaks detected',
            'Application remains responsive under load'
          ]
        }
      ]
    },

    // Security Test Suite
    {
      id: 'security-validation',
      name: 'Security and Data Protection',
      description: 'Validate security measures and data protection',
      category: 'security',
      estimatedDuration: 20,
      prerequisites: [
        'Application configured with sensitive data',
        'Multiple services connected'
      ],
      testSteps: [
        {
          id: 'credential-storage',
          title: 'Secure Credential Storage',
          description: 'Verify credentials are stored securely',
          expectedResult: 'All credentials are encrypted and protected',
          priority: 'critical',
          category: 'security',
          steps: [
            'Configure services with API keys',
            'Check local storage files for exposed credentials',
            'Verify encryption of sensitive data',
            'Test credential access controls'
          ],
          validationCriteria: [
            'No plain-text credentials in local files',
            'Credentials are properly encrypted',
            'Access requires proper authentication',
            'No credentials appear in logs or debug output'
          ]
        },
        {
          id: 'data-validation',
          title: 'Input Validation and Sanitization',
          description: 'Test input validation across all forms',
          expectedResult: 'All inputs are properly validated and sanitized',
          priority: 'high',
          category: 'security',
          steps: [
            'Test form inputs with malicious data',
            'Attempt script injection in text fields',
            'Test file upload restrictions',
            'Verify API input validation'
          ],
          validationCriteria: [
            'Malicious inputs are rejected',
            'No script execution from user input',
            'File uploads respect restrictions',
            'API calls validate input properly'
          ]
        }
      ]
    }
  ];

  async generateTestReport(results: TestResult[], tester: string, environment: string): Promise<TestReport> {
    const totalTests = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const skipped = totalTests - passed - failed;
    
    const criticalFailures = results.filter(r => 
      !r.passed && this.getTestStep(r.testId)?.priority === 'critical'
    ).length;

    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    const blockers = results
      .filter(r => !r.passed && this.getTestStep(r.testId)?.priority === 'critical')
      .map(r => this.getTestStep(r.testId)?.title || r.testId);

    const recommendations = this.generateRecommendations(results);

    return {
      session: {
        id: `manual-test-${Date.now()}`,
        timestamp: new Date(),
        tester,
        environment,
        version: '2.11.0'
      },
      results,
      summary: {
        totalTests,
        passed,
        failed,
        skipped,
        criticalFailures,
        duration: totalDuration
      },
      blockers,
      recommendations
    };
  }

  private getTestStep(testId: string): TestStep | undefined {
    for (const suite of this.testSuites) {
      const step = suite.testSteps.find(s => s.id === testId);
      if (step) return step;
    }
    return undefined;
  }

  private generateRecommendations(results: TestResult[]): string[] {
    const recommendations: string[] = [];
    
    const failedCritical = results.filter(r => 
      !r.passed && this.getTestStep(r.testId)?.priority === 'critical'
    );
    
    if (failedCritical.length > 0) {
      recommendations.push('Address all critical failures before production release');
    }

    const onboardingFailures = results.filter(r => 
      !r.passed && this.getTestStep(r.testId)?.category === 'onboarding'
    );
    
    if (onboardingFailures.length > 0) {
      recommendations.push('Fix onboarding issues to ensure good first user experience');
    }

    const securityFailures = results.filter(r => 
      !r.passed && this.getTestStep(r.testId)?.category === 'security'
    );
    
    if (securityFailures.length > 0) {
      recommendations.push('Security vulnerabilities must be resolved before deployment');
    }

    return recommendations;
  }

  async exportTestPlan(format: 'markdown' | 'json' | 'csv' = 'markdown'): Promise<string> {
    if (format === 'markdown') {
      return this.generateMarkdownTestPlan();
    } else if (format === 'json') {
      return JSON.stringify(this.testSuites, null, 2);
    } else {
      return this.generateCSVTestPlan();
    }
  }

  private generateMarkdownTestPlan(): string {
    let markdown = '# SessionHub Manual Testing Checklist\n\n';
    markdown += 'This document contains comprehensive manual testing procedures for SessionHub v2.11.\n\n';
    
    // Table of Contents
    markdown += '## Table of Contents\n\n';
    this.testSuites.forEach(suite => {
      markdown += `- [${suite.name}](#${suite.id.replace(/[^a-z0-9]/gi, '-').toLowerCase()})\n`;
    });
    markdown += '\n';

    // Test Suites
    this.testSuites.forEach(suite => {
      markdown += `## ${suite.name}\n\n`;
      markdown += `**Category:** ${suite.category}\n`;
      markdown += `**Estimated Duration:** ${suite.estimatedDuration} minutes\n`;
      markdown += `**Description:** ${suite.description}\n\n`;

      if (suite.prerequisites.length > 0) {
        markdown += '**Prerequisites:**\n';
        suite.prerequisites.forEach(prereq => {
          markdown += `- ${prereq}\n`;
        });
        markdown += '\n';
      }

      markdown += '### Test Steps\n\n';
      
      suite.testSteps.forEach((step, index) => {
        markdown += `#### ${index + 1}. ${step.title}\n\n`;
        markdown += `**Priority:** ${step.priority}\n`;
        markdown += `**Description:** ${step.description}\n`;
        markdown += `**Expected Result:** ${step.expectedResult}\n\n`;

        if (step.preconditions && step.preconditions.length > 0) {
          markdown += '**Preconditions:**\n';
          step.preconditions.forEach(condition => {
            markdown += `- ${condition}\n`;
          });
          markdown += '\n';
        }

        markdown += '**Steps to Execute:**\n';
        step.steps.forEach((stepItem, stepIndex) => {
          markdown += `${stepIndex + 1}. ${stepItem}\n`;
        });
        markdown += '\n';

        markdown += '**Validation Criteria:**\n';
        step.validationCriteria.forEach(criteria => {
          markdown += `- [ ] ${criteria}\n`;
        });
        markdown += '\n';

        if (step.troubleshooting) {
          markdown += '**Troubleshooting:**\n';
          step.troubleshooting.commonIssues.forEach(issue => {
            markdown += `- **Issue:** ${issue.issue}\n`;
            markdown += `  **Solution:** ${issue.solution}\n`;
          });
          markdown += '\n';
        }

        markdown += '**Test Result:**\n';
        markdown += '- [ ] Pass\n';
        markdown += '- [ ] Fail\n';
        markdown += '- [ ] Skip\n\n';
        markdown += '**Notes:**\n';
        markdown += '_Add any additional observations or issues found during testing._\n\n';
        markdown += '---\n\n';
      });
    });

    return markdown;
  }

  private generateCSVTestPlan(): string {
    let csv = 'Suite,Test ID,Title,Priority,Category,Description,Expected Result,Steps,Validation Criteria\n';
    
    this.testSuites.forEach(suite => {
      suite.testSteps.forEach(step => {
        const steps = step.steps.join(' | ');
        const criteria = step.validationCriteria.join(' | ');
        
        csv += `"${suite.name}","${step.id}","${step.title}","${step.priority}","${step.category}","${step.description}","${step.expectedResult}","${steps}","${criteria}"\n`;
      });
    });

    return csv;
  }

  async saveTestPlan(filename: string, format: 'markdown' | 'json' | 'csv' = 'markdown'): Promise<void> {
    const content = await this.exportTestPlan(format);
    const extension = format === 'markdown' ? 'md' : format;
    const filepath = path.join(__dirname, `${filename}.${extension}`);
    
    await fs.writeFile(filepath, content, 'utf-8');
    console.log(`Test plan saved to: ${filepath}`);
  }

  getTestSuites(): TestSuite[] {
    return this.testSuites;
  }

  getTestSuite(id: string): TestSuite | undefined {
    return this.testSuites.find(suite => suite.id === id);
  }

  getTotalEstimatedTime(): number {
    return this.testSuites.reduce((total, suite) => total + suite.estimatedDuration, 0);
  }

  getCriticalTests(): TestStep[] {
    const criticalTests: TestStep[] = [];
    this.testSuites.forEach(suite => {
      criticalTests.push(...suite.testSteps.filter(step => step.priority === 'critical'));
    });
    return criticalTests;
  }
}

// Export singleton instance
export const manualTestingChecklists = new ManualTestingChecklists();

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const format = (args[1] as 'markdown' | 'json' | 'csv') || 'markdown';

  switch (command) {
    case 'export':
      manualTestingChecklists.exportTestPlan(format).then(content => {
        console.log(content);
      });
      break;

    case 'save':
      const filename = args[2] || 'sessionhub-manual-test-plan';
      manualTestingChecklists.saveTestPlan(filename, format).then(() => {
        console.log(`Test plan saved as ${filename}.${format === 'markdown' ? 'md' : format}`);
      });
      break;

    case 'summary':
      console.log(`Total test suites: ${manualTestingChecklists.getTestSuites().length}`);
      console.log(`Total estimated time: ${manualTestingChecklists.getTotalEstimatedTime()} minutes`);
      console.log(`Critical tests: ${manualTestingChecklists.getCriticalTests().length}`);
      break;

    default:
      console.log('Usage: ts-node ManualTestingChecklist.ts [export|save|summary] [format] [filename]');
      console.log('Formats: markdown, json, csv');
      break;
  }
}