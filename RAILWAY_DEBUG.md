# Railway Debug Steps

Since your deployment shows as successful but returns 502, check these:

## 1. Check Railway Logs
In the Railway dashboard, click on your service and go to the "Logs" tab to see what's happening.

Look for:
- "Server running on port 3035"
- Any error messages
- Database initialization issues

## 2. Missing Environment Variables
You need to set these in Railway:

```bash
railway variables --set JWT_SECRET="your-secure-jwt-secret-here"
railway variables --set PORT=3035
```

Or add them in the Railway dashboard under "Variables" tab.

## 3. Common Railway Issues

### Port Binding
Railway expects your app to bind to the PORT environment variable. Let's check if this is happening correctly.

### Database Path
SQLite needs a writable location. The app creates `data.db` in the project root.

## 4. Quick Fix Script

Run these commands:

```bash
# Set missing variables
railway variables --set JWT_SECRET="change-this-to-secure-secret"
railway variables --set PORT=3035

# Redeploy
railway up

# Check logs
railway logs --tail 100
```

## 5. If Still Failing

The issue might be:
1. **Missing JWT_SECRET** - The app requires this to start
2. **Port binding** - Railway might be assigning a different PORT
3. **Database permissions** - SQLite file creation failing

Check the logs in Railway dashboard for the exact error!