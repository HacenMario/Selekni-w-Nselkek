import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: Number(process.env.PORT || 3100),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/slekni',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  superAdmin: {
    email: (process.env.SUPER_ADMIN_EMAIL || 'admin@slekni.dz').toLowerCase(),
    password: process.env.SUPER_ADMIN_PASSWORD || 'SlekniAdmin#2026',
    name: process.env.SUPER_ADMIN_NAME || 'Super Admin',
  },
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:contact@slekni.dz',
  },
  // frontend origin — Google redirects come back here
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    // optional override; defaults to "<this server>/api/auth/google/callback"
    redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
  },
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()),
};
