#!/usr/bin/env python3
"""v4.9 i18n audit — finds every translation gap across all NINE languages:
1. keys referenced via t('…') in src/** but missing from any language section,
2. keys present in one section but absent in another (the "doesn't translate on switch" bug).
Prints a precise report; --fill backfills missing keys with a safe per-language fallback."""
import io, re, os, sys, collections

ROOT = '/home/z/my-project'
I18N = os.path.join(ROOT, 'src/lib/i18n.ts')
LANGS = ['ar', 'fr', 'en', 'tr', 'es', 'it', 'de', 'ru', 'zh']

text = io.open(I18N, encoding='utf-8').read()

# ---- locate every section (const <name>: Dict = { ... }) ----
sec = {}
for name in LANGS:
    m = re.search(rf"^const {name}: Dict = \{{", text, re.M)
    if not m:
        continue
    start = m.end()
    depth = 1
    i = start
    while depth > 0:
        c = text[i]
        if c == '{': depth += 1
        elif c == '}': depth -= 1
        i += 1
    sec[name] = text[start:i-1]

key_re = re.compile(r"^\s{2}([A-Za-z0-9_]+):\s*['\"`](.*)['\"`],\s*$", re.M)
dicts = {}
for name, body in sec.items():
    d = {}
    for k, v in key_re.findall(body):
        d[k] = v
    dicts[name] = d

counts = ' '.join(f"{l}={len(dicts[l])}" for l in LANGS if l in dicts)
print(f"{counts} keys per section")

found = [l for l in LANGS if l in dicts]
if len(found) < len(LANGS):
    print(f"!! MISSING SECTIONS: {', '.join(l for l in LANGS if l not in dicts)}")

# ---- collect referenced keys from all source files ----
used = collections.Counter()
ref_re = re.compile(r"""t\(\s*['"`]([A-Za-z0-9_]+)['"`]""")
for dirpath, _, files in os.walk(os.path.join(ROOT, 'src')):
    for f in files:
        if not f.endswith(('.tsx', '.ts')) or f == 'i18n.ts':
            continue
        s = io.open(os.path.join(dirpath, f), encoding='utf-8').read()
        for k in ref_re.findall(s):
            used[k] += 1

missing_used = {k: c for k, c in used.items() if any(k not in dicts.get(l, {}) for l in found)}
print(f"\n== used-but-missing (in any section): {len(missing_used)}")
for k, c in sorted(missing_used.items(), key=lambda x: -x[1]):
    have = [l for l in found if k in dicts[l]]
    print(f"  {k}  (used {c}x; has: {have or 'NONE'})")

allk = set()
for l in found:
    allk |= set(dicts[l])
not_in_all = []
for k in sorted(allk):
    lack = [l for l in found if k not in dicts[l]]
    if lack:
        not_in_all.append((k, lack))
print(f"\n== defined but not in ALL sections: {len(not_in_all)}")
for k, lack in not_in_all:
    print(f"  {k}  missing in: {lack}")

# also: placeholder parity ({x} params must exist in every translation)
ph_re = re.compile(r"\{([a-zA-Z]+)\}")
ph_bad = []
for k in sorted(allk):
    ref = None
    for l in ('ar', 'en'):
        if k in dicts.get(l, {}):
            ref = set(ph_re.findall(dicts[l][k]))
            break
    if not ref:
        continue
    for l in found:
        if k in dicts[l] and set(ph_re.findall(dicts[l][k])) != ref:
            ph_bad.append((k, l))
print(f"\n== placeholder mismatches: {len(ph_bad)}")
for k, l in ph_bad:
    print(f"  {k} in {l}")

if '--fill' in sys.argv:
    def esc(v):
        return v.replace('\\', '\\\\').replace("'", "\\'")
    # per-language fallback chain for backfilling
    ORDER = {
        'ar': ['ar', 'en', 'fr'], 'fr': ['fr', 'en', 'ar'], 'en': ['en', 'fr', 'ar'],
        'tr': ['en', 'fr', 'ar'], 'es': ['en', 'fr', 'ar'], 'it': ['en', 'fr', 'ar'],
        'de': ['en', 'fr', 'ar'], 'ru': ['en', 'fr', 'ar'], 'zh': ['en', 'fr', 'ar'],
    }
    out = text
    for name in found:
        m = re.search(rf"(const {name}: Dict = \{{)(.*?)(\n\}};)", text, re.S)
        body = m.group(2)
        missing = [k for k in sorted(allk) if k not in dicts[name]]
        if not missing:
            continue
        add = []
        for k in missing:
            v = next((dicts[src][k] for src in ORDER[name] if k in dicts.get(src, {})), k)
            add.append(f"  {k}: '{esc(v)}',")
        out = out.replace(m.group(1) + body + m.group(3),
                          m.group(1) + body + "\n  // v4.9 — audit backfill\n" + "\n".join(add) + m.group(3), 1)
        print(f"backfilled {len(missing)} keys into {name}")
    io.open(I18N, 'w', encoding='utf-8').write(out)
    print("WROTE", I18N)
