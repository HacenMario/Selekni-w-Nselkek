#!/usr/bin/env python3
"""v4.8 patches:
- register blood group becomes a dropdown (was a button grid)
- accepting an offer removes its 'new offer' broadcast for everyone except owner + accepted worker
- admin can delete an offer from the offers tab (endpoint + card button + confirm dialog)
- new i18n key deleteOfferConfirm (x3)"""
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

# ---------- 1) register blood group: grid -> dropdown ----------
patch('src/components/app/screens/AuthScreen.tsx', [
    ("""            {/* blood group — mandatory for every account, shown to the other party */}
            <div className="space-y-1.5">
              <Label>{t('bloodType')} *</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {BLOOD_TYPES.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setRblood(b)}
                    className={`h-10 rounded-xl border-2 text-sm font-extrabold transition-all active:scale-95 ${rblood === b ? 'border-destructive/70 bg-destructive/10 text-destructive' : 'border-border bg-card text-muted-foreground hover:border-destructive/30'}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">{t('bloodTypeHint')}</p>
            </div>""",
     """            {/* blood group — mandatory dropdown for every account, shown to the other party */}
            <div className="space-y-1.5">
              <Label htmlFor="rblood">{t('bloodType')} *</Label>
              <select
                id="rblood"
                value={rblood}
                onChange={(e) => setRblood(e.target.value as BloodType)}
                className="h-11 w-full rounded-xl border-2 bg-card px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="" disabled>— {t('bloodType')} —</option>
                {BLOOD_TYPES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground leading-snug">{t('bloodTypeHint')}</p>
            </div>"""),
])

# ---------- 2) accept: broadcast cleanup for everyone but owner + worker ----------
patch('mini-services/api-server/src/routes/offers.routes.ts', [
    ("import { notifyUsers } from '../services/notification.service';",
     "import { notifyUsers } from '../services/notification.service';\nimport { Notification } from '../models/notification.model';"),
    ("""  if (!offer) { res.status(409).json({ error: 'Offer no longer available', code: 'ALREADY_TAKEN' }); return; }
  const owner = offer.owner as any;
  notifyUsers([owner?._id], 'offer_accepted', {""",
     """  if (!offer) { res.status(409).json({ error: 'Offer no longer available', code: 'ALREADY_TAKEN' }); return; }
  const owner = offer.owner as any;
  // v4.8 — the offer is taken: its "new offer" broadcast disappears for everyone
  // except the client (owner) and the worker who accepted it
  await Notification.deleteMany({
    type: 'new_offer_match',
    'data.offerId': String(offer._id),
    user: { $nin: [offer.acceptedBy, owner?._id ?? offer.owner] },
  });
  notifyUsers([owner?._id], 'offer_accepted', {"""),
])

# ---------- 3) admin: delete an offer entirely ----------
patch('mini-services/api-server/src/routes/admin.routes.ts', [
    ("""router.get('/offers', asyncH(async (req: AuthRequest, res) => {""",
     """/** v4.8 — remove an offer entirely: the document + every notification pointing to it. */
router.delete('/offers/:id', asyncH(async (req: AuthRequest, res) => {
  const offer = await Offer.findByIdAndDelete(req.params.id);
  if (!offer) { res.status(404).json({ error: 'Offer not found', code: 'NOT_FOUND' }); return; }
  await Notification.deleteMany({ 'data.offerId': req.params.id });
  res.json({ ok: true });
}));

router.get('/offers', asyncH(async (req: AuthRequest, res) => {"""),
])

