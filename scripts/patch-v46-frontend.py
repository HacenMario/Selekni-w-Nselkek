#!/usr/bin/env python3
# v4.6 frontend mechanical patches: i18n wording + new keys (x3 langs), types, live sub polling.
import io

def patch(path, pairs):
    s = io.open(path, encoding='utf-8').read()
    changed = 0
    for old, new in pairs:
        if new in s:
            print('SKIP (already applied)', path, old[:40])
            continue
        found = s.count(old)
        assert found == 1, f"{path}: expected 1 of {old[:70]!r}, found {found}"
        s = s.replace(old, new)
        changed += 1
    io.open(path, 'w', encoding='utf-8').write(s)
    print('OK', path, changed, 'patches applied')

I = '/home/z/my-project/src/lib/i18n.ts'

# 1) payment-proof wording — expresses the document that proves the payment succeeded (x3)
patch(I, [
    ("  paymentReferencePlaceholder: 'مثال: رقم عملية BaridiMob أو إشعار البريد',\n  attachProof: 'إرفاق صورة الإشعار (اختياري)',",
     "  paymentReferencePlaceholder: 'مثال: رقم عملية BaridiMob أو رقم وصل البريد',\n  attachProof: 'إرفاق صورة وصل الدفع (اختياري)',"),
    ("  paymentReferencePlaceholder: 'Ex : numéro de transaction BaridiMob ou avis postal',\n  attachProof: 'Joindre la preuve (facultatif)',",
     "  paymentReferencePlaceholder: 'Ex : numéro de transaction BaridiMob ou du reçu postal',\n  attachProof: 'Joindre la preuve de paiement (facultatif)',"),
    ("  paymentReferencePlaceholder: 'e.g. BaridiMob transaction number or postal notice',\n  attachProof: 'Attach proof photo (optional)',",
     "  paymentReferencePlaceholder: 'e.g. BaridiMob transaction number or postal receipt number',\n  attachProof: 'Attach proof of payment (optional)',"),
])

# 2) 'demandeur' is replaced by the professional 'porteur de tâche' (= task owner) everywhere in FR
patch(I, [
    ("  skillsSubtitle: 'Décrivez brièvement ce que vous savez faire (visible par le demandeur)',",
     "  skillsSubtitle: 'Décrivez brièvement ce que vous savez faire (visible par le porteur de tâche)',"),
    ("  ownerInfo: 'Infos du demandeur',", "  ownerInfo: 'Infos du porteur de tâche',"),
    ("  contactOwner: 'Contacter le demandeur',", "  contactOwner: 'Contacter le porteur de tâche',"),
    ("  byRoleOwner: 'Du demandeur',", "  byRoleOwner: 'Du porteur de tâche',"),
    ("  subscriptionTitle: 'Abonnement des demandeurs',", "  subscriptionTitle: 'Abonnement des porteurs de tâches',"),
    ("  ownerStats: 'Mes statistiques',", "  ownerStats: 'Statistiques du porteur de tâche',"),
])

# 3) new keys (x3) — contact page, stats wording
blocks = [
    ("  ownerStats: 'إحصائيات صاحب العرض',",
     """  ownerStats: 'إحصائياتي',
  // v4.6 — contact page
  contactUs: 'اتصل بنا',
  contactIntro: 'نجيب بسرعة — اختر نوع الرسالة واكتب لنا',
  contactInfo: 'معلومات التواصل',
  contactPhone: 'الهاتف',
  contactEmail: 'البريد الإلكتروني',
  contactFacebook: 'صفحة فيسبوك',
  contactAddress: 'العنوان',
  kindSuggestion: 'اقتراح',
  kindReport: 'بلاغ',
  kindComplaint: 'شكوى',
  contactSubject: 'الموضوع',
  contactMessage: 'الرسالة',
  contactSend: 'إرسال',
  contactSent: 'تم إرسال رسالتك، شكراً لك!',
  contactUnavailable: 'لم تُضبط معلومات التواصل بعد — أضفها من حساب الإدارة',"""),
    ("  ownerStats: 'Statistiques du porteur de tâche',",
     """  // v4.6 — contact page
  contactUs: 'Contactez-nous',
  contactIntro: 'Nous répondons vite — choisissez le type de message et écrivez-nous',
  contactInfo: 'Informations de contact',
  contactPhone: 'Téléphone',
  contactEmail: 'E-mail',
  contactFacebook: 'Page Facebook',
  contactAddress: 'Adresse',
  kindSuggestion: 'Suggestion',
  kindReport: 'Signalement',
  kindComplaint: 'Réclamation',
  contactSubject: 'Objet',
  contactMessage: 'Message',
  contactSend: 'Envoyer',
  contactSent: 'Message envoyé, merci !',
  contactUnavailable: 'Les informations de contact ne sont pas encore définies — ajoutez-les depuis le compte administrateur',"""),
    ("  ownerStats: 'Task owner stats',",
     """  ownerStats: 'My statistics',
  // v4.6 — contact page
  contactUs: 'Contact us',
  contactIntro: 'We answer fast — pick the message type and write to us',
  contactInfo: 'Contact information',
  contactPhone: 'Phone',
  contactEmail: 'E-mail',
  contactFacebook: 'Facebook page',
  contactAddress: 'Address',
  kindSuggestion: 'Suggestion',
  kindReport: 'Report',
  kindComplaint: 'Complaint',
  contactSubject: 'Subject',
  contactMessage: 'Message',
  contactSend: 'Send',
  contactSent: 'Your message was sent — thank you!',
  contactUnavailable: 'Contact information is not set yet — add it from the admin account',"""),
]
for anchor, repl in blocks:
    s = io.open(I, encoding='utf-8').read()
    if 'contactUs:' in s and 'contactSent' in repl and repl.split('contactUs: ')[1].split(',')[0] in s:
        print('SKIP contact block (already applied)')
        continue
    assert s.count(anchor) == 1, f"anchor {anchor[:40]!r} count {s.count(anchor)}"
    io.open(I, 'w', encoding='utf-8').write(s.replace(anchor, repl))
