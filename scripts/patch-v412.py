#!/usr/bin/env python3
"""v4.12 — the REAL remaining languages bug: language-context kept a v1-era
whitelist ALL = ['ar','fr','en'] that (a) rejected any newer language from
localStorage on hydration and (b) filtered the server's saved list back down
to three on adoption — so the UI reverted to 3 even when the server had 9.
Fix: whitelist derives from the i18n dictionary; toggles also persist to the
account immediately (debounced PATCH /me) instead of waiting for the button."""
import io

patch_file = '/home/z/my-project/src/lib/language-context.tsx'
s = io.open(patch_file, encoding='utf-8').read()

# 1) whitelist from the dictionary (auto-extends with future languages)
old = """const ALL: Lang[] = ['ar', 'fr', 'en'];
const DEFAULT: LangStore = { lang: 'ar', enabled: ALL };"""
new = """// v4.12 — the whitelist must always match the full i18n dictionary: the stale
// v1-era hard-coded three rejected every newer language on hydration and
// filtered the account's saved list back down to three on adoption
const ALL: Lang[] = LANGS.map((l) => l.code);
const DEFAULT: LangStore = { lang: 'ar', enabled: ALL };"""
assert s.count(old) == 1
s = s.replace(old, new)

# 2) immediate (debounced) persistence on every toggle
old = """/* ---- react context ---- */"""
new = """/* v4.12 — persist language toggles to the account right away (debounced):
   the choice survives reloads and follows the user to any device without
   waiting for the “update info” button; guests keep localStorage only */
let syncTimer: ReturnType<typeof setTimeout> | null = null;
function queueServerSync(): void {
  if (typeof window === 'undefined') return;
  if (!useApp.getState().user) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    api.patch('/me', { languages: getSnapshot().enabled }).catch(() => {});
  }, 800);
}

/* ---- react context ---- */"""
assert s.count(old) == 1
s = s.replace(old, new)

old = """      const s = getSnapshot();
      if (s.enabled.includes(l)) {
        if (s.enabled.length === 1) return; // at least one language stays on
        const enabled = s.enabled.filter((x) => x !== l);
        update({ enabled, lang: enabled.includes(s.lang) ? s.lang : enabled[0] });
      } else {
        update({ enabled: [...s.enabled, l] });
      }"""
new = """      const s = getSnapshot();
      if (s.enabled.includes(l)) {
        if (s.enabled.length === 1) return; // at least one language stays on
        const enabled = s.enabled.filter((x) => x !== l);
        update({ enabled, lang: enabled.includes(s.lang) ? s.lang : enabled[0] });
      } else {
        update({ enabled: [...s.enabled, l] });
      }
      queueServerSync();"""
assert s.count(old) == 1
s = s.replace(old, new)

io.open(patch_file, 'w', encoding='utf-8').write(s)
print('OK language-context.tsx patched')

# versions
import json
for p in ['/home/z/my-project/package.json', '/home/z/my-project/mini-services/api-server/package.json']:
    d = json.load(io.open(p, encoding='utf-8'))
    d['version'] = '4.12.0'
    io.open(p, 'w', encoding='utf-8').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
    print('OK', p, '-> 4.12.0')
sw = io.open('/home/z/my-project/public/sw.js', encoding='utf-8').read()
assert 'slekni-v4-11' in sw
io.open('/home/z/my-project/public/sw.js', 'w', encoding='utf-8').write(sw.replace('slekni-v4-11', 'slekni-v4-12'))
print('OK sw -> slekni-v4-12')
print('V4.12 PATCH DONE')
