import { ipcMain } from 'electron';
import { ProjectContextService } from '@/src/services/intelligence/ProjectContextService';
import { PatternRecognitionService } from '@/src/services/intelligence/PatternRecognitionService';
import { Logger } from '@/src/lib/logging/Logger';

const logger = new Logger('ContextHandlers');
const contextService = ProjectContextService.getInstance();
const patternService = new PatternRecognitionService();

export function registerContextHandlers() {
  // Analyze project context
  ipcMain.handle('analyze-project-context', async (_event, projectId: string, projectPath: string) => {
    try {
      logger.info(`Analyzing context for project: ${projectId}`);
      const result = await contextService.analyzeProjectContext(projectPath, projectId);
      return { success: true, data: result };
    } catch (error) {
      logger.error('Failed to analyze project context', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get project context
  ipcMain.handle('get-project-context', async (_event, projectId: string) => {
    try {
      const context = await contextService.getContextForPlanning(projectId);
      return { success: true, data: context };
    } catch (error) {
      logger.error('Failed to get project context', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Search similar contexts
  ipcMain.handle('search-similar-contexts', async (_event, projectId: string, limit: number = 5) => {
    try {
      const context = await contextService.getContextForPlanning(projectId);
      if (!context) {
        return { success: false, error: 'Context not found' };
      }
      
      const similar = await contextService.searchSimilarContexts(context, limit);
      return { success: true, data: similar };
    } catch (error) {
      logger.error('Failed to search similar contexts', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get patterns
  ipcMain.handle('get-patterns', async (_event, projectId?: string) => {
    try {
      let patterns;
      
      if (projectId) {
        // Get patterns relevant to a specific project
        const context = await contextService.getContextForPlanning(projectId);
        if (context) {
          const suggestions = await patternService.getSuggestionsForContext({
            projectType: context.projectType,
            language: context.language,
            framework: context.frameworks[0]?.name
          });
          
          patterns = suggestions.map(s => ({
            id: s.pattern.id,
            type: s.pattern.type,
            name: s.pattern.pattern,
            description: s.pattern.description || '',
            examples: s.pattern.examples || [],
            frequency: s.pattern.frequency,
            projects: (s.pattern as any).projectIds || [],
            confidence: s.relevanceScore
          }));
        } else {
          patterns = [];
        }
      } else {
        // Get all patterns
        const allPatterns = await (patternService as any).getAllPatterns();
        patterns = allPatterns.map((p: any) => ({
          id: p.id,
          type: p.type,
          name: p.pattern,
          description: p.description || '',
          examples: p.examples || [],
          frequency: p.frequency,
          projects: p.projectIds || [],
          confidence: p.successRate
        }));
      }
      
      return { success: true, data: patterns };
    } catch (error) {
      logger.error('Failed to get patterns', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Learn pattern from example
  ipcMain.handle('learn-pattern', async (_event, pattern: {
    type: string;
    pattern: string;
    example: string;
    projectId: string;
  }) => {
    try {
      await (patternService as any).learnPattern({
        type: pattern.type as any,
        pattern: pattern.pattern,
        example: pattern.example,
        projectId: pattern.projectId,
        context: {},
        timestamp: new Date()
      });
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to learn pattern', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Refresh context cache
  ipcMain.handle('refresh-context-cache', async (_event, projectId: string) => {
    try {
      // This will force a cache refresh by analyzing the project again
      const project = await getProjectById(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }
      
      const result = await contextService.analyzeProjectContext(project.path, projectId);
      return { success: true, data: result };
    } catch (error) {
      logger.error('Failed to refresh context cache', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  logger.info('Context handlers registered');
}

// Helper function to get project by ID (would be imported from project service)
async function getProjectById(_projectId: string): Promise<{ path: string } | null> {
  // This would typically query the database or project service
  // For now, returning a placeholder
  return null;
}