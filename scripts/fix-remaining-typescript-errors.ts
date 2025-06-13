#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

class TypeScriptErrorFixer {
  async run(): Promise<void> {
    console.log('🔧 Fixing remaining TypeScript errors...\n');
    
    // Fix import paths
    await this.fixImportPaths();
    
    // Fix type annotations
    await this.fixTypeAnnotations();
    
    // Fix method signatures
    await this.fixMethodSignatures();
    
    console.log('✅ TypeScript error fixes completed');
  }

  private async fixImportPaths(): Promise<void> {
    // Fix remaining import path issues
    const fixes = [
      {
        file: 'src/components/organization/ProjectNavigationView.tsx',
        old: "import { useToast } from '@/lib/toast';",
        new: "import { useToast } from '@/lib/hooks/useToast';"
      },
      {
        file: 'src/components/templates/TemplateApplicationView.tsx',
        old: "import { useToast } from '@/lib/toast';",
        new: "import { useToast } from '@/lib/hooks/useToast';"
      },
      {
        file: 'src/components/templates/TemplateApplicationView.tsx',
        old: "import { Label } from '@/components/ui/label';",
        new: "// import { Label } from '@/components/ui/label';"
      },
      {
        file: 'src/components/templates/TemplateApplicationView.tsx',
        old: "import { Switch } from '@/components/ui/switch';",
        new: "// import { Switch } from '@/components/ui/switch';"
      }
    ];

    for (const fix of fixes) {
      const filePath = path.join(process.cwd(), fix.file);
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(fix.old, fix.new);
        fs.writeFileSync(filePath, content);
        console.log(`✓ Fixed import in ${fix.file}`);
      }
    }
  }

  private async fixTypeAnnotations(): Promise<void> {
    // Fix missing type annotations
    const annotations = [
      {
        file: 'src/components/templates/TemplateApplicationView.tsx',
        pattern: /onCheckedChange=\{(\(checked\)) =>/g,
        replacement: 'onCheckedChange={(checked: boolean) =>'
      },
      {
        file: 'src/components/organization/ProjectNavigationView.tsx',
        pattern: /onValueChange=\{(\(value\)) =>/g,
        replacement: 'onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>'
      }
    ];

    for (const ann of annotations) {
      const filePath = path.join(process.cwd(), ann.file);
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(ann.pattern, ann.replacement);
        fs.writeFileSync(filePath, content);
        console.log(`✓ Fixed type annotations in ${ann.file}`);
      }
    }
  }

  private async fixMethodSignatures(): Promise<void> {
    // Fix method signatures and missing properties
    const methodFixes = [
      {
        file: 'src/core/orchestrator/AnalyticsIntegratedResilienceOrchestrator.ts',
        old: 'this.healthMonitor.getCurrentStatus()',
        new: 'this.healthMonitor.getHealthStatus()'
      },
      {
        file: 'renderer/components/sessions/SessionAnalyticsDashboard.tsx',
        old: "acc[point.model]['executing']",
        new: "acc[point.model]!['executing']"
      }
    ];

    for (const fix of methodFixes) {
      const filePath = path.join(process.cwd(), fix.file);
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(fix.old, fix.new);
        fs.writeFileSync(filePath, content);
        console.log(`✓ Fixed method signature in ${fix.file}`);
      }
    }
  }
}

// Run the fixer
const fixer = new TypeScriptErrorFixer();
fixer.run().catch(console.error);