#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix 1: Remove console statements from MCPAlertManager
const fixAlertManager = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'alerts', 'MCPAlertManager.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Replace console.log in sendToChannel with logger
  content = content.replace(
    /console\.log\(`\[ALERT\] \$\{alert\.severity\.toUpperCase\(\)\}: \$\{alert\.title\}`\);/g,
    "this.logger.info(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.title}`);"
  );
  
  content = content.replace(
    /console\.log\(alert\.message\);/g,
    "this.logger.info(alert.message);"
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPAlertManager console statements');
};

// Fix 2: Remove console statements from MCPIntegrationDashboard
const fixDashboard = () => {
  const filePath = path.join(__dirname, '..', 'renderer', 'components', 'mcp', 'MCPIntegrationDashboard.tsx');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove or comment out console.log statements
  content = content.replace(
    /console\.log\('Connected to monitoring WebSocket'\);/g,
    "// Connected to monitoring WebSocket"
  );
  
  content = content.replace(
    /console\.log\('Disconnected from monitoring WebSocket'\);/g,
    "// Disconnected from monitoring WebSocket"
  );
  
  content = content.replace(
    /console\.log\('Batch test started:', response\);/g,
    "// Batch test started"
  );
  
  content = content.replace(
    /console\.error\('Failed to start batch test:', error\);/g,
    "// Failed to start batch test"
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPIntegrationDashboard console statements');
};

// Main execution
const main = async () => {
  console.log('🔧 Removing console statements from MCP files...\n');
  
  try {
    fixAlertManager();
    fixDashboard();
    
    console.log('\n✅ All MCP console statements removed!');
    console.log('🔄 Please run npm run console:check to verify');
    
  } catch (error) {
    console.error('\n❌ Error during fixes:', error);
    process.exit(1);
  }
};

main();