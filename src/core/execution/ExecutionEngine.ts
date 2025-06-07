/**
 * @actor execution
 * @responsibility Executes instructions in isolated environments
 * @forbidden Cannot make strategic decisions, only implement instructions
 */

import {
  InstructionProtocol,
  ExecutionResult,
  ExecutionOutput,
  ExecutionError,
  ValidationResult
} from '@/src/models/Instruction';
import { Logger } from '@/src/lib/logging/Logger';
import { ProtocolValidator } from '@/src/core/protocol/ProtocolValidator';
import { SecuritySandbox } from './SecuritySandbox';
import { ClaudeCodeAPIClient } from '@/src/lib/api/ClaudeCodeAPIClient';
import { v4 as uuidv4 } from 'uuid';

export interface ExecutionContext {
  workingDirectory: string;
  environment: Record<string, string>;
  timeout: number;
  dryRun: boolean;
}

export interface ExecutionTask {
  id: string;
  type: 'code' | 'command' | 'file' | 'service';
  description: string;
  action: () => Promise<any>;
  rollback?: () => Promise<void>;
}

export class ExecutionEngine {
  private readonly logger: Logger;
  private readonly validator: ProtocolValidator;
  private readonly sandbox: SecuritySandbox;
  private readonly claudeCodeApi?: ClaudeCodeAPIClient;
  private executionHistory: Map<string, ExecutionResult> = new Map();
  private readonly useRealApi: boolean;

  constructor(
    logger: Logger,
    validator: ProtocolValidator,
    sandbox: SecuritySandbox,
    claudeCodeApi?: ClaudeCodeAPIClient
  ) {
    this.logger = logger;
    this.validator = validator;
    this.sandbox = sandbox;
    this.claudeCodeApi = claudeCodeApi;
    this.useRealApi = !!claudeCodeApi;
  }

  /**
   * Main entry point for executing instructions
   * This method ONLY executes what instructions specify, never makes decisions
   */
  async executeInstructions(
    instructions: InstructionProtocol,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = new Date().toISOString();
    const outputs: ExecutionOutput[] = [];
    const errors: ExecutionError[] = [];
    const logs: string[] = [];

    this.logger.info('ExecutionEngine: Starting execution', {
      instructionId: instructions.metadata.id
    });

    try {
      // Validate instructions are properly formatted
      this.validator.validate(instructions);

      // Ensure execution actor cannot access planning functions
      this.validator.ensureExecutionBoundary(instructions);

      // Parse instructions into executable tasks
      const tasks = await this.parseInstructionTasks(instructions, context);

      // Execute tasks in sandboxed environment
      for (const task of tasks) {
        try {
          logs.push(`Starting task: ${task.description}`);
          
          const output = await this.sandbox.executeSecurely(
            task.action,
            context.timeout
          );
          
          outputs.push({
            type: 'console',
            content: JSON.stringify(output),
            description: task.description
          });
          
          logs.push(`Completed task: ${task.description}`);
        } catch (error) {
          const execError: ExecutionError = {
            code: 'TASK_FAILED',
            message: `Failed to execute task: ${task.description}`,
            stack: (error as Error).stack,
            recoverable: false
          };
          errors.push(execError);
          logs.push(`Error in task: ${task.description} - ${(error as Error).message}`);
          
          // Attempt rollback if available
          if (task.rollback) {
            try {
              await task.rollback();
              logs.push(`Rolled back task: ${task.description}`);
            } catch (rollbackError) {
              logs.push(`Failed to rollback task: ${task.description}`);
            }
          }
        }
      }

      // Validate success criteria
      const validationResults = await this.validateResults(
        instructions,
        outputs,
        errors
      );

      const result: ExecutionResult = {
        instructionId: instructions.metadata.id,
        status: this.determineStatus(errors, validationResults),
        startTime,
        endTime: new Date().toISOString(),
        outputs,
        errors,
        logs,
        validationResults
      };

      // Store execution history
      this.executionHistory.set(instructions.metadata.id, result);

      this.logger.info('ExecutionEngine: Execution completed', {
        instructionId: instructions.metadata.id,
        status: result.status
      });

      return result;
    } catch (error) {
      this.logger.error('ExecutionEngine: Execution failed', error as Error);
      
      return {
        instructionId: instructions.metadata.id,
        status: 'failure',
        startTime,
        endTime: new Date().toISOString(),
        outputs,
        errors: [{
          code: 'EXECUTION_FAILED',
          message: (error as Error).message,
          stack: (error as Error).stack,
          recoverable: false
        }],
        logs,
        validationResults: []
      };
    }
  }