# ---------- 4) admin offers tab: delete button + confirm dialog ----------
patch('src/components/app/screens/AdminScreen.tsx', [
    ("  BadgeCheck, Ban, BarChart3, Check, ClipboardList, Coins, Crown, Droplets, Gavel, Gift, Handshake, Hourglass, IdCard, ImagePlus,",
     "  BadgeCheck, Ban, BarChart3, Check, ClipboardList, Coins, Crown, Droplets, Gavel, Gift, Handshake, Hourglass, IdCard, ImagePlus, LoaderCircle,"),
    ("""function OffersTab() {
  const { t } = useLang();
  const openOfferDetail = useApp((s) => s.openOfferDetail);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  // open offers the administration has not opened yet — they bounce
  const [clickedIds, setClickedIds] = useState<string[]>(() => getClicked('offers'));""",
     """function OffersTab() {
  const { t } = useLang();
  const openOfferDetail = useApp((s) => s.openOfferDetail);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  // open offers the administration has not opened yet — they bounce
  const [clickedIds, setClickedIds] = useState<string[]>(() => getClicked('offers'));
  // v4.8 — per-offer delete with confirmation
  const qcOffers = useQueryClient();
  const [delOffer, setDelOffer] = useState<Offer | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  async function doDeleteOffer() {
    if (!delOffer) return;
    setBusyDel(true);
    try {
      await api.del(`/admin/offers/${delOffer._id}`);
      toast.success(t('done'));
      qcOffers.invalidateQueries({ queryKey: ['admin-offers'] });
      qcOffers.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setDelOffer(null);
    } catch {
      toast.error(t('error'));
    } finally {
      setBusyDel(false);
    }
  }"""),
    ("""        data.items.map((o) => {
          const owner = typeof o.owner === 'object' ? o.owner : null;
          return (
            <button
              key={o._id}
              // opens the SAME final detail sheet users see — owner card, worker card,
              // status, photos, video, address (backend gives the super admin full visibility)
              onClick={() => { viewCard(o._id); openOfferDetail(o._id); }}
              className={`w-full text-start rounded-2xl border bg-card p-3.5 hover:border-primary/40 hover:shadow-md active:scale-[0.99] transition-all card-hover cursor-pointer ${o.status === 'open' && !clickedIds.includes(o._id) ? 'animate-bounce-new border-2 border-primary/50' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-sm break-words leading-snug text-primary">{o.title}</p>
                <AmountPill amount={o.amountDA} className="shrink-0" />
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-muted-foreground">
                <StatusBadge status={o.status} t={t} />
                {owner?.name && <span>{owner.name}</span>}
                <span className="ms-auto">{timeAgo(o.createdAt, t)}</span>
              </div>
            </button>
          );
        })""",
     """        data.items.map((o) => {
          const owner = typeof o.owner === 'object' ? o.owner : null;
          return (
            <div
              key={o._id}
              role="button"
              tabIndex={0}
              // opens the SAME final detail sheet users see — owner card, worker card,
              // status, photos, video, address (backend gives the super admin full visibility)
              onClick={() => { viewCard(o._id); openOfferDetail(o._id); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { viewCard(o._id); openOfferDetail(o._id); } }}
              className={`w-full text-start rounded-2xl border bg-card p-3.5 hover:border-primary/40 hover:shadow-md active:scale-[0.99] transition-all card-hover cursor-pointer ${o.status === 'open' && !clickedIds.includes(o._id) ? 'animate-bounce-new border-2 border-primary/50' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-sm break-words leading-snug text-primary">{o.title}</p>
                <AmountPill amount={o.amountDA} className="shrink-0" />
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-muted-foreground">
                <StatusBadge status={o.status} t={t} />
                {owner?.name && <span>{owner.name}</span>}
                <span className="ms-auto">{timeAgo(o.createdAt, t)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setDelOffer(o); }}
                  aria-label={t('delete')}
                  title={t('delete')}
                  className="h-7 w-7 grid place-items-center rounded-lg text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 transition-colors shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })"""),
    ("""      {data && <Pager page={data.page || page} pages={data.pages} onChange={setPage} />}
    </div>
  );
}

/* ---------- Subscriptions (v4: full details + full control) ---------- */""",
     """      {data && <Pager page={data.page || page} pages={data.pages} onChange={setPage} />}

      {/* v4.8 — delete-offer confirmation */}
      <AlertDialog open={!!delOffer} onOpenChange={(o) => !o && setDelOffer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteOfferConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={busyDel}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDeleteOffer}
              disabled={busyDel}
              className="rounded-xl bg-destructive text-white hover:bg-destructive/90"
            >
              {busyDel ? <LoaderCircle className="h-4 w-4 animate-spin" /> : t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- Subscriptions (v4: full details + full control) ---------- */"""),
])

# ---------- 5) i18n: deleteOfferConfirm x3 ----------
patch('src/lib/i18n.ts', [
    ("  delete: 'حذف',", "  delete: 'حذف',\n  deleteOfferConfirm: 'سيتم حذف هذا العرض نهائياً مع كل إشعاراته المرتبطة به. لا يمكن التراجع.',"),
    ("  delete: 'Supprimer',", "  delete: 'Supprimer',\n  deleteOfferConfirm: 'Cette offre sera définitivement supprimée avec toutes ses notifications. Action irréversible.',"),
    ("  delete: 'Delete',", "  delete: 'Delete',\n  deleteOfferConfirm: 'This offer will be permanently deleted along with its notifications. This cannot be undone.',"),
])
print('V4.8 PATCHES DONE')
