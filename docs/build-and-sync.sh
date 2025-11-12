#!/bin/bash

# SecuGen Capacitor Plugin Build and Sync Script
# Usage: ./build-and-sync.sh

set -e  # Exit on any error

echo "🔧 Starting SecuGen Plugin Build and Sync..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Build the plugin
echo -e "${BLUE}📦 Step 1: Building Capacitor plugin...${NC}"
cd ..
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Plugin build successful${NC}"
else
    echo -e "${RED}❌ Plugin build failed${NC}"
    exit 1
fi

# Step 2: Update demo app
echo -e "${BLUE}🔄 Step 2: Updating demo app dependencies...${NC}"
cd secugen-demo

# Uninstall old version
echo -e "${YELLOW}Uninstalling old plugin version...${NC}"
npm uninstall @myduchospital/cap-secugen-ble

# Install new version
echo -e "${YELLOW}Installing updated plugin...${NC}"
npm install ../

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Plugin installation successful${NC}"
else
    echo -e "${RED}❌ Plugin installation failed${NC}"
    exit 1
fi

# Step 3: Build Ionic app
echo -e "${BLUE}🏗️  Step 3: Building Ionic Angular app...${NC}"
ionic build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Ionic build successful${NC}"
else
    echo -e "${RED}❌ Ionic build failed${NC}"
    exit 1
fi

# Step 4: Sync Capacitor
echo -e "${BLUE}🔄 Step 4: Syncing Capacitor platforms...${NC}"
npx cap sync
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Capacitor sync successful${NC}"
else
    echo -e "${RED}❌ Capacitor sync failed${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 All steps completed successfully!${NC}"
echo -e "${BLUE}📱 Ready to run:${NC}"
echo -e "  ${YELLOW}iOS:${NC}     npx cap run ios"
echo -e "  ${YELLOW}Android:${NC} npx cap run android"
echo -e "  ${YELLOW}Web:${NC}     ionic serve"
