# Fix Railway Backend Issues

## Current Status
✅ Frontend deployed to Netlify and trying to reach Railway
❌ Railway backend returning 502 (not running or crashed)
❌ CORS not configured for Netlify domain

## Steps to Fix

### 1. Check Railway Deployment Status

```bash
# Login to Railway
railway login

# Check if app is running
railway logs
```

### 2. Set Environment Variables in Railway

```bash
railway variables --set CLIENT_URL=https://peppy-starburst-7c91fa.netlify.app
railway variables --set JWT_SECRET=your-secure-jwt-secret-here
railway variables --set PORT=3035
```

### 3. Check Railway Build

Your Railway app might be failing to start. Common issues:

1. **Missing dependencies** - Make sure all dependencies are in package.json
2. **Database not initialized** - The app uses SQLite which should work
3. **Wrong start command** - Check railway.json

### 4. Redeploy to Railway

```bash
railway up
```

### 5. Check Logs for Errors

```bash
railway logs
```

Look for:
- "Server running on port 3035"
- Any error messages about missing modules
- Database initialization errors

## Quick Debug Commands

```bash
# See all Railway variables
railway variables

# Check deployment status
railway status

# View recent logs
railway logs --tail 100
```

## If Railway is Still Failing

1. Check if `node_modules` is in .gitignore
2. Ensure `package.json` has all dependencies
3. Try adding a `start` script to package.json:

```json
"scripts": {
  "start": "node server/index.js",
  ...
}
```