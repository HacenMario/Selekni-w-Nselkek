#!/usr/bin/env python3
"""Patch i18n.ts: new role labels + new keys for the 3 dictionaries."""
import re

P = '/home/z/my-project/src/lib/i18n.ts'
s = open(P, encoding='utf-8').read()

# ---- role labels (ar) ----
s = s.replace(
    "  roleOwner: 'صاحب عرض',\n  roleOwnerDesc: 'أريد من شخص ما إنجاز عمل عني',\n  roleSeeker: 'باحث عن عمل',\n  roleSeekerDesc: 'أبحث عن أشغال مقابل أجر',",
    "  roleOwner: 'صاحب المهمة',\n  roleOwnerDesc: 'عندي عمل أو مهمة أريد من أحد إنجازها عني',\n  roleSeeker: 'منفّذ المهام',\n  roleSeekerDesc: 'أبحث عن أعمال ومهام مقابل أجر',"
)
# ---- role labels (fr) ----
s = s.replace(
    "  roleOwner: 'Demandeur',\n  roleOwnerDesc: 'Je veux que quelqu\\'un fasse un travail à ma place',\n  roleSeeker: 'Chercheur d\\'emploi',\n  roleSeekerDesc: 'Je cherche des petits boulots payés',",
    "  roleOwner: 'Client',\n  roleOwnerDesc: 'J\\'ai une tâche que je veux confier à quelqu\\'un',\n  roleSeeker: 'Prestataire',\n  roleSeekerDesc: 'Je cherche des travaux et missions payées',"
)
# ---- role labels (en) ----
s = s.replace(
    "  roleOwner: 'Task owner',\n  roleOwnerDesc: 'I want someone to do a task for me',\n  roleSeeker: 'Job seeker',\n  roleSeekerDesc: 'I\\'m looking for paid gigs',",
    "  roleOwner: 'Client',\n  roleOwnerDesc: 'I have a task I want someone to do for me',\n  roleSeeker: 'Tasker',\n  roleSeekerDesc: 'I\\'m looking for paid gigs and missions',"
)

