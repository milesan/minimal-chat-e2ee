# CORS Configuration for Production

## Problem
The application was experiencing CORS errors when the frontend tried to connect to the backend API on Railway deployment.

## Solution
Updated the CORS configuration to be more flexible in production environments.

### Environment Variables

1. **CLIENT_URL**: Set this to your frontend URL (e.g., `https://your-frontend.vercel.app`)
2. **ALLOWED_ORIGINS**: Comma-separated list of allowed origins (optional, defaults to CLIENT_URL)

### Railway Configuration

Add these environment variables in your Railway project:

```bash
CLIENT_URL=https://your-frontend-domain.com
ALLOWED_ORIGINS=https://your-frontend-domain.com,https://another-allowed-domain.com
```

### Security Note

If `CLIENT_URL` is not set in production, the server will temporarily allow all origins with a warning. This is insecure and should only be used for testing. Always set `CLIENT_URL` in production.

### Changes Made

1. Added `ALLOWED_ORIGINS` to config.js to support multiple origins
2. Updated CORS middleware to use a dynamic origin validation function
3. Added support for OPTIONS method and exposed headers
4. Made Socket.IO use the same CORS configuration as Express

### Testing

To test locally:
```bash
# Set environment variables
export CLIENT_URL=http://localhost:3033
export JWT_SECRET=$(openssl rand -base64 32)

# Run the server
npm start
```

The server will now properly handle CORS requests from the configured origins.