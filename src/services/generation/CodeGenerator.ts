import * as fs from 'fs-extra';
import * as path from 'path';
import { GenerationContext, TemplateFile } from './types';

export class CodeGenerator {
  async generate(context: GenerationContext): Promise<string[]> {
    const generatedFiles: string[] = [];

    // Create all directories first
    const directories = this.extractDirectories(context.template.files);
    for (const dir of directories) {
      await fs.ensureDir(path.join(context.outputDir, dir));
    }

    // Generate each file
    for (const file of context.template.files) {
      const filePath = path.join(context.outputDir, file.path);
      await this.generateFile(filePath, file);
      generatedFiles.push(file.path);
    }

    // Generate package manager files
    if (context.config.type.includes('python')) {
      // Python projects already have pyproject.toml and requirements.txt
    } else {
      // Node.js projects - ensure package-lock.json will be created
      await this.generatePackageLock(context);
    }

    return generatedFiles;
  }

  private extractDirectories(files: TemplateFile[]): Set<string> {
    const dirs = new Set<string>();
    
    for (const file of files) {
      const dir = path.dirname(file.path);
      if (dir !== '.') {
        // Add all parent directories
        const parts = dir.split(path.sep);
        for (let i = 1; i <= parts.length; i++) {
          dirs.add(parts.slice(0, i).join(path.sep));
        }
      }
    }

    return dirs;
  }

  private async generateFile(filePath: string, file: TemplateFile): Promise<void> {
    // Ensure directory exists
    await fs.ensureDir(path.dirname(filePath));

    // Write file content
    if (typeof file.content === 'string') {
      await fs.writeFile(filePath, file.content, 'utf8');
    } else {
      await fs.writeFile(filePath, file.content);
    }

    // Set executable flag if needed
    if (file.executable) {
      await fs.chmod(filePath, '755');
    }
  }

  private async generatePackageLock(_context: GenerationContext): Promise<void> {
    // For Node.js projects, we'll let npm generate the lock file
    // This ensures compatibility and prevents version conflicts
    
    // The actual npm install will happen in QualityEnforcer
    // to ensure all dependencies are properly installed
  }
}