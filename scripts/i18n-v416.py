#!/usr/bin/env python3
"""v4.16 i18n upgrade: per-task dues control keys + phone-notification titles x9."""
import re, sys

P = 'src/lib/i18n.ts'
src = open(P, encoding='utf-8').read()

BLOCKS = {
'ar': """
  // ── v4.16 — per-task dues control, restored date picker, font card, push titles ──
  videoMaxHint: 'أقصى حجم للفيديو: 50 MB',
  duesPartiallyPaidBadge: 'مسدد جزئياً',
  duesPendingBadge: 'معلقة',
  duesTaskSection: 'مهام الشهر وحالة مستحقاتها',
  fontSizeCard: 'حجم خط التطبيق',
  fontSizeHint: 'اضبط حجم نصوص التطبيق ليناسب عينيك.',
  notifDuesReminder: 'تذكير بالمستحقات',
  notifDuesPaid: 'تم استلام المستحقات',
  notifDuesProofSubmitted: 'إثبات سداد جديد',
  notifDuesProofApproved: 'تم تأكيد سداد مستحقاتك',
  notifDuesProofRejected: 'تعذر تأكيد إثبات السداد',
""",
'fr': """
  // ── v4.16 — contrôle des commissions par tâche, sélecteur de date, carte police, titres push ──
  videoMaxHint: 'Taille maximale de la vidéo : 50 Mo',
  duesPartiallyPaidBadge: 'Partiellement réglé',
  duesPendingBadge: 'En attente',
  duesTaskSection: 'Tâches du mois et état de leurs commissions',
  fontSizeCard: 'Taille du texte de l’application',
  fontSizeHint: 'Ajustez la taille des textes pour vos yeux.',
  notifDuesReminder: 'Rappel de commissions',
  notifDuesPaid: 'Commissions reçues',
  notifDuesProofSubmitted: 'Nouveau justificatif',
  notifDuesProofApproved: 'Paiement des commissions confirmé',
  notifDuesProofRejected: 'Justificatif non confirmé',
""",
'en': """
  // ── v4.16 — per-task dues control, restored date picker, font card, push titles ──
  videoMaxHint: 'Maximum video size: 50 MB',
  duesPartiallyPaidBadge: 'Partly paid',
  duesPendingBadge: 'Pending',
  duesTaskSection: 'Month tasks and their dues state',
  fontSizeCard: 'App text size',
  fontSizeHint: 'Adjust the app text size to suit your eyes.',
  notifDuesReminder: 'Dues reminder',
  notifDuesPaid: 'Dues received',
  notifDuesProofSubmitted: 'New payment proof',
  notifDuesProofApproved: 'Dues payment confirmed',
  notifDuesProofRejected: 'Payment proof not confirmed',
""",
'tr': """
  // ── v4.16 — görev başına alacak kontrolü, tarih seçici, yazı boyutu kartı, push başlıkları ──
  videoMaxHint: 'Maksimum video boyutu: 50 MB',
  duesPartiallyPaidBadge: 'Kısmen ödendi',
  duesPendingBadge: 'Beklemede',
  duesTaskSection: 'Ayın görevleri ve alacak durumları',
  fontSizeCard: 'Uygulama yazı boyutu',
  fontSizeHint: 'Uygulama yazılarını gözünüze göre ayarlayın.',
  notifDuesReminder: 'Alacak hatırlatması',
  notifDuesPaid: 'Alacaklar alındı',
  notifDuesProofSubmitted: 'Yeni ödeme kanıtı',
  notifDuesProofApproved: 'Alacak ödemesi onaylandı',
  notifDuesProofRejected: 'Ödeme kanıtı onaylanmadı',
""",
'es': """
  // ── v4.16 — control de comisiones por tarea, selector de fecha, tarjeta de texto, títulos push ──
  videoMaxHint: 'Tamaño máximo del vídeo: 50 MB',
  duesPartiallyPaidBadge: 'Parcialmente pagado',
  duesPendingBadge: 'Pendiente',
  duesTaskSection: 'Tareas del mes y estado de sus comisiones',
  fontSizeCard: 'Tamaño del texto de la aplicación',
  fontSizeHint: 'Ajusta el tamaño de los textos a tu vista.',
  notifDuesReminder: 'Recordatorio de comisiones',
  notifDuesPaid: 'Comisiones recibidas',
  notifDuesProofSubmitted: 'Nuevo comprobante',
  notifDuesProofApproved: 'Pago de comisiones confirmado',
  notifDuesProofRejected: 'Comprobante no confirmado',
""",
'it': """
  // ── v4.16 — controllo commissioni per attività, selettore data, scheda testo, titoli push ──
  videoMaxHint: 'Dimensione massima del video: 50 MB',
  duesPartiallyPaidBadge: 'Parzialmente saldato',
  duesPendingBadge: 'In sospeso',
  duesTaskSection: 'Attività del mese e stato delle commissioni',
  fontSizeCard: 'Dimensione del testo dell’app',
  fontSizeHint: 'Regola la dimensione dei testi per i tuoi occhi.',
  notifDuesReminder: 'Promemoria commissioni',
  notifDuesPaid: 'Commissioni ricevute',
  notifDuesProofSubmitted: 'Nuovo giustificativo',
  notifDuesProofApproved: 'Pagamento commissioni confermato',
  notifDuesProofRejected: 'Giustificativo non confermato',
""",
'de': """
  // ── v4.16 — Gebührenkontrolle pro Aufgabe, Datumsauswahl, Schriftkarte, Push-Titel ──
  videoMaxHint: 'Maximale Videogröße: 50 MB',
  duesPartiallyPaidBadge: 'Teilweise bezahlt',
  duesPendingBadge: 'Ausstehend',
  duesTaskSection: 'Aufgaben des Monats und deren Gebührenstatus',
  fontSizeCard: 'App-Textgröße',
  fontSizeHint: 'Passe die Textgröße an deine Augen an.',
  notifDuesReminder: 'Gebühren-Erinnerung',
  notifDuesPaid: 'Gebühren erhalten',
  notifDuesProofSubmitted: 'Neuer Zahlungsnachweis',
  notifDuesProofApproved: 'Gebührenzahlung bestätigt',
  notifDuesProofRejected: 'Zahlungsnachweis nicht bestätigt',
""",
'ru': """
  // ── v4.16 — контроль задолженностей по заданиям, выбор даты, карта шрифта, заголовки push ──
  videoMaxHint: 'Максимальный размер видео: 50 МБ',
  duesPartiallyPaidBadge: 'Частично оплачено',
  duesPendingBadge: 'Ожидает',
  duesTaskSection: 'Задания месяца и состояние их задолженностей',
  fontSizeCard: 'Размер текста приложения',
  fontSizeHint: 'Настройте размер текста под ваши глаза.',
  notifDuesReminder: 'Напоминание о задолженности',
  notifDuesPaid: 'Задолженность получена',
  notifDuesProofSubmitted: 'Новое подтверждение оплаты',
  notifDuesProofApproved: 'Оплата задолженности подтверждена',
  notifDuesProofRejected: 'Подтверждение не подтверждено',
""",
'zh': """
  // ── v4.16 — 按任务控制应付款、日期选择器、字体卡片、推送标题 ──
  videoMaxHint: '视频最大尺寸：50 MB',
  duesPartiallyPaidBadge: '部分已付',
  duesPendingBadge: '待定',
  duesTaskSection: '本月任务及其应付款状态',
  fontSizeCard: '应用文字大小',
  fontSizeHint: '按您的需要调整应用文字大小。',
  notifDuesReminder: '应付款提醒',
  notifDuesPaid: '已收到应付款',
  notifDuesProofSubmitted: '新付款凭证',
  notifDuesProofApproved: '应付款已确认',
  notifDuesProofRejected: '付款凭证未确认',
""",
}

LANGS = ['ar', 'fr', 'en', 'tr', 'es', 'it', 'de', 'ru', 'zh']
for lang in LANGS:
    start = src.index(f'const {lang}: Dict = {{')
    end = src.index('\n};\n', start)
    src = src[:end] + BLOCKS[lang] + src[end:]

open(P, 'w', encoding='utf-8').write(src)

def keys_of(lang):
    start = src.index(f'const {lang}: Dict = {{')
    end = src.index('\n};\n', start)
    return set(re.findall(r"^  ([A-Za-z0-9_]+):", src[start:end], re.M))

base = keys_of('ar')
ok = True
for lang in LANGS:
    missing = base - keys_of(lang)
    if missing:
        ok = False
        print(f'{lang}: missing {sorted(missing)[:10]}')
print('v4.16 i18n done, zero-gap' if ok else 'GAPS FOUND', file=sys.stderr)
