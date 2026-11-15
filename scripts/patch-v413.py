#!/usr/bin/env python3
"""v4.13 — Google OAuth callback fix:
The Vercel deployment carried a dev-only rewrite (/api/* -> http://localhost:3100,
from the sandbox era). The OAuth callback redirect lands on
vercel.app/api/auth/google/callback, the rewrite sent Vercel's edge to localhost
(a private address) => 404 DNS_HOSTNAME_RESOLVED_PRIVATE. Fix: install the
rewrite ONLY when NEXT_PUBLIC_API_URL is unset (local dev), never in production.
Also: startup warning when Google login is configured but APP_URL is still the
localhost default (the callback would dead-end), and sharper .env.example docs."""
import io, json

def patch(path, pairs):
    p = '/home/z/my-project/' + path
    s = io.open(p, encoding='utf-8').read()
    for old, new in pairs:
        if new in s:
            print('SKIP', path, old[:40].replace('\n', ' '))
            continue
        assert s.count(old) == 1, f"{path}: expected 1 of {old[:64]!r}, found {s.count(old)}"
        s = s.replace(old, new)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('OK', path)

# 1) the critical fix — dev rewrite must not run in production
patch('next.config.ts', [
    ("""  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `http://localhost:${process.env.NEXT_PUBLIC_API_PORT || "3100"}/api/:path*`,
      },
    ];
  },""",
     """  async rewrites() {
    // v4.13 — ONLY for local dev / sandbox (client built without an absolute
    // API URL). In production the browser talks to the API server directly and
    // this rewrite must not exist: it sent Vercel's edge to localhost for the
    // Google OAuth callback, which dies with 404 DNS_HOSTNAME_RESOLVED_PRIVATE.
    if (process.env.NEXT_PUBLIC_API_URL) return [];
    return [
      {
        source: "/api/:path*",
        destination: `http://localhost:${process.env.NEXT_PUBLIC_API_PORT || "3100"}/api/:path*`,
      },
    ];
  },"""),
])

# 2) startup warning — misconfigurations visible in Railway logs
patch('mini-services/api-server/src/index.ts', [
    ("""    console.log(`[slekni] API ready on port ${env.port}`);""",
     """    console.log(`[slekni] API ready on port ${env.port}`);
    // v4.13 — surface social-login misconfigurations early in the deploy logs
    if (env.google.clientId && env.appUrl.startsWith('http://localhost')) {
      console.warn('[slekni] WARNING: GOOGLE_CLIENT_ID is set but APP_URL is still localhost — the Google callback would redirect users to localhost. Set APP_URL to the frontend origin (e.g. https://<app>.vercel.app).');
    }"""),
])

# 3) sharper env docs
patch('.env.example', [
    ("""# APP_URL=https://your-frontend.vercel.app
# GOOGLE_CLIENT_ID=<Google Cloud Console OAuth Web Client ID>
# GOOGLE_CLIENT_SECRET=<Google OAuth secret>
# GOOGLE_REDIRECT_URI=            # optional; defaults to <server>/api/auth/google/callback""",
     """# APP_URL is REQUIRED for Google login: the OAuth callback redirects here
# APP_URL=https://your-frontend.vercel.app
# GOOGLE_CLIENT_ID=<Google Cloud Console OAuth Web Client ID>
# GOOGLE_CLIENT_SECRET=<Google OAuth secret>
# GOOGLE_REDIRECT_URI            # optional; defaults to <this server>/api/auth/google/callback
#                                # (the URI must also be listed in Google Console →
#                                #  Credentials → Authorized redirect URIs)"""),
])

# 4) versions
for p in ['package.json', 'mini-services/api-server/package.json']:
    d = json.load(io.open('/home/z/my-project/' + p, encoding='utf-8'))
    d['version'] = '4.13.0'
    io.open('/home/z/my-project/' + p, 'w', encoding='utf-8').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
    print('OK', p, '-> 4.13.0')
sw = io.open('/home/z/my-project/public/sw.js', encoding='utf-8').read()
assert 'slekni-v4-12' in sw
io.open('/home/z/my-project/public/sw.js', 'w', encoding='utf-8').write(sw.replace('slekni-v4-12', 'slekni-v4-13'))
print('OK sw -> slekni-v4-13')
print('V4.13 PATCH DONE')
