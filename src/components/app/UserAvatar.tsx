'use client';

import { useEffect, useState } from 'react';
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
  const [failed, setFailed] = useState(false);
  // bump when the photo version changes (updatedAt) so a new upload replaces the cached one
  useEffect(() => setFailed(false), [user?._id, user?.hasAvatar, (user as { updatedAt?: string } | null | undefined)?.updatedAt]);
  const showPhoto = user?.hasAvatar && !failed;

  if (showPhoto) {
    return (
      <img
        src={avatarUrl(user._id, (user as { updatedAt?: string } | null | undefined)?.updatedAt)}
        alt={user.name || ''}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${size} ${ring ? 'ring-2 ring-primary/30' : ''} rounded-2xl object-cover border bg-muted shrink-0`}
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
