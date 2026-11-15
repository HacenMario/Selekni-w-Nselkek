#!/usr/bin/env python3
"""v4.10 — attribution, Terms & Privacy page, free-tier resource guards:
- "By MADOUNINE Hacene" (ar: ببرمجة مادونين حسان) on auth/contact/profile/terms
- Terms & Privacy card in "My account" opening the fully translated legal page
- video upload capped at 30 MB (server + friendly client pre-check)
- GridFS video blobs purged on offer/user deletion + daily orphan cleanup
- notifications capped to the newest 150 per user
- 4 new i18n keys in ALL nine sections (477 x 9)"""
import io

def patch(path, pairs):
    p = '/home/z/my-project/' + path
    s = io.open(p, encoding='utf-8').read()
    for old, new in pairs:
        if new in s:
            print('SKIP', path, old[:44].replace('\n', ' '))
            continue
        assert s.count(old) == 1, f"{path}: expected 1 of {old[:64]!r}, found {s.count(old)}"
        s = s.replace(old, new)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('OK', path)

# ---------- 1) i18n: 4 keys x 9 sections (appended before each section close) ----------
BY = 'By MADOUNINE Hacene'
KEYS = {
 'ar': ["  // ── v4.10: حقوق المطور + الشروط والخصوصية + حد الفيديو ──",
        "  madeBy: 'ببرمجة مادونين حسان',",
        "  termsTitle: 'شروط الاستخدام والخصوصية',",
        "  termsIntro: 'القواعد المنظّمة لاستخدام التطبيق وكيف نحمي بياناتك وخصوصيتك',",
        "  videoTooLarge: 'الفيديو كبير جداً — الحد الأقصى 30 ميجابايت، اختر فيديو أقصر أو أخف',"],
 'fr': ["  // ── v4.10: droits du développeur + conditions + limite vidéo ──",
        f"  madeBy: '{BY}',",
        "  termsTitle: 'Conditions d\\'utilisation et Confidentialité',",
        "  termsIntro: 'Les règles qui régissent l\\'utilisation de l\\'application et la protection de vos données et de votre vie privée',",
        "  videoTooLarge: 'La vidéo est trop volumineuse — maximum 30 Mo, choisissez une vidéo plus courte ou plus légère',"],
 'en': ["  // ── v4.10: developer credit + terms + video limit ──",
        f"  madeBy: '{BY}',",
        "  termsTitle: 'Terms of Use & Privacy',",
        "  termsIntro: 'The rules governing the use of the app and how your data and privacy are protected',",
        "  videoTooLarge: 'The video is too large — the maximum is 30 MB, choose a shorter or lighter video',"],
 'tr': ["  // ── v4.10: geliştirici imzası + koşullar + video sınırı ──",
        f"  madeBy: '{BY}',",
        "  termsTitle: 'Kullanım Koşulları ve Gizlilik',",
        "  termsIntro: 'Uygulamanın kullanımını düzenleyen kurallar ve verilerinizin gizliliğinin nasıl korunduğu',",
        "  videoTooLarge: 'Video çok büyük — en fazla 30 MB, daha kısa veya hafif bir video seçin',"],
 'es': ["  // ── v4.10: crédito del desarrollador + términos + límite de vídeo ──",
        f"  madeBy: '{BY}',",
        "  termsTitle: 'Términos de uso y Privacidad',",
        "  termsIntro: 'Las reglas que rigen el uso de la aplicación y cómo se protegen sus datos y su privacidad',",
        "  videoTooLarge: 'El vídeo es demasiado grande — el máximo es 30 MB, elija un vídeo más corto o ligero',"],
 'it': ["  // ── v4.10: credito dello sviluppatore + termini + limite video ──",
        f"  madeBy: '{BY}',",
        "  termsTitle: 'Termini d\\'uso e Privacy',",
        "  termsIntro: 'Le regole che disciplinano l\\'uso dell\\'app e come sono protetti i tuoi dati e la tua privacy',",
        "  videoTooLarge: 'Il video è troppo grande — il massimo è 30 MB, scegli un video più corto o leggero',"],
 'de': ["  // ── v4.10: Entwickler-Signatur + Bedingungen + Videolimit ──",
        f"  madeBy: '{BY}',",
        "  termsTitle: 'Nutzungsbedingungen und Datenschutz',",
        "  termsIntro: 'Die Regeln für die Nutzung der App und wie Ihre Daten und Ihre Privatsphäre geschützt werden',",
        "  videoTooLarge: 'Das Video ist zu groß — maximal 30 MB, wählen Sie ein kürzeres oder leichteres Video',"],
 'ru': ["  // ── v4.10: подпись разработчика + условия + лимит видео ──",
        f"  madeBy: '{BY}',",
        "  termsTitle: 'Условия использования и конфиденциальность',",
        "  termsIntro: 'Правила пользования приложением и то, как защищаются ваши данные и приватность',",
        "  videoTooLarge: 'Видео слишком большое — максимум 30 МБ, выберите более короткое или лёгкое видео',"],
 'zh': ["  // ── v4.10：开发者署名 + 条款 + 视频上限 ──",
        f"  madeBy: '{BY}',",
        "  termsTitle: '使用条款与隐私政策',",
        "  termsIntro: '规范应用使用的规则，以及您的数据与隐私如何受到保护',",
        "  videoTooLarge: '视频太大——上限为 30 MB，请选择更短或更小的视频',"],
}
TAILS = {
 'ar': "  categoryFallbackHint: 'اللغات الإضافية تعرض التسمية الإنجليزية تلقائياً إن لم تُدخل ترجمتها',\n};",
 'fr': "  categoryFallbackHint: 'Les langues supplémentaires affichent automatiquement le libellé anglais si aucune traduction n\\'est saisie',\n};",
 'en': "  categoryFallbackHint: 'Additional languages automatically show the English label when no translation is provided',\n};",
 'tr': "  categoryFallbackHint: 'Çevirisi girilmeyen ek dillerde otomatik olarak İngilizce etiket gösterilir',\n};",
 'es': "  categoryFallbackHint: 'Los idiomas adicionales muestran automáticamente la etiqueta en inglés si no se introduce su traducción',\n};",
 'it': "  categoryFallbackHint: 'Le lingue aggiuntive mostrano automaticamente l\\'etichetta inglese se non ne viene inserita la traduzione',\n};",
 'de': "  categoryFallbackHint: 'Zusätzliche Sprachen zeigen automatisch die englische Bezeichnung, wenn keine Übersetzung eingegeben wurde',\n};",
 'ru': "  categoryFallbackHint: 'Дополнительные языки автоматически показывают английское название, если перевод не введён',\n};",
 'zh': "  categoryFallbackHint: '其他语言若未输入译文，将自动显示英文标签',\n};",
}
pairs = []
for lang, lines in KEYS.items():
    tail = TAILS[lang]
    new_tail = tail.replace('};', '\n'.join(lines) + '\n};')
    pairs.append(('src/lib/i18n.ts', [(tail, new_tail)]))
