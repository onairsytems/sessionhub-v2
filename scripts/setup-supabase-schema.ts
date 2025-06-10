#!/usr/bin/env ts-node

/**
 * Supabase Schema Setup Script for SessionHub
 * This script helps you set up the required database schema in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { MacKeychainService } from '../src/lib/security/MacKeychainService';
import { Logger } from '../src/lib/logging/Logger';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🗄️  SessionHub Supabase Schema Setup\n');

  const logger = new Logger('SchemaSetup');
  const keychainService = new MacKeychainService(logger);

  try {
    // Get credentials from Keychain
    console.log('🔑 Retrieving Supabase credentials from Keychain...');
    
    const url = await keychainService.getCredential('supabase-url');
    const serviceKey = await keychainService.getCredential('supabase-service-key');
    
    if (!url || !serviceKey) {
      throw new Error(
        'Supabase credentials not found. Please run configure-supabase.ts first.\n' +
        'Note: Schema setup requires a Service Key for admin access.'
      );
    }

    // Create Supabase client with service key
    const supabase = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Read schema file
    const schemaPath = path.join(__dirname, '../src/database/schema/supabase-schema.sql');
    console.log('📄 Reading schema file...');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    console.log('🚀 Executing schema setup...');
    console.log('This will create tables, views, functions, and RLS policies.\n');

    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => s + ';');

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      // Skip comments
      if (statement.startsWith('--') || statement.startsWith('/*')) {
        continue;
      }

      try {
        // Extract a summary of what we're doing
        const firstLine = statement.split('\n')[0];
        const action = firstLine && firstLine.match(/(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT)/i)?.[0] || 'EXECUTE';
        const target = firstLine && firstLine.match(/(TABLE|VIEW|FUNCTION|POLICY|INDEX|TRIGGER)\s+(\S+)/i)?.[2] || 'statement';
        
        process.stdout.write(`${action} ${target}... `);

        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          console.log('❌');
          console.error(`  Error: ${error.message}`);
          errorCount++;
        } else {
          console.log('✅');
          successCount++;
        }
      } catch (error: any) {
        console.log('❌');
        console.error(`  Error: ${error instanceof Error ? error.message : error}`);
        errorCount++;
      }
    }

    console.log(`\n📊 Schema Setup Summary:`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);

    if (errorCount === 0) {
      console.log('\n🎉 Schema setup completed successfully!');
      console.log('\n📋 Next Steps:');
      console.log('1. Check your Supabase dashboard to verify tables were created');
      console.log('2. Launch SessionHub and test creating a project');
      console.log('3. Monitor the logs for any sync issues\n');
    } else {
      console.log('\n⚠️  Schema setup completed with errors.');
      console.log('Some statements may have failed due to:');
      console.log('- Objects already existing (safe to ignore)');
      console.log('- Missing permissions (check your service key)');
      console.log('- SQL syntax differences\n');
      console.log('Please check your Supabase dashboard and logs for details.');
    }

  } catch (error: any) {
    console.error('\n❌ Setup failed:', error instanceof Error ? error.message : error);
    console.log('\nTroubleshooting:');
    console.log('1. Ensure you have run configure-supabase.ts first');
    console.log('2. Verify you provided a Service Key (not just Anon Key)');
    console.log('3. Check that your Supabase project is active');
    console.log('4. Try running the SQL directly in Supabase SQL Editor');
    process.exit(1);
  }
}

// Note: If the exec_sql function doesn't exist, create it first
// Example:
// CREATE OR REPLACE FUNCTION exec_sql(sql text)
// RETURNS void AS $$
// BEGIN
//   EXECUTE sql;
// END;
// $$ LANGUAGE plpgsql SECURITY DEFINER;
// `;

// Run the script
main().catch(console.error);