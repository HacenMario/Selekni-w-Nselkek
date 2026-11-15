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
  });
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

main().catch((err) => {
  console.error('[slekni] fatal', err);
  process.exit(1);
});
