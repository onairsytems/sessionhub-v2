#!/usr/bin/env ts-node

/**
 * Production Health Check Script
 * Quick health check for production deployment
 */

import { productionHealthMonitor } from '../src/services/production/ProductionHealthMonitor';
import { productionOptimizations } from '../src/config/production-optimizations';
import { securityHardening } from '../src/config/production-security';
import * as os from 'os';

async function runHealthCheck() {
  console.log('🏥 SessionHub Production Health Check');
  console.log('=====================================\n');

  try {
    // System Information
    console.log('📊 System Information:');
    console.log(`Platform: ${os.platform()}`);
    console.log(`Architecture: ${os.arch()}`);
    console.log(`Node Version: ${process.version}`);
    console.log(`CPUs: ${os.cpus().length} cores`);
    console.log(`Total Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`);
    console.log(`Free Memory: ${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`);
    console.log('');

    // Security Validation
    console.log('🔒 Security Validation:');
    const securityValidation = securityHardening.validateSecurityRequirements();
    if (securityValidation.valid) {
      console.log('✅ All security requirements met');
    } else {
      console.log('❌ Security issues found:');
      securityValidation.issues.forEach(issue => {
        console.log(`   - ${issue}`);
      });
    }
    console.log('');

    // Compliance Report
    console.log('📋 Compliance Status:');
    const complianceReport = securityHardening.generateComplianceReport();
    console.log(`Compliance Mode: ${complianceReport.complianceMode}`);
    console.log(`Encryption: ${complianceReport.encryptionStatus.algorithm}`);
    console.log(`At-Rest Encryption: ${complianceReport.encryptionStatus.atRestEncryption ? '✅' : '❌'}`);
    console.log(`In-Transit Encryption: ${complianceReport.encryptionStatus.inTransitEncryption ? '✅' : '❌'}`);
    console.log('');

    // Start monitoring temporarily
    console.log('🔍 Running Health Checks...');
    await productionHealthMonitor.startMonitoring({
      checkInterval: 1000, // Just for this check
      telemetryEnabled: false,
    });

    // Wait for initial check
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get health status
    const healthStatus = await productionHealthMonitor.getHealthStatus();
    
    console.log('\n📊 Health Check Results:');
    console.log(`Overall Status: ${getStatusEmoji(healthStatus.overall)} ${healthStatus.overall.toUpperCase()}`);
    console.log('');

    // Individual checks
    console.log('Component Health:');
    Object.entries(healthStatus.checks).forEach(([component, metric]) => {
      const emoji = getStatusEmoji(metric.status);
      console.log(`${emoji} ${component.padEnd(10)}: ${metric.value}${metric.unit} (threshold: ${metric.threshold}${metric.unit})`);
    });
    console.log('');

    // Alerts
    const alerts = productionHealthMonitor.getAlerts();
    if (alerts.length > 0) {
      console.log('⚠️  Active Alerts:');
      alerts.forEach(alert => {
        console.log(`   - [${alert.level.toUpperCase()}] ${alert.message}`);
      });
      console.log('');
    }

    // Performance Report
    console.log('🚀 Performance Metrics:');
    const perfReport = await productionOptimizations.getPerformanceReport();
    console.log(`Memory Usage: ${perfReport.memory.current.heapUsed}MB / ${perfReport.memory.heap.heapSizeLimit}MB`);
    console.log(`Database Health: ${perfReport.database.fragmentationRatio < 0.3 ? '✅ Good' : '⚠️  Needs optimization'}`);
    console.log('');

    // Recommendations
    const healthReport = await productionHealthMonitor.generateHealthReport();
    if (healthReport.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      healthReport.recommendations.forEach((rec: any) => {
        console.log(`   - ${rec}`);
      });
      console.log('');
    }

    // Summary
    console.log('=====================================');
    if (healthStatus.overall === 'healthy' && securityValidation.valid) {
      console.log('✅ SessionHub is ready for production!');
      process.exit(0);
    } else {
      console.log('⚠️  Issues detected. Please review the results above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  } finally {
    // Stop monitoring
    productionHealthMonitor.stopMonitoring();
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'healthy':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'critical':
      return '❌';
    case 'degraded':
      return '⚠️';
    default:
      return '❓';
  }
}

// Run the health check
runHealthCheck();