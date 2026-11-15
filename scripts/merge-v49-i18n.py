#!/usr/bin/env python3
"""v4.9 — merge the six new dictionaries (tr/es/it/de/ru/zh) into src/lib/i18n.ts.
Verifies 1:1 key parity with the ar section (order included), then inserts the
sections and extends the dictionaries export to all nine languages."""
import io, re, sys

ROOT = '/home/z/my-project'
I18N = ROOT + '/src/lib/i18n.ts'
NEW = ['tr', 'es', 'it', 'de', 'ru', 'zh']

text = io.open(I18N, encoding='utf-8').read()

# ---- ordered key list from the ar section ----
m = re.search(r"^const ar: Dict = \{", text, re.M)
start = m.end(); depth = 1; i = start
while depth > 0:
    c = text[i]
    if c == '{': depth += 1
    elif c == '}': depth -= 1
    i += 1
ar_body = text[start:i-1]
key_re = re.compile(r"^\s{2}([A-Za-z0-9_]+):", re.M)
ar_keys = key_re.findall(ar_body)
ar_set = set(ar_keys)
print(f"ar keys: {len(ar_keys)} ({len(ar_set)} unique)")

ok = True
bodies = {}
for lang in NEW:
    frag = io.open(f'{ROOT}/scripts/i18n-v49/{lang}.ts', encoding='utf-8').read()
    m2 = re.search(rf"^const {lang}: Dict = \{{", frag, re.M)
    assert m2, lang
    s2 = m2.end(); depth = 1; i2 = s2
    while depth > 0:
        c = frag[i2]
        if c == '{': depth += 1
        elif c == '}': depth -= 1
        i2 += 1
    body = frag[s2:i2-1]
    keys = key_re.findall(body)
    missing = [k for k in ar_keys if k not in set(keys)]
    extra = [k for k in keys if k not in ar_set]
    dup = len(keys) - len(set(keys))
    print(f"{lang}: {len(keys)} keys, missing={len(missing)}, extra={extra[:4]}, dup={dup}")
    if missing:
        ok = False
        print('  MISSING:', missing[:12])
    if extra:
        ok = False
    # any keys out of ar order? (not fatal, just informative)
    bodies[lang] = body.strip()

if not ok:
    sys.exit('KEY PARITY FAILED — fix the fragments above')

# ---- polish two known imperfections ----
bodies['de'] = bodies['de'].replace("extendSub: 'Abo verlängern (dauerverlängerung)',", "extendSub: 'Abo verlängern',")
bodies['ru'] = bodies['ru'].replace('чтобы сохран возможность', 'чтобы сохранить возможность')

# ---- insert the six sections before the dictionaries export ----
anchor = 'export const dictionaries: Record<Lang, Dict> = { ar, fr, en };'
assert text.count(anchor) == 1, 'dictionaries export anchor not found'
sections = ''.join(f"\nconst {lang}: Dict = {{\n  {bodies[lang]}\n}};\n" for lang in NEW)
new_export = 'export const dictionaries: Record<Lang, Dict> = { ar, fr, en, tr, es, it, de, ru, zh };'
text = text.replace(anchor, sections + '\n' + new_export)

io.open(I18N, 'w', encoding='utf-8').write(text)
print('MERGED into', I18N)
