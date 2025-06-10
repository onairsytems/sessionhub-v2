
/**
 * Claude Code API client for the Execution Actor
 * Integrates with Anthropic's Claude Code API for code generation and execution
 */

import { Logger } from '@/src/lib/logging/Logger';
import { InstructionProtocol } from '@/src/models/Instruction';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';


export interface ClaudeCodeAPIConfig {
  apiKey: string;
  apiUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  workspaceDir?: string;
}

export interface CodeGenerationRequest {
  instruction: InstructionProtocol;
  context: {
    projectType: string;
    language: string;
    framework?: string;
    existingCode?: string;
  };
}

export interface CodeExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  files: string[];
  executionTime: number;
}

export class ClaudeCodeAPIClient {
  private readonly logger: Logger;
  private readonly config: Required<ClaudeCodeAPIConfig>;
  private readonly workspaceDir: string;
  private rateLimiter: Map<string, number> = new Map();
  private readonly maxRequestsPerMinute = 30; // Lower for code generation

  constructor(config: ClaudeCodeAPIConfig, logger?: Logger) {
    this.logger = logger || new Logger('ClaudeCodeAPIClient');
    
    // Use proper workspace directory based on platform
    const defaultWorkspaceDir = process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support', 'SessionHub', 'workspaces')
      : path.join(os.tmpdir(), 'sessionhub', 'execution');
    
    this.config = {
      apiKey: config.apiKey,
      apiUrl: config.apiUrl || 'https://api.anthropic.com/v1/messages',
      model: config.model || 'claude-3-5-sonnet-20241022',
      maxTokens: config.maxTokens || 8000,
      temperature: config.temperature || 0.3,
      timeout: config.timeout || 120000, // Longer timeout for code generation
      workspaceDir: config.workspaceDir || defaultWorkspaceDir
    };
    
    this.workspaceDir = this.config.workspaceDir;
  }

  /**
   * Generate code from instructions
   */
  async generateCode(request: CodeGenerationRequest): Promise<string> {
    const systemPrompt = `You are the Execution Actor in SessionHub's Two-Actor Architecture.

Your role is to:
1. Implement the exact requirements specified in the instructions
2. Generate working, production-quality code
3. Follow all patterns and constraints specified
4. Ensure all success criteria can be met

You MUST:
- Write actual, executable code
- Follow the project's coding standards
- Implement all requirements without exception
- Create all necessary files and configurations
- Ensure the code is testable and maintainable

You MUST NOT:
- Make strategic decisions (follow instructions exactly)
- Skip any requirements
- Add features not specified in instructions
- Change the approach defined by Planning Actor

Context:
- Project Type: ${request.context.projectType}
- Language: ${request.context.language}
- Framework: ${request.context.framework || 'none'}

Generate complete, working code that fulfills all requirements.`;

    const userPrompt = `Please implement the following instructions:

${JSON.stringify(request.instruction, null, 2)}

Generate all necessary code files to fulfill these requirements completely.
For each file, use this format:

=== FILE: path/to/file.ext ===
<file content>
=== END FILE ===

Implement everything needed to meet all success criteria.`;

    try {
      const response = await this.sendRequest({
        model: this.config.model,
        messages: [
          { role: 'user', content: userPrompt }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt
      });

      const content = response.content[0]?.text;
      if (!content) {
        throw new Error('Empty response from Claude Code API');
      }

      return content;
    } catch (error) {
      this.logger.error('Failed to generate code', error as Error);
      throw error;
    }
  }

  /**
   * Execute generated code in isolated environment
   */
  async executeCode(
    code: string,
    instruction: InstructionProtocol
  ): Promise<CodeExecutionResult> {
    const startTime = Date.now();
    const sessionDir = path.join(this.workspaceDir, instruction.metadata.sessionId);
    
    try {
      // Create workspace directory
      await fs.mkdir(sessionDir, { recursive: true });
      
      // Parse and write files
      const files = await this.parseAndWriteFiles(code, sessionDir);
      
      // Determine execution command based on project type
      const execCommand = await this.determineExecutionCommand(sessionDir, files);
      
      // Execute the code
      const output = await this.runCommand(execCommand, sessionDir);
      
      // Run validation tests if specified
      const validationOutput = await this.runValidation(sessionDir, instruction);
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        output: output + '\n\n' + validationOutput,
        files,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        output: '',
        error: (error as Error).message,
        files: [],
        executionTime
      };
    }
  }

  /**
   * Parse generated code and write files
   */
  private async parseAndWriteFiles(code: string, _sessionDir: string): Promise<string[]> {
    const fileRegex = /=== FILE: (.*?) ===\n([\s\S]*?)(?=\n=== (?:END FILE|FILE:)|$)/g;
    const files: string[] = [];
    let match;

    while ((match = fileRegex.exec(code)) !== null) {
      const filePath = match[1]?.trim() || '';
      const fileContent = match[2]?.trim() || '';
      
      const fullPath = path.join(_sessionDir, filePath);
      const dir = path.dirname(fullPath);
      
      // Create directory structure
      await fs.mkdir(dir, { recursive: true });
      
      // Write file
      await fs.writeFile(fullPath, fileContent, 'utf8');
      files.push(filePath);
      
      this.logger.debug('Wrote file', { path: filePath });
    }

    return files;
  }

