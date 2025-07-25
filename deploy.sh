#!/bin/bash

# Minimal Chat Deployment Script
# This script helps deploy both backend (Railway) and frontend (Netlify)

echo "🚀 Minimal Chat Deployment Script"
echo "================================="

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "   brew install railway"
    exit 1
fi

# Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "❌ Netlify CLI not found. Please install it first:"
    echo "   npm install -g netlify-cli"
    exit 1
fi

# Step 1: Deploy Backend to Railway
echo ""
echo "📦 Step 1: Deploying Backend to Railway..."
echo "Please make sure you're logged in to Railway (railway login)"
read -p "Press Enter to continue..."

# Get the Railway domain
echo "Deploying to Railway..."
railway up

echo ""
echo "Getting Railway domain..."
RAILWAY_URL=$(railway domain)

if [ -z "$RAILWAY_URL" ]; then
    echo "❌ Could not get Railway domain. Please run 'railway domain' manually."
    read -p "Enter your Railway URL (e.g., your-app.up.railway.app): " RAILWAY_URL
fi

echo "✅ Railway URL: https://$RAILWAY_URL"

# Step 2: Update Netlify configuration
echo ""
echo "📝 Step 2: Updating Netlify configuration..."

# Update netlify.toml with the Railway URL
sed -i.bak "s|https://your-railway-backend.up.railway.app|https://$RAILWAY_URL|g" netlify.toml
sed -i.bak "s|https://your-app.up.railway.app|https://$RAILWAY_URL|g" netlify.toml

echo "✅ Updated netlify.toml with Railway URL"

# Step 3: Build the frontend
echo ""
echo "🔨 Step 3: Building frontend..."
npm run build

# Step 4: Deploy to Netlify
echo ""
echo "🌐 Step 4: Deploying to Netlify..."
echo "Setting environment variables..."

netlify env:set VITE_API_URL "https://$RAILWAY_URL"
netlify env:set VITE_WS_URL "wss://$RAILWAY_URL"

echo "Deploying to Netlify..."
netlify deploy --prod

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📋 Summary:"
echo "- Railway Backend: https://$RAILWAY_URL"
echo "- Netlify Frontend: https://peppy-starburst-7c91fa.netlify.app"
echo ""
echo "⚠️  Important: Make sure to set the CLIENT_URL environment variable in Railway:"
echo "   railway variables set CLIENT_URL=https://peppy-starburst-7c91fa.netlify.app"
echo ""
echo "🧪 Test your deployment:"
echo "1. Visit https://peppy-starburst-7c91fa.netlify.app"
echo "2. Try registering a new user"
echo "3. Check if messages work properly"