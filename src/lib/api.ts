const API_PORT = process.env.NEXT_PUBLIC_API_PORT || '3100';

/**
 * In the sandbox preview everything goes through the gateway with relative paths.
 * In production (Vercel frontend + Railway server) set NEXT_PUBLIC_API_URL to the
 * Railway URL, e.g. https://slekni-api.up.railway.app
 */
const BASE = process.env.NEXT_PUBLIC_API_URL || '';

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const abs = `${BASE}/api${path}`;
  if (BASE) {
    // production: direct call to Railway
    if (!query) return abs;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') qs.set(k, String(v));
    const s = qs.toString();
    return s ? `${abs}?${s}` : abs;
  }
  // sandbox/dev: relative path through the gateway, port via XTransformPort
  const qs = new URLSearchParams();
  qs.set('XTransformPort', API_PORT);
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== '') qs.set(k, String(v));
  return `${abs}?${qs.toString()}`;
}

/** Absolute API URL (used for full-page redirects like Google OAuth). */
export function buildApiUrl(path: string): string {
  return buildUrl(path);
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function token(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('slekni.token');
}

export function setToken(t: string | null) {
  if (typeof window === 'undefined') return;
  if (t) localStorage.setItem('slekni.token', t);
  else localStorage.removeItem('slekni.token');
}

export function imageUrl(offerId: string, imageId: string): string {
  return buildUrl(`/images/${offerId}/${imageId}`);
}

/** Public marketing image of a subscription package (no auth needed). */
export function packageImageUrl(gridId: string): string {
  return buildUrl(`/media/package/${gridId}`);
}

export function avatarUrl(userId: string, version?: string): string {
  // <img> tags cannot send the Authorization header — token must ride in the query.
  // `version` (updatedAt) busts the HTTP cache so a freshly-uploaded photo shows instantly.
  const v = version ? encodeURIComponent(version) : undefined;
  return buildUrl(`/images/avatar/${userId}`, { token: token() || undefined, ...(v ? { v } : {}) });
}

export function subProofUrl(subscriptionId: string, imageId: string, tokenStr: string): string {
  // admin-only proof image: token passed via query for <img> support
  return buildUrl(`/images/sub/${subscriptionId}/${imageId}`, { token: tokenStr });
}

/** Admin-only ID-card photo for account verification review (query token for <img>). */
export function idCardUrl(userId: string, tokenStr: string): string {
  return buildUrl(`/images/idcard/${userId}`, { token: tokenStr });
}

export function videoUrl(offerId: string, gridId: string): string {
  return buildUrl(`/media/video/${offerId}/${gridId}`, { token: token() || undefined });
}

/** Authenticated media URL with the token embedded (for <img>/<video> tags). */
export function mediaUrl(path: string): string {
  const t = token();
  return buildUrl(path, t ? { token: t } : undefined);
}

const CHUNK = 4 * 1024 * 1024; // 4MB per chunk — passes every proxy/server limit

/**
 * Chunked video upload: works for files of ANY size (no server body limit involved).
 * 1) start -> uploadId, 2) raw chunks, 3) finalize -> GridFS id.
 */
export async function uploadVideo(
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ gridId: string; mime: string; size: number }> {
  const t = token();
  const headers: Record<string, string> = {};
  if (t) headers['Authorization'] = `Bearer ${t}`;

  const start = await fetch(buildUrl('/media/video/start'), { method: 'POST', headers });
  if (!start.ok) throw new ApiError('Upload failed to start', 'ERROR', start.status);
  const { uploadId } = (await start.json()) as { uploadId: string };

  const mime = file.type && file.type.startsWith('video/') ? file.type : 'video/mp4';
  const total = Math.ceil(file.size / CHUNK);
  for (let i = 0; i < total; i++) {
    const slice = file.slice(i * CHUNK, Math.min(file.size, (i + 1) * CHUNK));
    const res = await fetch(buildUrl('/media/video/chunk', { uploadId }), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/octet-stream' },
      body: slice,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(data.error || `Chunk ${i + 1}/${total} failed`, data.code || 'ERROR', res.status);
    }
    onProgress?.(Math.round(((i + 1) / total) * 100));
  }

  const fin = await fetch(buildUrl('/media/video/finalize', { uploadId, mime }), { method: 'POST', headers });
  const data = await fin.json().catch(() => ({}));
  if (!fin.ok) throw new ApiError(data.error || 'Finalize failed', data.code || 'ERROR', fin.status);
  onProgress?.(100);
  return data as { gridId: string; mime: string; size: number };
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  query?: Record<string, string | number | undefined>
): Promise<T> {
  const headers: Record<string, string> = {};
  const t = token();
  if (t) headers['Authorization'] = `Bearer ${t}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Network error', 'NETWORK', 0);
  }
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    const err = (data as { error?: string; code?: string }) || {};
    throw new ApiError(err.error || `HTTP ${res.status}`, err.code || 'ERROR', res.status);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Record<string, string | number | undefined>) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};
