'use client';

// v4.15 — video size cap raised to 50 MB (matches the server limit)
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLang } from '@/lib/language-context';
import { api, uploadVideo } from '@/lib/api';
import { compressImage, CompressedImage } from '@/lib/image';
import { Settings } from '@/lib/types';
import { categoryLabel } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ClearInput } from '@/components/app/ClearableField';
import { WilayaSelect } from '@/components/app/WilayaSelect';
import { X, LoaderCircle, Camera, ImagePlus, TriangleAlert, Film, Play, MapPin, Users, Navigation } from 'lucide-react';
import { toast } from 'sonner';

const MAX_IMAGES = 10;

export function CreateOfferScreen({ onDone }: { onDone: () => void }) {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryKey, setCategoryKey] = useState('');
  const [wilaya, setWilaya] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [workersNeeded, setWorkersNeeded] = useState('');
  const [amount, setAmount] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [images, setImages] = useState<CompressedImage[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [videoUp, setVideoUp] = useState(false);
  const [videoPct, setVideoPct] = useState(0);
  const [compressing, setCompressing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
    staleTime: 60_000,
  });

  async function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      toast.error(t('maxImages'));
      return;
    }
    setCompressing(true);
    try {
      const picked = Array.from(files).slice(0, room);
      const compressed: CompressedImage[] = [];
      for (const f of picked) {
        if (!f.type.startsWith('image/')) continue;
        compressed.push(await compressImage(f));
      }
      setImages((prev) => [...prev, ...compressed].slice(0, MAX_IMAGES));
    } catch {
      toast.error(t('error'));
    } finally {
      setCompressing(false);
    }
  }

  /** v4.15 — one tap captures the precise place (user grants the GPS permission). */
  function pickLocation() {
    if (!('geolocation' in navigator)) { toast.error(t('gpsError')); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) });
        setLocating(false);
        toast.success(t('gpsPicked'));
      },
      () => {
        setLocating(false);
        toast.error(t('gpsError'));
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 }
    );
  }

  async function submit() {
    if (!title.trim() || title.trim().length < 5) { toast.error(t('offerTitle')); return; }
    if (!categoryKey) { toast.error(t('offerCategory')); return; }
    // v4.15 — the task place: typed address and/or the captured GPS point
    if (!address.trim() && !location) { toast.error(t('offerAddress')); return; }
    setSaving(true);
    try {
      let videos: { gridId: string; mime: string }[] | undefined;
      if (video) {
        setVideoUp(true);
        setVideoPct(0);
        try {
          // progress-aware chunked upload; on failure abort instead of silently
          // publishing an offer without the video the user attached
          const res = await uploadVideo(video, (p) => setVideoPct(p));
          videos = [{ gridId: res.gridId, mime: res.mime }];
        } catch {
          toast.error(t('videoUploadFailed'));
          return;
        } finally {
          setVideoUp(false);
        }
      }
      const iso = scheduledToLocalIso(scheduledAt);
      await api.post('/offers', {
        title: title.trim(),
        description: description.trim(),
        categoryKey,
        wilaya,
        address: address.trim(),
        ...(location ? { location } : {}),
        ...(Number(workersNeeded) >= 1 ? { workersNeeded: Math.min(50, Math.round(Number(workersNeeded))) } : {}),
        amountDA: Number(amount) || 0,
        scheduledAt: iso,
        images: images.length ? images : undefined,
        videos,
      });
      toast.success(t('offerCreated'));
      qc.invalidateQueries({ queryKey: ['my-offers'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
      onDone();
    } catch (e) {
      const code = (e as { code?: string }).code;
      // v4.14 — no subscription gate anymore; only the anti-spam cap can reject
      if (code === 'MAX_OFFERS_REACHED') toast.error(`${t('maxActiveOffers')}: ${settings?.subscription.maxActiveOffers}`);
      else toast.error(t('error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-4 pb-32 pt-4 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="o-title">{t('offerTitle')} *</Label>
          <ClearInput id="o-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('offerTitlePlaceholder')} className="h-11 rounded-xl" maxLength={120} />
        </div>

        {/* v4.15 — the field/domain became a proper dropdown list */}
        <div className="space-y-1.5">
          <Label htmlFor="o-category">{t('offerCategory')} *</Label>
          <select
            id="o-category"
            value={categoryKey}
            onChange={(e) => setCategoryKey(e.target.value)}
            className="h-12 w-full rounded-xl border-2 bg-card px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="" disabled>— {t('offerCategory')} —</option>
            {settings?.categories.map((c) => (
              <option key={c.key} value={c.key}>{categoryLabel(c, lang)}</option>
            ))}
          </select>
        </div>

        {/* v4.15 — the description is no longer required */}
        <div className="space-y-1.5">
          <Label htmlFor="o-desc">{t('offerDescription')} ({t('optional')})</Label>
          <Textarea id="o-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('offerDescriptionPlaceholder')} className="min-h-24 rounded-xl" maxLength={2000} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="o-wilaya">{t('wilaya')}</Label>
          <WilayaSelect id="o-wilaya" value={wilaya} onChange={setWilaya} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="o-amount">{t('offerAmount')}</Label>
          <ClearInput id="o-amount" type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 rounded-xl" placeholder="2000" />
        </div>

        {/* v4.15 — how many people the task needs */}
        <div className="space-y-1.5">
          <Label htmlFor="o-workers" className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary" /> {t('workersNeeded')} ({t('optional')})</Label>
          <ClearInput id="o-workers" type="number" inputMode="numeric" min={1} max={50} value={workersNeeded} onChange={(e) => setWorkersNeeded(e.target.value)} className="h-11 rounded-xl" placeholder="1" />
        </div>

        {/* v4.15 — address as text AND/OR the precise GPS point */}
        <div className="space-y-1.5">
          <Label htmlFor="o-address">{t('offerAddress')} *</Label>
          <ClearInput id="o-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('offerAddressPlaceholder')} className="h-11 rounded-xl" maxLength={300} />
          <button
            type="button"
            onClick={pickLocation}
            disabled={locating}
            className={`w-full h-11 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-bold transition-all active:scale-[0.99] ${
              location ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'border-primary/40 bg-primary/5 text-primary hover:border-primary'
            }`}
          >
            {locating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            {location ? t('gpsPickedShort') : t('gpsPick')}
          </button>
          {location && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 break-all" dir="ltr">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> {location.lat}, {location.lng}
              </span>
              <button type="button" onClick={() => setLocation(null)} aria-label={t('close')} className="h-6 w-6 rounded-full bg-white dark:bg-emerald-900 text-rose-600 flex items-center justify-center shadow active:scale-90 shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground leading-snug break-words">{t('offerAddressHint')}</p>
        </div>

        {/* v4.15 — the pattern is enforced: yyyy/mm/dd hh:mm (numeric keyboard) */}
        <div className="space-y-1.5">
          <Label htmlFor="o-date">{t('scheduledAt')} ({t('optional')})</Label>
          <ClearInput
            id="o-date"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(formatSchedule(e.target.value))}
            className="h-11 rounded-xl"
            placeholder="yyyy/mm/dd hh:mm"
            inputMode="numeric"
            dir="ltr"
            maxLength={16}
          />
          <p className="text-[11px] text-muted-foreground leading-snug break-words">{t('schedulePatternHint')}</p>
        </div>

        {/* images — max 10, compressed automatically */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('offerImages')}</Label>
            <span className="text-xs text-muted-foreground tabular-nums">{images.length}/{MAX_IMAGES}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative">
                <img src={`data:${img.mime};base64,${img.dataBase64}`} alt={`${i}`} className="h-20 w-20 rounded-xl object-cover border" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -top-2 -end-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md active:scale-90"
                  aria-label={t('deleteImages')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <label className="h-20 w-20 rounded-xl border-2 border-dashed border-muted-foreground/40 flex flex-col items-center justify-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors">
                {compressing ? <LoaderCircle className="h-5 w-5 animate-spin text-primary" /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onPickFiles(e.target.files); e.currentTarget.value = ''; }} />
              </label>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Camera className="h-3 w-3" /> {t('maxImages')}
          </p>
        </div>

        {/* video — GridFS, capped at 50 MB to protect the free MongoDB tier */}
        <div className="space-y-2">
          <Label>{t('offerVideo')}</Label>
          {video ? (
            <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Film className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold break-all">{video.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(video.size / (1024 * 1024)).toFixed(1)} MB
                  {videoUp ? ` — ${t('videoUploadingProgress', { pct: videoPct })}` : ''}
                </p>
                {videoUp && (
                  <div className="h-1 rounded-full bg-primary/10 overflow-hidden mt-1.5">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${videoPct}%` }} />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setVideo(null)}
                className="h-9 w-9 rounded-full bg-destructive/10 text-destructive flex items-center justify-center active:scale-90 shrink-0"
                aria-label={t('removeVideo')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="h-20 rounded-xl border-2 border-dashed border-muted-foreground/40 flex items-center justify-center gap-2 cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors text-sm font-semibold text-muted-foreground">
              <Play className="h-5 w-5" /> {t('addVideo')}
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.currentTarget.value = '';
                  if (!f) return;
                  // friendly pre-check: refuse heavy videos before any upload bytes move
                  if (f.size > MAX_VIDEO_BYTES) { toast.error(t('videoTooLarge')); return; }
                  setVideo(f);
                }}
              />
            </label>
          )}
        </div>

        <div className="rounded-xl border bg-muted/40 p-3 flex items-start gap-2">
          <TriangleAlert className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground break-words">{t('showAddress')}</p>
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 border-t bg-background/95 backdrop-blur p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button onClick={submit} disabled={saving || compressing || videoUp} className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/25">
          {(saving || videoUp) && <LoaderCircle className="h-5 w-5 animate-spin" />}
          {videoUp ? t('videoUploading') : t('createOffer')}
        </Button>
      </div>
    </div>
  );
}

/* ---------- v4.15 helpers: date pattern + GPS-free precise location ---------- */

/**
 * Format the schedule field strictly as yyyy/mm/dd hh:mm while typing:
 * digits only are collected, separators are inserted automatically
 * (4-digit year, 2-digit month, 2-digit day, 2-digit hour, 2-digit minutes).
 */
function formatSchedule(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  let out = digits.slice(0, 4);
  if (digits.length > 4) out += '/' + digits.slice(4, 6);
  if (digits.length > 6) out += '/' + digits.slice(6, 8);
  if (digits.length > 8) out += ' ' + digits.slice(8, 10);
  if (digits.length > 10) out += ':' + digits.slice(10, 12);
  return out;
}

/** 'yyyy/mm/dd hh:mm' → ISO string, or null when empty/invalid. */
function scheduledToLocalIso(value: string): string | null {
  if (!value) return null;
  const m = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const nums = m.map(Number);
  const [, y, mo, d, h, mi] = nums;
  const dt = new Date(y, mo - 1, d, h, mi);
  // reject impossible dates (31/02…) via a round-trip check
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt.toISOString();
}
