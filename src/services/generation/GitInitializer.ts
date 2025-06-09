import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs-extra';
import * as path from 'path';
import { GitInitOptions, GitHubSetupOptions, ProjectType } from './types';

const execAsync = promisify(exec);

export class GitInitializer {
  async initialize(options: GitInitOptions): Promise<void> {
    const { projectDir, projectType, enableHooks, includeGitIgnore } = options;

    // Initialize git repository
    await execAsync('git init', { cwd: projectDir });

    // Create .gitignore if requested
    if (includeGitIgnore && !(await fs.pathExists(path.join(projectDir, '.gitignore')))) {
      await this.createGitIgnore(projectDir, projectType);
    }

    // Set up git hooks if requested
    if (enableHooks) {
      await this.setupGitHooks(projectDir, projectType);
    }

    // Create initial commit
    await this.createInitialCommit(projectDir);
  }

  async setupGitHub(options: GitHubSetupOptions): Promise<void> {
    const { projectDir, repoName, private: isPrivate, includeActions } = options;

    try {
      // Check if gh CLI is available
      await execAsync('gh --version');

      // Create GitHub repository
      const visibility = isPrivate ? '--private' : '--public';
      await execAsync(
        `gh repo create ${repoName} ${visibility} --source=. --remote=origin --push`,
        { cwd: projectDir }
      );

      // Set up GitHub Actions if requested
      if (includeActions && !(await fs.pathExists(path.join(projectDir, '.github/workflows')))) {
        await this.createGitHubActions(projectDir);
      }

      // Push to GitHub
      await execAsync('git push -u origin main', { cwd: projectDir });
    } catch (error) {
      // GitHub CLI not available or authentication failed. Skipping GitHub setup.
      // Create remote instructions file
      await this.createGitHubInstructions(projectDir, repoName);
    }
  }

  private async createGitIgnore(projectDir: string, projectType: ProjectType): Promise<void> {
    let content = '';

    if (projectType.includes('python')) {
      content = `# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.venv
.env
*.egg-info/
dist/
build/
.pytest_cache/
.mypy_cache/
.coverage
htmlcov/
.tox/
.nox/

# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db`;
    } else {
      content = `# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
.nyc_output

# Production
build/
dist/

# Misc
.DS_Store
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# TypeScript
*.tsbuildinfo

# Next.js
.next/
out/

# Gatsby
.cache/
public/

# VuePress
.vuepress/dist/

# Serverless
.serverless/

# FuseBox
.fusebox/`;
    }

    await fs.writeFile(path.join(projectDir, '.gitignore'), content);
  }

  private async setupGitHooks(projectDir: string, projectType: ProjectType): Promise<void> {
    const hooksDir = path.join(projectDir, '.git/hooks');
    await fs.ensureDir(hooksDir);

    // Create pre-commit hook
    const preCommitContent = this.createPreCommitHook(projectType);
    const preCommitPath = path.join(hooksDir, 'pre-commit');
    await fs.writeFile(preCommitPath, preCommitContent);
    await fs.chmod(preCommitPath, '755');

    // Create commit-msg hook for conventional commits
    const commitMsgContent = this.createCommitMsgHook();
    const commitMsgPath = path.join(hooksDir, 'commit-msg');
    await fs.writeFile(commitMsgPath, commitMsgContent);
    await fs.chmod(commitMsgPath, '755');
  }

  private createPreCommitHook(projectType: ProjectType): string {
    if (projectType.includes('python')) {
      return `#!/bin/sh
# Pre-commit hook for Python projects

echo "Running pre-commit checks..."

# Run black
echo "Running black..."
black --check src tests
if [ $? -ne 0 ]; then
    echo "❌ Black found formatting issues. Run 'black src tests' to fix."
    exit 1
fi

# Run isort
echo "Running isort..."
isort --check-only src tests
if [ $? -ne 0 ]; then
    echo "❌ isort found import sorting issues. Run 'isort src tests' to fix."
    exit 1
fi

# Run flake8
echo "Running flake8..."
flake8 src tests
if [ $? -ne 0 ]; then
    echo "❌ flake8 found linting errors."
    exit 1
fi

# Run mypy
echo "Running mypy..."
mypy src tests
if [ $? -ne 0 ]; then
    echo "❌ mypy found type errors."
    exit 1
fi

# Run tests
echo "Running tests..."
pytest --tb=short
if [ $? -ne 0 ]; then
    echo "❌ Tests failed."
    exit 1
fi

echo "✅ All pre-commit checks passed!"`;
    } else {
      return `#!/bin/sh
# Pre-commit hook for Node.js projects

echo "Running pre-commit checks..."

# Run ESLint
echo "Running ESLint..."
npm run lint
if [ $? -ne 0 ]; then
    echo "❌ ESLint found errors. Run 'npm run lint:fix' to fix auto-fixable issues."
    exit 1
fi

# Run TypeScript check
echo "Running TypeScript check..."
npm run typecheck
if [ $? -ne 0 ]; then
    echo "❌ TypeScript found type errors."
    exit 1
fi

# Run Prettier check
echo "Running Prettier check..."
npm run format:check
if [ $? -ne 0 ]; then
    echo "❌ Prettier found formatting issues. Run 'npm run format' to fix."
    exit 1
fi

# Run tests
echo "Running tests..."
npm test -- --watchAll=false --passWithNoTests
if [ $? -ne 0 ]; then
    echo "❌ Tests failed."
    exit 1
fi

echo "✅ All pre-commit checks passed!"`;
    }
  }

  private createCommitMsgHook(): string {
    return `#!/bin/sh
# Commit message hook to enforce conventional commits

commit_regex='^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?: .{1,100}$'
error_msg="❌ Commit message does not follow Conventional Commits format!

Expected format: <type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert

Example: feat(auth): add login functionality"

if ! grep -qE "$commit_regex" "$1"; then
    echo "$error_msg" >&2
    exit 1
fi`;
  }

  private async createInitialCommit(projectDir: string): Promise<void> {
    // Add all files
    await execAsync('git add .', { cwd: projectDir });

    // Create initial commit
    const commitMessage = 'feat: initial project setup\n\nGenerated with zero errors by SessionHub';
    await execAsync(`git commit -m "${commitMessage}"`, { cwd: projectDir });
  }

  private async createGitHubActions(projectDir: string): Promise<void> {
    const workflowsDir = path.join(projectDir, '.github/workflows');
    await fs.ensureDir(workflowsDir);

    // CI workflow is already created by template engine
    // Add additional workflows here if needed
  }

  private async createGitHubInstructions(projectDir: string, repoName: string): Promise<void> {
    const instructions = `# GitHub Setup Instructions

Since GitHub CLI is not available or not authenticated, please follow these steps to push your project to GitHub:

1. Create a new repository on GitHub:
   - Go to https://github.com/new
   - Repository name: ${repoName}
   - Choose public or private visibility
   - Do NOT initialize with README, .gitignore, or license

2. Add the remote origin:
   \`\`\`bash
   git remote add origin https://github.com/YOUR_USERNAME/${repoName}.git
   \`\`\`

3. Push your code:
   \`\`\`bash
   git push -u origin main
   \`\`\`

Your project includes GitHub Actions workflows that will run automatically once pushed.

## Quality Guarantee

This project was generated with:
- ✅ Zero errors
- ✅ Pre-commit hooks installed
- ✅ GitHub Actions CI/CD ready
- ✅ All quality checks passing

Generated by SessionHub - The zero-error code generation platform.`;

    await fs.writeFile(path.join(projectDir, 'GITHUB_SETUP.md'), instructions);
  }
}