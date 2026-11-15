import { Router, Response } from 'express';
import express from 'express';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Offer } from '../models/offer.model';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncH } from '../middleware/error';

const router = Router();

function bucket(bucketName = 'videos'): mongoose.mongo.GridFSBucket {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB not connected');
  return new mongoose.mongo.GridFSBucket(db, { bucketName });
}

const TMP_DIR = path.join('/tmp', 'slekni-video-uploads');
// v4.10 — server-side cap: protects the free MongoDB tier from huge video blobs
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

function tmpPath(uploadId: string): string {
  // strict validation — the id never reaches the filesystem raw
  if (!/^[a-f0-9]{32}$/.test(uploadId)) throw new Error('bad upload id');
  return path.join(TMP_DIR, uploadId);
}

/**
 * Chunked video upload — works for files of ANY size:
 *  1) POST /video/start                       -> { uploadId }
 *  2) POST /video/chunk?uploadId=...          (raw bytes, one call per chunk)
 *  3) POST /video/finalize?uploadId=..&mime=  -> { gridId, size }
 * Chunks are appended to a temp file on disk, then streamed into GridFS.
 */
router.post('/video/start', auth, asyncH(async (_req: AuthRequest, res) => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const uploadId = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(tmpPath(uploadId), '');
  res.json({ uploadId });
}));

router.post(
  '/video/chunk',
  auth,
  express.raw({ type: () => true, limit: '12mb' }),
  asyncH(async (req: AuthRequest, res) => {
    const uploadId = String(req.query.uploadId || '');
    const buf: Buffer = req.body;
    if (!buf || buf.length === 0) { res.status(400).json({ error: 'Empty chunk', code: 'EMPTY' }); return; }
    const p = tmpPath(uploadId); // throws on a bad id (handled as 500)
    await fs.promises.appendFile(p, buf);
    res.json({ ok: true, received: buf.length });
  })
);

router.post('/video/finalize', auth, asyncH(async (req: AuthRequest, res: Response) => {
  const uploadId = String(req.query.uploadId || '');
  const mime0 = String(req.query.mime || 'video/mp4');
  const mime = mime0.startsWith('video/') ? mime0 : 'video/mp4';
  const p = tmpPath(uploadId);
  if (!fs.existsSync(p)) { res.status(404).json({ error: 'Upload not found — restart the upload', code: 'NOT_FOUND' }); return; }

  const size = fs.statSync(p).size;
  if (size === 0) { res.status(400).json({ error: 'Empty file', code: 'EMPTY' }); return; }
  if (size > MAX_VIDEO_BYTES) {
    fs.promises.unlink(p).catch(() => {});
    res.status(413).json({ error: 'Video too large (max 30 MB)', code: 'VIDEO_TOO_LARGE' });
    return;
  }

  const b = bucket();
  const gridId = await new Promise<mongoose.mongo.ObjectId>((resolve, reject) => {
    const stream = b.openUploadStream(`offer-video-${Date.now()}`, {
      metadata: { userId: String(req.user!._id), mime, size },
      contentType: mime,
    });
    stream.on('error', reject);
    stream.on('finish', () => resolve(stream.id as mongoose.mongo.ObjectId));
    fs.createReadStream(p).pipe(stream);
  });
  fs.promises.unlink(p).catch(() => {});
  res.status(201).json({ gridId: String(gridId), mime, size });
}));

/** Stream a video from GridFS with full HTTP Range support (seekable on desktop + mobile). */
router.get(
  '/video/:offerId/:gridId',
  auth,
  asyncH(async (req: AuthRequest, res: Response) => {
    const offer = await Offer.findOne({ _id: req.params.offerId }).select('videos');
    if (!offer) { res.status(404).json({ error: 'Offer not found', code: 'NOT_FOUND' }); return; }
    const meta = offer.videos.find((v) => String(v.gridId) === req.params.gridId);
    if (!meta) { res.status(404).json({ error: 'Video not found', code: 'NOT_FOUND' }); return; }

    const gridId = new mongoose.mongo.ObjectId(req.params.gridId);
    const b = bucket();
    const files = await b.find({ _id: gridId }).limit(1).toArray();
    const file = files[0];
    if (!file || file.length === 0) { res.status(404).json({ error: 'Video not found', code: 'NOT_FOUND' }); return; }

    const total = file.length;
    const mime = meta.mime || file.contentType || 'video/mp4';

    // Express routes HEAD through this GET handler — headers only, never a body
    if (req.method === 'HEAD') {
      res.set('Content-Type', mime);
      res.set('Accept-Ranges', 'bytes');
      res.set('Content-Length', String(total));
      res.end();
      return;
    }

    res.set('Content-Type', mime);
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'private, max-age=600');
    res.set('Content-Disposition', 'inline');

    // RFC 7233 single range; multi-range / malformed headers fall back to a full response
    const rh = req.headers.range;
    let start = 0;
    let end = total - 1;
    let partial = false;
    let badRange = false;
    if (rh && !rh.includes(',')) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(rh);
      if (m && (m[1] !== '' || m[2] !== '')) {
        if (m[1] === '') {
          // suffix form "bytes=-N": the last N bytes
          const n = Math.min(parseInt(m[2], 10), total);
          start = total - n;
          end = total - 1;
        } else {
          start = parseInt(m[1], 10);
          end = m[2] !== '' ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
        }
        if (start < total && start <= end) partial = true;
        else badRange = true;
      }
    }

    if (badRange) {
      res.status(416).set('Content-Range', `bytes */${total}`);
      res.json({ error: 'Bad range', code: 'BAD_RANGE' });
      return;
    }

    const streamOpts = partial ? { start, end: end + 1 } : undefined;
    if (partial) {
      res.status(206);
      res.set('Content-Range', `bytes ${start}-${end}/${total}`);
      res.set('Content-Length', String(end - start + 1));
    } else {
      res.set('Content-Length', String(total));
    }
    // GridFSBucketReadStream treats `end` as EXCLUSIVE — passing the inclusive end made
    // every ranged response one byte short of Content-Length, so the player stalled
    // forever waiting for a byte that never arrived (the v4 "video won't play" bug).
    const stream = b.openDownloadStream(gridId, streamOpts);
    // players open and abort range requests constantly — release the GridFS cursor
    res.on('close', () => stream.destroy());
    stream.on('error', () => res.end());
    stream.pipe(res);
  })
);

/** Public image of a subscription package (marketing content — no auth). */
router.get('/package/:gridId', asyncH(async (req: AuthRequest, res: Response) => {
  if (!/^[a-f0-9]{24}$/.test(req.params.gridId)) { res.status(400).json({ error: 'Bad id', code: 'BAD_ID' }); return; }
  // the upload route stores package images in the `packageImages` bucket —
  // the v4 serve route looked in `videos`, so uploaded images never resolved
  const b = bucket('packageImages');
  const files = await b.find({ _id: new mongoose.mongo.ObjectId(req.params.gridId) }).limit(1).toArray();
  const file = files[0];
  if (!file) { res.status(404).json({ error: 'Image not found', code: 'NOT_FOUND' }); return; }
  res.set('Content-Type', file.contentType || 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=86400');
  res.set('Content-Length', String(file.length));
  const stream = b.openDownloadStream(file._id);
  stream.on('error', () => res.end());
  stream.pipe(res);
}));

export default router;
