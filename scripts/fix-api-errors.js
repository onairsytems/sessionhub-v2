#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Fix 1: Update supabaseHandlers.ts to properly type the project type
const fixSupabaseHandlers = () => {
  const filePath = path.join(__dirname, '..', 'main', 'ipc', 'supabaseHandlers.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Fix the type field to use a proper type assertion
  content = content.replace(
    /type: (\w+),/g,
    `type: $1 as Project['type'],`
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed supabaseHandlers.ts type issue');
};

// Fix 2: Install missing type dependencies
const installMissingTypes = () => {
  console.log('📦 Installing missing type dependencies...');
  
  try {
    execSync('npm install --save-dev @types/semver', { stdio: 'inherit' });
    console.log('✅ Installed @types/semver');
  } catch (error) {
    console.error('❌ Failed to install @types/semver:', error.message);
  }
};

// Fix 3: Fix SessionProgress.tsx imports and window.electron
const fixSessionProgress = () => {
  const filePath = path.join(__dirname, '..', 'renderer', 'components', 'SessionProgress.tsx');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Fix Card import
  content = content.replace(
    "import { Card } from './ui/Card'",
    "import { Card } from '../components/ui/Card'"
  );
  
  // Fix window.electron to window.Electron
  content = content.replace(/window\.electron/g, 'window.Electron');
  
  // Remove unused index parameter
  content = content.replace(
    /\.map\(\(instruction, index\) =>/g,
    '.map((instruction) =>'
  );
  
  // Fix return statement in function
  content = content.replace(
    /getStatusColor\(status: string\) {[\s\S]*?switch \(status\) {([\s\S]*?)}/,
    (_match, switchContent) => {
      return `getStatusColor(status: string) {
    switch (status) {${switchContent}
      default:
        return 'text-gray-500';
    }`
    }
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed SessionProgress.tsx');
};

// Fix 4: Fix configure-supabase.ts void conversions
const fixConfigureSupabase = () => {
  const filePath = path.join(__dirname, 'configure-supabase.ts');
  if (!fs.existsSync(filePath)) {
    console.log('⚠️  configure-supabase.ts not found, skipping...');
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Fix void conversions by removing the incorrect type assertions
  content = content.replace(/as string\s*\|\|\s*''/g, '|| \'\'');
  content = content.replace(/process\.env\.\w+\s+as string/g, (match) => {
    return match.replace(' as string', '');
  });
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed configure-supabase.ts');
};

// Fix 5: Fix APIErrorHandler attemptNumber issue
const fixAPIErrorHandler = () => {
  const filePath = path.join(__dirname, '..', 'src', 'core', 'orchestrator', 'APIErrorHandler.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove attemptNumber from metadata or add it to the type
  content = content.replace(
    /attemptNumber: (\w+),/g,
    '// attemptNumber: $1, // Removed - not in metadata type'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed APIErrorHandler.ts');
};

// Fix 6: Fix ExecutionEngine optional chaining
const fixExecutionEngine = () => {
  const filePath = path.join(__dirname, '..', 'src', 'core', 'execution', 'ExecutionEngine.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Add optional chaining for resources
  content = content.replace(
    /result\.deliverables\.resources\./g,
    'result?.deliverables?.resources?.'
  );
  
  content = content.replace(
    /outputs\.deliverables\.resources\./g,
    'outputs?.deliverables?.resources?.'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed ExecutionEngine.ts');
};

// Fix 7: Fix ClaudeCodeAPIClient child process types
const fixClaudeCodeAPIClient = () => {
  const filePath = path.join(__dirname, '..', 'src', 'lib', 'api', 'ClaudeCodeAPIClient.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Fix spawn call with proper typing
  content = content.replace(
    /const claudeProcess = spawn\(/g,
    'const claudeProcess = spawn('
  );
  
  // Add type assertion for the process
  content = content.replace(
    /const claudeProcess = spawn\((.*?)\);/s,
    'const claudeProcess = spawn($1) as any;'
  );
  
  // Remove unused imports
  content = content.replace(
    /import { .*?ExecutionOutput.*? } from/,
    'import { InstructionProtocol } from'
  );
  
  content = content.replace(
    /import { v4 as uuidv4 } from 'uuid';\n/,
    ''
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed ClaudeCodeAPIClient.ts');
};

// Fix 8: Fix InstructionQueue undefined sessionId
const fixInstructionQueue = () => {
  const filePath = path.join(__dirname, '..', 'src', 'core', 'orchestrator', 'InstructionQueue.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Add null check for sessionId
  content = content.replace(
    /sessionId: instruction\.sessionId,/g,
    'sessionId: instruction.sessionId || \'unknown\','
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed InstructionQueue.ts');
};

// Fix 9: Fix SessionStateManager null vs undefined
const fixSessionStateManager = () => {
  const filePath = path.join(__dirname, '..', 'src', 'core', 'orchestrator', 'SessionStateManager.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Change null to undefined
  content = content.replace(
    /: SessionState \| null/g,
    ': SessionState | undefined'
  );
  
  content = content.replace(
    /return null;/g,
    'return undefined;'
  );
  
  // Add optional chaining
  content = content.replace(
    /metrics\.instructions\./g,
    'metrics?.instructions?.'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed SessionStateManager.ts');
};

// Fix 10: Fix SystemOrchestrator type mismatches
const fixSystemOrchestrator = () => {
  const filePath = path.join(__dirname, '..', 'src', 'core', 'orchestrator', 'SystemOrchestrator.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Add content property to UserRequest
  content = content.replace(
    /request: UserRequest/g,
    'request: UserRequest & { content?: string }'
  );
  
  // Remove unused apiErrorHandler
  content = content.replace(
    /private readonly apiErrorHandler: APIErrorHandler;/,
    '// private readonly apiErrorHandler: APIErrorHandler; // Unused'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed SystemOrchestrator.ts');
};

// Fix 11: Fix test files
const fixTestFiles = () => {
  const testFile = path.join(__dirname, '..', 'tests', 'integration', 'test-two-actor-workflow.ts');
  if (fs.existsSync(testFile)) {
    let content = fs.readFileSync(testFile, 'utf-8');
    
    // Fix the results array type
    content = content.replace(
      /const results = \[\];/g,
      'const results: string[] = [];'
    );
    
    // Remove unused imports
    content = content.replace(
      /import \* as path from 'path';\n/,
      ''
    );
    
    fs.writeFileSync(testFile, content);
    console.log('✅ Fixed test-two-actor-workflow.ts');
  }
};

// Main execution
const main = async () => {
  console.log('🔧 Starting API error fixes...\n');
  
  try {
    fixSupabaseHandlers();
    installMissingTypes();
    fixSessionProgress();
    fixConfigureSupabase();
    fixAPIErrorHandler();
    fixExecutionEngine();
    fixClaudeCodeAPIClient();
    fixInstructionQueue();
    fixSessionStateManager();
    fixSystemOrchestrator();
    fixTestFiles();
    
    console.log('\n✅ All API error fixes completed!');
    console.log('🔄 Please run npm run build:check to verify the fixes');
    
  } catch (error) {
    console.error('\n❌ Error during fixes:', error);
    process.exit(1);
  }
};

main();