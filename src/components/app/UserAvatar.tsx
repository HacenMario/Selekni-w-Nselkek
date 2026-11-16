'use client';

import { useState } from 'react';
import { avatarUrl } from '@/lib/api';
import { PublicUser, User } from '@/lib/types';

/** Profile photo when present, otherwise a gradient tile with the user's initial. */
export function UserAvatar({
  user,
  size = 'h-11 w-11',
  textClass = 'text-base',
  ring = false,
}: {
  user: (PublicUser & { hasAvatar?: boolean }) | (User & { hasAvatar?: boolean }) | null | undefined;
  size?: string;
  textClass?: string;
  ring?: boolean;
}) {
  // reset is derived, not an effect: the failure is scoped to the exact photo
  // version (id + updatedAt) so a new upload or a different user retries naturally
  const version = (user as { updatedAt?: string } | null | undefined)?.updatedAt || '';
  const identity = `${user?._id || ''}|${version}|${user?.hasAvatar ? 1 : 0}`;
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const failed = failedFor === identity;
  const showPhoto = user?.hasAvatar && !failed;

  if (showPhoto) {
    return (
      // v4.15 — object-contain: the whole photo shows inside the frame, never cropped
      <img
        key={identity}
        src={avatarUrl(user._id, version || undefined)}
        alt={user.name || ''}
        loading="lazy"
        onError={() => setFailedFor(identity)}
        className={`${size} ${ring ? 'ring-2 ring-primary/30' : ''} rounded-2xl object-contain bg-muted border shrink-0 p-[2px]`}
        draggable={false}
      />
    );
  }
  const initial = (user?.name || '?').trim().charAt(0).toUpperCase();
  return (
    <div
      className={`${size} ${ring ? 'ring-2 ring-primary/30' : ''} rounded-2xl bg-gradient-to-br from-primary/80 to-primary/50 text-white flex items-center justify-center font-extrabold shrink-0 ${textClass}`}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
