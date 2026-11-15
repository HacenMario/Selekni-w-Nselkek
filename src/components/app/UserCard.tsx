'use client';

import { Phone, VenusAndMars, CalendarClock, MapPin, Droplets, BadgeCheck } from 'lucide-react';
import { useLang } from '@/lib/language-context';
import { wilayaShort } from '@/lib/wilayas';
import { UserAvatar } from '@/components/app/UserAvatar';
import { LevelBadge } from '@/components/app/ui-bits';
import { PublicUser } from '@/lib/types';

/** Rich counterpart card: photo, name, gender, age, wilaya, blood group and phone. */
export function UserCard({
  user,
  title,
  phone,
  phoneLabel,
}: {
  user: PublicUser | null | undefined;
  title: string;
  phone?: string;
  phoneLabel?: string;
}) {
  const { t, lang } = useLang();
  if (!user) return null;
  const genderLabel = user.gender === 'male' ? t('male') : user.gender === 'female' ? t('female') : '';
  // gamification: executors level up by completed tasks, owners by completed posts
  const levelTasks = user.tasksDone || user.tasksCompleted || 0;

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm card-hover" data-testid="user-card">
      <p className="text-xs font-bold text-muted-foreground mb-3">{title}</p>
      <div className="flex items-start gap-4">
        <UserAvatar user={user} size="h-20 w-20" textClass="text-2xl" ring />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-[15px] break-words leading-snug">{user.name}</p>
            <LevelBadge tasks={levelTasks} />
            {user.idVerified === 'verified' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5">
                <BadgeCheck className="h-3 w-3" /> {t('idVerifiedBadge')}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {genderLabel && (
              <span className="inline-flex items-center gap-1">
                <VenusAndMars className="h-3.5 w-3.5" /> {genderLabel}
              </span>
            )}
            {Boolean(user.age) && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" /> {t('yearsOld', { age: user.age! })}
              </span>
            )}
            {user.wilaya && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {wilayaShort(user.wilaya, lang)}
              </span>
            )}
            {user.bloodType && (
              <span className="inline-flex items-center gap-1 font-bold text-destructive">
                <Droplets className="h-3.5 w-3.5" /> {user.bloodType}
              </span>
            )}
          </div>
          {phone && (
            <a
              href={`tel:${phone}`}
              className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary font-bold text-sm px-3 py-1.5 hover:bg-primary/20 active:scale-95 transition-all"
            >
              <Phone className="h-3.5 w-3.5" /> <span dir="ltr">{phone}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
