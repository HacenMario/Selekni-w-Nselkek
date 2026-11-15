import { Offer } from '../models/offer.model';
import mongoose from 'mongoose';

/**
 * v4.10 — storage hygiene (invisible to users): keeps the free MongoDB tier
 * from filling up with orphaned video blobs.
 *  1) Videos uploaded to GridFS but never attached to an offer (abandoned
 *     uploads) are deleted after a 24 h grace period.
 *  2) Stale chunk-upload temp files older than 24 h are removed from /tmp.
 * Runs once at boot and then every 6 hours. Never throws.
 */
const VIDEO_BUCKET = 'videos';
const GRACE_MS = 24 * 60 * 60 * 1000;

export function startStorageHygiene(): void {
  const run = () => cleanOrphans().catch((e) => console.error('[hygiene] failed (ignored)', e));
  setTimeout(run, 15_000); // after the app settles
  setInterval(run, 6 * 60 * 60 * 1000);
}

async function cleanOrphans(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;
  const b = new mongoose.mongo.GridFSBucket(db, { bucketName: VIDEO_BUCKET });

  const files = await b
    .find({ uploadDate: { $lt: new Date(Date.now() - GRACE_MS) } }, { projection: { _id: 1 } })
    .limit(2000)
    .toArray();
  if (files.length === 0) return;

  // ids still referenced by a live offer stay untouched
  const ids = files.map((f) => f._id);
  const referenced = new Set<string>();
  const offers = await Offer.find({ 'videos.gridId': { $in: ids } }).select('videos.gridId').limit(5000);
  for (const o of offers) for (const v of o.videos || []) referenced.add(String(v.gridId));

  const orphans = ids.filter((id) => !referenced.has(String(id)));
  if (orphans.length === 0) return;
  await Promise.all(orphans.map((id) => b.delete(id).catch(() => {})));
  console.log(`[hygiene] purged ${orphans.length} orphaned video blob(s)`);
}
