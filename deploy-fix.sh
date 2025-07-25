#!/bin/bash

echo "🔧 Fixing Netlify Deployment"
echo "============================"
echo ""

# Build with environment variables
echo "📦 Building with production environment variables..."
VITE_API_URL="https://minimal-chat-e2ee-production.up.railway.app" \
VITE_WS_URL="wss://minimal-chat-e2ee-production.up.railway.app" \
npm run build

echo ""
echo "✅ Build complete with Railway backend URLs"
echo ""
echo "🚀 Now deploy to Netlify:"
echo "   netlify deploy --prod --dir=dist"
echo ""
echo "Or if you haven't linked yet:"
echo "   netlify link"
echo "   netlify deploy --prod --dir=dist"