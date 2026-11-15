#!/usr/bin/env python3
"""v4.9 core infrastructure:
- 9 languages (ar/fr/en/tr/es/it/de/ru/zh) in types, LANGS, audit tool
- 10 new task categories with full 9-language labels
- uiTheme field on user + PATCH /me
- contact page phone field (model + route + admin display)
- contact tab in the bottom navigation"""
import io

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

CAT_LBL = "{ ar: string; fr: string; en: string; tr?: string; es?: string; it?: string; de?: string; ru?: string; zh?: string }"

# ---------- 1) i18n.ts: 9-language type + LANGS with official flags ----------
patch('src/lib/i18n.ts', [
    ("export type Lang = 'ar' | 'fr' | 'en';",
     "export type Lang = 'ar' | 'fr' | 'en' | 'tr' | 'es' | 'it' | 'de' | 'ru' | 'zh';"),
    ("""export const LANGS: { code: Lang; name: string; flag: 'dz' | 'fr' | 'gb' }[] = [
  { code: 'ar', name: 'العربية', flag: 'dz' },
  { code: 'fr', name: 'Français', flag: 'fr' },
  { code: 'en', name: 'English', flag: 'gb' },
];""",
     """export type FlagCode = 'dz' | 'fr' | 'gb' | 'tr' | 'es' | 'it' | 'de' | 'ru' | 'zh';

export const LANGS: { code: Lang; name: string; flag: FlagCode }[] = [
  { code: 'ar', name: 'العربية', flag: 'dz' },
  { code: 'fr', name: 'Français', flag: 'fr' },
  { code: 'en', name: 'English', flag: 'gb' },
  { code: 'tr', name: 'Türkçe', flag: 'tr' },
  { code: 'es', name: 'Español', flag: 'es' },
  { code: 'it', name: 'Italiano', flag: 'it' },
  { code: 'de', name: 'Deutsch', flag: 'de' },
  { code: 'ru', name: 'Русский', flag: 'ru' },
  { code: 'zh', name: '中文', flag: 'zh' },
];"""),
    ("export function categoryLabel(cat: { key: string; label: { ar: string; fr: string; en: string } }, lang: Lang): string {\n  return cat.label[lang] || cat.label.en;\n}",
     f"export function categoryLabel(cat: {{ key: string; label: {CAT_LBL} }}, lang: Lang): string {{\n  return cat.label[lang] || cat.label.en || cat.label.fr || cat.label.ar;\n}}"),
])

# ---------- 2) ui-bits.tsx: new category icons + widened label type ----------
patch('src/components/app/ui-bits.tsx', [
    ("  Truck, Sparkles, Hammer, Package, Leaf, Paintbrush, Wrench, Ellipsis, HelpCircle,\n} from 'lucide-react';",
     "  Truck, Sparkles, Hammer, Package, Leaf, Paintbrush, Wrench, Ellipsis, HelpCircle,\n  Droplets, Zap, ChefHat, Scissors, Baby, GraduationCap, Monitor, Heart, Camera, PartyPopper,\n} from 'lucide-react';"),
    ("""const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  truck: Truck,
  sparkles: Sparkles,
  hammer: Hammer,
  package: Package,
  leaf: Leaf,
  paintbrush: Paintbrush,
  wrench: Wrench,
  ellipsis: Ellipsis,
};""",
     """const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  truck: Truck,
  sparkles: Sparkles,
  hammer: Hammer,
  package: Package,
  leaf: Leaf,
  paintbrush: Paintbrush,
  wrench: Wrench,
  ellipsis: Ellipsis,
  droplets: Droplets,
  zap: Zap,
  'chef-hat': ChefHat,
  scissors: Scissors,
  baby: Baby,
  'graduation-cap': GraduationCap,
  monitor: Monitor,
  heart: Heart,
  camera: Camera,
  'party-popper': PartyPopper,
};"""),
    (f"export function CategoryChip({{ cat, lang }}: {{ cat: {{ key: string; label: {{ ar: string; fr: string; en: string }}; icon: string }}; lang: Lang }}) {{",
     f"export function CategoryChip({{ cat, lang }}: {{ cat: {{ key: string; label: {CAT_LBL}; icon: string }}; lang: Lang }}) {{"),
])

