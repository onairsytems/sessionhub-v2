#!/usr/bin/env ts-node

import { ProjectContextService } from '@/src/services/intelligence/ProjectContextService';
import { Logger } from '@/src/lib/logging/Logger';
// import * as path from 'path';

const logger = new Logger('ContextManagementTest');

async function testContextExtraction() {
  logger.info('Testing Enhanced Project Context Management...');
  
  try {
    const contextService = ProjectContextService.getInstance();
    const projectPath = process.cwd();
    const projectId = 'test-project-001';
    
    logger.info('Analyzing project context...');
    const result = await contextService.analyzeProjectContext(projectPath, projectId);
    
    logger.info('Context Analysis Result:', {
      projectType: result.context.projectType,
      language: result.context.language,
      frameworks: result.context.frameworks.map((f: any) => ({
        name: f.name,
        confidence: f.confidence
      })),
      architecturePatterns: result.context.architecturePatterns.map((p: any) => ({
        pattern: p.pattern,
        confidence: p.confidence
      })),
      summary: result.context.summary,
      confidence: result.confidence
    });
    
    // Test context retrieval for Planning Actor
    logger.info('Testing context retrieval for Planning Actor...');
    const planningContext = await contextService.getContextForPlanning(projectId);
    
    if (planningContext) {
      logger.info('Successfully retrieved context for planning:', {
        projectType: planningContext.projectType,
        hasEmbeddings: !!planningContext.embeddings,
        frameworkCount: planningContext.frameworks.length,
        libraryCount: planningContext.libraries.length
      });
    }
    
    // Test similar context search
    logger.info('Testing similar context search...');
    const similarContexts = await contextService.searchSimilarContexts(result.context, 3);
    logger.info(`Found ${similarContexts.length} similar contexts`);
    
    logger.info('✅ Context Management Test Completed Successfully');
    
  } catch (error) {
    logger.error('❌ Context Management Test Failed:', error as Error);
    process.exit(1);
  }
}

// Run the test
testContextExtraction().catch(error => {
  logger.error('Test execution failed:', error);
  process.exit(1);
});