#!/bin/bash

# Quick rebuild script for SecuGen Plugin
echo "🔨 Quick rebuilding SecuGen Plugin..."

# Build plugin
cd ..
npm run build

# Build demo and sync iOS
cd secugen-demo
ionic build && npx cap sync ios

echo "✅ Done! Ready to test."
