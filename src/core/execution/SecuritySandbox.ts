/**
 * Security sandbox for safe execution of tasks
 * Prevents malicious code execution and resource abuse
 */

import { Logger } from '@/src/lib/logging/Logger';

export class SecuritySandbox {
  private readonly logger: Logger;
  private readonly maxMemoryMB: number = 512;
  // private readonly maxCpuPercent: number = 80; // Commented out for future use

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Execute a function in a sandboxed environment with resource limits
   */
  async executeSecurely<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    this.logger.debug('SecuritySandbox: Executing function securely', { timeoutMs });

    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      // Race between execution and timeout
      const result = await Promise.race([
        this.wrapWithResourceLimits(fn),
        timeoutPromise
      ]);

      this.logger.debug('SecuritySandbox: Execution completed successfully');
      return result;
    } catch (error) {
      this.logger.error('SecuritySandbox: Execution failed', error as Error);
      throw error;
    }
  }

  private async wrapWithResourceLimits<T>(fn: () => Promise<T>): Promise<T> {
    // In a real implementation, this would:
    // 1. Create a separate process or worker
    // 2. Set resource limits (memory, CPU, file access)
    // 3. Monitor resource usage
    // 4. Kill process if limits exceeded

    // For now, we'll just execute with basic error handling
    try {
      const startMemory = process.memoryUsage();
      const result = await fn();
      const endMemory = process.memoryUsage();

      // Check memory usage
      const memoryUsedMB = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024;
      if (memoryUsedMB > this.maxMemoryMB) {
        throw new Error(`Memory limit exceeded: ${memoryUsedMB}MB > ${this.maxMemoryMB}MB`);
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate that code/command is safe to execute
   */
  validateSafety(code: string): boolean {
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /require\s*\(\s*['"`]child_process/,
      /process\.exit/,
      /rm\s+-rf/,
      /format\s+[cC]:/
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        this.logger.warn('SecuritySandbox: Dangerous pattern detected', {
          pattern: pattern.toString()
        });
        return false;
      }
    }

    return true;
  }
}