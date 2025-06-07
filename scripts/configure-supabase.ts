#!/usr/bin/env ts-node

/**
 * Supabase Configuration Script for SessionHub
 * This script helps you configure Supabase credentials for SessionHub
 */

import { SupabaseService } from '../src/services/cloud/SupabaseService';
import { Logger } from '../src/lib/logging/Logger';
import * as readline from 'readline';
import { promisify } from 'util';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = promisify(rl.question).bind(rl);

async function main() {
  console.log('🚀 SessionHub Supabase Configuration\n');

  try {
    // Get Supabase URL
    const url = await question('Enter your Supabase project URL: ') as unknown as string;
    if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
      throw new Error('Invalid Supabase URL. It should look like: https://your-project.supabase.co');
    }

    // Get Anon Key
    const anonKey = await question('Enter your Supabase Anon Key (starts with eyJ...): ') as unknown as string;
    if (!anonKey.startsWith('eyJ')) {
      throw new Error('Invalid Anon Key. It should start with "eyJ"');
    }

    // Optional Service Key
    const hasServiceKey = await question('Do you have a Service Key? (y/n): ') as unknown as string;
    let serviceKey: string | undefined;
    
    if (hasServiceKey.toLowerCase() === 'y') {
      serviceKey = await question('Enter your Supabase Service Key: ') as unknown as string;
    }

    console.log('\n📝 Configuring Supabase...');

    // Initialize service and configure
    const logger = new Logger('SupabaseConfig');
    const supabaseService = new SupabaseService(logger);

    await supabaseService.configureCredentials(url, anonKey, serviceKey);

    console.log('✅ Supabase configured successfully!');
    console.log('🔒 Credentials stored securely in Mac Keychain\n');

    // Test connection
    console.log('🧪 Testing connection...');
    await supabaseService.initialize();
    
    const isOnline = supabaseService.isServiceOnline();
    if (isOnline) {
      console.log('✅ Successfully connected to Supabase!\n');
      
      // Show next steps
      console.log('📋 Next Steps:');
      console.log('1. Run the database schema setup (if not done already)');
      console.log('2. Launch SessionHub and test project creation');
      console.log('3. Check your Supabase dashboard to see synced data\n');
    } else {
      console.log('⚠️  Connection test failed. Please check your credentials and try again.\n');
    }

  } catch (error) {
    console.error('\n❌ Configuration failed:', error instanceof Error ? error.message : error);
    console.log('\nPlease check your credentials and try again.');
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
main().catch(console.error);