AR_KEYS = """
  // font size control
  fontLarger: 'تكبير الخط',
  fontSmaller: 'تصغير الخط',
  roleAdmin: 'المشرف الأعلى',
  accountType: 'نوع الحساب',
  videoUploadingProgress: 'جارٍ رفع الفيديو... {pct}%',
  daysLeft: 'متبقٍ {count} يوم',
  dayLeftOne: 'يوم واحد متبقٍ',
  subExpiringSoon: 'اشتراكك على وشك الانتهاء — جدّد الآن ليبقى نشر عروضك متاحاً',
  subActiveBadge: 'اشتراك ساري المفعول',
  packages: 'الباقات',
  choosePackage: 'اختر الباقة المناسبة',
  noPackages: 'لا توجد باقات متاحة حالياً',
  packageOffers: 'عروض نشطة',
  subProgress: 'تقدم الاشتراك',
  promoTitle: 'هل تريد نشر عروض عمل؟',
  promoBody: 'فعّل اشتراكك وانشر مهامك ليجدك المنفّذون بسرعة — عدة باقات تناسبك.',
  promoCta: 'اكتشف الباقات',
  editUser: 'تعديل الحساب',
  deleteUser: 'حذف الحساب',
  deleteUserConfirm: 'سيتم حذف هذا الحساب نهائياً مع كل عروضه واشتراكاته. لا يمكن التراجع.',
  disableUser: 'تعطيل الحساب',
  enableUser: 'تفعيل الحساب',
  userDetails: 'تفاصيل الحساب',
  sendToUser: 'إرسال إلى مستخدم محدد',
  sendToAll: 'إرسال إلى الجميع',
  selectUser: 'اختر المستخدم',
  notifSent: 'تم إرسال الإشعار بنجاح',
  expiringSubs: 'اشتراكات تحتاج تجديداً',
  contactAccount: 'اتصل بصاحب الحساب',
  addPackage: 'إضافة باقة',
  packageName: 'اسم الباقة',
  removePackage: 'حذف الباقة',
  saved: 'تم الحفظ',
};"""
FR_KEYS = """
  fontLarger: 'Agrandir le texte',
  fontSmaller: 'Réduire le texte',
  roleAdmin: 'Super admin',
  accountType: 'Type de compte',
  videoUploadingProgress: 'Envoi de la vidéo... {pct}%',
  daysLeft: '{count} jours restants',
  dayLeftOne: '1 jour restant',
  subExpiringSoon: 'Votre abonnement expire bientôt — renouvelez-le pour continuer à publier vos offres',
  subActiveBadge: 'Abonnement actif',
  packages: 'Forfaits',
  choosePackage: 'Choisissez le forfait adapté',
  noPackages: 'Aucun forfait disponible pour le moment',
  packageOffers: 'offres actives',
  subProgress: 'Progression de l\\'abonnement',
  promoTitle: 'Publiez vos offres de travail !',
  promoBody: 'Activez votre abonnement et publiez vos tâches — les prestataires les trouveront rapidement. Plusieurs forfaits disponibles.',
  promoCta: 'Découvrir les forfaits',
  editUser: 'Modifier le compte',
  deleteUser: 'Supprimer le compte',
  deleteUserConfirm: 'Ce compte et toutes ses offres seront définitivement supprimés. Action irréversible.',
  disableUser: 'Désactiver le compte',
  enableUser: 'Activer le compte',
  userDetails: 'Détails du compte',
  sendToUser: 'Envoyer à un utilisateur précis',
  sendToAll: 'Envoyer à tout le monde',
  selectUser: 'Choisir l\\'utilisateur',
  notifSent: 'Notification envoyée',
  expiringSubs: 'Abonnements à renouveler',
  contactAccount: 'Contacter le titulaire',
  addPackage: 'Ajouter un forfait',
  packageName: 'Nom du forfait',
  removePackage: 'Supprimer le forfait',
  saved: 'Enregistré',
};"""
EN_KEYS = """
  fontLarger: 'Larger text',
  fontSmaller: 'Smaller text',
  roleAdmin: 'Super admin',
  accountType: 'Account type',
  videoUploadingProgress: 'Uploading video... {pct}%',
  daysLeft: '{count} days left',
  dayLeftOne: '1 day left',
  subExpiringSoon: 'Your subscription is about to expire — renew now to keep posting offers',
  subActiveBadge: 'Active subscription',
  packages: 'Packages',
  choosePackage: 'Choose the right package',
  noPackages: 'No packages available right now',
  packageOffers: 'active offers',
  subProgress: 'Subscription progress',
  promoTitle: 'Want to post work offers?',
  promoBody: 'Activate your subscription and publish your tasks — taskers will find you fast. Several packages available.',
  promoCta: 'Discover packages',
  editUser: 'Edit account',
  deleteUser: 'Delete account',
  deleteUserConfirm: 'This account and all its offers will be permanently deleted. This cannot be undone.',
  disableUser: 'Disable account',
  enableUser: 'Enable account',
  userDetails: 'Account details',
  sendToUser: 'Send to a specific user',
  sendToAll: 'Send to everyone',
  selectUser: 'Select user',
  notifSent: 'Notification sent',
  expiringSubs: 'Subscriptions needing renewal',
  contactAccount: 'Contact the account owner',
  addPackage: 'Add package',
  packageName: 'Package name',
  removePackage: 'Remove package',
  saved: 'Saved',
};"""

s = s.replace("  offline: 'أنت غير متصل',\n};", "  offline: 'أنت غير متصل',\n" + AR_KEYS)
s = s.replace("  offline: 'Vous êtes hors ligne',\n};", "  offline: 'Vous êtes hors ligne',\n" + FR_KEYS)
s = s.replace("  offline: 'You are offline',\n};", "  offline: 'You are offline',\n" + EN_KEYS)

open(P, 'w', encoding='utf-8').write(s)
print('roles ar replaced:', 'صاحب المهمة' in s)
print('roles fr replaced:', "'Client'," in s)
print('keys ar:', 'promoCta' in s, '| keys fr:', s.count('promoCta') >= 3, '| keys en:', s.count('promoCta') >= 3)
print('promoCta count:', s.count('promoCta'))
