# Getting Started with SessionHub

## System Requirements

- **macOS**: 12.0 or later (optimized for Apple Silicon)
- **Memory**: 8GB RAM minimum (16GB recommended)
- **Storage**: 2GB free space
- **Internet**: Required for AI features

## Installation

### Method 1: Direct Download (Recommended)

1. Download SessionHub from [official website]
2. Open the downloaded `.dmg` file
3. Drag SessionHub to your Applications folder
4. Launch SessionHub from Applications or Spotlight

### Method 2: Homebrew

```bash
brew install --cask sessionhub
```

## First Launch

When you first open SessionHub:

1. **API Configuration Wizard** appears
   - Enter your Anthropic API key
   - Configure Supabase credentials (optional)
   - Set up GitHub integration (optional)

2. **Onboarding Tutorial** guides you through:
   - Creating your first session
   - Understanding the Two-Actor Model
   - Setting up keyboard shortcuts

## Essential Setup

### 1. Configure Your API Keys

```bash
# In SessionHub Settings > API Configuration
Anthropic API Key: your-key-here
Supabase URL: your-project-url (optional)
Supabase Anon Key: your-anon-key (optional)
```

### 2. Set Up Your First Project

1. Click **"New Project"** or press `⌘N`
2. Choose project type:
   - React Application
   - Node.js API
   - Python Script
   - Custom Template
3. Select your project directory
4. SessionHub analyzes your codebase automatically

### 3. Configure IDE Integration

SessionHub works with your favorite IDE:

- **VS Code**: Automatic detection
- **Cursor**: Enable in Settings > IDE Integration
- **Zed**: Configure path in Settings

## Understanding the Interface

### Main Window Components

```
┌─────────────────────────────────────────┐
│  Sidebar  │      Session Editor         │
│           │                             │
│ Projects  │   Describe your request... │
│ Sessions  │                             │
│ Templates │   [Start Session]           │
│           │                             │
│           │   Progress Tracker          │
└───────────┴─────────────────────────────┘
```

### Key UI Elements

1. **Project Switcher** (⌘K) - Quick project navigation
2. **Session List** - History of all sessions
3. **Template Library** - Pre-built session templates
4. **Progress Tracker** - Real-time session monitoring
5. **Actor Status** - Shows planning/execution state

## Your First Session

### Example: Create a Todo App

1. **Start a New Session**
   ```
   Press ⌘N or click "New Session"
   ```

2. **Describe Your Request**
   ```
   Create a React Todo app with:
   - Add/remove tasks
   - Mark tasks complete
   - Filter by status
   - Local storage persistence
   ```

3. **Watch the Magic**
   - Planning Actor analyzes your request
   - Creates detailed implementation plan
   - Execution Actor builds your app
   - Quality gates ensure clean code

4. **Review Results**
   - See generated files in your IDE
   - Test the application
   - Iterate with follow-up sessions

## Quick Tips

- **Use Templates**: Start with pre-built templates for common tasks
- **Be Specific**: Clear descriptions lead to better results
- **Review Plans**: Check the planning output before execution
- **Iterate**: Build complex features through multiple sessions

## Next Steps

- [Learn the Two-Actor Model](./two-actor-model.md)
- [Explore Session Templates](./templates.md)
- [Master Keyboard Shortcuts](./keyboard-shortcuts.md)
- [Watch Video Tutorials](./video-tutorials.md)

## Troubleshooting First Launch

### Common Issues

**SessionHub won't open**
- Check macOS security settings
- Right-click and select "Open" for first launch

**API Key errors**
- Verify your Anthropic API key is valid
- Check internet connection

**Project not detected**
- Ensure you're in a git repository
- Check file permissions

Need more help? Visit our [Troubleshooting Guide](../troubleshooting/README.md)