import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { User } from '../models/user.model';

/** Upsert the super admin account from env vars. Not demo data: required admin. */
export async function upsertSuperAdmin(): Promise<void> {
  try {
    const existing = await User.findOne({ email: env.superAdmin.email });
    if (!existing) {
      const passwordHash = await bcrypt.hash(env.superAdmin.password, 10);
      await User.create({
        name: env.superAdmin.name,
        email: env.superAdmin.email,
        phone: '0000000000',
        wilaya: '',
        passwordHash,
        role: 'owner',
        isSuperAdmin: true,
      });
      console.log(`[superadmin] created: ${env.superAdmin.email}`);
    } else if (!existing.isSuperAdmin) {
      existing.isSuperAdmin = true;
      await existing.save();
      console.log(`[superadmin] promoted: ${env.superAdmin.email}`);
    }
  } catch (err) {
    console.error('[superadmin] upsert failed', err);
  }
}
