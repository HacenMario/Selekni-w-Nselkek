import { createApp } from './app';
import { connectDb } from './config/db';
import { env } from './config/env';
import { upsertSuperAdmin } from './services/superadmin.service';
import { startStorageHygiene } from './services/hygiene.service';

async function main() {
  await connectDb();
  await upsertSuperAdmin();
  // v4.10 — daily cleanup of orphaned video blobs (free MongoDB tier protection)
  startStorageHygiene();
  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[slekni] API ready on port ${env.port}`);
    // v4.13 — surface social-login misconfigurations early in the deploy logs
    if (env.google.clientId && env.appUrl.startsWith('http://localhost')) {
      console.warn('[slekni] WARNING: GOOGLE_CLIENT_ID is set but APP_URL is still localhost — the Google callback would redirect users to localhost. Set APP_URL to the frontend origin (e.g. https://<app>.vercel.app).');
    }
  });
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

main().catch((err) => {
  console.error('[slekni] fatal', err);
  process.exit(1);
});
