# Deployment Guide for Minimal Chat

## Current Issues and Solutions

### 1. SES/Lockdown.js Warnings
These warnings are coming from a dependency and can be safely ignored. They're deprecation warnings that don't affect functionality.

### 2. API 404 Errors
The Netlify frontend is trying to reach `/api/auth/register` but can't find your Railway backend. This needs proper configuration.

### 3. WebSocket Connection Issues
Socket.IO needs proper configuration for cross-origin connections between Netlify and Railway.

## Deployment Steps

### Step 1: Deploy Backend to Railway

1. Login to Railway CLI:
```bash
railway login
```

2. Create a new Railway project:
```bash
railway init
```

3. Set environment variables in Railway:
```bash
railway variables set JWT_SECRET="your-secure-jwt-secret-here"
railway variables set CLIENT_URL="https://peppy-starburst-7c91fa.netlify.app"
railway variables set PORT="3035"
```

4. Deploy to Railway:
```bash
railway up
```

5. Get your Railway URL:
```bash
railway domain
```

### Step 2: Update Netlify Configuration

1. Update the `netlify.toml` file with your Railway URL:
```toml
[[redirects]]
  from = "/api/*"
  to = "https://YOUR-APP.up.railway.app/api/:splat"
  status = 200
  force = true
```

2. Set environment variables in Netlify:
   - Go to Netlify Dashboard > Site Settings > Environment Variables
   - Add: `VITE_API_URL` = `https://YOUR-APP.up.railway.app`
   - Add: `VITE_WS_URL` = `wss://YOUR-APP.up.railway.app`

3. Deploy to Netlify:
```bash
netlify deploy --prod
```

### Step 3: Fix CORS and WebSocket Issues

The backend needs to accept connections from your Netlify domain. Update the server CORS configuration if needed.

## Quick Fix Commands

Run these commands to fix the immediate issues:

```bash
# 1. Get your Railway URL
railway domain

# 2. Update netlify.toml with the Railway URL
# (manually edit the file)

# 3. Deploy both
railway up
netlify deploy --prod
```

## Testing

After deployment, test:
1. Visit https://peppy-starburst-7c91fa.netlify.app
2. Try to register a new user
3. Check if WebSocket connections work

## Environment Variables Summary

### Railway (Backend)
- `JWT_SECRET`: Your secure JWT secret
- `CLIENT_URL`: https://peppy-starburst-7c91fa.netlify.app
- `PORT`: 3035

### Netlify (Frontend)
- `VITE_API_URL`: https://YOUR-APP.up.railway.app
- `VITE_WS_URL`: wss://YOUR-APP.up.railway.app