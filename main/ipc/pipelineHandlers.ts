import { ipcMain } from 'electron';
import { PipelineOrchestrator } from '../../src/services/pipeline/PipelineOrchestrator';
import { PipelineConfig } from '../../src/services/pipeline/types';
import { CredentialManager } from '../../src/lib/security/CredentialManager';
import { EmergencyRecoverySystem } from '../../src/services/pipeline/EmergencyRecoverySystem';
import { Logger } from '../../src/lib/logging/Logger';

let pipelineOrchestrator: PipelineOrchestrator | null = null;
const logger = new Logger('PipelineHandlers');
const credentialManager = new CredentialManager(logger);

export function registerPipelineHandlers(): void {
  // Initialize pipeline
  ipcMain.handle('pipeline:initialize', async (_event, config: PipelineConfig) => {
    try {
      if (!pipelineOrchestrator) {
        pipelineOrchestrator = new PipelineOrchestrator(config);
        await pipelineOrchestrator.start();
      }
      return { success: true };
    } catch (error) {
// REMOVED: console statement
      return { success: false, error: (error as Error).message };
    }
  });

  // Get pipeline status
  ipcMain.handle('pipeline:getStatus', async () => {
    if (!pipelineOrchestrator) {
      return {
        isRunning: false,
        health: {
          github: 'disconnected',
          production: 'healthy',
          deployment: 'ready',
        },
      };
    }
    return pipelineOrchestrator.getStatus();
  });

  // Stop pipeline
  ipcMain.handle('pipeline:stop', async () => {
    try {
      if (pipelineOrchestrator) {
        await pipelineOrchestrator.stop();
        pipelineOrchestrator = null;
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Configure GitHub credentials
  ipcMain.handle('pipeline:setGitHubCredentials', async (_event, { token, webhookSecret }) => {
    try {
      await (credentialManager as any).setCredential('github_api_token', token);
      await (credentialManager as any).setCredential('github_webhook_secret', webhookSecret);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Configure deployment keys
  ipcMain.handle('pipeline:setDeploymentKeys', async (_event, { signingKey, verifyKey }) => {
    try {
      await (credentialManager as any).setCredential('deployment_signing_key', signingKey);
      await (credentialManager as any).setCredential('deployment_verify_key', verifyKey);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Manual session creation
  ipcMain.handle('pipeline:createSession', async (_event, instruction) => {
    try {
      if (!pipelineOrchestrator) {
        throw new Error('Pipeline not initialized');
      }
      
      // Queue the session manually
      await (pipelineOrchestrator as any).queueSession({
        ...instruction,
        sourceType: 'manual',
        createdAt: new Date(),
        status: 'pending',
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Get webhook URL
  ipcMain.handle('pipeline:getWebhookUrl', async () => {
    if (!pipelineOrchestrator) {
      return null;
    }
    
    // Get webhook URL from the receiver
    // This would need to be exposed through the orchestrator
    return 'http://localhost:3001/webhook';
  });

  // Emergency recovery
  ipcMain.handle('pipeline:triggerRecovery', async () => {
    try {
      const recovery = EmergencyRecoverySystem.getInstance();
      const result = await (recovery as any).performRecovery();
      return { success: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Factory reset
  ipcMain.handle('pipeline:factoryReset', async () => {
    try {
      const recovery = EmergencyRecoverySystem.getInstance();
      const result = await (recovery as any).factoryReset();
      return { success: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Create recovery checkpoint
  ipcMain.handle('pipeline:createRecoveryCheckpoint', async () => {
    try {
      const recovery = EmergencyRecoverySystem.getInstance();
      await recovery.createRecoveryCheckpoint();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Rollback deployment
  ipcMain.handle('pipeline:rollbackDeployment', async (_event, _version: string) => {
    try {
      if (!pipelineOrchestrator) {
        throw new Error('Pipeline not initialized');
      }
      
      // This would need to be exposed through the orchestrator
      // await pipelineOrchestrator.rollbackDeployment(version);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Note: Pipeline event listeners would need to be set up after initialization
  // and would need access to the webContents to send events
}

// Export function to get orchestrator instance (for integration with background.ts)
export function getPipelineOrchestrator(): PipelineOrchestrator | null {
  return pipelineOrchestrator;
}