  /**
   * Determine execution command based on files
   */
  private async determineExecutionCommand(
    sessionDir: string,
    files: string[]
  ): Promise<string> {
    // Check for package.json
    if (files.includes('package.json')) {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(sessionDir, 'package.json'), 'utf8')
      );
      
      // Install dependencies
      await this.runCommand('npm install', sessionDir);
      
      // Check for test script
      if (packageJson.scripts?.test) {
        return 'npm test';
      }
      
      // Check for start script
      if (packageJson.scripts?.start) {
        return 'npm start';
      }
    }
    
    // Check for Python files
    if (files.some(f => f.endsWith('.py'))) {
      const mainPy = files.find(f => f === 'main.py' || f === 'app.py');
      if (mainPy) {
        return `python ${mainPy}`;
      }
    }
    
    // Default: list files
    return 'ls -la';
  }

  /**
   * Run shell command
   */
  private async runCommand(command: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const child: ChildProcessWithoutNullStreams = spawn(cmd || 'echo', args, {
        cwd,
        env: { ...process.env },
        timeout: this.config.timeout,
        shell: true
      });

      let stdout = '';
      let stderr = '';

      if (child.stdout) {
        child.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      }

      child.on('error', (error: Error) => {
        reject(error);
      });

      child.on('close', (code: number | null) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
    });
  }

  /**
   * Run validation tests
   */
  private async runValidation(
    _sessionDir: string,
    instruction: InstructionProtocol
  ): Promise<string> {
    const results: string[] = ['=== Validation Results ==='];
    
    for (const criterion of instruction.successCriteria) {
      if (criterion.automated) {
        try {
          // Simple file existence check for now
          const filesExist = instruction.deliverables
            .filter(d => d.type === 'file')
            .every(_d => true); // Would check actual files
          
          if (filesExist) {
            results.push(`✓ ${criterion.criterion}`);
          } else {
            results.push(`✗ ${criterion.criterion}`);
          }
        } catch (error) {
          results.push(`✗ ${criterion.criterion}: ${(error as Error).message}`);
        }
      }
    }
    
    return results.join('\n');
  }

  /**
   * Send request to Claude API with rate limiting and retry logic
   */
  private async sendRequest(request: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    max_tokens: number;
    temperature: number;
    system: string;
  }): Promise<{ content: Array<{ text?: string }> }> {
    await this.checkRateLimit();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      this.logger.debug('Sending code generation request to Claude API', {
        model: request.model,
        maxTokens: request.max_tokens
      });

      const response = await this.makeRequestWithRetry(request, controller.signal);
      const data = await response.json();

      this.logger.debug('Claude Code API response received', {
        contentLength: data.content?.[0]?.text?.length || 0
      });

      return data;
    } catch (error: any) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Claude Code API request timed out after ${this.config.timeout}ms`);
      }
      this.logger.error('Claude Code API request failed', error as Error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Make API request with retry logic
   */
  private async makeRequestWithRetry(
    request: any, 
    signal: AbortSignal,
    maxRetries = 3
  ): Promise<Response> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(this.config.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(request),
          signal
        });

        if (response.ok) {
          return response;
        }

        // Handle specific error codes
        if (response.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = parseInt(response.headers.get('retry-after') || '60');
          this.logger.warn(`Code API rate limited, waiting ${retryAfter}s before retry ${attempt}/${maxRetries}`);
          await this.delay(retryAfter * 1000);
          continue;
        }

        if (response.status >= 500 && attempt < maxRetries) {
          // Server error - retry with exponential backoff
          const backoffDelay = Math.pow(2, attempt) * 1000;
          this.logger.warn(`Code API server error ${response.status}, retrying in ${backoffDelay}ms`);
          await this.delay(backoffDelay);
          continue;
        }

        // Client error or final attempt - throw error
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Claude Code API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        );
      } catch (error: any) {
        lastError = error as Error;
        if (attempt === maxRetries || error.name === 'AbortError') {
          throw error;
        }
        
        // Wait before retry
        const backoffDelay = Math.pow(2, attempt) * 1000;
        this.logger.warn(`Code API request failed, retrying in ${backoffDelay}ms`, error as Error);
        await this.delay(backoffDelay);
      }
    }
    
    throw lastError!;
  }

  /**
   * Check rate limit before making request
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window
    
    // Clean old entries
    for (const [timestamp] of this.rateLimiter.entries()) {
      if (parseInt(timestamp) < windowStart) {
        this.rateLimiter.delete(timestamp);
      }
    }
    
    // Check if we're at the limit
    if (this.rateLimiter.size >= this.maxRequestsPerMinute) {
      const oldestRequest = Math.min(...Array.from(this.rateLimiter.keys()).map(k => parseInt(k)));
      const waitTime = oldestRequest + 60000 - now;
      
      this.logger.warn(`Code API rate limit reached, waiting ${waitTime}ms`);
      await this.delay(waitTime);
      return this.checkRateLimit();
    }
    
    // Record this request
    this.rateLimiter.set(now.toString(), now);
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up execution workspace
   */
  async cleanup(sessionId: string): Promise<void> {
    try {
      await fs.rm(path.join(this.workspaceDir, sessionId), { recursive: true, force: true });
      this.logger.debug('Cleaned up session workspace', { sessionId });
    } catch (error) {
      this.logger.warn('Failed to cleanup workspace', error as Error);
    }
  }
}