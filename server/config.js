import dotenv from 'dotenv';

dotenv.config();

// Validate JWT_SECRET
if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET environment variable is required');
  console.error('Please set JWT_SECRET in your .env file or environment variables');
  console.error('Generate a secure secret with: openssl rand -base64 32');
  process.exit(1);
}

// Ensure JWT_SECRET is strong enough
if (process.env.JWT_SECRET.length < 32) {
  console.error('ERROR: JWT_SECRET must be at least 32 characters long');
  console.error('Generate a secure secret with: openssl rand -base64 32');
  process.exit(1);
}

// Check for common weak secrets
const weakSecrets = [
  'your-secret-key-change-in-production',
  'secret',
  'password',
  'jwt-secret',
  'change-me'
];

if (weakSecrets.includes(process.env.JWT_SECRET.toLowerCase())) {
  console.error('ERROR: JWT_SECRET contains a common weak value');
  console.error('Generate a secure secret with: openssl rand -base64 32');
  process.exit(1);
}

export const config = {
  JWT_SECRET: process.env.JWT_SECRET,
  PORT: parseInt(process.env.PORT) || 3035,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3033',
  NODE_ENV: process.env.NODE_ENV || 'development',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [process.env.CLIENT_URL || 'http://localhost:3033']
};