for path, pp in pairs:
    patch(path, pp)

# ---------- 2) AuthScreen: developer credit ----------
patch('src/components/app/screens/AuthScreen.tsx', [
    ("          <p className=\"text-xs text-muted-foreground text-center pt-1\">{t('subscriptionFree')}</p>\n        </div>",
     "          <p className=\"text-xs text-muted-foreground text-center pt-1\">{t('subscriptionFree')}</p>\n          <p className=\"text-[11px] font-semibold text-muted-foreground/80 text-center pt-3\">{t('madeBy')}</p>\n        </div>"),
])

# ---------- 3) ProfileScreen: Terms & Privacy card + credit ----------
patch('src/components/app/screens/ProfileScreen.tsx', [
    ("import {\n  BadgeCheck, ChevronLeft, Coins, Handshake, IdCard, LogOut, Moon, ShieldCheck,\n  Sparkles, Sun, TrendingUp, TriangleAlert, UserRound, Wrench,\n} from 'lucide-react';",
     "import {\n  BadgeCheck, ChevronLeft, Coins, FileText, Handshake, IdCard, LogOut, Moon, ShieldCheck,\n  Sparkles, Sun, TrendingUp, TriangleAlert, UserRound, Wrench,\n} from 'lucide-react';"),
    ("import { wilayaShort } from '@/lib/wilayas';",
     "import { wilayaShort } from '@/lib/wilayas';\nimport { TermsScreen } from '@/components/app/screens/TermsScreen';"),
    ("  const [name, setName] = useState(user?.name || '');",
     "  const [showTerms, setShowTerms] = useState(false);\n  const [name, setName] = useState(user?.name || '');"),
    ("""      {/* about / safety */}
      <SectionCard icon={TriangleAlert} title={t('safetyTitle')}>
        <p className="text-sm text-muted-foreground leading-relaxed break-words">{t('aboutBody')}</p>
      </SectionCard>
""",
     """      {/* about / safety */}
      <SectionCard icon={TriangleAlert} title={t('safetyTitle')}>
        <p className="text-sm text-muted-foreground leading-relaxed break-words">{t('aboutBody')}</p>
      </SectionCard>

      {/* v4.10 — Terms of Use & Privacy: elegant card opening the legal page */}
      <SectionCard icon={FileText} title={t('termsTitle')} action={
        <Button variant="ghost" size="sm" onClick={() => setShowTerms(true)} className="text-primary font-bold">
          {t('seeAll')}
        </Button>
      }>
        <p className="text-sm text-muted-foreground break-words">{t('termsIntro')}</p>
      </SectionCard>
      <p className="text-center text-[11px] font-semibold text-muted-foreground/80">{t('madeBy')}</p>
      {showTerms && <TermsScreen onClose={() => setShowTerms(false)} />}
"""),
])

