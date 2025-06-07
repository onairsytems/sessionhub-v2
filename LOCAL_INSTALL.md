# SessionHub Local Installation Guide

## 🚀 Quick Start

SessionHub has been successfully compiled into a local Mac application! Follow these steps to install and run it on your machine.

## 📦 Installation Steps

### 1. Locate the Built Application
Your SessionHub app is located at:
```
/Users/jonathanhoggard/Development/sessionhub-v2/dist-electron/mac-arm64/SessionHub.app
```

### 2. Install to Applications Folder (Recommended)
```bash
# Copy the app to your Applications folder
cp -R "/Users/jonathanhoggard/Development/sessionhub-v2/dist-electron/mac-arm64/SessionHub.app" /Applications/

# Or use Finder: drag SessionHub.app to your Applications folder
```

### 3. Launch SessionHub
- **From Applications**: Double-click SessionHub in your Applications folder
- **From Terminal**: 
  ```bash
  open /Applications/SessionHub.app
  ```

## 🔒 Security & Permissions

### First Launch
When you first launch SessionHub, macOS may show a security warning because the app isn't code-signed. To resolve this:

1. **Right-click** on SessionHub.app
2. Select **"Open"** from the context menu
3. Click **"Open"** in the security dialog
4. SessionHub will launch and be trusted for future runs

### Required Permissions
SessionHub may request permissions for:
- **Files and Folders**: To access your development projects
- **Network**: To connect to Claude API and Supabase services

## ⚡ Development Mode

If you want to run SessionHub in development mode with live reloading:

```bash
# From the project directory
cd /Users/jonathanhoggard/Development/sessionhub-v2

# Start the Next.js development server
npm run dev

# In another terminal, start Electron
npm run electron:dev
```

## 🔧 Build Commands Reference

| Command | Description |
|---------|-------------|
| `npm run build` | Build Next.js frontend |
| `npm run electron:compile` | Compile TypeScript for Electron |
| `npm run electron:build` | Build both frontend and Electron |
| `npm run pack` | Create unpacked app bundle |
| `npm run dist` | Create distributable .dmg file |

## 📁 Project Structure

```
SessionHub.app/
├── Contents/
│   ├── MacOS/SessionHub          # Main executable
│   ├── Resources/
│   │   ├── app/                  # Next.js frontend
│   │   ├── dist/main/            # Electron main process
│   │   └── icon.icns             # App icon
│   └── Info.plist                # App metadata
```

## 🚀 Features Available

Your local SessionHub installation includes:

- ✅ **Native Mac Application**: Runs as a proper macOS app
- ✅ **Menu Bar Integration**: Full native menus and shortcuts
- ✅ **Modern UI**: Built with Next.js and Tailwind CSS
- ✅ **Electron Framework**: Secure desktop integration
- ✅ **Local Development Ready**: Perfect for local testing

## 🛠 Troubleshooting

### App Won't Launch
- Check Console.app for error messages
- Verify you have macOS 13.0+ (minimum system requirement)
- Try running from Terminal to see error output

### Permission Issues
- Make sure SessionHub.app has necessary permissions in System Preferences
- Try launching with sudo (not recommended for regular use)

### Development Issues
- Ensure all dependencies are installed: `npm install`
- Check that ports 3000 and 8080 are available
- Restart both Next.js and Electron if hot reloading stops working

## 📝 Next Steps

Now that SessionHub is installed locally, you can:

1. **Explore the Interface**: Open the app and familiarize yourself with the Two-Actor Model interface
2. **Test Core Features**: Try creating a test session to verify functionality
3. **Development Workflow**: Use this local build for testing SessionHub development
4. **Production Preparation**: This build demonstrates the complete desktop application

## 🔄 Updating SessionHub

To update your local SessionHub installation:

```bash
# Navigate to project directory
cd /Users/jonathanhoggard/Development/sessionhub-v2

# Pull latest changes (if using git)
git pull origin main

# Rebuild the application
npm run build
npm run electron:compile
npx electron-builder --dir

# Copy updated app to Applications
cp -R "dist-electron/mac-arm64/SessionHub.app" /Applications/
```

## 💡 Development Tips

- **Hot Reloading**: Use `npm run electron:dev` for development with live updates
- **Debugging**: The app includes DevTools for debugging the renderer process
- **Logging**: Check Console.app for Electron main process logs
- **Build Optimization**: Use `npm run dist` to create an optimized .dmg installer

---

**🎉 Congratulations!** You now have SessionHub running locally as a native Mac application. The Two-Actor Model development platform is ready for local testing and development.

For questions or issues, check the project documentation or create an issue in the repository.