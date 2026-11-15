// Cross-platform helper: copies the static assets into the standalone server output.
// Replaces `cp -r` so `npm run build` works on Windows CMD too (v4.6).
import { cpSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const staticSrc = join(root, '.next', 'static');
const staticDst = join(root, '.next', 'standalone', '.next', 'static');
const publicSrc = join(root, 'public');
const publicDst = join(root, '.next', 'standalone', 'public');

for (const [src, dst] of [[staticSrc, staticDst], [publicSrc, publicDst]]) {
  if (!existsSync(src)) {
    console.error(`[copy-standalone] missing ${src} — run "next build" first`);
    process.exit(1);
  }
  rmSync(dst, { recursive: true, force: true });
  cpSync(src, dst, { recursive: true });
  console.log(`[copy-standalone] ${src} -> ${dst}`);
}