# ---------- 3) types.ts: widened label types + Complaint.phone ----------
patch('src/lib/types.ts', [
    ("  name: { ar: string; fr: string; en: string };",
     "  name: { ar: string; fr: string; en: string; tr?: string; es?: string; it?: string; de?: string; ru?: string; zh?: string };"),
    ("  categories: { key: string; label: { ar: string; fr: string; en: string }; icon: string }[];",
     "  categories: { key: string; label: { ar: string; fr: string; en: string; tr?: string; es?: string; it?: string; de?: string; ru?: string; zh?: string }; icon: string }[];"),
    ("  subject: string;\n  description: string;\n  status: 'open' | 'resolved';\n  resolution?: string;\n  createdAt: string;\n}",
     "  subject: string;\n  description: string;\n  status: 'open' | 'resolved';\n  resolution?: string;\n  phone?: string;\n  createdAt: string;\n}"),
])

# ---------- 4) store: contact tab ----------
patch('src/store/app.ts', [
    ("export type Tab = 'feed' | 'tasks' | 'offers' | 'subscription' | 'notifications' | 'profile' | 'admin';",
     "export type Tab = 'feed' | 'tasks' | 'offers' | 'subscription' | 'notifications' | 'profile' | 'contact' | 'admin';"),
])

# ---------- 5) settings model: widened label + 10 new categories (9 languages each) ----------
patch('mini-services/api-server/src/models/settings.model.ts', [
    ("  categories: { key: string; label: { ar: string; fr: string; en: string }; icon: string }[];",
     "  categories: { key: string; label: { ar: string; fr: string; en: string; tr?: string; es?: string; it?: string; de?: string; ru?: string; zh?: string }; icon: string }[];"),
    ("""export const DEFAULT_CATEGORIES = [
  { key: 'moving', label: { ar: 'نقل أثاث', fr: 'Déménagement', en: 'Furniture moving' }, icon: 'truck' },
  { key: 'cleaning', label: { ar: 'تنظيف', fr: 'Nettoyage', en: 'Cleaning' }, icon: 'sparkles' },
  { key: 'assembly', label: { ar: 'تركيب ونجارة', fr: 'Montage & Menuiserie', en: 'Assembly & Carpentry' }, icon: 'hammer' },
  { key: 'delivery', label: { ar: 'توصيل', fr: 'Livraison', en: 'Delivery' }, icon: 'package' },
  { key: 'gardening', label: { ar: 'بستنة', fr: 'Jardinage', en: 'Gardening' }, icon: 'leaf' },
  { key: 'painting', label: { ar: 'صباغة', fr: 'Peinture', en: 'Painting' }, icon: 'paintbrush' },
  { key: 'repair', label: { ar: 'تصليح', fr: 'Réparation', en: 'Repair' }, icon: 'wrench' },
  { key: 'other', label: { ar: 'أخرى', fr: 'Autre', en: 'Other' }, icon: 'ellipsis' },
];""",
     """export const DEFAULT_CATEGORIES = [
  { key: 'moving', label: { ar: 'نقل أثاث', fr: 'Déménagement', en: 'Furniture moving', tr: 'Evden eve nakliyat', es: 'Mudanza de muebles', it: 'Trasloco mobili', de: 'Möbeltransport', ru: 'Переезд мебели', zh: '家具搬运' }, icon: 'truck' },
  { key: 'cleaning', label: { ar: 'تنظيف', fr: 'Nettoyage', en: 'Cleaning', tr: 'Temizlik', es: 'Limpieza', it: 'Pulizie', de: 'Reinigung', ru: 'Уборка', zh: '清洁' }, icon: 'sparkles' },
  { key: 'assembly', label: { ar: 'تركيب ونجارة', fr: 'Montage & Menuiserie', en: 'Assembly & Carpentry', tr: 'Montaj ve marangozluk', es: 'Montaje y carpintería', it: 'Montaggio e falegnameria', de: 'Montage & Schreinerei', ru: 'Сборка и столярные работы', zh: '安装与木工' }, icon: 'hammer' },
  { key: 'delivery', label: { ar: 'توصيل', fr: 'Livraison', en: 'Delivery', tr: 'Kurye & teslimat', es: 'Reparto y entrega', it: 'Consegne', de: 'Lieferung', ru: 'Доставка', zh: '配送跑腿' }, icon: 'package' },
  { key: 'gardening', label: { ar: 'بستنة', fr: 'Jardinage', en: 'Gardening', tr: 'Bahçecilik', es: 'Jardinería', it: 'Giardinaggio', de: 'Gartenarbeit', ru: 'Садоводство', zh: '园艺绿化' }, icon: 'leaf' },
  { key: 'painting', label: { ar: 'صباغة', fr: 'Peinture', en: 'Painting', tr: 'Boya badana', es: 'Pintura', it: 'Pittura', de: 'Malerarbeiten', ru: 'Покраска', zh: '油漆粉刷' }, icon: 'paintbrush' },
  { key: 'repair', label: { ar: 'تصليح', fr: 'Réparation', en: 'Repair', tr: 'Tamir & bakım', es: 'Reparación', it: 'Riparazioni', de: 'Reparatur', ru: 'Ремонт', zh: '维修' }, icon: 'wrench' },
  { key: 'plumbing', label: { ar: 'سباكة', fr: 'Plomberie', en: 'Plumbing', tr: 'Tesisatçılık', es: 'Fontanería', it: 'Idraulica', de: 'Sanitär & Rohre', ru: 'Сантехника', zh: '管道维修' }, icon: 'droplets' },
  { key: 'electrical', label: { ar: 'كهرباء', fr: 'Électricité', en: 'Electrical work', tr: 'Elektrik tesisatı', es: 'Electricidad', it: 'Impianti elettrici', de: 'Elektroinstallation', ru: 'Электромонтаж', zh: '电工电气' }, icon: 'zap' },
  { key: 'cooking', label: { ar: 'طبخ وتجهيز وجبات', fr: 'Cuisine & Traiteur', en: 'Cooking & Catering', tr: 'Yemek & ikram', es: 'Cocina y banquetes', it: 'Cucina e banqueting', de: 'Kochen & Catering', ru: 'Кулинария и кейтеринг', zh: '烹饪与餐饮' }, icon: 'chef-hat' },
  { key: 'sewing', label: { ar: 'خياطة وإصلاح الملابس', fr: 'Couture & Retouches', en: 'Sewing & Alterations', tr: 'Terzilik & onarım', es: 'Costura y arreglos', it: 'Cucito e sartoria', de: 'Schneiderei & Änderungen', ru: 'Шитьё и починка одежды', zh: '缝纫与修改' }, icon: 'scissors' },
  { key: 'babysitting', label: { ar: 'جليسة أطفال ومراقبة', fr: "Garde d'enfants", en: 'Babysitting & Childcare', tr: 'Çocuk bakımı', es: 'Cuidado de niños', it: 'Babysitting e bambini', de: 'Kinderbetreuung', ru: 'Присмотр за детьми', zh: '儿童照护' }, icon: 'baby' },
  { key: 'tutoring', label: { ar: 'دروس ودعم مدرسي', fr: 'Cours & Soutien scolaire', en: 'Tutoring & Lessons', tr: 'Özel ders & destek', es: 'Clases y refuerzo', it: 'Ripetizioni e lezioni', de: 'Nachhilfe & Unterricht', ru: 'Репетиторство и уроки', zh: '辅导与补习' }, icon: 'graduation-cap' },
  { key: 'tech', label: { ar: 'دعم تقني ومعلوماتية', fr: 'Support informatique', en: 'Tech & IT support', tr: 'Bilgisayar & BT desteği', es: 'Soporte técnico e informático', it: 'Supporto tecnico e informatico', de: 'Technik & IT-Support', ru: 'Техподдержка и IT', zh: '电脑与技术支持' }, icon: 'monitor' },
  { key: 'beauty', label: { ar: 'تجميل وعناية بالشعر', fr: 'Beauté & Coiffure', en: 'Beauty & Hairdressing', tr: 'Güzellik & kuaför', es: 'Belleza y peluquería', it: 'Bellezza e parrucchiere', de: 'Schönheit & Friseur', ru: 'Красота и парикмахерская', zh: '美容美发' }, icon: 'heart' },
  { key: 'photography', label: { ar: 'تصوير فوتوغرافي', fr: 'Photographie', en: 'Photography', tr: 'Fotoğrafçılık', es: 'Fotografía', it: 'Fotografia', de: 'Fotografie', ru: 'Фотография', zh: '摄影摄像' }, icon: 'camera' },
  { key: 'events', label: { ar: 'تنظيم حفلات ومناسبات', fr: "Organisation d'événements", en: 'Event planning', tr: 'Etkinlik organizasyonu', es: 'Organización de eventos', it: 'Organizzazione di eventi', de: 'Veranstaltungsorganisation', ru: 'Организация мероприятий', zh: '活动策划' }, icon: 'party-popper' },
  { key: 'other', label: { ar: 'أخرى', fr: 'Autre', en: 'Other', tr: 'Diğer', es: 'Otros', it: 'Altro', de: 'Sonstiges', ru: 'Другое', zh: '其他' }, icon: 'ellipsis' },
];"""),
])

