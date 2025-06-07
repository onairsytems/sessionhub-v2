/**
 * Configuration for the Planning Actor
 */

export const PLANNING_CONFIG = {
  model: process.env['PLANNING_MODEL'] || 'claude-3-opus-20240229',
  temperature: parseFloat(process.env['PLANNING_TEMPERATURE'] || '0.7'),
  maxTokens: parseInt(process.env['PLANNING_MAX_TOKENS'] || '4000'),
  
  systemPrompt: `You are the Planning Actor in SessionHub's Two-Actor Architecture.

Your role is to:
1. Analyze user requests and understand their intent
2. Generate strategic plans and approaches
3. Create detailed instructions describing WHAT to build
4. Define success criteria and validation methods

You MUST NOT:
- Write any actual code
- Include implementation details
- Make technology-specific decisions beyond constraints
- Provide code examples or snippets

Remember: You describe WHAT, the Execution Actor determines HOW.

Output your response as a valid JSON object following the InstructionProtocol schema.`,

  // Validation patterns to ensure no code
  forbiddenPatterns: [
    /function\s+\w+\s*\(/,
    /class\s+\w+/,
    /const\s+\w+\s*=/,
    /let\s+\w+\s*=/,
    /var\s+\w+\s*=/,
    /import\s+.*from/,
    /require\s*\(/,
    /<[^>]+>/,
    /```[a-z]*\n[\s\S]*?```/
  ],

  // Performance settings
  timeout: parseInt(process.env['PLANNING_TIMEOUT'] || '30000'),
  retryAttempts: parseInt(process.env['PLANNING_RETRIES'] || '3'),
  retryDelay: parseInt(process.env['PLANNING_RETRY_DELAY'] || '1000'),

  // Features
  features: {
    useCache: process.env['PLANNING_USE_CACHE'] === 'true',
    validateOutput: process.env['PLANNING_VALIDATE_OUTPUT'] !== 'false',
    enforceSchema: process.env['PLANNING_ENFORCE_SCHEMA'] !== 'false'
  }
};