print('OK', I, '3 contact-key blocks')

# 4) stats wording — clearer by-package card + revenue/count labels (x3)
patch(I, [
    ("  subsByPackage: 'الاشتراكات حسب الباقة',", "  subsByPackagePaid: 'الاشتراكات المدفوعة حسب الباقة',\n  revenueShort: 'إيراد',\n  countLabel: 'العدد',"),
    ("  subsByPackage: 'Abonnements par forfait',", "  subsByPackagePaid: 'Abonnements payants par forfait',\n  revenueShort: 'Revenu',\n  countLabel: 'Nombre',"),
    ("  subsByPackage: 'Subscriptions by package',", "  subsByPackagePaid: 'Paid subscriptions by package',\n  revenueShort: 'Revenue',\n  countLabel: 'Count',"),
])

# 5) types — complaint kind + nullable offer; settings contact
patch('/home/z/my-project/src/lib/types.ts', [
    ("""export interface Complaint {
  _id: string;
  offer: { _id: string; title: string; status: string } | string;
  by: { _id: string; name: string; email?: string; phone?: string; role?: Role } | string;
  byRole?: Role;
  against?: { _id: string; name: string; email?: string; phone?: string; role?: Role } | string | null;
  subject: string;
  description: string;
  status: 'open' | 'resolved';
  resolution?: string;
  createdAt: string;
}""",
     """export interface Complaint {
  _id: string;
  offer?: { _id: string; title: string; status: string } | string | null;
  kind?: 'complaint' | 'suggestion' | 'report';
  by: { _id: string; name: string; email?: string; phone?: string; role?: Role } | string;
  byRole?: Role;
  against?: { _id: string; name: string; email?: string; phone?: string; role?: Role } | string | null;
  subject: string;
  description: string;
  status: 'open' | 'resolved';
  resolution?: string;
  createdAt: string;
}"""),
])

# 6) live subscription state — poll every 30s so an admin grant/activation shows instantly
for f, anchor in [
    ('/home/z/my-project/src/components/app/screens/MyOffersScreen.tsx',
     "    enabled: user?.role === 'owner' && !!settings?.subscription.isEnabled,\n  });"),
    ('/home/z/my-project/src/components/app/screens/SubscriptionScreen.tsx',
     "    queryFn: () => api.get<{ current: Subscription | null; locked?: boolean; packages: SubPackage[]; subscription: Settings['subscription'] }>('/subscriptions/mine'),"),
]:
    s = io.open(f, encoding='utf-8').read()
    assert s.count(anchor) == 1, f"{f}: anchor count {s.count(anchor)}"
    s = s.replace(anchor, anchor + "\n    // keeps an admin grant/activation visible within seconds — no stale 'expired' banner\n    refetchInterval: 30_000,")
    io.open(f, 'w', encoding='utf-8').write(s)
    print('OK polling', f)

# PromoBubble + ProfileScreen queries (same key, keep them fresh too)
patch('/home/z/my-project/src/components/app/PromoBubble.tsx', [
    ("    queryFn: () => api.get<{ current: Subscription | null }>('/subscriptions/mine'),",
     "    queryFn: () => api.get<{ current: Subscription | null }>('/subscriptions/mine'),\n    refetchInterval: 30_000, // no stale 'expired' state after an admin grant/activation"),
])
patch('/home/z/my-project/src/components/app/screens/ProfileScreen.tsx', [
    ("    queryFn: () => api.get<{ current: Subscription | null; subscription: Settings['subscription'] }>('/subscriptions/mine'),",
     "    queryFn: () => api.get<{ current: Subscription | null; subscription: Settings['subscription'] }>('/subscriptions/mine'),\n    refetchInterval: 30_000, // no stale 'expired' state after an admin grant/activation"),
])

print('ALL FRONTEND MECHANICAL PATCHES DONE')
