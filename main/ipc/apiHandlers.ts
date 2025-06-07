import { ipcMain, dialog } from 'electron';
import { MacKeychainService } from '../services/mac/MacKeychainService';
import { ClaudeAPIClient } from '../../src/lib/api/ClaudeAPIClient';
import Store from 'electron-store';

const store = new Store();
const keychainService = new MacKeychainService();

export function registerApiHandlers() {
  // Check if API key exists
  ipcMain.handle('check-api-key', async () => {
    try {
      const apiKey = await keychainService.getCredential('sessionhub', 'claude-api-key');
      return !!apiKey;
    } catch (error) {
      return false;
    }
  });

  // Validate API key
  ipcMain.handle('validate-api-key', async (_event, apiKey: string) => {
    try {
      const client = new ClaudeAPIClient({ apiKey });
      // Test the API key with a simple request
      await client.sendMessage('Hello', 'test-validation');
      return true;
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  });

  // Save API key to keychain
  ipcMain.handle('save-api-key', async (_event, apiKey: string) => {
    try {
      await keychainService.setCredential('sessionhub', 'claude-api-key', apiKey);
      return true;
    } catch (error) {
      console.error('Failed to save API key:', error);
      throw error;
    }
  });

  // Send chat message
  ipcMain.handle('send-chat-message', async (_event, sessionId: string, message: string) => {
    try {
      const apiKey = await keychainService.getCredential('sessionhub', 'claude-api-key');
      if (!apiKey) {
        throw new Error('API key not found');
      }

      const client = new ClaudeAPIClient({ apiKey });
      
      // Get conversation history
      const history = store.get(`sessions.${sessionId}.messages`, []) as any[];
      
      // Add user message to history
      history.push({ role: 'user', content: message });
      
      // Send to Claude API
      const response = await client.sendMessage(message, sessionId, history);
      
      // Add assistant response to history
      history.push({ role: 'assistant', content: response });
      
      // Save updated history
      store.set(`sessions.${sessionId}.messages`, history);
      
      return response;
    } catch (error) {
      console.error('Failed to send chat message:', error);
      throw error;
    }
  });

  // GitHub repository selection dialog
  ipcMain.handle('select-github-repo', async () => {
    try {
      // Show dialog to input GitHub URL
      const result = await dialog.showMessageBox({
        type: 'question',
        buttons: ['Cancel', 'Import'],
        defaultId: 1,
        title: 'Import GitHub Repository',
        message: 'Enter the GitHub repository URL',
        detail: 'Example: https://github.com/owner/repo'
      });

      if (result.response === 0) {
        return null;
      }

      // For demo purposes, return mock data
      // In production, this would parse the URL and fetch repo details
      return {
        url: 'https://github.com/example/project',
        name: 'project',
        owner: 'example',
        defaultBranch: 'main'
      };
    } catch (error) {
      console.error('Failed to select GitHub repo:', error);
      return null;
    }
  });

  // Analyze repository
  ipcMain.handle('analyze-repository', async (_event, sessionId: string, repoInfo: any) => {
    try {
      const apiKey = await keychainService.getCredential('sessionhub', 'claude-api-key');
      if (!apiKey) {
        throw new Error('API key not found');
      }

      const client = new ClaudeAPIClient({ apiKey });
      
      // Create analysis prompt
      const analysisPrompt = `Please analyze this GitHub repository: ${repoInfo.url}
Repository: ${repoInfo.owner}/${repoInfo.name}
Default Branch: ${repoInfo.defaultBranch}

Provide a comprehensive analysis including:
1. Project structure and architecture
2. Main technologies and frameworks used
3. Key features and functionality
4. Code quality observations
5. Potential improvements or issues
6. Recommendations for development approach`;

      const response = await client.sendMessage(analysisPrompt, sessionId);
      
      return response;
    } catch (error) {
      console.error('Failed to analyze repository:', error);
      throw error;
    }
  });
}