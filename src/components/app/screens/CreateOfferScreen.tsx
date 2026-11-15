'use client';

// v4.10 — video size cap (matches the server limit; protects the free MongoDB tier)
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLang } from '@/lib/language-context';
import { api, uploadVideo } from '@/lib/api';
import { compressImage, CompressedImage } from '@/lib/image';
import { Settings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CategoryChip } from '@/components/app/ui-bits';
import { WilayaSelect } from '@/components/app/WilayaSelect';
import { X, LoaderCircle, Camera, ImagePlus, TriangleAlert, Film, Play } from 'lucide-react';
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

  async function submit() {
    if (!title.trim() || title.trim().length < 5) { toast.error(t('offerTitle')); return; }
    if (!description.trim() || description.trim().length < 10) { toast.error(t('offerDescription')); return; }
    if (!categoryKey) { toast.error(t('offerCategory')); return; }
    if (!address.trim()) { toast.error(t('offerAddress')); return; }
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
      await api.post('/offers', {
        title: title.trim(),
        description: description.trim(),
        categoryKey,
        wilaya,
        address: address.trim(),
        amountDA: Number(amount) || 0,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
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
      if (code === 'SUBSCRIPTION_REQUIRED') toast.error(t('subscriptionRequired'));
      else if (code === 'MAX_OFFERS_REACHED') toast.error(`${t('maxActiveOffers')}: ${settings?.subscription.maxActiveOffers}`);
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
          <Input id="o-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('offerTitlePlaceholder')} className="h-11 rounded-xl" maxLength={120} />
        </div>

        <div className="space-y-1.5">
          <Label>{t('offerCategory')} *</Label>
          <div className="flex flex-wrap gap-2">
            {settings?.categories.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategoryKey(c.key)}
                className={`inline-flex rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-all active:scale-95 ${
                  categoryKey === c.key ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25' : 'border-border bg-card hover:border-primary/50'
                }`}
              >
                <CategoryChip cat={c} lang={lang} />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="o-desc">{t('offerDescription')} *</Label>
          <Textarea id="o-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('offerDescriptionPlaceholder')} className="min-h-28 rounded-xl" maxLength={2000} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="o-wilaya">{t('wilaya')}</Label>
          <WilayaSelect id="o-wilaya" value={wilaya} onChange={setWilaya} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="o-amount">{t('offerAmount')}</Label>
          <Input id="o-amount" type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 rounded-xl" placeholder="2000" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="o-address">{t('offerAddress')} *</Label>
          <Input id="o-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('offerAddressPlaceholder')} className="h-11 rounded-xl" maxLength={300} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="o-date">{t('scheduledAt')} ({t('optional')})</Label>
          <Input id="o-date" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="h-11 rounded-xl" />
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

        {/* video — GridFS, capped at 30 MB to protect the free MongoDB tier */}
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
                  // v4.10 — friendly pre-check: refuse heavy videos before any upload bytes move
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
