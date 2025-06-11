#!/usr/bin/env ts-node

import { productionReadinessCertification } from '../tests/certification/ProductionReadinessCertification';

/**
 * Production Readiness Certification Runner
 * Executes comprehensive validation and generates certification
 */

async function main() {
  console.log('🚀 SessionHub v2.10 - Production Readiness Certification');
  console.log('='.repeat(60));
  
  try {
    const startTime = Date.now();
    
    // Run full certification process
    const certification = await productionReadinessCertification.runFullCertification();
    
    const duration = (Date.now() - startTime) / 1000;
    
    console.log('\n' + '='.repeat(60));
    console.log('PRODUCTION READINESS CERTIFICATION RESULTS');
    console.log('='.repeat(60));
    console.log(`Certification ID: ${certification.certificationId}`);
    console.log(`Overall Score: ${certification.overallScore}/100`);
    console.log(`Certification Level: ${certification.certification.level}`);
    console.log(`Production Ready: ${certification.productionReady ? '✅ YES' : '❌ NO'}`);
    console.log(`Risk Level: ${certification.riskAssessment.level}`);
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log('='.repeat(60));
    
    if (certification.productionReady) {
      console.log('\n🎉 CONGRATULATIONS! SessionHub v2.10 is PRODUCTION READY!');
      console.log(`🏆 Certification Level: ${certification.certification.level}`);
      console.log(`📅 Valid Until: ${certification.certification.validUntil.toISOString().split('T')[0]}`);
    } else {
      console.log('\n⚠️  SessionHub requires improvements before production deployment');
      console.log('📋 Review the certification report for detailed action items');
    }
    
    console.log('\n📄 Certification report saved to: test-results/production-readiness-certification.md');
    
    // Exit with appropriate code
    process.exit(certification.productionReady ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Certification process failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}