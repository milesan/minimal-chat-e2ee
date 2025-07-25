# Quick Deployment Steps

## 1. Deploy Backend to Railway

Open a terminal and run these commands:

```bash
# Login to Railway
railway login

# Initialize Railway project (if not already done)
railway init

# Set environment variables
railway variables set JWT_SECRET="your-very-secure-jwt-secret-$(openssl rand -hex 32)"
railway variables set CLIENT_URL="https://peppy-starburst-7c91fa.netlify.app"
railway variables set PORT="3035"

# Deploy to Railway
railway up

# Get your Railway domain
railway domain
```

Copy the Railway domain URL (e.g., `minimal-chat-production.up.railway.app`)

## 2. Update Netlify Configuration

Replace `YOUR-RAILWAY-URL` in the commands below with your actual Railway domain:

```bash
# Update netlify.toml with your Railway URL
sed -i '' 's|https:///|https://YOUR-RAILWAY-URL/|g' netlify.toml

# Example:
# sed -i '' 's|https:///|https://minimal-chat-production.up.railway.app/|g' netlify.toml
```

## 3. Deploy Frontend to Netlify

```bash
# Build the project
npm run build

# Link to your Netlify project
netlify link

# Set environment variables
netlify env:set VITE_API_URL "https://YOUR-RAILWAY-URL"
netlify env:set VITE_WS_URL "wss://YOUR-RAILWAY-URL"

# Deploy to production
netlify deploy --prod --dir=dist
```

## 4. Verify Deployment

1. Visit https://peppy-starburst-7c91fa.netlify.app
2. Open browser console (F12)
3. Try to register/login
4. Check for any errors

## Troubleshooting

If you see CORS errors:
- Make sure `CLIENT_URL` is set correctly in Railway
- Redeploy Railway: `railway up`

If WebSocket doesn't connect:
- Check that `VITE_WS_URL` is set in Netlify
- Ensure it starts with `wss://` not `https://`

## Example with actual values:

```bash
# If your Railway URL is: minimal-chat-production.up.railway.app

# Update netlify.toml
sed -i '' 's|https:///|https://minimal-chat-production.up.railway.app/|g' netlify.toml

# Set Netlify env vars
netlify env:set VITE_API_URL "https://minimal-chat-production.up.railway.app"
netlify env:set VITE_WS_URL "wss://minimal-chat-production.up.railway.app"
```