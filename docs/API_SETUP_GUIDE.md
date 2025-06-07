# SessionHub API Configuration Guide

This guide will walk you through setting up both Claude API and Supabase credentials for SessionHub.

## Prerequisites

- SessionHub installed on your Mac
- An Anthropic account for Claude API access
- A Supabase account with a project created

## Step 1: Get Your Claude API Key

1. **Visit Anthropic Console**
   - Go to [console.anthropic.com](https://console.anthropic.com)
   - Sign in to your account (or create one if needed)

2. **Navigate to API Keys**
   - Click on "API Keys" in the left sidebar
   - Click "Create Key" button

3. **Create Your Key**
   - Give your key a descriptive name (e.g., "SessionHub")
   - Copy the key that starts with `sk-ant-api...`
   - **Important**: Save this key securely - you won't be able to see it again!

## Step 2: Configure Claude API in SessionHub

### Option A: Through the UI (Recommended)

1. **Launch SessionHub**
   - Open SessionHub from your Applications folder
   - You'll see the API Configuration screen on first launch

2. **Enter Your API Key**
   - Paste your Claude API key in the input field
   - Click "Continue"
   - SessionHub will validate the key and store it securely in Mac Keychain

### Option B: Manual Configuration

If you need to update your API key later:

```bash
# Using the command line (requires SessionHub to expose this functionality)
# This is stored securely in Mac Keychain
security add-generic-password -a "sessionhub" -s "claude-api-key" -w "your-api-key-here"
```

## Step 3: Set Up Supabase

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Sign in and create a new project
   - Choose a name, password, and region

2. **Get Your Credentials**
   - Once your project is created, go to Settings → API
   - You'll need:
     - **Project URL**: `https://your-project-ref.supabase.co`
     - **Anon Key**: A long string starting with `eyJ...`
     - **Service Key** (optional): For admin operations

3. **Set Up Database Schema**
   - Go to SQL Editor in Supabase dashboard
   - Copy and run the schema from: `/Users/jonathanhoggard/Development/sessionhub-v2/src/database/schema/supabase-schema.sql`

## Step 4: Configure Supabase in SessionHub

Currently, Supabase configuration needs to be done programmatically. Here's how:

### Create a Configuration File

Create a file at `~/Development/sessionhub-v2/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-key-here
```

### Or Use the Programmatic API

In your code or through the developer console:

```javascript
// This will be available in a future UI update
await window.electronAPI.configureSupabase({
  url: 'https://your-project-ref.supabase.co',
  anonKey: 'your-anon-key-here',
  serviceKey: 'your-service-key-here' // optional
});
```

## Step 5: Test Your Configuration

### Test Claude API

1. Open SessionHub
2. Go to the Planning Chat interface
3. Send a test message like "Hello, can you hear me?"
4. You should receive a response from Claude

### Test Supabase Connection

1. Create a new project in SessionHub
2. Check if it appears in your Supabase dashboard under the `projects` table
3. If successful, your connection is working!

## Troubleshooting

### Claude API Issues

**"Invalid API key" error**
- Verify your key starts with `sk-ant-api`
- Check for extra spaces or characters
- Ensure your Anthropic account is active

**"Rate limit exceeded" error**
- Check your usage on console.anthropic.com
- Consider upgrading your plan if needed

### Supabase Connection Issues

**"Missing Supabase credentials" error**
- Ensure both URL and Anon Key are provided
- Check that your project is active (not paused)

**"Failed to connect to Supabase" error**
- Verify your project URL is correct
- Check if your project is in a paused state
- Ensure your internet connection is stable

### Mac Keychain Issues

If you're having trouble with Keychain access:

1. Open Keychain Access app
2. Search for "sessionhub"
3. Delete any existing entries if corrupted
4. Restart SessionHub to reconfigure

## Security Notes

- **Claude API Key**: Stored securely in Mac Keychain, never in plain text
- **Supabase Keys**: Also stored in Keychain when configured through the app
- **Never commit API keys** to version control
- **Use environment variables** for development

## Next Steps

Once both APIs are configured:

1. Explore the Planning Chat to interact with Claude
2. Create your first project and see it sync to Supabase
3. Test the Two-Actor Model with a simple task
4. Check the Foundation.md document for advanced usage

## Getting Help

- Check the logs at: `~/Library/Logs/SessionHub/`
- Visit the issues page: https://github.com/anthropics/sessionhub/issues
- Review the Foundation document for architectural details

---

**Note**: This guide will be updated as we add UI components for Supabase configuration in upcoming sessions.