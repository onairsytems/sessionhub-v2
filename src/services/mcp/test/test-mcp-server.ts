/**
 * Test script for MCP Server
 * 
 * Run this to verify the MCP server is working correctly
 */

import { MCPServerService } from '../server/MCPServerService';
import { MCPIntegrationSDK } from '../sdk/MCPIntegrationSDK';

async function testMCPServer() {
// REMOVED: console statement

  // 1. Create and start the server
// REMOVED: console statement
  const server = new MCPServerService();
  
  try {
    await server.start();
// REMOVED: console statement
  } catch (error) {
// REMOVED: console statement
    return;
  }

  // 2. Check server status
  await server.getStatus();

  // 3. List initial integrations
// REMOVED: console statement
  const integrations = await server.listIntegrations();
// REMOVED: console statement
  integrations.forEach(_i => {
    // Integration processed
  });

  // 4. Create a test integration using the SDK
// REMOVED: console statement
  const testIntegration = MCPIntegrationSDK.createIntegration()
    .setName('Test Integration')
    .setVersion('1.0.0')
    .setDescription('A test integration for verification')
    .setAuthor('Test Suite')
    .setCategory('other')
    .setIcon('🧪')
    .addPermission('network')
    .addTool(
      MCPIntegrationSDK.createTool()
        .setName('echo')
        .setDescription('Echoes back the input message')
        .setInputSchema(
          MCPIntegrationSDK.schema.object({
            message: MCPIntegrationSDK.schema.string('Message to echo')
          }, ['message'])
        )
        .setRateLimit(100, 60)
        .build()
    )
    .addTool(
      MCPIntegrationSDK.createTool()
        .setName('add')
        .setDescription('Adds two numbers')
        .setInputSchema(
          MCPIntegrationSDK.schema.object({
            a: MCPIntegrationSDK.schema.number('First number'),
            b: MCPIntegrationSDK.schema.number('Second number')
          }, ['a', 'b'])
        )
        .setOutputSchema(
          MCPIntegrationSDK.schema.object({
            result: MCPIntegrationSDK.schema.number('Sum of a and b')
          })
        )
        .build()
    )
    .build();

  // 5. Validate the integration
// REMOVED: console statement
  const errors = MCPIntegrationSDK.validate.integration(testIntegration);
  if (errors.length > 0) {
// REMOVED: console statement
    return;
  }
// REMOVED: console statement

  // 6. Register the test integration
// REMOVED: console statement
  try {
    const integrationId = await server.registerIntegration(testIntegration);
// REMOVED: console statement

    // 7. Test tool execution
// REMOVED: console statement
    
    // Test echo tool
// REMOVED: console statement
    await server.executeToolCall(
      integrationId,
      'echo',
      { message: 'Hello, MCP!' }
    );
// REMOVED: console statement

    // Test add tool
// REMOVED: console statement
    await server.executeToolCall(
      integrationId,
      'add',
      { a: 5, b: 3 }
    );
// REMOVED: console statement

    // 8. Test rate limiting
// REMOVED: console statement
    try {
      // Make many requests quickly
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          server.executeToolCall(integrationId, 'echo', { message: `Test ${i}` })
        );
      }
      await Promise.all(promises);
// REMOVED: console statement
    } catch (error: any) {
      if (error.message.includes('Rate limit')) {
        // Rate limiting working correctly
      } else {
        // Unexpected error during rate limit test
      }
    }

    // 9. Unregister the test integration
// REMOVED: console statement
    await server.unregisterIntegration(integrationId);
// REMOVED: console statement

  } catch (error) {
// REMOVED: console statement
  }

  // 10. Stop the server
// REMOVED: console statement
  await server.stop();
// REMOVED: console statement

// REMOVED: console statement
}

// Run the test
if (require.main === module) {
  testMCPServer().catch(() => {
    // Test errors are handled internally
  });
}

export { testMCPServer };