# ---------- 4) ContactScreen: developer credit ----------
patch('src/components/app/screens/ContactScreen.tsx', [
    ("          <Button onClick={send} disabled={sending || subject.trim().length < 3 || message.trim().length < 5} className=\"w-full h-11 rounded-xl font-bold\">\n            {sending ? <Send className=\"h-4 w-4 animate-pulse\" /> : <Send className=\"h-4 w-4 me-1.5\" />} {t('contactSend')}\n          </Button>\n        </div>",
     "          <Button onClick={send} disabled={sending || subject.trim().length < 3 || message.trim().length < 5} className=\"w-full h-11 rounded-xl font-bold\">\n            {sending ? <Send className=\"h-4 w-4 animate-pulse\" /> : <Send className=\"h-4 w-4 me-1.5\" />} {t('contactSend')}\n          </Button>\n          <p className=\"text-center text-[11px] font-semibold text-muted-foreground/80 pt-1\">{t('madeBy')}</p>\n        </div>"),
])

# ---------- 5) CreateOfferScreen: friendly client pre-check (30 MB) ----------
patch('src/components/app/screens/CreateOfferScreen.tsx', [
    ("        {/* video — no size limit (GridFS) */}",
     "        {/* video — GridFS, capped at 30 MB to protect the free MongoDB tier */}"),
    ("""                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.currentTarget.value = '';
                  if (f) setVideo(f);
                }}""",
     """                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.currentTarget.value = '';
                  if (!f) return;
                  // v4.10 — friendly pre-check: refuse heavy videos before any upload bytes move
                  if (f.size > MAX_VIDEO_BYTES) { toast.error(t('videoTooLarge')); return; }
                  setVideo(f);
                }}"""),
])
s = io.open('/home/z/my-project/src/components/app/screens/CreateOfferScreen.tsx', encoding='utf-8').read()
if 'MAX_VIDEO_BYTES' in s and 'const MAX_VIDEO_BYTES' not in s:
    anchor = "'use client';"
    s = s.replace(anchor, anchor + "\n\n// v4.10 — video size cap (matches the server limit; protects the free MongoDB tier)\nconst MAX_VIDEO_BYTES = 30 * 1024 * 1024;", 1)
    io.open('/home/z/my-project/src/components/app/screens/CreateOfferScreen.tsx', 'w', encoding='utf-8').write(s)
    print('OK CreateOfferScreen const')

# ---------- 6) media.routes.ts: server-side 30 MB cap at finalize ----------
patch('mini-services/api-server/src/routes/media.routes.ts', [
    ("const TMP_DIR = path.join('/tmp', 'slekni-video-uploads');",
     "const TMP_DIR = path.join('/tmp', 'slekni-video-uploads');\n// v4.10 — server-side cap: protects the free MongoDB tier from huge video blobs\nconst MAX_VIDEO_BYTES = 30 * 1024 * 1024;"),
    ("""  const size = fs.statSync(p).size;
  if (size === 0) { res.status(400).json({ error: 'Empty file', code: 'EMPTY' }); return; }
""",
     """  const size = fs.statSync(p).size;
  if (size === 0) { res.status(400).json({ error: 'Empty file', code: 'EMPTY' }); return; }
  if (size > MAX_VIDEO_BYTES) {
    fs.promises.unlink(p).catch(() => {});
    res.status(413).json({ error: 'Video too large (max 30 MB)', code: 'VIDEO_TOO_LARGE' });
    return;
  }
"""),
])

