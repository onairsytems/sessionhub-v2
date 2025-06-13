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
    description: 'Fix refreshUsage not returning value in all paths',
    fix: (content) => {
      // The refreshUsage function needs to be fixed
      return content.replace(
        /const refreshUsage = async \(\) => \{[\s\S]*?\};/,
        `const refreshUsage = async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      // This would be replaced with actual API call
      const response = await fetch(\`/api/usage/\${userId}\`);
      if (!response.ok) throw new Error('Failed to fetch usage data');
      
      const data = await response.json() as UsageData;
      setUsage(data);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };`
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
    description: 'Fix object property access with bracket notation',
    fix: (content) => {
      return content.replace(
        /statusData\.executing/g,
        "statusData['executing']"
      );
    }
  },
  {
    file: 'renderer/components/sessions/SessionLibrary.tsx',
    description: 'Fix dateFrom property to dateRange',
    fix: (content) => {
      return content.replace(
        /dateFrom:/g,
        'dateRange:'
      );
    }
  },
  {
    file: 'scripts/fix-all-remaining-typescript.ts',
    description: 'Fix unused parameter and possibly undefined',
    fix: (content) => {
      // Remove unused type parameter
      content = content.replace(
        /\.replace\(\/\[\^\\w\]\\w\+\\s\*\\(\\w\+\\)\[\\s\\S\]\*\?\\}\/g, \(match, type, name\) => \{/,
        '.replace(/[^\\w]\\w+\\s*\\(\\w+\\)[\\s\\S]*?\\}/g, (match, _, name) => {'
      );
      
      // Fix possibly undefined name
      content = content.replace(
        /if \(name && !name\.includes\('\['\) && !name\.includes\('\.'\)\)/,
        "if (name && !name.includes('[') && !name.includes('.'))"
      );
      
      return content;
    }
  },
  {
    file: 'scripts/fix-all-typescript-final.ts',
    description: 'Fix incorrect replacement value type',
    fix: (content) => {
      // Fix the incorrect replacement function usage
      content = content.replace(
        /replacement: \(match: string\) => string/g,
        'replacement: string'
      );
      
      // Fix the actual replacements
      content = content.replace(
        /replacement: \(match: string\) => \{[\s\S]*?return[\s\S]*?\}/g,
        'replacement: "$1: any = $2"'
      );
      
      return content;
    }
  },
  {
    file: 'scripts/fix-eslint-2.26.ts',
    description: 'Remove unused output variable',
    fix: (content) => {
      return content.replace(
        /const output = execSync/,
        'execSync'
      );
    }
  },
  {
    file: 'src/components/projects/ProjectSettingsModal.tsx',
    description: 'Fix undefined activeTab usage',
    fix: (content) => {
      // Add null check for activeTab
      return content.replace(
        /const tabData = TABS\[activeTab\]/g,
        'const tabData = activeTab ? TABS[activeTab] : null'
      ).replace(
        /tabData\.icon/g,
        'tabData?.icon'
      ).replace(
        /tabData\.fields/g,
        'tabData?.fields || []'
      ).replace(
        /values\[activeTab\]/g,
        'activeTab && values[activeTab]'
      );
    }
  },
  {
    file: 'src/components/templates/TemplateApplicationView.tsx',
    description: 'Fix imports and duplicate properties',
    fix: (content) => {
      // Remove unused Select components
      content = content.replace(
        /import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@\/components\/ui\/select';/,
        "import { Select, SelectItem } from '@/components/ui/select';"
      );
      
      // Fix Alert imports
      content = content.replace(
        /import { Alert, AlertDescription, AlertTitle } from '@\/components\/ui\/alert';/,
        "import { Alert, AlertDescription } from '@/components/ui/alert';"
      );
      
      // Fix duplicate description properties in toast calls
      content = content.replace(
        /toast\(\{[\s\S]*?description:.*?\n.*?description:.*?\n.*?\}\)/g,
        (match) => {
          // Keep only the first description
          const lines = match.split('\n');
          let foundFirst = false;
          return lines.filter(line => {
            if (line.includes('description:')) {
              if (foundFirst) return false;
              foundFirst = true;
            }
            return true;
          }).join('\n');
        }
      );
      
      // Change AlertTitle to strong tag
      content = content.replace(
        /<AlertTitle>/g,
        '<strong>'
      ).replace(
        /<\/AlertTitle>/g,
        '</strong>'
      );
      
      // Fix Select component usage to simple select
      content = content.replace(
        /<Select[\s\S]*?value={value}[\s\S]*?onValueChange[\s\S]*?disabled={isSettingUp}[\s\S]*?>([\s\S]*?)<\/Select>/g,
        `<select
              value={value}
              onChange={(e) => handleCustomizationChange(option.id, e.target.value)}
              disabled={isSettingUp}
              className="w-full px-3 py-2 border rounded-md"
            >
              {option.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>`
      );
      
      // Remove SelectItem import usage
      content = content.replace(
        /<SelectItem key={opt} value={opt}>\s*{opt}\s*<\/SelectItem>/g,
        '<option key={opt} value={opt}>{opt}</option>'
      );
      
      return content;
    }
  },
  {
    file: 'src/core/orchestrator/AnalyticsIntegratedResilienceOrchestrator.ts',
    description: 'Fix missing instructionQueue property',
    fix: (content) => {
      // Add missing property declaration
      return content.replace(
        /private sessionManager: SessionManager;/,
        `private sessionManager: SessionManager;
  private instructionQueue: InstructionQueue;`
      );
    }
  },
  {
    file: 'src/services/usage/CostCalculator.ts',
    description: 'Fix missing pricing declaration',
    fix: (content) => {
      return content.replace(
        /\): CostBreakdown \{\/\/\s*\n\s*\/\/ const pricing = this\.modelPricing\.get\(model\);/,
        `): CostBreakdown {
    const pricing = this.modelPricing.get(model);`
      );
    }
  },
  {
    file: 'src/services/queue/SessionQueueManager.ts',
    description: 'Fix missing imports and properties',
    fix: (content) => {
      // Add missing import
      content = content.replace(
        /import { InstructionQueue } from/,
        `import { InstructionQueue } from`
      );
      
      // Add missing property
      content = content.replace(
        /private sessionManager: SessionManager;/,
        `private sessionManager: SessionManager;
  private instructionQueue: InstructionQueue;`
      );
      
      return content;
    }
  },
  {
    file: 'src/services/ide/ZedAgentPanelAdapter.ts',
    description: 'Fix missing clientId declaration',
    fix: (content) => {
      return content.replace(
        /this\.wsServer\.on\('connection', \(ws\) => \{\/\/\s*\n\s*\/\/ const clientId = this\.generateClientId\(\);/,
        `this.wsServer.on('connection', (ws) => {
        const clientId = this.generateClientId();`
      );
    }
  }
];

async function applyFixes() {
  console.log('🔧 Fixing remaining TypeScript errors...\n');

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

  console.log('\n✨ TypeScript error fixes complete!');
}

applyFixes().catch(console.error);