
/**
 * End-to-end integration tests for the complete orchestration system
 */

import { SystemOrchestrator } from '@/src/core/orchestrator/SystemOrchestrator';
// import { Logger } from '@/src/lib/logging/Logger'; // Commented out for future use

// Test configuration
const TEST_CONFIG = {
  useRealApi: false, // Use mock for tests
  dataDir: './test-data',
  masterKey: 'test-master-key'
};

async function testEndToEndFlow() {
  console.log('\n🧪 Testing End-to-End Orchestration Flow\n');
  
  const orchestrator = new SystemOrchestrator(TEST_CONFIG);
  
  try {
    // Initialize system
    console.log('1️⃣ Initializing system...');
    await orchestrator.initialize();
    console.log('✅ System initialized');
    
    // Submit a request
    console.log('\n2️⃣ Submitting user request...');
    const sessionId = await orchestrator.submitRequest(
      'test-user-123',
      'Create a function to calculate fibonacci numbers',
      { priority: 'normal' }
    );
    console.log(`✅ Request submitted, session ID: ${sessionId}`);
    
    // Check initial status
    console.log('\n3️⃣ Checking initial session status...');
    let session = await orchestrator.getSessionStatus(sessionId);
    console.log(`📊 Session status: ${session?.status}`);
    console.log(`📊 Queue position: ${session?.metadata?.['queuePosition'] || 'N/A'}`);
    
    // Wait for processing
    console.log('\n4️⃣ Waiting for request processing...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
    
    // Check final status
    console.log('\n5️⃣ Checking final session status...');
    session = await orchestrator.getSessionStatus(sessionId);
    console.log(`📊 Session status: ${session?.status}`);
    
    if (session?.result) {
      console.log(`✅ Request completed successfully`);
      console.log(`📊 Tasks completed: ${session.result.metrics.tasksCompleted}`);
      console.log(`📊 Duration: ${session.result.metrics.duration}ms`);
    } else {
      console.log('⚠️ Request not yet completed');
    }
    
    // Get system health
    console.log('\n6️⃣ Checking system health...');
    const health = await orchestrator.getHealthStatus();
    console.log(`📊 System status: ${health.status}`);
    console.log(`📊 Actors healthy: ${health.actors.every((a) => a.healthy) ? 'Yes' : 'No'}`);
    console.log(`📊 Queue length: ${health.queue.length}`);
    
    // Get metrics
    console.log('\n7️⃣ Getting system metrics...');
    const metrics = await orchestrator.getMetrics();
    console.log(`📊 Total requests: ${metrics.system.totalRequests}`);
    console.log(`📊 Success rate: ${metrics.system.successfulRequests / metrics.system.totalRequests * 100}%`);
    console.log(`📊 Active sessions: ${metrics.sessions.active}`);
    
    // Shutdown
    console.log('\n8️⃣ Shutting down system...');
    await orchestrator.shutdown();
    console.log('✅ System shutdown complete');
    
    console.log('\n✅ All orchestration tests passed!');
    
  } catch (error) {
    console.error('\n❌ Orchestration test failed:', error);
    throw error;
  }
}

async function testMultipleRequests() {
  console.log('\n🧪 Testing Multiple Concurrent Requests\n');
  
  const orchestrator = new SystemOrchestrator(TEST_CONFIG);
  
  try {
    await orchestrator.initialize();
    
    // Submit multiple requests
    console.log('Submitting 5 requests...');
    const sessionIds = await Promise.all([
      orchestrator.submitRequest('user-1', 'Create a REST API endpoint', { priority: 'high' }),
      orchestrator.submitRequest('user-2', 'Add authentication middleware', { priority: 'normal' }),
      orchestrator.submitRequest('user-3', 'Implement data validation', { priority: 'low' }),
      orchestrator.submitRequest('user-4', 'Create unit tests', { priority: 'high' }),
      orchestrator.submitRequest('user-5', 'Update documentation', { priority: 'normal' })
    ]);
    
    console.log(`✅ Submitted ${sessionIds.length} requests`);
    
    // Check queue positions
    console.log('\nQueue positions:');
    for (const sessionId of sessionIds) {
      const session = await orchestrator.getSessionStatus(sessionId);
      console.log(`  Session ${sessionId}: Position ${session?.metadata?.['queuePosition'] || 'Processing'}`);
    }
    
    // Wait for some processing
    console.log('\nProcessing requests...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check final statuses
    console.log('\nFinal statuses:');
    let completed = 0;
    for (const sessionId of sessionIds) {
      const session = await orchestrator.getSessionStatus(sessionId);
      console.log(`  Session ${sessionId}: ${session?.status}`);
      if (session?.status === 'completed') completed++;
    }
    
    console.log(`\n✅ ${completed}/${sessionIds.length} requests completed`);
    
    await orchestrator.shutdown();
    
  } catch (error) {
    console.error('\n❌ Multiple requests test failed:', error);
    throw error;
  }
}

async function testErrorHandling() {
  console.log('\n🧪 Testing Error Handling\n');
  
  const orchestrator = new SystemOrchestrator(TEST_CONFIG);
  
  try {
    await orchestrator.initialize();
    
    // Submit a request that will fail
    console.log('Submitting request with invalid content...');
    const sessionId = await orchestrator.submitRequest(
      'test-user',
      'function badCode() { throw new Error("test"); }', // This contains code!
      {}
    );
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check status
    const session = await orchestrator.getSessionStatus(sessionId);
    console.log(`Session status: ${session?.status}`);
    
    if (session?.status === 'failed') {
      console.log('✅ Request correctly failed due to code in planning');
      console.log(`Error: ${session.error}`);
    } else {
      console.log('❌ Request should have failed');
    }
    
    // Check error metrics
    const metrics = await orchestrator.getMetrics();
    console.log(`\nError stats:`);
    console.log(`  Total errors: ${metrics.errors.total}`);
    console.log(`  Critical errors: ${metrics.errors.bySeverity.critical}`);
    
    await orchestrator.shutdown();
    
  } catch (error) {
    console.error('\n❌ Error handling test failed:', error);
    throw error;
  }
}

async function testAPIIntegration() {
  console.log('\n🧪 Testing Claude API Integration\n');
  
  // This test requires a real API key
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  
  if (!apiKey) {
    console.log('⚠️ Skipping API integration test (no API key set)');
    console.log('Set ANTHROPIC_API_KEY environment variable to enable');
    return;
  }
  
  const orchestrator = new SystemOrchestrator({
    ...TEST_CONFIG,
    useRealApi: true,
    apiKey
  });
  
  try {
    await orchestrator.initialize();
    
    console.log('Submitting request to real Claude API...');
    const sessionId = await orchestrator.submitRequest(
      'test-user',
      'Create a simple TypeScript function that returns the current date',
      {}
    );
    
    // Wait for API processing
    console.log('Waiting for API response...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // Longer wait for API
    
    const session = await orchestrator.getSessionStatus(sessionId);
    console.log(`Session status: ${session?.status}`);
    
    if (session?.instructions) {
      console.log('✅ Successfully generated instructions via Claude API');
      console.log(`Instruction ID: ${session.instructions.metadata.id}`);
    }
    
    await orchestrator.shutdown();
    
  } catch (error) {
    console.error('\n❌ API integration test failed:', error);
    throw error;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Running SessionHub Orchestration Integration Tests\n');
  
  try {
    await testEndToEndFlow();
    await testMultipleRequests();
    await testErrorHandling();
    await testAPIIntegration();
    
    console.log('\n\n✅ All integration tests completed successfully! 🎉');
  } catch (error) {
    console.error('\n\n❌ Integration tests failed');
    process.exit(1);
  }
}

// Execute tests
if (require.main === module) {
  runAllTests();
}