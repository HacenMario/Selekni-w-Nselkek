import { Schema, model, Document } from 'mongoose';

export interface ISubPackage {
  key: string;
  name: { ar: string; fr: string; en: string };
  priceDA: number;
  durationDays: number;
  maxActiveOffers: number;
  active: boolean;
  imageGridId?: string;
}

export interface ISettings extends Document {
  key: string;
  subscription: {
    isEnabled: boolean;
    priceDA: number;
    durationDays: number;
    maxActiveOffers: number;
    paymentInstructions: string;
  };
  packages: ISubPackage[];
  categories: { key: string; label: { ar: string; fr: string; en: string; tr?: string; es?: string; it?: string; de?: string; ru?: string; zh?: string }; icon: string }[];
  // v4.6 — "contact us" page, edited from the admin account
  contact: {
    phone: string;
    email: string;
    instagram: string;
    address: string;
  };
  updatedAt: Date;
}

export const DEFAULT_CATEGORIES = [
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
];

export const DEFAULT_PACKAGES: ISubPackage[] = [
  {
    key: 'starter',
    name: { ar: 'الباقة الأساسية', fr: 'Starter', en: 'Starter' },
    priceDA: 500,
    durationDays: 30,
    maxActiveOffers: 3,
    active: true,
  },
  {
    key: 'pro',
    name: { ar: 'الباقة الاحترافية', fr: 'Pro', en: 'Pro' },
    priceDA: 1200,
    durationDays: 90,
    maxActiveOffers: 10,
    active: true,
  },
];

const SettingsSchema = new Schema<ISettings>(
  {
    key: { type: String, default: 'main', unique: true },
    subscription: {
      isEnabled: { type: Boolean, default: true },
      priceDA: { type: Number, default: 500 },
      durationDays: { type: Number, default: 30 },
      maxActiveOffers: { type: Number, default: 3 },
      paymentInstructions: {
        type: String,
        default:
          'ادفع مبلغ الاشتراك عبر BaridiMob أو في مكتب البريد على حساب CCP الخاص بالمنصة، ثم أدخل رقم/مرجع عملية الدفع هنا. سيؤكد المشرف اشتراكك بعد التحقق. | Payez via BaridiMob ou au bureau de poste sur le compte CCP, puis saisissez la référence du paiement. Le super admin confirmera votre abonnement. | Pay via BaridiMob or at the post office, then enter the payment reference. The super admin will confirm your subscription.',
      },
    },
    packages: { type: [{ key: String, name: { ar: String, fr: String, en: String }, priceDA: Number, durationDays: Number, maxActiveOffers: Number, active: Boolean, imageGridId: String }], default: DEFAULT_PACKAGES },
    // v4.6 — "contact us" page, edited from the admin account
    contact: {
      type: { phone: String, email: String, instagram: String, address: String },
      default: { phone: '', email: '', instagram: '', address: '' },
    },
    categories: { type: [{ key: String, label: { ar: String, fr: String, en: String }, icon: String }], default: DEFAULT_CATEGORIES },
  },
  { timestamps: true }
);

export const Settings = model<ISettings>('Settings', SettingsSchema);

