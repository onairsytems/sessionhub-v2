/**
 * Error Detection System
 * Comprehensive error detection and prevention for SessionHub
 */

export { ErrorDetectionEngine } from './ErrorDetectionEngine';
export { ErrorCatalog } from './ErrorCatalog';
export { RealTimeMonitor } from './RealTimeMonitor';
export { BuildValidator } from './BuildValidator';
export { CICDIntegration } from './CICDIntegration';
export * from './types';

// Re-export for convenience
import { ErrorDetectionEngine } from './ErrorDetectionEngine';
import { RealTimeMonitor } from './RealTimeMonitor';
import { BuildValidator } from './BuildValidator';
// import { CICDIntegration } from './CICDIntegration'; // Commented out for future use
import { ErrorDetectionConfig } from './types';

/**
 * Create and configure the complete error detection system
 */
export function createErrorDetectionSystem(config?: Partial<ErrorDetectionConfig>) {
  const engine = new ErrorDetectionEngine();
  
  const monitor = new RealTimeMonitor(engine, {
    enableAutoFix: config?.enableRealTime ?? true,
    ignoredPaths: config?.ignoredFiles ?? []
  });

  const validator = new BuildValidator(engine, {
    failOnWarning: config?.strictMode ?? false
  });

  return {
    engine,
    monitor,
    validator,
    
    // Convenience methods
    async start() {
      if (config?.enableRealTime !== false) {
        await monitor.start();
      }
    },
    
    async stop() {
      await monitor.stop();
    },
    
    async validate() {
      return validator.validateBuild();
    },
    
    async validateFile(filePath: string) {
      return engine.detectErrors(filePath);
    },
    
    getErrorSummary() {
      return monitor.getErrorSummary();
    }
  };
}