#!/usr/bin/env python3
"""v4.9 tsc fixes: Lang import in wilayas.ts, widen pickLangText, uiTheme in IUser."""
import io

def patch(path, pairs):
    p = '/home/z/my-project/' + path
    s = io.open(p, encoding='utf-8').read()
    for old, new in pairs:
        assert s.count(old) == 1, f"{path}: {old[:60]!r} found {s.count(old)}"
        s = s.replace(old, new)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('OK', path)

patch('src/lib/wilayas.ts', [
    ("/** The 69 wilayas of Algeria (official division: 58 since 2019 + 11 promoted districts, Nov 2025) — bilingual labels. */",
     "import { Lang } from '@/lib/i18n';\n\n/** The 69 wilayas of Algeria (official division: 58 since 2019 + 11 promoted districts, Nov 2025) — multilingual labels. */"),
])
patch('src/components/app/screens/SubscriptionScreen.tsx', [
    ("function pickLangText(text: string, lang: 'ar' | 'fr' | 'en'): string {",
     "function pickLangText(text: string, lang: Lang): string {"),
    # lang union now 9 — the ternary falls back to index 2 (the English segment) for the new languages
    ("                      {pickLangText(info?.paymentInstructions || '', lang)}",
     "                      {pickLangText(info?.paymentInstructions || '', lang)}"),
])
# ensure Lang import exists in SubscriptionScreen
s = io.open('/home/z/my-project/src/components/app/screens/SubscriptionScreen.tsx', encoding='utf-8').read()
if "from '@/lib/i18n'" not in s:
    s = s.replace("'use client';\n", "'use client';\n\nimport { Lang } from '@/lib/i18n';\n", 1)
    io.open('/home/z/my-project/src/components/app/screens/SubscriptionScreen.tsx', 'w', encoding='utf-8').write(s)
    print('OK SubscriptionScreen import added')
else:
    # add Lang to an existing i18n import if missing
    import re
    m = re.search(r"import \{([^}]*)\} from '@/lib/i18n'", s)
    assert m, 'no i18n import found'
    names = [n.strip() for n in m.group(1).split(',')]
    if 'Lang' not in names:
        s = s.replace(m.group(0), "import { Lang, " + m.group(1) + " } from '@/lib/i18n'", 1)
        io.open('/home/z/my-project/src/components/app/screens/SubscriptionScreen.tsx', 'w', encoding='utf-8').write(s)
        print('OK Lang added to SubscriptionScreen i18n import')
    else:
        print('SKIP SubscriptionScreen (Lang already imported)')

patch('mini-services/api-server/src/models/user.model.ts', [
    ("  skills: string;\n  languages: string[];\n  authProvider: 'password' | 'google';",
     "  skills: string;\n  languages: string[];\n  // v4.9 — preferred interface accent color, applied on every device at login\n  uiTheme: string;\n  authProvider: 'password' | 'google';"),
])
print('V4.9 FIXES DONE')
