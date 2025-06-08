#!/usr/bin/env node

/**
 * Bypass Monitor Startup Script
 * Runs in the background to detect and alert on bypass attempts
 */

import { bypassMonitor } from '../src/services/monitoring/BypassMonitor';
import * as fs from 'fs';
import * as path from 'path';

// Create PID file
const pidFile = path.join(process.env['HOME']!, '.sessionhub/monitor.pid');
fs.mkdirSync(path.dirname(pidFile), { recursive: true });
fs.writeFileSync(pidFile, process.pid.toString());

// Setup signal handlers
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping bypass monitor...');
  bypassMonitor.stopMonitoring();
  if (fs.existsSync(pidFile)) {
    fs.unlinkSync(pidFile);
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  bypassMonitor.stopMonitoring();
  if (fs.existsSync(pidFile)) {
    fs.unlinkSync(pidFile);
  }
  process.exit(0);
});

// Setup event handlers
bypassMonitor.on('bypass-attempt', (attempt) => {
  console.log(`\n⚠️  Bypass attempt detected:`);
  console.log(`   Type: ${attempt.type}`);
  console.log(`   Severity: ${attempt.severity}`);
  console.log(`   Details: ${attempt.details}`);
  console.log(`   User: ${attempt.user}`);
  console.log(`   Time: ${attempt.timestamp}`);
});

bypassMonitor.on('critical-alert', (attempt) => {
  console.log(`\n🚨 CRITICAL SECURITY ALERT:`);
  console.log(`   ${attempt.details}`);
  
  // Send system notification on macOS
  if (process.platform === 'darwin') {
    const { exec } = require('child_process');
    exec(`osascript -e 'display alert "Critical Security Alert" message "${attempt.details}" as critical'`);
  }
});

// Start monitoring
console.log('🔒 SessionHub Bypass Monitor v0.1.4');
console.log('👁️  Monitoring for quality gate bypass attempts...');
console.log('📁 Logs: ~/.sessionhub/bypass-attempts.log');
console.log('');

bypassMonitor.startMonitoring();

// Generate report every hour
setInterval(() => {
  const report = bypassMonitor.generateReport();
  const reportFile = path.join(process.env['HOME']!, '.sessionhub/security-report.md');
  fs.writeFileSync(reportFile, report);
  console.log(`📊 Security report updated: ${reportFile}`);
}, 60 * 60 * 1000);

// Keep the process running
setInterval(() => {
  // Heartbeat
}, 1000);

console.log('Press Ctrl+C to stop monitoring.');