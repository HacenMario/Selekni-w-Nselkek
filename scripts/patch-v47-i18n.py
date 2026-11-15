#!/usr/bin/env python3
"""v4.7 i18n: 'صاحب مهمة/صاحب عرض' → 'عميل' (ar) / 'Client' (fr) / 'Customer' (en) everywhere,
and contact info swaps facebook for instagram."""
import io

I = '/home/z/my-project/src/lib/i18n.ts'
s = io.open(I, encoding='utf-8').read()

pairs = [
    # --- AR ---
    ("  roleOwner: 'صاحب المهمة',", "  roleOwner: 'عميل',"),
    ("  skillsSubtitle: 'اكتب باختصار ما تجيده (تظهر لصاحب العرض)',", "  skillsSubtitle: 'اكتب باختصار ما تجيده (تظهر للعميل)',"),
    ("  owner: 'صاحب العرض',", "  owner: 'العميل',"),
    ("  ownerInfo: 'معلومات صاحب العرض',", "  ownerInfo: 'معلومات العميل',"),
    ("  contactOwner: 'اتصل بصاحب العرض',", "  contactOwner: 'اتصل بالعميل',"),
    ("  byRoleOwner: 'من صاحب العرض',", "  byRoleOwner: 'من العميل',"),
    ("  subscriptionTitle: 'اشتراك أصحاب العروض',", "  subscriptionTitle: 'اشتراك العملاء',"),
    ("  ownerStats: 'إحصائيات صاحب العرض',", "  ownerStats: 'إحصائيات العميل',"),
    ("منصة جزائرية تربط أصحاب المهام بمنفّذين موثوقين", "منصة جزائرية تربط العملاء بمنفّذين موثوقين"),
    ("  owners: 'أصحاب عروض',", "  owners: 'عملاء',"),
    ("  usersFilterOwners: 'أصحاب المهام',", "  usersFilterOwners: 'العملاء',"),
    # --- FR ---
    ("  skillsSubtitle: 'Décrivez brièvement ce que vous savez faire (visible par le porteur de tâche)',", "  skillsSubtitle: 'Décrivez brièvement ce que vous savez faire (visible par le client)',"),
    ("  ownerInfo: 'Infos du porteur de tâche',", "  ownerInfo: 'Infos du client',"),
    ("  contactOwner: 'Contacter le porteur de tâche',", "  contactOwner: 'Contacter le client',"),
    ("  byRoleOwner: 'Du porteur de tâche',", "  byRoleOwner: 'Du client',"),
    ("  subscriptionTitle: 'Abonnement des porteurs de tâches',", "  subscriptionTitle: 'Abonnement des clients',"),
    ("  ownerStats: 'Statistiques du porteur de tâche',", "  ownerStats: 'Statistiques du client',"),
    ("qui connecte les demandeurs de tâches à des prestataires de confiance", "qui connecte les clients à des prestataires de confiance"),
    ("  owners: 'Demandeurs',", "  owners: 'Clients',"),
    # --- EN ---
    ("  skillsSubtitle: 'Briefly describe what you can do (visible to task owners)',", "  skillsSubtitle: 'Briefly describe what you can do (visible to customers)',"),
    ("  owner: 'Task owner',", "  owner: 'Customer',"),
    ("  ownerInfo: 'Owner details',", "  ownerInfo: 'Customer details',"),
    ("  contactOwner: 'Contact task owner',", "  contactOwner: 'Contact customer',"),
    ("  subscriptionTitle: 'Task owners\\' subscription',", "  subscriptionTitle: 'Customers\\' subscription',"),
    ("  ownerStats: 'Task owner stats',", "  ownerStats: 'Customer stats',"),
    ("connecting task owners with trusted taskers", "connecting customers with trusted taskers"),
    ("  owners: 'Task owners',", "  owners: 'Customers',"),
    ("  usersFilterOwners: 'Owners',", "  usersFilterOwners: 'Customers',"),
    ("  owner: 'Demandeur',", "  owner: 'Client',"),
    ("  roleOwner: 'Client',\n  roleOwnerDesc: 'I have one or more tasks", "  roleOwner: 'Customer',\n  roleOwnerDesc: 'I have one or more tasks"),  # EN only (FR keeps 'Client')
    # --- contact info: instagram replaces facebook ---
    ("  contactFacebook: 'صفحة فيسبوك',", "  contactInstagram: 'صفحة انستغرام',"),
    ("  contactFacebook: 'Page Facebook',", "  contactInstagram: 'Page Instagram',"),
    ("  contactFacebook: 'Facebook page',", "  contactInstagram: 'Instagram page',"),
]

applied = 0
for old, new in pairs:
    if new in s:
        print('SKIP', old[:52].replace('\n', ' '))
        continue
    n = s.count(old)
    assert n == 1, f"expected 1 of {old[:60]!r}, found {n}"
    s = s.replace(old, new)
    applied += 1

io.open(I, 'w', encoding='utf-8').write(s)
print(f'APPLIED {applied}/{len(pairs)}')