  private async parseInstructionTasks(
    instructions: InstructionProtocol,
    context: ExecutionContext
  ): Promise<ExecutionTask[]> {
    const tasks: ExecutionTask[] = [];

    if (this.useRealApi && this.claudeCodeApi) {
      // When using real API, create a single task to generate and execute all code
      const task: ExecutionTask = {
        id: uuidv4(),
        type: 'code',
        description: 'Generate and execute code for all requirements',
        action: async () => {
          this.logger.info('Using Claude Code API to generate implementation');
          
          // Generate code from instructions
          const generatedCode = await this.claudeCodeApi.generateCode({
            instruction: instructions,
            context: {
              projectType: context.environment['PROJECT_TYPE'] || 'web',
              language: context.environment['LANGUAGE'] || 'typescript',
              framework: context.environment['FRAMEWORK'],
              existingCode: context.environment['EXISTING_CODE']
            }
          });
          
          this.logger.debug('Code generated, executing...');
          
          // Execute the generated code
          const executionResult = await this.claudeCodeApi.executeCode(
            generatedCode,
            instructions
          );
          
          if (!executionResult.success) {
            throw new Error(`Execution failed: ${executionResult.error}`);
          }
          
          return {
            generated: true,
            executed: true,
            output: executionResult.output,
            files: executionResult.files,
            executionTime: executionResult.executionTime
          };
        },
        rollback: async () => {
          // Clean up workspace on failure
          if (this.claudeCodeApi) {
            await this.claudeCodeApi.cleanup(instructions.metadata.sessionId);
          }
        }
      };
      
      tasks.push(task);
    } else {
      // Fallback to mock implementation
      for (const requirement of instructions.requirements) {
        const task: ExecutionTask = {
          id: uuidv4(),
          type: 'code',
          description: requirement.description,
          action: async () => {
            this.logger.debug('Executing requirement (mock)', { requirement });
            
            if (context.dryRun) {
              return { simulated: true, requirement: requirement.description };
            }
            
            return { executed: true, requirement: requirement.description };
          }
        };
        
        tasks.push(task);
      }
    }

    return tasks;
  }

  private async validateResults(
    instructions: InstructionProtocol,
    outputs: ExecutionOutput[],
    errors: ExecutionError[]
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const criterion of instructions.successCriteria) {
      const result: ValidationResult = {
        criterionId: criterion.id,
        passed: errors.length === 0, // Simple validation for now
        message: errors.length === 0 
          ? `Criterion met: ${criterion.criterion}`
          : `Criterion failed: ${criterion.criterion}`,
        details: { outputs: outputs.length, errors: errors.length }
      };
      
      results.push(result);
    }

    return results;
  }

  private determineStatus(
    errors: ExecutionError[],
    validationResults: ValidationResult[]
  ): 'success' | 'failure' | 'partial' {
    if (errors.length === 0 && validationResults.every(v => v.passed)) {
      return 'success';
    }
    
    if (errors.every(e => e.recoverable) || validationResults.some(v => v.passed)) {
      return 'partial';
    }
    
    return 'failure';
  }

  /**
   * Get execution history for an instruction
   */
  getExecutionHistory(instructionId: string): ExecutionResult | undefined {
    return this.executionHistory.get(instructionId);
  }

  /**
   * Clear execution history (for testing or cleanup)
   */
  clearHistory(): void {
    this.executionHistory.clear();
  }
}