# ---------- 7) admin.routes.ts: purge GridFS videos on offer/user deletion ----------
patch('mini-services/api-server/src/routes/admin.routes.ts', [
    ("""router.delete('/offers/:id', asyncH(async (req: AuthRequest, res) => {
  const offer = await Offer.findByIdAndDelete(req.params.id);
  if (!offer) { res.status(404).json({ error: 'Offer not found', code: 'NOT_FOUND' }); return; }
  await Notification.deleteMany({ 'data.offerId': req.params.id });
  res.json({ ok: true });
}));""",
     """router.delete('/offers/:id', asyncH(async (req: AuthRequest, res) => {
  // .select('+videos') — the schema hides video metadata by default (select: 0)
  const offer = await Offer.findByIdAndDelete(req.params.id).select('+videos');
  if (!offer) { res.status(404).json({ error: 'Offer not found', code: 'NOT_FOUND' }); return; }
  // v4.10 — purge the offer's GridFS video blobs so the free Mongo tier never leaks
  const db = mongoose.connection.db;
  if (db && offer.videos?.length) {
    const b = new mongoose.mongo.GridFSBucket(db, { bucketName: 'videos' });
    await Promise.all(offer.videos.map((v: any) => b.delete(v.gridId).catch(() => {})));
  }
  await Notification.deleteMany({ 'data.offerId': req.params.id });
  res.json({ ok: true });
}));"""),
    ("""  if (target.isSuperAdmin) { res.status(403).json({ error: 'The super admin account cannot be deleted', code: 'FORBIDDEN' }); return; }
  await Promise.all([""",
     """  if (target.isSuperAdmin) { res.status(403).json({ error: 'The super admin account cannot be deleted', code: 'FORBIDDEN' }); return; }
  // v4.10 — purge the GridFS video blobs of the deleted user's offers (free-tier protection)
  const gdb = mongoose.connection.db;
  if (gdb) {
    const gb = new mongoose.mongo.GridFSBucket(gdb, { bucketName: 'videos' });
    const own = await Offer.find({ owner: target._id }).select('videos.gridId').limit(2000);
    const ids = own.flatMap((o) => ((o.videos || []) as any[]).map((v) => v.gridId));
    if (ids.length > 0) await Promise.all(ids.map((id) => gb.delete(id).catch(() => {})));
  }
  await Promise.all(["""),
])

# ---------- 8) notification.service.ts: cap to the newest 150 per user ----------
patch('mini-services/api-server/src/services/notification.service.ts', [
    ("""    const docs = ids.map((id) => ({ user: id, type, data }));
    await Notification.insertMany(docs, { ordered: false });
    await Promise.allSettled(ids.map((id) => pushToUser(id, pushPayload(type, data))));""",
     """    const docs = ids.map((id) => ({ user: id, type, data }));
    await Notification.insertMany(docs, { ordered: false });
    // v4.10 — keep only the newest 150 notifications per user (free MongoDB tier protection)
    void pruneNotifications(ids as string[]);
    await Promise.allSettled(ids.map((id) => pushToUser(id, pushPayload(type, data))));"""),
    ("""/** Notify all super admins. */""",
     """/** v4.10 — fire-and-forget: trim each user's inbox to the newest NOTIF_CAP docs. */
const NOTIF_CAP = 150;

async function pruneNotifications(ids: string[]): Promise<void> {
  try {
    for (const id of ids) {
      const count = await Notification.countDocuments({ user: id });
      if (count <= NOTIF_CAP) continue;
      const cutoffDoc = await Notification.find({ user: id }).sort({ createdAt: -1 }).skip(NOTIF_CAP).limit(1).select('createdAt');
      if (cutoffDoc[0]) {
        await Notification.deleteMany({ user: id, createdAt: { $lte: cutoffDoc[0].createdAt } });
      }
    }
  } catch (err) {
    console.error('[notify] prune failed (ignored)', err);
  }
}

/** Notify all super admins. */"""),
])

# ---------- 9) index.ts: start the storage hygiene loop ----------
patch('mini-services/api-server/src/index.ts', [
    ("import { upsertSuperAdmin } from './services/superadmin.service';",
     "import { upsertSuperAdmin } from './services/superadmin.service';\nimport { startStorageHygiene } from './services/hygiene.service';"),
    ("  await connectDb();\n  await upsertSuperAdmin();",
     "  await connectDb();\n  await upsertSuperAdmin();\n  // v4.10 — daily cleanup of orphaned video blobs (free MongoDB tier protection)\n  startStorageHygiene();"),
])

# ---------- 10) layout metadata: author ----------
patch('src/app/layout.tsx', [
    ('  applicationName: "Selekni",',
     '  applicationName: "Selekni",\n  authors: [{ name: "MADOUNINE Hacene" }],\n  creator: "MADOUNINE Hacene",'),
])

print('V4.10 PATCHES DONE')
