import { Settings, ISettings } from '../models/settings.model';
import { DEFAULT_CATEGORIES } from '../models/settings.model';

export async function getSettings(): Promise<ISettings> {
  let s = await Settings.findOne({ key: 'main' });
  if (!s) {
    s = await Settings.create({ key: 'main' });
  }
  // v4.9 — upgrade existing deployments: append any default category the stored
  // settings are missing (admin-added custom categories are always preserved)
  const keys = new Set(s.categories.map((c) => c.key));
  const missing = DEFAULT_CATEGORIES.filter((c) => !keys.has(c.key));
  if (missing.length > 0) {
    s.categories.push(...missing.map((c) => ({ key: c.key, label: c.label as any, icon: c.icon })));
    await s.save();
  }
  return s;
}

export function isSubscribed(settings: ISettings, sub: { status: string; endsAt?: Date } | null | undefined): boolean {
  if (!settings.subscription.isEnabled) return true; // gate disabled globally
  return !!sub && sub.status === 'active' && !!sub.endsAt && sub.endsAt.getTime() > Date.now();
}
