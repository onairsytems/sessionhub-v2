#!/bin/bash

# Setup Code Signing for macOS
# This script helps configure environment variables for code signing and notarization

echo "🔐 SessionHub Code Signing Setup"
echo "================================"
echo ""
echo "This script will help you set up code signing for macOS distribution."
echo "You'll need:"
echo "  1. An Apple Developer account"
echo "  2. A valid Developer ID Application certificate"
echo "  3. An app-specific password for notarization"
echo ""

# Function to add to shell profile
add_to_profile() {
    local var_name=$1
    local var_value=$2
    local profile_file=""
    
    # Determine shell profile file
    if [ -n "$ZSH_VERSION" ]; then
        profile_file="$HOME/.zshrc"
    elif [ -n "$BASH_VERSION" ]; then
        profile_file="$HOME/.bash_profile"
    fi
    
    if [ -n "$profile_file" ]; then
        echo "export $var_name=\"$var_value\"" >> "$profile_file"
        echo "✅ Added $var_name to $profile_file"
    fi
}

# Check for existing certificates
echo "Checking for Developer ID certificates..."
security find-identity -v -p codesigning | grep "Developer ID Application"

echo ""
read -p "Do you have a Developer ID Application certificate installed? (y/n): " has_cert

if [ "$has_cert" != "y" ]; then
    echo ""
    echo "⚠️  You need to create a Developer ID Application certificate."
    echo "   1. Sign in to https://developer.apple.com"
    echo "   2. Go to Certificates, IDs & Profiles"
    echo "   3. Create a new Developer ID Application certificate"
    echo "   4. Download and install it in Keychain Access"
    echo ""
    exit 1
fi

# Get Apple ID
echo ""
read -p "Enter your Apple ID email: " apple_id
add_to_profile "APPLE_ID" "$apple_id"

# Get Team ID
echo ""
echo "Finding your Team ID..."
security find-certificate -c "Developer ID Application" -p | openssl x509 -noout -text | grep "Subject:" | grep -o "OU=[^,]*" | cut -d= -f2 | head -1
echo ""
read -p "Enter your Apple Team ID (10-character string): " team_id
add_to_profile "APPLE_TEAM_ID" "$team_id"

# Get app-specific password
echo ""
echo "You need an app-specific password for notarization."
echo "Generate one at: https://appleid.apple.com/account/manage"
echo "Sign in > Security > App-Specific Passwords > Generate"
echo ""
read -s -p "Enter your app-specific password: " app_password
echo ""
add_to_profile "APPLE_ID_PASSWORD" "$app_password"

# Optional: Certificate name
echo ""
echo "By default, electron-builder will find your certificate automatically."
read -p "Do you want to specify a certificate name? (y/n): " specify_cert

if [ "$specify_cert" = "y" ]; then
    echo ""
    echo "Available certificates:"
    security find-identity -v -p codesigning | grep "Developer ID Application"
    echo ""
    read -p "Enter the certificate name (or press Enter to skip): " cert_name
    if [ -n "$cert_name" ]; then
        add_to_profile "CSC_NAME" "$cert_name"
    fi
fi

# Create .env.local file for development
echo ""
echo "Creating .env.local file for development..."
cat > .env.local << EOF
# Code Signing Configuration (DO NOT COMMIT)
APPLE_ID=$apple_id
APPLE_ID_PASSWORD=$app_password
APPLE_TEAM_ID=$team_id
EOF

if [ -n "$cert_name" ]; then
    echo "CSC_NAME=$cert_name" >> .env.local
fi

echo "✅ Created .env.local file"

# Update .gitignore
if ! grep -q ".env.local" .gitignore 2>/dev/null; then
    echo ".env.local" >> .gitignore
    echo "✅ Added .env.local to .gitignore"
fi

# Enable notarization in package.json
echo ""
echo "Updating package.json to enable notarization..."
sed -i '' 's/"notarize": false/"notarize": true/g' package.json
echo "✅ Enabled notarization in package.json"

echo ""
echo "🎉 Code signing setup complete!"
echo ""
echo "To build and sign your app:"
echo "  npm run electron:dist:mac"
echo ""
echo "To test without signing (faster builds):"
echo "  CSC_IDENTITY_AUTO_DISCOVERY=false npm run electron:dist:mac"
echo ""
echo "Remember to source your shell profile or restart your terminal:"
echo "  source ~/.zshrc  # or ~/.bash_profile"
echo ""