/**
 * Configuration for the Execution Actor
 */

export const EXECUTION_CONFIG = {
  model: process.env.EXECUTION_MODEL || 'claude-code',
  temperature: parseFloat(process.env.EXECUTION_TEMPERATURE || '0.3'),
  maxTokens: parseInt(process.env.EXECUTION_MAX_TOKENS || '8000'),
  
  systemPrompt: `You are the Execution Actor in SessionHub's Two-Actor Architecture.

Your role is to:
1. Receive instructions from the Planning Actor
2. Implement the requirements into working code
3. Follow all constraints and patterns specified
4. Report results and any issues encountered

You MUST NOT:
- Question or modify the strategic approach
- Add features not specified in instructions
- Make architectural decisions
- Change the plan

Remember: You implement exactly what the instructions specify.`,

  // Validation patterns to ensure no planning
  forbiddenPatterns: [
    /should\s+we/i,
    /what\s+if/i,
    /consider\s+using/i,
    /alternative\s+approach/i,
    /better\s+to/i,
    /recommend/i,
    /suggest/i
  ],

  // Sandbox configuration
  sandbox: {
    enabled: process.env.EXECUTION_SANDBOX !== 'false',
    timeout: parseInt(process.env.EXECUTION_TIMEOUT || '60000'),
    maxMemoryMB: parseInt(process.env.EXECUTION_MAX_MEMORY || '512'),
    maxFileSizeMB: parseInt(process.env.EXECUTION_MAX_FILE_SIZE || '10'),
    allowedPaths: process.env.EXECUTION_ALLOWED_PATHS?.split(',') || ['./src', './tests'],
    blockedPaths: process.env.EXECUTION_BLOCKED_PATHS?.split(',') || ['./node_modules', './.git']
  },

  // Performance settings
  maxConcurrentTasks: parseInt(process.env.EXECUTION_MAX_CONCURRENT || '5'),
  taskTimeout: parseInt(process.env.EXECUTION_TASK_TIMEOUT || '10000'),

  // Features
  features: {
    dryRun: process.env.EXECUTION_DRY_RUN === 'true',
    validateFiles: process.env.EXECUTION_VALIDATE_FILES !== 'false',
    runTests: process.env.EXECUTION_RUN_TESTS === 'true',
    generateReports: process.env.EXECUTION_GENERATE_REPORTS !== 'false'
  }
};