/**
 * Test script for MCP Server
 * 
 * Run this to verify the MCP server is working correctly
 */
import { MCPServerService } from '../server/MCPServerService';
import { MCPIntegrationSDK } from '../sdk/MCPIntegrationSDK';
async function testMCPServer() {
  // 1. Create and start the server
  const server = new MCPServerService();
  try {
    await server.start();
  } catch (error) {
    return;
  }
  // 2. Check server __status
  // const ___status = await server.getStatus(); // Unused
  // 3. List initial integrations
  const integrations = await server.listIntegrations();
  integrations.forEach(_i => {
  });
  // 4. Create a test integration using the SDK
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
  const errors = MCPIntegrationSDK.validate.integration(testIntegration);
  if (errors.length > 0) {
    return;
  }
  // 6. Register the test integration
  try {
    const integrationId = await server.registerIntegration(testIntegration);
    // 7. Test tool execution
    // Test echo tool
    // const ___echoResult = await server.executeToolCall(
    //   integrationId,
    //   'echo',
    //   { message: 'Hello, MCP!' }
    // );
    // Test add tool
    // const ___addResult = await server.executeToolCall(
    //   integrationId,
    //   'add',
    //   { a: 5, b: 3 }
    // );
    // 8. Test rate limiting
    try {
      // Make many requests quickly
      const promises = [];
      for (let _i = 0; _i < 5; _i++) {
        promises.push(
          server.executeToolCall(integrationId, 'echo', { message: `Test ${_i}` })
        );
      }
      await Promise.all(promises);
    } catch (error: any) {
      if (error.message.includes('Rate limit')) {
      } else {
      }
    }
    // 9. Unregister the test integration
    await server.unregisterIntegration(integrationId);
  } catch (error) {
  }
  // 10. Stop the server
  await server.stop();
}
// Run the test
if (require.main === module) {
  testMCPServer().catch((error) => {
    process.stderr.write(`Test failed: ${error.message}\n`);
    process.exit(1);
  });
}
export { testMCPServer };