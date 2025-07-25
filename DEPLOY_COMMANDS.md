# Deploy Commands - Ready to Copy/Paste

Your Railway backend is already deployed at: `https://minimal-chat-e2ee-production.up.railway.app`

## 1. Set Railway Environment Variable

```bash
railway variables --set CLIENT_URL="https://peppy-starburst-7c91fa.netlify.app"
```

Then redeploy Railway:
```bash
railway up
```

## 2. Link Netlify Project

```bash
netlify link
```
Choose: "Use current git remote origin"

## 3. Set Netlify Environment Variables

```bash
netlify env:set VITE_API_URL "https://minimal-chat-e2ee-production.up.railway.app"
netlify env:set VITE_WS_URL "wss://minimal-chat-e2ee-production.up.railway.app"
```

## 4. Deploy to Netlify

```bash
netlify deploy --prod --dir=dist
```

## All-in-One Command Sequence

```bash
# Set Railway CLIENT_URL
railway variables --set CLIENT_URL="https://peppy-starburst-7c91fa.netlify.app"
railway up

# Link and deploy to Netlify
netlify link
netlify env:set VITE_API_URL "https://minimal-chat-e2ee-production.up.railway.app"
netlify env:set VITE_WS_URL "wss://minimal-chat-e2ee-production.up.railway.app"
netlify deploy --prod --dir=dist
```

## Verify Deployment

After deployment, check:
1. https://peppy-starburst-7c91fa.netlify.app
2. Open browser console (F12)
3. Try to register/login
4. Check for any errors in console