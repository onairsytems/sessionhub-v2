#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

interface Fix {
  file: string;
  description: string;
  fix: (content: string) => string;
}

const fixes: Fix[] = [
  {
    file: 'components/usage/UsageStatusWidget.tsx',
    description: 'Fix useEffect dependency issue',
    fix: (content) => {
      // Remove refreshUsage from dependency array to avoid infinite loop
      return content.replace(
        /}, \[userId, refreshInterval, refreshUsage\]\);/,
        '}, [userId, refreshInterval]);'
      );
    }
  },
  {
    file: 'main/ipc/sessionHandlers.ts',
    description: 'Remove unused userId parameter',
    fix: (content) => {
      return content.replace(
        /async \(event: IpcMainInvokeEvent, projectId: string, userId: string\)/,
        'async (event: IpcMainInvokeEvent, projectId: string)'
      );
    }
  },
  {
    file: 'renderer/components/sessions/SessionAnalyticsDashboard.tsx',
    description: 'Fix property access with bracket notation',
    fix: (content) => {
      return content.replace(
        /statusData\.executing(?!['"\]])/g,
        "statusData['executing']"
      );
    }
  },
  {
    file: 'renderer/components/sessions/SessionLibrary.tsx',
    description: 'Fix SessionFilter properties',
    fix: (content) => {
      // Remove dateRange and use dateFrom/dateTo
      return content.replace(
        /dateRange: dateRange\.from,\s*dateTo: dateRange\.to/,
        'dateFrom: dateRange.from,\n          dateTo: dateRange.to'
      );
    }
  },
  {
    file: 'scripts/fix-all-remaining-typescript.ts',
    description: 'Fix unused parameter and undefined check',
    fix: (content) => {
      // Fix the regex replace function
      content = content.replace(
        /\.replace\(\/\[\\^\\\\w\]\\\\w\+\\\\s\*\\\\\(\\\\w\+\\\\\)\[\\\\s\\\\S\]\*\?\\\\}\/g, \(match, type, name\) => \{/,
        '.replace(/[^\\\\w]\\\\w+\\\\s*\\\\(\\\\w+\\\\)[\\\\s\\\\S]*?\\\\}/g, (match) => {'
      );
      
      // Add proper check for name
      content = content.replace(
        /const name = match\.match\(\/\\\\(\\\\w\+\\\\)\/\)\?\[1\];/,
        `const nameMatch = match.match(/\\\\(\\\\w+\\\\)/);
        const name = nameMatch ? nameMatch[1] : undefined;`
      );
      
      return content;
    }
  },
  {
    file: 'scripts/fix-all-typescript-final.ts',
    description: 'Fix pattern type definitions',
    fix: (content) => {
      // Fix the pattern definitions
      return content.replace(
        /pattern: \/.*?\/g?,\s*replacement: \(match: string\) => .*?[,}]/gs,
        (match) => {
          if (match.includes('require')) {
            return `pattern: /const\\s+(\\w+)\\s*=\\s*require\\(/g,
        replacement: 'const $1: any = require('`;
          } else {
            return `pattern: /const\\s+(\\w+)\\s*=\\s*([^:]+as\\s+any)/g,
        replacement: 'const $1: any = $2'`;
          }
        }
      );
    }
  },
  {
    file: 'src/components/projects/ProjectSettingsModal.tsx',
    description: 'Fix activeTab null checks',
    fix: (content) => {
      // Add early return if activeTab is undefined
      const renderTabContentFix = content.replace(
        /const renderTabContent = \(\) => \{/,
        `const renderTabContent = () => {
    if (!activeTab) return null;`
      );
      
      // Fix all TABS[activeTab] accesses
      return renderTabContentFix.replace(
        /TABS\[activeTab\]/g,
        'TABS[activeTab as keyof typeof TABS]'
      );
    }
  },
  {
    file: 'src/components/templates/TemplateApplicationView.tsx',
    description: 'Remove unused Select imports',
    fix: (content) => {
      return content.replace(
        /import { Select, SelectItem } from '@\/components\/ui\/select';/,
        '// Removed unused Select imports'
      );
    }
  },
  {
    file: 'src/core/orchestrator/AnalyticsIntegratedResilienceOrchestrator.ts',
    description: 'Fix constructor calls with missing arguments',
    fix: (content) => {
      // Fix ErrorTrendAnalyzer constructor
      content = content.replace(
        /this\.trendAnalyzer = new ErrorTrendAnalyzer\(this\.analyticsEngine\);/,
        'this.trendAnalyzer = new ErrorTrendAnalyzer(this.analyticsEngine, this.logger);'
      );
      
      // Fix PerformanceCorrelationAnalyzer constructor
      content = content.replace(
        /this\.performanceAnalyzer = new PerformanceCorrelationAnalyzer\(\s*this\.analyticsEngine,\s*this\.healthMonitor,\s*this\.telemetryService\s*\);/,
        'this.performanceAnalyzer = new PerformanceCorrelationAnalyzer(\n      this.analyticsEngine,\n      this.healthMonitor,\n      this.telemetryService,\n      this.logger\n    );'
      );
      
      // Fix AlertManagementSystem constructor
      content = content.replace(
        /this\.alertSystem = new AlertManagementSystem\(\s*this\.analyticsEngine,\s*this\.healthMonitor,\s*this\.notificationService,\s*this\.logger,\s*{ enabled: true }[^)]*\);/,
        `this.alertSystem = new AlertManagementSystem(
      this.analyticsEngine,
      this.healthMonitor,
      this.notificationService,
      this.logger,
      this.auditLogger,
      { enabled: true }
    );`
      );
      
      // Fix generateReport call
      content = content.replace(
        /await this\.reportGenerator\.generateReport\(reportConfig\);/,
        'await this.reportGenerator.generateReport(reportConfig, { format: "html", sections: ["summary", "alerts", "recommendations"] });'
      );
      
      // Fix createConfigFromTemplate call
      content = content.replace(
        /const dailyReportConfig = this\.reportGenerator\.createConfigFromTemplate\(\s*'operational-status',/,
        `const dailyReportConfig = await this.reportGenerator.createConfigFromTemplate(
      'operational-status',`
      );
      
      return content;
    }
  },
  {
    file: 'src/core/verification/__tests__/SessionVerification.test.ts',
    description: 'Remove unused auditLogger',
    fix: (content) => {
      // Remove the unused declaration
      return content.replace(
        /const auditLogger = new AuditLogger\(\);\n/,
        ''
      );
    }
  },
  {
    file: 'src/services/analytics/UserImpactAssessment.ts',
    description: 'Remove unused function parameter',
    fix: (content) => {
      // Remove or comment out unused parameter
      return content.replace(
        /private async analyzeCompletedSession\(session: Session, analyzeCompletedSession: boolean\): Promise<void> \{/,
        'private async analyzeCompletedSession(session: Session): Promise<void> {'
      );
    }
  }
];

async function applyFixes() {
  console.log('🔧 Fixing last TypeScript errors...\n');

  for (const fix of fixes) {
    const filePath = path.join(process.cwd(), fix.file);
    
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${fix.file}`);
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const fixedContent = fix.fix(content);

      if (content !== fixedContent) {
        fs.writeFileSync(filePath, fixedContent);
        console.log(`✅ Fixed: ${fix.file} - ${fix.description}`);
      } else {
        console.log(`ℹ️  No changes needed: ${fix.file}`);
      }
    } catch (error) {
      console.error(`❌ Error fixing ${fix.file}:`, error);
    }
  }

  console.log('\n✨ Final TypeScript error fixes complete!');
}

applyFixes().catch(console.error);