# ---------- 6) user model: uiTheme ----------
patch('mini-services/api-server/src/models/user.model.ts', [
    ("    languages: { type: [String], default: ['ar', 'fr', 'en'] },",
     "    languages: { type: [String], default: ['ar', 'fr', 'en'] },\n    // v4.9 — preferred interface accent color, applied on every device at login\n    uiTheme: { type: String, default: '', maxlength: 20 },"),
])

# ---------- 7) PATCH /me accepts uiTheme (spread into $set automatically) ----------
patch('mini-services/api-server/src/routes/auth.routes.ts', [
    ("  interests: z.array(z.string().max(60)).max(20).optional(),",
     "  interests: z.array(z.string().max(60)).max(20).optional(),\n  // v4.9 — preferred interface accent color (violet/blue/cyan/teal/emerald/amber/orange/rose/pink/indigo)\n  uiTheme: z.string().max(20).optional(),"),
])

# ---------- 8) complaints: phone on the contact form ----------
patch('mini-services/api-server/src/models/complaint.model.ts', [
    ("  subject: string;\n  description: string;\n  status: 'open' | 'resolved';",
     "  subject: string;\n  description: string;\n  // v4.9 — optional phone number so the administration can call the sender back\n  phone?: string;\n  status: 'open' | 'resolved';"),
    ("    subject: { type: String, required: true, trim: true, maxlength: 120 },\n    description: { type: String, required: true, trim: true, maxlength: 1500 },",
     "    subject: { type: String, required: true, trim: true, maxlength: 120 },\n    description: { type: String, required: true, trim: true, maxlength: 1500 },\n    phone: { type: String, trim: true, maxlength: 20 },"),
])
patch('mini-services/api-server/src/routes/complaints.routes.ts', [
    ("""  const body = z.object({
    kind: z.enum(['suggestion', 'report', 'complaint']).default('suggestion'),
    subject: z.string().min(3).max(120),
    message: z.string().min(5).max(1500),
  }).parse(req.body);
  const complaint = await Complaint.create({
    kind: body.kind,
    by: req.user!._id,
    byRole: req.user!.role,
    subject: body.subject,
    description: body.message,
    status: 'open',
  });""",
     """  const body = z.object({
    kind: z.enum(['suggestion', 'report', 'complaint']).default('suggestion'),
    subject: z.string().min(3).max(120),
    message: z.string().min(5).max(1500),
    // v4.9 — optional callback number so the administration can reach the sender
    phone: z.string().max(20).optional(),
  }).parse(req.body);
  const complaint = await Complaint.create({
    kind: body.kind,
    by: req.user!._id,
    byRole: req.user!.role,
    subject: body.subject,
    description: body.message,
    ...(body.phone && body.phone.trim().length >= 6 ? { phone: body.phone.trim() } : {}),
    status: 'open',
  });"""),
])

