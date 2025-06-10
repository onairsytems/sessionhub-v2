import { SessionService } from '@/src/services/SessionService';
import { GitVersioningService } from '@/src/services/GitVersioningService';
// import { SupabaseService } from '@/src/services/cloud/SupabaseService';
// import { LocalCacheService } from '@/src/services/cache/LocalCacheService';
import { InstructionProtocol } from '@/src/models/Instruction';
import { ExecutionResult } from '@/src/models/ExecutionResult';
import { v4 as uuidv4 } from 'uuid';

/**
 * Session 2.1 Infrastructure Validation Test
 * Tests all requirements for the session infrastructure foundation
 */

async function validateSessionInfrastructure() {
  console.log('🔍 Session 2.1 Infrastructure Validation');
  console.log('=====================================\n');

  const results: { test: string; status: 'PASS' | 'FAIL'; error?: string }[] = [];

  // Initialize services
  const sessionService = SessionService.getInstance();
  const gitService = GitVersioningService.getInstance();
  // const supabaseService = SupabaseService.getInstance();
  // const cacheService = LocalCacheService.getInstance();

  // Test 1: Create and persist session
  try {
    console.log('1. Testing session creation and persistence...');
    const sessionRequest = {
      id: uuidv4(),
      sessionId: '',
      userId: 'test-user',
      content: 'Test session for infrastructure validation',
      context: { test: true },
      timestamp: new Date().toISOString()
    };

    const metadata = {
      name: 'Test Session',
      description: 'Infrastructure validation test',
      tags: ['test', 'validation'],
      projectId: 'test-project'
    };

    const session = await sessionService.createSession(sessionRequest, metadata);
    
    if (session && session.id) {
      results.push({ test: 'Session Creation', status: 'PASS' });
      
      // Test persistence by retrieving the session
      const retrieved = await sessionService.getSession(session.id);
      if (retrieved && retrieved.id === session.id) {
        results.push({ test: 'Session Persistence', status: 'PASS' });
      } else {
        results.push({ test: 'Session Persistence', status: 'FAIL', error: 'Could not retrieve session' });
      }

      // Test 2: Search functionality
      console.log('2. Testing session search...');
      const searchResults = await sessionService.searchSessions({
        userId: 'test-user',
        searchTerm: 'infrastructure'
      });

      if (searchResults.some(s => s.id === session.id)) {
        results.push({ test: 'Session Search', status: 'PASS' });
      } else {
        results.push({ test: 'Session Search', status: 'FAIL', error: 'Session not found in search' });
      }

      // Test 3: Workflow transitions
      console.log('3. Testing workflow transitions...');
      
      // Transition to planning
      await sessionService.handoffToPlanningActor(session);
      const planningSession = await sessionService.getSession(session.id);
      
      if (planningSession?.status === 'planning') {
        results.push({ test: 'Planning Handoff', status: 'PASS' });
      } else {
        results.push({ test: 'Planning Handoff', status: 'FAIL', error: 'Status not updated to planning' });
      }

      // Transition to execution
      const mockInstructions: InstructionProtocol = {
        metadata: {
          id: uuidv4(),
          sessionId: session.id,
          sessionName: session.name,
          timestamp: new Date().toISOString(),
          version: '1.0',
          actor: 'planning'
        },
        context: {
          description: 'Test instruction',
          prerequisites: [],
          userRequest: 'Test request'
        },
        objectives: [{
          id: '1',
          primary: 'Test objective',
          measurable: true
        }],
        requirements: [{
          id: '1',
          description: 'Test requirement',
          priority: 'must'
        }],
        deliverables: [{
          type: 'file',
          description: 'Test deliverable'
        }],
        constraints: {},
        successCriteria: [{
          id: '1',
          criterion: 'Test passes',
          validationMethod: 'unit test',
          automated: true
        }]
      };
      
      await sessionService.handoffToExecutionActor(session, mockInstructions);
      const executingSession = await sessionService.getSession(session.id);
      
      if (executingSession?.status === 'executing') {
        results.push({ test: 'Execution Handoff', status: 'PASS' });
      } else {
        results.push({ test: 'Execution Handoff', status: 'FAIL', error: 'Status not updated to executing' });
      }

      // Complete session
      const mockResult: ExecutionResult = {
        sessionId: session.id,
        instructionId: mockInstructions.metadata.id,
        status: 'success',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 1000,
        deliverables: [],
        tasks: [],
        logs: [],
        errors: [],
        warnings: [],
        metrics: {
          totalTasks: 1,
          tasksCompleted: 1,
          tasksFailed: 0,
          tasksSkipped: 0,
          filesCreated: 0,
          filesModified: 0,
          linesAdded: 0,
          linesRemoved: 0,
          memoryUsed: 1024,
          cpuTime: 1000
        }
      };
      
      await sessionService.completeSession(session, mockResult);
      const completedSession = await sessionService.getSession(session.id);
      
      if (completedSession?.status === 'completed') {
        results.push({ test: 'Session Completion', status: 'PASS' });
      } else {
        results.push({ test: 'Session Completion', status: 'FAIL', error: 'Status not updated to completed' });
      }

      // Test 4: Analytics
      console.log('4. Testing analytics...');
      const analytics = await sessionService.getAnalytics('test-user');
      
      if (analytics && analytics.totalSessions > 0) {
        results.push({ test: 'Analytics Generation', status: 'PASS' });
      } else {
        results.push({ test: 'Analytics Generation', status: 'FAIL', error: 'No analytics data' });
      }

      // Test 5: Git versioning
      console.log('5. Testing Git versioning...');
      const history = await gitService.getSessionHistory(session.id);
      
      if (history && history.length > 0) {
        results.push({ test: 'Git Versioning', status: 'PASS' });
      } else {
        results.push({ test: 'Git Versioning', status: 'FAIL', error: 'No Git history found' });
      }

      // Test 6: Templates
      console.log('6. Testing session templates...');
      const template = await sessionService.createTemplate(completedSession!, {
        name: 'Test Template',
        category: 'testing',
        isPublic: false
      });
      
      if (template && template.id) {
        results.push({ test: 'Template Creation', status: 'PASS' });
        
        // Create session from template
        const fromTemplate = await sessionService.createSessionFromTemplate(
          template.id,
          'test-user-2'
        );
        
        if (fromTemplate && fromTemplate.id) {
          results.push({ test: 'Session from Template', status: 'PASS' });
        } else {
          results.push({ test: 'Session from Template', status: 'FAIL', error: 'Could not create from template' });
        }
      } else {
        results.push({ test: 'Template Creation', status: 'FAIL', error: 'Template not created' });
      }

      // Test 7: Export/Import
      console.log('7. Testing export/import...');
      const exportData = await sessionService.exportSession(session.id);
      
      if (exportData && exportData.includes(session.id)) {
        results.push({ test: 'Session Export', status: 'PASS' });
        
        // Import session
        const imported = await sessionService.importSession(exportData, 'test-user-3');
        
        if (imported && imported.id !== session.id) {
          results.push({ test: 'Session Import', status: 'PASS' });
        } else {
          results.push({ test: 'Session Import', status: 'FAIL', error: 'Import failed or same ID' });
        }
      } else {
        results.push({ test: 'Session Export', status: 'FAIL', error: 'Export data invalid' });
      }

      // Cleanup test session
      await sessionService.deleteSession(session.id);

    } else {
      results.push({ test: 'Session Creation', status: 'FAIL', error: 'Session not created' });
    }

  } catch (error) {
    console.error('Test error:', error);
    results.push({ test: 'Overall Test', status: 'FAIL', error: (error as Error).message });
  }

  // Print results
  console.log('\n📊 Validation Results:');
  console.log('====================');
  
  let passCount = 0;
  let failCount = 0;
  
  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${result.test}: ${result.status}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    if (result.status === 'PASS') passCount++;
    else failCount++;
  });

  console.log('\n📈 Summary:');
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Success Rate: ${((passCount / results.length) * 100).toFixed(1)}%`);

  return failCount === 0;
}

// Run validation if called directly
if (require.main === module) {
  validateSessionInfrastructure()
    .then(success => {
      if (success) {
        console.log('\n✅ Session 2.1 Infrastructure Validation PASSED!');
        process.exit(0);
      } else {
        console.log('\n❌ Session 2.1 Infrastructure Validation FAILED!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Validation Error:', error);
      process.exit(1);
    });
}

export { validateSessionInfrastructure };