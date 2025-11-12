#!/bin/bash

# SecuGen Unity 20 BLE Plugin - Complete Rebuild Script
# Tự động build plugin và demo app, sync với iOS

echo "🚀 Starting SecuGen Plugin Complete Rebuild..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command succeeded
check_status() {
    if [ $? -eq 0 ]; then
        print_success "$1"
    else
        print_error "$2"
        exit 1
    fi
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "📁 Working directory: $SCRIPT_DIR"

# Step 1: Build SecuGen Plugin
print_status "Step 1: Building SecuGen BLE Plugin..."
cd "$SCRIPT_DIR/.."

if [ ! -f "package.json" ]; then
    print_error "package.json not found in cap-secugen-ble directory!"
    exit 1
fi

print_status "Running npm run build in cap-secugen-ble..."
npm run build
check_status "✅ Plugin build completed successfully" "❌ Plugin build failed"

# Step 2: Build Demo App
print_status "Step 2: Building Ionic Demo App..."
cd "$SCRIPT_DIR/../secugen-demo"

if [ ! -f "package.json" ]; then
    print_error "package.json not found in secugen-demo directory!"
    exit 1
fi

print_status "Running ionic build..."
ionic build
check_status "✅ Ionic build completed successfully" "❌ Ionic build failed"

# Step 3: Sync with iOS
print_status "Step 3: Syncing with iOS..."
print_status "Running npx cap sync ios..."
npx cap sync ios
check_status "✅ iOS sync completed successfully" "❌ iOS sync failed"

# Completion
echo ""
echo "🎉 ================================================"
print_success "SecuGen Plugin Rebuild Completed Successfully!"
echo "🎉 ================================================"
echo ""
print_status "Next steps:"
echo "  1. Open Xcode: npx cap open ios"
echo "  2. Build and run on device"
echo "  3. Test fingerprint capture functionality"
echo ""
print_warning "Note: Make sure your SecuGen Unity 20 device is powered on and nearby"
echo ""