# ---------- 9) admin complaints tab: phone chip with tel: link ----------
patch('src/components/app/screens/AdminScreen.tsx', [
    ("""              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                <span>{t('requester')}: <b className="text-foreground">{name(c.by)}</b></span>
                {c.against && <span>· {t('againstUser')}: <b className="text-foreground">{name(c.against)}</b></span>}
                <span className="ms-auto">{timeAgo(c.createdAt, t)}</span>
              </div>""",
     """              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                <span>{t('requester')}: <b className="text-foreground">{name(c.by)}</b></span>
                {c.against && <span>· {t('againstUser')}: <b className="text-foreground">{name(c.against)}</b></span>}
                <span className="ms-auto">{timeAgo(c.createdAt, t)}</span>
              </div>
              {/* v4.9 — callback phone the sender left on the contact page */}
              {c.phone && (
                <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 w-fit hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors" dir="ltr">
                  <Phone className="h-3 w-3" /> {c.phone}
                </a>
              )}"""),
])

# ---------- 10) audit tool: 9 sections ----------
patch('scripts/i18n-audit.py', [
    ("for name in ('ar', 'fr', 'en'):", "for name in ('ar', 'fr', 'en', 'tr', 'es', 'it', 'de', 'ru', 'zh'):"),
])
print('V4.9 CORE PATCHES DONE')
