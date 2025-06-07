
/**
 * Example usage of SupabaseService
 * Demonstrates how to use the service for various operations
 */

import { supabaseService } from './SupabaseService';
import { Logger } from '@/src/lib/logging/Logger';

async function exampleUsage() {
  const logger = new Logger('SupabaseExample');

  try {
    // Step 1: Configure credentials (first-time setup)
    // In production, these would come from environment variables or user input
    await supabaseService.configureCredentials(
      'https://your-project.supabase.co',
      'your-anon-key',
      'your-service-key' // optional
    );

    // Step 2: Initialize the service
    await supabaseService.initialize();

    // Step 3: Authentication
    const { user, session: _session } = await supabaseService.signIn('user@example.com', 'password');
    logger.info('User signed in', { userId: user?.id });

    // Step 4: Create a project
    const project = await supabaseService.createProject({
      name: 'My Next.js App',
      path: '/Users/username/projects/my-app',
      type: 'nextjs',
      metadata: {
        framework: 'Next.js 14',
        typescript: true
      }
    });
    logger.info('Project created', { projectId: project.id });

    // Step 5: Create a session
    const newSession = await supabaseService.createSession({
      user_id: user!.id,
      project_id: project.id!,
      title: 'Initial setup and configuration',
      description: 'Setting up the project structure and dependencies'
    });
    logger.info('Session created', { sessionId: newSession.id });

    // Step 6: Create an instruction
    const instruction = await supabaseService.createInstruction({
      session_id: newSession.id!,
      type: 'code_generation',
      content: 'Create a new React component for user authentication',
      sequence_number: 1,
      metadata: {
        component_name: 'AuthForm',
        features: ['login', 'signup', 'password-reset']
      }
    });
    logger.info('Instruction created', { instructionId: instruction.id });

    // Step 7: Create an execution result
    const executionResult = await supabaseService.createExecutionResult({
      instruction_id: instruction.id!,
      status: 'running',
      started_at: new Date().toISOString()
    });

    // Simulate execution
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Update execution result
    await supabaseService.updateExecutionResult(executionResult.id, {
      status: 'success',
      completed_at: new Date().toISOString(),
      outputs: {
        files_created: ['components/AuthForm.tsx', 'components/AuthForm.module.css'],
        lines_of_code: 250
      }
    });

    // Step 8: Create a pattern from successful execution
    // const pattern = await supabaseService.createPattern({ // Commented out for future use
    //   pattern_type: 'code_pattern',
    //   description: 'React authentication component with hooks',
    //   project_id: project.id,
    //   metadata: {
    //     framework: 'React',
    //     features: ['hooks', 'form-validation', 'error-handling']
    //   }
    // });

    // Step 9: Query data
    const projectSessions = await supabaseService.getProjectSessions(project.id);
    logger.info('Project sessions', { count: projectSessions.length });

    const sessionInstructions = await supabaseService.getSessionInstructions(newSession.id);
    logger.info('Session instructions', { count: sessionInstructions.length });

    const patterns = await supabaseService.getPatterns({ projectId: project.id });
    logger.info('Project patterns', { count: patterns.length });

    // Step 10: Get session statistics
    const stats = await supabaseService.getSessionStatistics(newSession.id);
    logger.info('Session statistics', stats);

    // Step 11: Handle offline mode
    if (!supabaseService.isServiceOnline()) {
      logger.warn('Service is offline, operations will be queued');
    }

    const queueSize = supabaseService.getOfflineQueueSize();
    if (queueSize > 0) {
      logger.info(`${queueSize} operations pending in offline queue`);
    }

    // Step 12: Cleanup (when app closes)
    await supabaseService.cleanup();

  } catch (error) {
    logger.error('Example failed', error as Error);
  }
}

// Error handling example
async function errorHandlingExample() {
  try {
    await supabaseService.initialize();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Missing Supabase credentials')) {
        // Prompt user to configure credentials
        console.log('Please configure your Supabase credentials first');
      } else if (error.message.includes('Failed to connect')) {
        // Handle connection errors
        console.log('Unable to connect to Supabase. Check your internet connection.');
      }
    }
  }
}

// Offline mode example
async function offlineModeExample() {
  // Operations will be queued when offline
  try {
    await supabaseService.createProject({
      name: 'Offline Project',
      path: '/path/to/project',
      type: 'react'
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Offline mode')) {
      console.log('Operation queued for when connection is restored');
    }
  }
}

// Export the examples
export { exampleUsage, errorHandlingExample, offlineModeExample };