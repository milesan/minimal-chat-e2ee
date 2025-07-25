#!/bin/bash

# Deployment script for minimal-chat with your Railway URL

echo "🚀 Deploying Minimal Chat to Netlify"
echo "===================================="
echo ""
echo "Railway Backend: https://minimal-chat-e2ee-production.up.railway.app"
echo ""

# Step 1: Build the project
echo "📦 Building frontend..."
npm run build

# Step 2: Deploy to Netlify with environment variables
echo ""
echo "🌐 Deploying to Netlify..."
echo ""
echo "Please follow these steps:"
echo ""
echo "1. Run: netlify link"
echo "   - Choose 'Use current git remote origin'"
echo ""
echo "2. Set environment variables:"
echo "   netlify env:set VITE_API_URL 'https://minimal-chat-e2ee-production.up.railway.app'"
echo "   netlify env:set VITE_WS_URL 'wss://minimal-chat-e2ee-production.up.railway.app'"
echo ""
echo "3. Deploy to production:"
echo "   netlify deploy --prod --dir=dist"
echo ""
echo "4. Make sure Railway has the correct CLIENT_URL:"
echo "   railway variables set CLIENT_URL='https://peppy-starburst-7c91fa.netlify.app'"
echo ""
echo "✅ Your netlify.toml is already configured with the Railway URL!"