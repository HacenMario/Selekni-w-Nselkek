#!/usr/bin/env python3
"""v4.11 — production fixes:
1) languages save bug (double-sided): client saveProfile now sends languages;
   server patchMeSchema accepts all nine UI languages (was ar/fr/en max 3 — v1-era)
2) friendly API root route (GET / returned the generic 404 JSON)
3) adopt the deployed variants: RAILPACK builder + Arabic madeBy wording 'من تطوير'
4) version 4.11.0 + sw slekni-v4-11"""
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

# 1a) server: accept all nine UI languages (min 1 — toggleEnabled guarantees one)
patch('mini-services/api-server/src/routes/auth.routes.ts', [
    ("""  languages: z.array(z.enum(['ar', 'fr', 'en'])).min(1).max(3).optional(),""",
     """  // v4.11 — all nine UI languages (the v1-era schema only accepted ar/fr/en max 3,
  // so saving a profile with any newer language was rejected with VALIDATION)
  languages: z.array(z.enum(['ar', 'fr', 'en', 'tr', 'es', 'it', 'de', 'ru', 'zh'])).min(1).max(9).optional(),"""),
])

# 1b) client: actually include the chosen languages in the update-info request
patch('src/components/app/screens/ProfileScreen.tsx', [
    ("""      const updated = await api.patch<User>('/me', {
        name: name.trim(),
        phone: phone.trim(),
        wilaya,
        gender,
        bloodType: blood || undefined,
        ...(ageNum >= 12 && ageNum <= 100 ? { age: ageNum } : {}),
      });""",
     """      const updated = await api.patch<User>('/me', {
        name: name.trim(),
        phone: phone.trim(),
        wilaya,
        gender,
        bloodType: blood || undefined,
        ...(ageNum >= 12 && ageNum <= 100 ? { age: ageNum } : {}),
        // v4.11 — persist the chosen interface languages with the account
        // (they were only written to localStorage before, never sent to the server)
        languages: enabledLangs,
      });"""),
])

# 2) friendly root route — visiting the Railway domain no longer shows a bare 404
patch('mini-services/api-server/src/app.ts', [
    ("""  app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'slekni-api', time: new Date().toISOString() }));""",
     """  app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'slekni-api', time: new Date().toISOString() }));

  // v4.11 — friendly root: the API serves /api/* only; visiting the bare domain
  // now confirms the deployment instead of showing the generic 404 JSON
  app.get('/', (_req, res) => {
    res.json({
      ok: true,
      service: 'Selekni w Nselkek — API',
      developer: 'MADOUNINE Hacene',
      health: '/api/health',
      api: '/api/...',
    });
  });"""),
])

# 3a) railway.json — match the deployed working config (Railway switched to Railpack)
patch('mini-services/api-server/railway.json', [
    ('"builder": "NIXPACKS"', '"builder": "RAILPACK"'),
])

# 3b) Arabic attribution wording as deployed by the owner
patch('src/lib/i18n.ts', [
    ("  madeBy: 'ببرمجة مادونين حسان',", "  madeBy: 'من تطوير مادونين حسان',"),
])

# 4) versions
for p in ['package.json', 'mini-services/api-server/package.json']:
    d = json.load(io.open('/home/z/my-project/' + p, encoding='utf-8'))
    d['version'] = '4.11.0'
    io.open('/home/z/my-project/' + p, 'w', encoding='utf-8').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
    print('OK', p, '→ 4.11.0')
s = io.open('/home/z/my-project/public/sw.js', encoding='utf-8').read()
assert 'slekni-v4-10' in s
io.open('/home/z/my-project/public/sw.js', 'w', encoding='utf-8').write(s.replace('slekni-v4-10', 'slekni-v4-11'))
print('OK sw → slekni-v4-11')
print('V4.11 PATCHES DONE')
