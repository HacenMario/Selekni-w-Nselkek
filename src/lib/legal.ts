import { Lang } from '@/lib/i18n';

/**
 * v4.10 — Terms of Use & Privacy Policy, fully translated into the nine UI
 * languages. Kept out of i18n.ts (long-form legal text, not UI labels); the
 * entry card in "My account" uses the t('termsTitle') / t('termsIntro') keys.
 * Algeria-specific: Law 18-07 on personal data protection (10 June 2018).
 */

export interface LegalSection {
  h: string;
  p: string[];
}

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

export function legalDoc(lang: Lang): LegalDoc {
  return LEGAL[lang] ?? LEGAL.en;
}

const LEGAL: Record<Lang, LegalDoc> = {
  ar: {
    title: 'شروط الاستخدام والخصوصية',
    updated: 'آخر تحديث: نوفمبر 2025',
    intro: 'نرحّب بك في «سلكني ونسلكك». هذه الصفحة تشرح بالوضح القواعد التي تنظّم استخدامك للتطبيق، وكيف نتعامل مع بياناتك. استخدامك للتطبيق يعني موافقتك على ما يلي.',
    sections: [
      {
        h: '1. طبيعة الخدمة',
        p: [
          '«سلكني ونسلكك» منصة تقنية وسيطة تربط أصحاب المهام بالمنفّذين في الجزائر. التطبيق لا يتعامل مع الأموال ولا يحفظ أي مدفوعات: الأجر يُدفع مباشرة بين العميل والمنفّذ وفق اتفاقهما.',
          'التطبيق لا يتحمّل مسؤولية تنفيذ المهام أو جودتها، ولا يعتبر طرفاً في العلاقة بين المستخدمين؛ دوره هو توفير أداة النشر والتواصل والإشعارات فقط.',
        ],
      },
      {
        h: '2. الحساب والمسؤولية',
        p: [
          'الاستخدام متاح لمن أعمارهم 18 سنة فأكثر. أنت مسؤول عن صحة معلومات تسجيلك (الاسم، الهاتف، البريد، الولاية) وعن الحفاظ على سرية كلمة السر الخاصة بك.',
          'كل حساب شخصي وغير قابل للتحويل. إن اكتشفنا حساباً بمعلومات وهمية أو استخداماً مسيء، يحق للإدارة تعليقه أو حذفه.',
        ],
      },
      {
        h: '3. قواعد الاستخدام',
        p: [
          'يتعهد المستخدم بعدم نشر أي محتوى مخالف للقانون الجزائري أو مسيء أو مضلل، وعدم استخدام المنصة لأي نشاط غير مشروع.',
          'يجب احترام المستخدمين الآخرين في الرسائل والشكاوى والتعليقات. العروض المنشورة يجب أن تكون في مجالات حقيقية وبأوصاف صادقة.',
        ],
      },
      {
        h: '4. العروض والمهام',
        p: [
          'المسؤولية عن محتوى العروض (النصوص، الصور، الفيديوهات، المبالغ) تقع على ناشرها وحده. ننصح بالاتفاق الشفهي أو الكتابي الواضح قبل بدء العمل.',
          'في حال وجود خلاف أو حادث، استخدم زر «اتصل بنا» أو شكوى العرض ليواصل فريق الإدارة الطرفين ويعالج البلاغ.',
        ],
      },
      {
        h: '5. الأمان',
        p: [
          'حافظ على خصوصيتك: لا تشارك بياناتك البنكية أو رموزك السرية مع أي مستخدم، وأجرِ اللقاءات في أماكن عامة كلما أمكن، وإن أبديت أي إساءة فبلّغنا فوراً.',
          'التواصل داخل التطبيق يكشف رقم الهاتف فقط لمن يقبل العرض أو لصاحبه — وليس لعامة المستخدمين.',
        ],
      },
      {
        h: '6. الخصوصية والبيانات',
        p: [
          'نجمع فقط البيانات الضرورية لتشغيل الخدمة: الاسم، البريد الإلكتروني، رقم الهاتف، الجنس، العمر، فصيلة الدم (اختيارية للسلامة)، الولاية، مجالات الاهتمام، والصور التي ترفعها بنفسك.',
          'صورة بطاقة الهوية (للمنفّذين) تُستخدم فقط للتحقق من الحساب، وتُحذف نهائياً من قاعدة البيانات فور صدور قرار التحقق قبولاً أو رفضاً — ولا نحتفظ بنسخة منها.',
          'لا نبيع بياناتك ولا نشاركها مع أي طرف ثالث لأغراض تجارية. الإشعارات تصل عبر خدمة Web Push القياسية في متصفحك، ويمكنك إيقافها في أي وقت من إعدادات المتصفح.',
          'تُعالج بياناتك وفق القانون الجزائري رقم 18-07 المتعلق بحماية الأشخاص الطبيعيين في مجال معالجة المعطيات ذات الطابع الشخصي.',
        ],
      },
      {
        h: '7. حقوقك',
        p: [
          'يمكنك تعديل معلوماتك في أي وقت من صفحة «حسابي». ويمكنك طلب حذف حسابك نهائياً مع كل بياناته (العروض، المهام المنجزة، المستحقات، الإشعارات) عبر صفحة «اتصل بنا».',
          'بعد حذف الحساب تُمحى بياناته من المنصة، باستثناء ما يلزم القانون الاحتفاظ به.',
        ],
      },
      {
        h: '8. تعديل الشروط',
        p: [
          'قد نحدّث هذه الشروط مع تطور الخدمة؛ النسخة السارية هي المعروضة في هذه الصفحة. استمرارك في استخدام التطبيق بعد أي تحديث يعني موافقتك عليه.',
          'تخضع هذه الشروط للقانون الجزائري. لأي استفسار تواصل معنا عبر صفحة «اتصل بنا» داخل التطبيق.',
        ],
      },
    ],
  },
  fr: {
    title: "Conditions d'utilisation et Confidentialité",
    updated: 'Dernière mise à jour : novembre 2025',
    intro: 'Bienvenue sur « Selekni w Nselkek ». Cette page explique clairement les règles qui encadrent votre utilisation de l\'application et la manière dont vos données sont traitées. Utiliser l\'application vaut acceptation de ce qui suit.',
    sections: [
      {
        h: '1. Nature du service',
        p: [
          "« Selekni w Nselkek » est une plateforme technique intermédiaire qui met en relation des clients et des exécutants de tâches en Algérie. L'application ne manipule pas d'argent et ne conserve aucun paiement : la rémunération est versée directement entre le client et l'exécutant, selon leur accord.",
          "L'application n'assume aucune responsabilité quant à l'exécution ou à la qualité des tâches et n'est pas partie au contrat entre les utilisateurs ; son rôle se limite à l'outil de publication, de contact et de notifications.",
        ],
      },
      {
        h: "2. Compte et responsabilité",
        p: [
          "L'utilisation est réservée aux personnes de 18 ans et plus. Vous êtes responsable de l'exactitude de vos informations d'inscription (nom, téléphone, e-mail, wilaya) et de la confidentialité de votre mot de passe.",
          "Chaque compte est personnel et non transférable. En cas de compte fictif ou d'usage abusif, l'administration peut le suspendre ou le supprimer.",
        ],
      },
      {
        h: "3. Règles d'utilisation",
        p: [
          "L'utilisateur s'engage à ne publier aucun contenu contraire à la loi algérienne, insultant ou trompeur, et à ne pas utiliser la plateforme à des fins illégales.",
          "Le respect des autres utilisateurs s'impose dans les messages, réclamations et commentaires. Les offres doivent porter sur des domaines réels, avec des descriptions sincères.",
        ],
      },
      {
        h: '4. Offres et tâches',
        p: [
          "La responsabilité du contenu des offres (textes, images, vidéos, montants) incombe uniquement à leur auteur. Un accord clair, oral ou écrit, est recommandé avant de commencer le travail.",
          "En cas de litige ou d'incident, utilisez le bouton « Contactez-nous » ou la réclamation de l'offre : l'équipe d'administration contactera les deux parties et traitera le signalement.",
        ],
      },
      {
        h: '5. Sécurité',
        p: [
          "Préservez votre vie privée : ne partagez vos données bancaires ni vos codes secrets avec aucun utilisateur ; rencontrez-vous, autant que possible, dans des lieux publics ; signalez immédiatement tout abus.",
          "La communication dans l'application ne révèle le numéro de téléphone qu'à celui qui accepte l'offre ou à son auteur — pas à l'ensemble des utilisateurs.",
        ],
      },
      {
        h: '6. Confidentialité et données',
        p: [
          "Nous collectons uniquement les données nécessaires au fonctionnement du service : nom, e-mail, téléphone, sexe, âge, groupe sanguin (facultatif, pour la sécurité), wilaya, centres d'intérêt et images que vous téléversez vous-même.",
          "La photo de la carte d'identité (pour les exécutants) sert uniquement à vérifier le compte et est définitivement supprimée de la base de données dès la décision de vérification, acceptée ou refusée — aucune copie n'est conservée.",
          "Nous ne vendons pas vos données et ne les partageons avec aucun tiers à des fins commerciales. Les notifications transitent par le service Web Push standard de votre navigateur et peuvent être désactivées à tout moment dans ses réglages.",
          "Vos données sont traitées conformément à la loi algérienne n° 18-07 relative à la protection des personnes physiques dans le traitement des données à caractère personnel.",
        ],
      },
      {
        h: '7. Vos droits',
        p: [
          "Vous pouvez modifier vos informations à tout moment depuis la page « Mon compte », et demander la suppression définitive de votre compte avec toutes ses données (offres, tâches accomplies, commissions dues, notifications) via la page « Contactez-nous ».",
          "Après suppression du compte, ses données sont effacées de la plateforme, hors ce que la loi impose de conserver.",
        ],
      },
      {
        h: '8. Modification des conditions',
        p: [
          "Ces conditions peuvent évoluer avec le service ; la version en vigueur est celle affichée sur cette page. Poursuivre l'utilisation de l'application après une mise à jour vaut acceptation de celle-ci.",
          "Ces conditions sont soumises au droit algérien. Pour toute question, contactez-nous via la page « Contactez-nous » de l'application.",
        ],
      },
    ],
  },
  en: {
    title: 'Terms of Use & Privacy',
    updated: 'Last updated: November 2025',
    intro: 'Welcome to "Selekni w Nselkek". This page clearly explains the rules governing your use of the app and how your data is handled. Using the app means you accept the following.',
    sections: [
      {
        h: '1. Nature of the service',
        p: [
          '"Selekni w Nselkek" is an intermediary technical platform connecting task owners with taskers in Algeria. The app never handles money and stores no payments: the fee is paid directly between the customer and the tasker by mutual agreement.',
          'The app bears no responsibility for the execution or quality of tasks and is not a party to the relationship between users; its role is limited to publishing, contact and notification tools.',
        ],
      },
      {
        h: '2. Account & responsibility',
        p: [
          'Use is restricted to people aged 18 and over. You are responsible for the accuracy of your registration details (name, phone, email, wilaya) and for keeping your password secret.',
          'Each account is personal and non-transferable. If we discover a fake account or abusive use, the administration may suspend or delete it.',
        ],
      },
      {
        h: '3. Rules of use',
        p: [
          'Users undertake not to publish any content that violates Algerian law, is abusive or misleading, and not to use the platform for any unlawful activity.',
          'Respect for other users is required in messages, complaints and comments. Published offers must relate to genuine fields with honest descriptions.',
        ],
      },
      {
        h: '4. Offers & tasks',
        p: [
          'Responsibility for offer content (texts, images, videos, amounts) lies solely with its publisher. A clear verbal or written agreement is recommended before starting work.',
          'In case of a dispute or incident, use the "Contact us" button or the offer complaint so the administration team can reach both parties and handle the report.',
        ],
      },
      {
        h: '5. Safety',
        p: [
          'Protect your privacy: never share your bank details or secret codes with any user; meet in public places whenever possible; report any abuse immediately.',
          'Communication inside the app reveals the phone number only to the user who accepts the offer or to its owner — not to all users.',
        ],
      },
      {
        h: '6. Privacy & data',
        p: [
          'We collect only the data needed to run the service: name, email, phone, gender, age, blood type (optional, for safety), wilaya, fields of interest, and the images you upload yourself.',
          'The ID-card photo (for taskers) is used solely to verify the account and is permanently deleted from the database as soon as the verification decision is made, approved or rejected — no copy is kept.',
          'We never sell your data or share it with third parties for commercial purposes. Notifications are delivered through the standard Web Push service of your browser and can be disabled at any time in its settings.',
          'Your data is processed in accordance with Algerian Law No. 18-07 on the protection of natural persons in the processing of personal data.',
        ],
      },
      {
        h: '7. Your rights',
        p: [
          'You can edit your information at any time from the "My account" page, and request the permanent deletion of your account with all its data (offers, completed tasks, commission dues, notifications) through the "Contact us" page.',
          'After account deletion its data is erased from the platform, except what the law requires to be kept.',
        ],
      },
      {
        h: '8. Changes to these terms',
        p: [
          'These terms may be updated as the service evolves; the version in force is the one displayed on this page. Continuing to use the app after an update means you accept it.',
          'These terms are governed by Algerian law. For any question, contact us through the "Contact us" page inside the app.',
        ],
      },
    ],
  },
  tr: {
    title: 'Kullanım Koşulları ve Gizlilik',
    updated: 'Son güncelleme: Kasım 2025',
    intro: '"Selekni w Nselkek" uygulamasına hoş geldiniz. Bu sayfa, uygulamayı kullanımınızı düzenleyen kuralları ve verilerinizle nasıl işlem yapıldığını açıkça anlatır. Uygulamayı kullanmak, aşağıdakileri kabul etmek anlamına gelir.',
    sections: [
      {
        h: '1. Hizmetin niteliği',
        p: [
          '"Selekni w Nselkek", Cezayir\'de iş sahiplerini görev yürütücüleriyle buluşturan aracı bir teknik platformdur. Uygulama paraya dokunmaz ve hiçbir ödemeyi saklamaz: ücret, müşteri ile yürütücü arasında doğrudan ve karşılıklı anlaşmaya göre ödenir.',
          'Uygulama, görevlerin yapılmasından veya kalitesinden sorumlu değildir ve kullanıcılar arasındaki ilişkinin tarafı değildir; rolü yalnızca yayınlama, iletişim ve bildirim araçları sağlamaktır.',
        ],
      },
      {
        h: '2. Hesap ve sorumluluk',
        p: [
          'Kullanım 18 yaş ve üzeri içindir. Kayıt bilgilerinizin (ad, telefon, e-posta, vilayet) doğruluğundan ve şifrenizin gizliliğinden siz sorumlusunuz.',
          'Her hesap kişiseldir ve devredilemez. Sahte hesap veya kötüye kullanım tespit edilirse yönetim hesabı askıya alabilir veya silebilir.',
        ],
      },
      {
        h: '3. Kullanım kuralları',
        p: [
          'Kullanıcı, Cezayir yasalarına aykırı, hakaret içeren veya yanıltıcı hiçbir içerik yayınlamamayı ve platformu yasadışı hiçbir amaç için kullanmamayı taahhüt eder.',
          'Mesajlarda, şikayetlerde ve yorumlarda diğer kullanıcılara saygı esastır. Yayınlanan ilanlar gerçek alanlara ilişkin ve dürüst açıklamalı olmalıdır.',
        ],
      },
      {
        h: '4. İlanlar ve görevler',
        p: [
          'İlan içeriğinin (metinler, fotoğraflar, videolar, tutarlar) sorumluluğu yalnızca yayınlayana aittir. İşe başlamadan önce net bir sözlü veya yazılı anlaşma önerilir.',
          'Anlaşmazlık veya kaza durumunda "Bize ulaşın" düğmesini veya ilan şikayetini kullanın; yönetim ekibi iki tarafla iletişime geçip bildirimi ele alır.',
        ],
      },
      {
        h: '5. Güvenlik',
        p: [
          'Gizliliğinizi koruyun: banka bilgilerinizi ve gizli kodlarınızı hiçbir kullanıcıyla paylaşmayın; mümkünse kalabalık yerlerde buluşun; her türlü istismarı hemen bildirin.',
          'Uygulama içindeki iletişimde telefon numarası yalnızca ilanı kabul edene veya ilan sahibine gösterilir — tüm kullanıcılara değil.',
        ],
      },
      {
        h: '6. Gizlilik ve veriler',
        p: [
          'Yalnızca hizmetin çalışması için gerekli verileri toplarız: ad, e-posta, telefon, cinsiyet, yaş, kan grubu (güvenlik için isteğe bağlı), vilayet, ilgi alanları ve kendi yüklediğiniz görseller.',
          'Kimlik kartı fotoğrafı (yürütücüler için) yalnızca hesabı doğrulamak için kullanılır ve karar verilir verilmez — onay ya da ret — veritabanından kalıcı olarak silinir; hiçbir kopyası tutulmaz.',
          'Verilerinizi asla satmayız ve ticari amaçla hiçbir üçüncü tarafla paylaşmayız. Bildirimler, tarayıcınızın standart Web Push hizmetiyle iletilir ve tarayıcı ayarlarından her zaman kapatılabilir.',
          'Verileriniz, kişisel verilerin işlenmesinde gerçek kişilerin korunmasına ilişkin Cezayir 18-07 sayılı Kanun\'a uygun olarak işlenir.',
        ],
      },
      {
        h: '7. Haklarınız',
        p: [
          'Bilgilerinizi "Hesabım" sayfasından her an düzenleyebilir; hesabınızın tüm verileriyle (ilanlar, abonelikler, bildirimler) birlikte kalıcı silinmesini "Bize ulaşın" sayfasından talep edebilirsiniz.',
          'Hesap silindikten sonra verileri platformdan silinir; yasaların saklanmasını zorunlu kıldığı kısımlar hariç.',
        ],
      },
      {
        h: '8. Koşullarda değişiklik',
        p: [
          'Bu koşullar hizmet geliştikçe güncellenebilir; geçerli olan sürüm bu sayfada görülen metindir. Güncellemeden sonra uygulamayı kullanmaya devam etmek, onu kabul ettiğiniz anlamına gelir.',
          'Bu koşullar Cezayir yasalarına tabidir. Sorularınız için uygulama içindeki "Bize ulaşın" sayfasından bize yazın.',
        ],
      },
    ],
  },
  es: {
    title: 'Términos de uso y Privacidad',
    updated: 'Última actualización: noviembre de 2025',
    intro: 'Bienvenido a «Selekni w Nselkek». Esta página explica con claridad las reglas que rigen el uso de la aplicación y cómo se tratan tus datos. Usar la aplicación implica aceptar lo siguiente.',
    sections: [
      {
        h: '1. Naturaleza del servicio',
        p: [
          '«Selekni w Nselkek» es una plataforma técnica intermediaria que conecta a clientes con ejecutores de tareas en Argelia. La aplicación no maneja dinero ni guarda ningún pago: la remuneración se abona directamente entre el cliente y el ejecutor según su acuerdo.',
          'La aplicación no responde por la ejecución ni la calidad de las tareas y no es parte de la relación entre los usuarios; su papel se limita a las herramientas de publicación, contacto y notificaciones.',
        ],
      },
      {
        h: '2. Cuenta y responsabilidad',
        p: [
          'El uso está reservado a personas de 18 años o más. Eres responsable de la veracidad de tus datos de registro (nombre, teléfono, correo, wilaya) y de guardar la confidencialidad de tu contraseña.',
          'Cada cuenta es personal e intransferible. Si descubrimos una cuenta falsa o un uso abusivo, la administración puede suspenderla o eliminarla.',
        ],
      },
      {
        h: '3. Reglas de uso',
        p: [
          'El usuario se compromete a no publicar contenido contrario a la ley argelina, insultante o engañoso, y a no usar la plataforma para actividades ilícitas.',
          'Debe respetarse a los demás usuarios en los mensajes, las quejas y los comentarios. Las ofertas publicadas deben corresponder a campos reales y con descripciones sinceras.',
        ],
      },
      {
        h: '4. Ofertas y tareas',
        p: [
          'La responsabilidad del contenido de las ofertas (textos, imágenes, vídeos, importes) recae únicamente en quien las publica. Se recomienda un acuerdo claro, verbal o escrito, antes de comenzar el trabajo.',
          'Ante un conflicto o incidente, usa el botón «Contacto» o la queja de la oferta: el equipo de administración contactará a ambas partes y atenderá el aviso.',
        ],
      },
      {
        h: '5. Seguridad',
        p: [
          'Cuida tu privacidad: no compartas tus datos bancarios ni tus códigos secretos con ningún usuario; reúnete, siempre que sea posible, en lugares públicos; denuncia cualquier abuso de inmediato.',
          'La comunicación dentro de la aplicación solo revela el número de teléfono a quien acepta la oferta o a quien la publicó — no a todos los usuarios.',
        ],
      },
      {
        h: '6. Privacidad y datos',
        p: [
          'Recopilamos únicamente los datos necesarios para el funcionamiento del servicio: nombre, correo, teléfono, sexo, edad, grupo sanguíneo (opcional, por seguridad), wilaya, campos de interés y las imágenes que tú mismo subes.',
          'La foto del documento de identidad (para los ejecutores) se usa solo para verificar la cuenta y se elimina definitivamente de la base de datos en cuanto se toma la decisión, sea de aprobación o de rechazo — no se conserva ninguna copia.',
          'No vendemos tus datos ni los compartimos con terceros con fines comerciales. Las notificaciones llegan mediante el servicio Web Push estándar de tu navegador y puedes desactivarlas en cualquier momento en su configuración.',
          'Tus datos se tratan conforme a la ley argelina n.º 18-07 sobre la protección de las personas físicas en el tratamiento de datos de carácter personal.',
        ],
      },
      {
        h: '7. Tus derechos',
        p: [
          'Puedes editar tu información en cualquier momento desde la página «Mi cuenta», y solicitar la eliminación definitiva de tu cuenta con todos sus datos (ofertas, suscripciones, notificaciones) desde la página «Contacto».',
          'Tras eliminar la cuenta, sus datos se borran de la plataforma, salvo lo que la ley obligue a conservar.',
        ],
      },
      {
        h: '8. Cambios en los términos',
        p: [
          'Estos términos pueden actualizarse a medida que evolucione el servicio; la versión vigente es la mostrada en esta página. Seguir usando la aplicación tras una actualización implica aceptarla.',
          'Estos términos se rigen por la ley argelina. Para cualquier consulta, escríbenos desde la página «Contacto» de la aplicación.',
        ],
      },
    ],
  },
  it: {
    title: 'Termini d\'uso e Privacy',
    updated: 'Ultimo aggiornamento: novembre 2025',
    intro: 'Benvenuto su «Selekni w Nselkek». Questa pagina spiega in modo chiaro le regole che disciplinano l\'uso dell\'app e come vengono trattati i tuoi dati. Usare l\'app significa accettare quanto segue.',
    sections: [
      {
        h: '1. Natura del servizio',
        p: [
          '«Selekni w Nselkek» è una piattaforma tecnica di intermediazione che mette in contatto clienti ed esecutori di compiti in Algeria. L\'app non gestisce denaro e non conserva alcun pagamento: il compenso è pagato direttamente tra cliente ed esecutore secondo il loro accordo.',
          'L\'app non risponde dell\'esecuzione o della qualità dei compiti e non è parte del rapporto tra gli utenti; il suo ruolo è limitato agli strumenti di pubblicazione, contatto e notifiche.',
        ],
      },
      {
        h: '2. Account e responsabilità',
        p: [
          'L\'uso è riservato alle persone di età pari o superiore a 18 anni. Sei responsabile dell\'esattezza dei dati di registrazione (nome, telefono, e-mail, wilaya) e della riservatezza della tua password.',
          'Ogni account è personale e non trasferibile. In caso di account fittizio o uso abusivo, l\'amministrazione può sospenderlo o eliminarlo.',
        ],
      },
      {
        h: '3. Regole d\'uso',
        p: [
          'L\'utente si impegna a non pubblicare contenuti contrari alla legge algerina, offensivi o ingannevoli, e a non usare la piattaforma per attività illecite.',
          'Il rispetto degli altri utenti è doveroso nei messaggi, nei reclami e nei commenti. Le offerte pubblicate devono riguardare settori reali, con descrizioni sincere.',
        ],
      },
      {
        h: '4. Offerte e compiti',
        p: [
          'La responsabilità del contenuto delle offerte (testi, immagini, video, importi) spetta esclusivamente a chi le pubblica. Si raccomanda un accordo chiaro, verbale o scritto, prima di iniziare il lavoro.',
          'In caso di controversia o incidente, usa il pulsante «Contattaci» o il reclamo dell\'offerta: il team di amministrazione contatterà entrambe le parti e tratterà la segnalazione.',
        ],
      },
      {
        h: '5. Sicurezza',
        p: [
          'Proteggi la tua privacy: non condividere i tuoi dati bancari né i tuoi codici segreti con alcun utente; incontratevi, per quanto possibile, in luoghi pubblici; segnala subito ogni abuso.',
          'La comunicazione all\'interno dell\'app rivela il numero di telefono solo a chi accetta l\'offerta o al suo autore — non a tutti gli utenti.',
        ],
      },
      {
        h: '6. Privacy e dati',
        p: [
          'Raccogliamo solo i dati necessari al funzionamento del servizio: nome, e-mail, telefono, sesso, età, gruppo sanguigno (facoltativo, per la sicurezza), wilaya, settori di interesse e le immagini che carichi tu stesso.',
          'La foto del documento d\'identità (per gli esecutori) serve soltanto a verificare l\'account ed è eliminata definitivamente dal database appena viene presa la decisione, di approvazione o di rifiuto — nessuna copia viene conservata.',
          'Non vendiamo i tuoi dati e non li condividiamo con terzi a fini commerciali. Le notifiche arrivano tramite il servizio Web Push standard del tuo browser e possono essere disattivate in qualsiasi momento nelle sue impostazioni.',
          'I tuoi dati sono trattati conformemente alla legge algerina n. 18-07 sulla protezione delle persone fisiche nel trattamento dei dati personali.',
        ],
      },
      {
        h: '7. I tuoi diritti',
        p: [
          'Puoi modificare le tue informazioni in qualsiasi momento dalla pagina «Il mio account», e richiedere l\'eliminazione definitiva dell\'account con tutti i suoi dati (offerte, abbonamenti, notifiche) tramite la pagina «Contattaci».',
          'Dopo l\'eliminazione dell\'account i suoi dati sono cancellati dalla piattaforma, salvo ciò che la legge impone di conservare.',
        ],
      },
      {
        h: '8. Modifiche ai termini',
        p: [
          'Questi termini possono essere aggiornati con l\'evoluzione del servizio; la versione in vigore è quella mostrata in questa pagina. Continuare a usare l\'app dopo un aggiornamento significa accettarlo.',
          'Questi termini sono soggetti alla legge algerina. Per qualsiasi domanda, scrivici dalla pagina «Contattaci» dell\'app.',
        ],
      },
    ],
  },
  de: {
    title: 'Nutzungsbedingungen und Datenschutz',
    updated: 'Stand: November 2025',
    intro: 'Willkommen bei „Selekni w Nselkek". Diese Seite erläutert klar die Regeln für die Nutzung der App und den Umgang mit Ihren Daten. Die Nutzung der App bedeutet die Zustimmung zu Folgendem.',
    sections: [
      {
        h: '1. Art des Dienstes',
        p: [
          '„Selekni w Nselkek" ist eine vermittelnde technische Plattform, die in Algerien Kunden mit Aufgabenausführern verbindet. Die App verarbeitet kein Geld und speichert keine Zahlungen: Die Vergütung wird direkt zwischen Kunde und Ausführer nach deren Absprache gezahlt.',
          'Die App haftet nicht für die Ausführung oder Qualität von Aufgaben und ist keine Partei des Verhältnisses zwischen den Nutzern; ihre Rolle beschränkt sich auf Werkzeuge zum Veröffentlichen, Kontakte knüpfen und Benachrichtigen.',
        ],
      },
      {
        h: '2. Konto und Verantwortung',
        p: [
          'Die Nutzung ist Personen ab 18 Jahren vorbehalten. Sie sind für die Richtigkeit Ihrer Registrierungsangaben (Name, Telefon, E-Mail, Wilaya) verantwortlich und dafür, Ihr Passwort geheim zu halten.',
          'Jedes Konto ist persönlich und nicht übertragbar. Bei erfundenen Konten oder missbräuchlicher Nutzung kann die Verwaltung das Konto sperren oder löschen.',
        ],
      },
      {
        h: '3. Nutzungsregeln',
        p: [
          'Nutzer verpflichten sich, keine gegen algerisches Recht verstoßenden, beleidigenden oder irreführenden Inhalte zu veröffentlichen und die Plattform nicht für rechtswidrige Zwecke zu nutzen.',
          'Respekt gegenüber anderen Nutzern ist in Nachrichten, Beschwerden und Kommentaren Pflicht. Veröffentlichte Angebote müssen echte Bereiche betreffen und ehrlich beschrieben sein.',
        ],
      },
      {
        h: '4. Angebote und Aufgaben',
        p: [
          'Für den Inhalt von Angeboten (Texte, Bilder, Videos, Beträge) haftet allein dessen Verfasser. Eine klare mündliche oder schriftliche Absprache wird empfohlen, bevor die Arbeit beginnt.',
          'Bei Streit oder Zwischenfall nutzen Sie die Schaltfläche „Kontakt" oder die Angebotsbeschwerde; das Verwaltungsteam kontaktiert beide Seiten und bearbeitet die Meldung.',
        ],
      },
      {
        h: '5. Sicherheit',
        p: [
          'Schützen Sie Ihre Privatsphäre: Teilen Sie Ihre Bankdaten oder Geheimcodes mit keinem Nutzer; treffen Sie sich, wann immer möglich, an öffentlichen Orten; melden Sie jeden Missbrauch sofort.',
          'Die Kommunikation in der App zeigt die Telefonnummer nur dem Nutzer, der das Angebot annimmt, bzw. dessen Auftraggeber — nicht allen Nutzern.',
        ],
      },
      {
        h: '6. Datenschutz und Daten',
        p: [
          'Wir erfassen nur die für den Betrieb nötigen Daten: Name, E-Mail, Telefon, Geschlecht, Alter, Blutgruppe (optional, zur Sicherheit), Wilaya, Interessengebiete und die Bilder, die Sie selbst hochladen.',
          'Das Ausweisfoto (für Ausführer) dient ausschließlich der Konto-Verifizierung und wird mit der Entscheidung — Genehmigung oder Ablehnung — endgültig aus der Datenbank gelöscht; keine Kopie wird aufbewahrt.',
          'Wir verkaufen Ihre Daten nicht und teilen sie zu kommerziellen Zwecken mit niemandem. Benachrichtigungen laufen über den Standard-Web-Push-Dienst Ihres Browsers und lassen sich dort jederzeit deaktivieren.',
          'Ihre Daten werden gemäß dem algerischen Gesetz Nr. 18-07 zum Schutz natürlicher Personen bei der Verarbeitung personenbezogener Daten verarbeitet.',
        ],
      },
      {
        h: '7. Ihre Rechte',
        p: [
          'Sie können Ihre Angaben jederzeit auf der Seite „Mein Konto" ändern und die endgültige Löschung Ihres Kontos samt aller Daten (Angebote, Abos, Benachrichtigungen) über die Seite „Kontakt" verlangen.',
          'Nach der Kontolöschung werden seine Daten von der Plattform entfernt, außer dem, was das Gesetz aufzubewahren verlangt.',
        ],
      },
      {
        h: '8. Änderungen der Bedingungen',
        p: [
          'Diese Bedingungen können mit der Weiterentwicklung des Dienstes aktualisiert werden; maßgeblich ist die auf dieser Seite angezeigte Fassung. Die App nach einem Update weiter zu nutzen bedeutet dessen Annahme.',
          'Diese Bedingungen unterliegen algerischem Recht. Bei Fragen schreiben Sie uns über die Seite „Kontakt" in der App.',
        ],
      },
    ],
  },
  ru: {
    title: 'Условия использования и конфиденциальность',
    updated: 'Обновлено: ноябрь 2025 г.',
    intro: 'Добро пожаловать в «Selekni w Nselkek». Эта страница ясно объясняет правила пользования приложением и порядок обработки ваших данных. Использование приложения означает согласие со следующим.',
    sections: [
      {
        h: '1. Характер услуги',
        p: [
          '«Selekni w Nselkek» — посредническая техническая платформа, соединяющая заказчиков и исполнителей задач в Алжире. Приложение не оперирует деньгами и не хранит платежей: вознаграждение выплачивается напрямую между заказчиком и исполнителем по их договорённости.',
          'Приложение не несёт ответственности за выполнение или качество задач и не является стороной отношений между пользователями; его роль ограничена инструментами публикации, связи и уведомлений.',
        ],
      },
      {
        h: '2. Аккаунт и ответственность',
        p: [
          'Пользование доступно лицам от 18 лет. Вы отвечаете за достоверность регистрационных данных (имя, телефон, эл. почта, вилайя) и за сохранность своего пароля.',
          'Каждый аккаунт личный и непередаваемый. При обнаружении фиктивного аккаунта или злоупотреблений администрация вправе приостановить или удалить его.',
        ],
      },
      {
        h: '3. Правила пользования',
        p: [
          'Пользователь обязуется не публиковать контент, нарушающий алжирское законодательство, оскорбительный или вводящий в заблуждение, и не использовать платформу для противоправной деятельности.',
          'Уважение к другим пользователям обязательно в сообщениях, жалобах и комментариях. Опубликованные задания должны относиться к реальным областям и иметь честные описания.',
        ],
      },
      {
        h: '4. Задания и объявления',
        p: [
          'Ответственность за содержание объявлений (тексты, фото, видео, суммы) несёт исключительно их автор. Перед началом работы рекомендуется ясная устная или письменная договорённость.',
          'При споре или происшествии используйте кнопку «Связаться с нами» или жалобу по объявлению: команда администрации свяжется с обеими сторонами и рассмотрит обращение.',
        ],
      },
      {
        h: '5. Безопасность',
        p: [
          'Оберегайте свою приватность: не передавайте никому банковские данные и секретные коды; по возможности встречайтесь в людных местах; о любом злоупотреблении сообщайте сразу.',
          'Общение внутри приложения раскрывает номер телефона только тому, кто принял задание, или его заказчику — но не всем пользователям.',
        ],
      },
      {
        h: '6. Конфиденциальность и данные',
        p: [
          'Мы собираем лишь данные, необходимые для работы сервиса: имя, эл. почту, телефон, пол, возраст, группу крови (необязательно, для безопасности), вилайю, области интересов и изображения, которые вы загружаете сами.',
          'Фото удостоверения личности (для исполнителей) используется только для подтверждения аккаунта и немедленно после решения — согласия или отказа — навсегда удаляется из базы данных; копии не хранятся.',
          'Мы не продаём ваши данные и не передаём их третьим лицам в коммерческих целях. Уведомления доставляются через стандартную службу Web Push вашего браузера и могут быть отключены в его настройках в любой момент.',
          'Ваши данные обрабатываются в соответствии с алжирским законом № 18-07 о защите физических лиц при обработке персональных данных.',
        ],
      },
      {
        h: '7. Ваши права',
        p: [
          'Вы можете изменить свои данные в любой момент на странице «Мой аккаунт» и запросить безвозвратное удаление аккаунта со всеми данными (задания, подписки, уведомления) через страницу «Связаться с нами».',
          'После удаления аккаунта его данные стираются с платформы, за исключением того, что закон требует хранить.',
        ],
      },
      {
        h: '8. Изменение условий',
        p: [
          'Эти условия могут обновляться по мере развития сервиса; действующей является версия, показанная на этой странице. Продолжая пользоваться приложением после обновления, вы принимаете его.',
          'Условия регулируются алжирским законодательством. По любым вопросам пишите нам через страницу «Связаться с нами» в приложении.',
        ],
      },
    ],
  },
  zh: {
    title: '使用条款与隐私政策',
    updated: '最近更新：2025 年 11 月',
    intro: '欢迎使用「Selekni w Nselkek」。本页清楚说明使用本应用的规则以及我们如何处理您的数据。继续使用本应用即表示您接受以下内容。',
    sections: [
      {
        h: '1. 服务性质',
        p: [
          '「Selekni w Nselkek」是连接阿尔及利亚任务发布者与执行者的中介技术平台。应用不经手资金、不代管任何付款：报酬由客户与执行者按双方约定直接支付。',
          '应用不对任务的执行或质量负责，也不是用户之间关系的当事方；其作用仅限于发布、联系与通知工具。',
        ],
      },
      {
        h: '2. 账号与责任',
        p: [
          '本服务仅面向年满 18 周岁者。您需对注册信息（姓名、电话、邮箱、省份）的真实性负责，并妥善保管密码。',
          '每个账号均属个人且不可转让。若发现虚假账号或滥用行为，管理部门有权暂停或删除该账号。',
        ],
      },
      {
        h: '3. 使用规则',
        p: [
          '用户承诺不发布违反阿尔及利亚法律、侮辱性或误导性的内容，也不将平台用于任何非法活动。',
          '在消息、投诉和评论中必须尊重其他用户。发布的任务必须属于真实领域，描述诚实可信。',
        ],
      },
      {
        h: '4. 任务与悬赏',
        p: [
          '任务内容（文字、图片、视频、金额）的责任完全由发布者承担。建议在开始工作前达成清晰的口头或书面约定。',
          '发生纠纷或事故时，请使用「联系我们」按钮或任务投诉功能：管理团队会联系双方并处理该报告。',
        ],
      },
      {
        h: '5. 安全提示',
        p: [
          '保护您的隐私：切勿向任何用户透露银行信息或密码口令；尽量在公共场所会面；发现任何侵害行为请立即举报。',
          '应用内的沟通只在任务接受者与发布者之间显示电话号码——不会向全体用户公开。',
        ],
      },
      {
        h: '6. 隐私与数据',
        p: [
          '我们只收集运行服务所必需的数据：姓名、邮箱、电话、性别、年龄、血型（可选，用于安全）、省份、兴趣领域，以及您自行上传的图片。',
          '身份证件照片（执行者用）仅用于账号核验，并在作出核验决定（通过或拒绝）后立即从数据库永久删除——不留任何副本。',
          '我们绝不出售您的数据，也不将其提供给任何第三方作商业用途。通知通过您浏览器的标准 Web Push 服务送达，可随时在浏览器设置中关闭。',
          '您的数据依照阿尔及利亚第 18-07 号法律（关于自然人在个人数据处理中的保护）进行处理。',
        ],
      },
      {
        h: '7. 您的权利',
        p: [
          '您可随时在「我的账号」页面修改信息，也可通过「联系我们」页面申请永久删除账号及其全部数据（任务、订阅、通知）。',
          '账号删除后，其数据将从平台清除，法律要求保留的内容除外。',
        ],
      },
      {
        h: '8. 条款变更',
        p: [
          '随服务的发展，本条款可能更新；以本页面显示的版本为准。更新后继续使用本应用即表示您接受更新。',
          '本条款受阿尔及利亚法律管辖。如有任何疑问，请通过应用内的「联系我们」页面与我们联系。',
        ],
      },
    ],
  },
};
