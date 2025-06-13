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
    description: 'Fix malformed useEffect in UsageStatusWidget',
    fix: (content) => {
      // Fix the broken useEffect
      const fixedContent = content.replace(
        /useEffect\(\(\) => \{[\s\S]*?\}, \[usage, showAlerts\]\);/,
        `useEffect(() => {
    if (!usage || !showAlerts) return;

    const newAlerts: Array<{ type: 'warning' | 'error'; message: string }> = [];

    // Check usage thresholds
    if (usage.tokens.percentage >= 90) {
      newAlerts.push({
        type: 'error',
        message: \`Token usage at \${usage.tokens.percentage.toFixed(1)}% of limit\`
      });
    } else if (usage.tokens.percentage >= 75) {
      newAlerts.push({
        type: 'warning',
        message: \`Token usage at \${usage.tokens.percentage.toFixed(1)}% of limit\`
      });
    }

    if (usage.cost.percentage >= 90) {
      newAlerts.push({
        type: 'error',
        message: \`Cost at \${usage.cost.percentage.toFixed(1)}% of budget\`
      });
    } else if (usage.cost.percentage >= 75) {
      newAlerts.push({
        type: 'warning',
        message: \`Cost at \${usage.cost.percentage.toFixed(1)}% of budget\`
      });
    }

    setAlerts(newAlerts);
  }, [usage, showAlerts]);`
      );

      return fixedContent;
    }
  },
  {
    file: 'scripts/fix-eslint-2.26.ts',
    description: 'Fix broken try-catch block in ESLint script',
    fix: (content) => {
      // Fix the broken try-catch block
      const fixedContent = content.replace(
        /try \{\/\/[\s\S]*?} catch \(error: any\) \{/,
        `try {
      const output = execSync('npx eslint . --ext .ts,.tsx,.js,.jsx', { 
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      console.log('✅ ESLint compliance achieved - no violations!');
    } catch (error: any) {`
      );

      return fixedContent;
    }
  },
  {
    file: 'src/components/templates/TemplateApplicationView.tsx',
    description: 'Fix broken Select component JSX',
    fix: (content) => {
      // Fix the broken Select component with duplicate closing bracket
      const fixedContent = content.replace(
        /<Select[\s\S]*?onValueChange=\{[^}]+\}[\s\S]*?disabled=\{isSettingUp\}[\s\S]*?>\s*>/,
        `<Select
              value={value}
              onValueChange={(val) => handleCustomizationChange(option.id, val)}
              disabled={isSettingUp}
            >`
      );

      return fixedContent;
    }
  }
];

async function applyFixes() {
  console.log('🔧 Fixing final syntax errors...\n');

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

  console.log('\n✨ Syntax error fixes complete!');
}

applyFixes().catch(console.error);