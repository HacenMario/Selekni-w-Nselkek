import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/user.model';
import { signToken, auth, AuthRequest } from '../middleware/auth';
import { asyncH } from '../middleware/error';
import { env } from '../config/env';
import { decodeAvatar, decodeIdCard } from '../utils/images';
import { notifyAdmins } from '../services/notification.service';

/* /api/auth */
export const authRouter = Router();

const AVATAR_MAX = 300 * 1024;
export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  phone: z.string().min(6).max(20),
  password: z.string().min(6).max(100),
  wilaya: z.string().max(80).default(''),
  gender: z.enum(['male', 'female', '']).default(''),
  age: z.number().int().min(12).max(100).optional(),
  // blood group is mandatory for every account — emergency medical info for the other party
  bloodType: z.enum(BLOOD_TYPES),
  avatar: z.object({ mime: z.string(), dataBase64: z.string() }).optional(),
  // seekers must upload the front side of their ID card; reviewed by the super admin
  idCard: z.object({ mime: z.string(), dataBase64: z.string() }).optional(),
  role: z.enum(['owner', 'seeker']).default('seeker'),
});

const loginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1),
});

authRouter.post('/register', asyncH(async (req, res) => {
  const body = registerSchema.parse(req.body);
  const exists = await User.findOne({ email: body.email });
  if (exists) { res.status(409).json({ error: 'Email already registered', code: 'EMAIL_TAKEN' }); return; }
  const avatar = decodeAvatar(body.avatar, AVATAR_MAX);
  if (avatar.error) { res.status(400).json({ error: avatar.error, code: 'BAD_IMAGE' }); return; }
  // seekers must attach the ID-card photo at signup
  let idCard: ReturnType<typeof decodeIdCard> = {};
  if (body.role === 'seeker') {
    if (!body.idCard) { res.status(400).json({ error: 'Seekers must upload the front side of their ID card', code: 'ID_CARD_REQUIRED' }); return; }
    idCard = decodeIdCard(body.idCard);
    if (idCard.error) { res.status(400).json({ error: idCard.error, code: 'BAD_IMAGE' }); return; }
  }
  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await User.create({
    name: body.name,
    email: body.email,
    phone: body.phone,
    wilaya: body.wilaya,
    gender: body.gender,
    age: body.age || 0,
    role: body.role,
    bloodType: body.bloodType,
    passwordHash,
    authProvider: 'password',
    profileComplete: true,
    // verification is pending until the super admin reviews the card, then
    // the image is wiped from the database either way (privacy first)
    ...(idCard.data ? { idCard: idCard.data.data, idCardMime: idCard.data.mime, idVerified: 'pending' } : {}),
    ...(avatar.data ? { avatar: avatar.data.data, avatarMime: avatar.data.mime, avatarIsSet: true } : {}),
  });
  const token = signToken(String(user._id));
  // a seeker account awaiting ID verification → alert the administration
  if (idCard.data) {
    notifyAdmins('id_pending', { actorName: user.name, userId: String(user._id) }).catch(() => {});
  }
  res.status(201).json({ token, user });
}));

authRouter.post('/login', asyncH(async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = await User.findOne({ email: body.email });
  if (!user || !user.passwordHash) { res.status(401).json({ error: 'Invalid email or password', code: 'BAD_CRED' }); return; }
  const ok = await bcrypt.compare(body.password, user.passwordHash);
  if (!ok) { res.status(401).json({ error: 'Invalid email or password', code: 'BAD_CRED' }); return; }
  if (user.isBanned) { res.status(403).json({ error: 'Account banned. Contact support.', code: 'BANNED' }); return; }
  const token = signToken(String(user._id));
  res.json({ token, user });
}));

/* ---------------------------------------------------------- Google OAuth */
const googleConfigured = () => Boolean(env.google.clientId && env.google.clientSecret);

/** Which social providers are usable — the auth screen calls this once. */
authRouter.get('/providers', (_req, res) => {
  res.json({ google: googleConfigured() });
});

/** Step 1: redirect the browser to Google's consent screen. */
authRouter.get('/google', (req: Request, res: Response) => {
  if (!googleConfigured()) { res.status(503).json({ error: 'Google login is not configured on this server', code: 'GOOGLE_NOT_CONFIGURED' }); return; }
  const state = jwt.sign({ kind: 'gstate' }, env.jwtSecret, { expiresIn: '10m' });
  const redirectUri = env.google.redirectUri || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

/** Step 2: exchange the code, upsert the user, send the session token back to the app. */
authRouter.get('/google/callback', asyncH(async (req: Request, res: Response) => {
  const fail = (msg: string) => res.redirect(`${env.appUrl}/#social-error=${encodeURIComponent(msg)}`);
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code) return fail('missing_code');
    try { jwt.verify(String(state), env.jwtSecret); } catch { return fail('bad_state'); }
    const redirectUri = env.google.redirectUri || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.google.clientId,
        client_secret: env.google.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return fail('token_exchange_failed');
    const tok = (await tokenRes.json()) as { access_token?: string };
    if (!tok.access_token) return fail('no_access_token');
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    if (!infoRes.ok) return fail('userinfo_failed');
    const info = (await infoRes.json()) as { email?: string; email_verified?: boolean; name?: string };
    if (!info.email) return fail('no_email');

    const email = info.email.toLowerCase();
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name: (info.name || email.split('@')[0]).slice(0, 80),
        email,
        phone: '',
        authProvider: 'google',
        profileComplete: false,
        passwordHash: '',
      });
    }
    if (user.isBanned) return fail('banned');
    const token = signToken(String(user._id));
    res.redirect(`${env.appUrl}/#social-token=${encodeURIComponent(token)}`);
  } catch {
    return fail('google_error');
  }
}));

/* /api/me */
export const meRouter = Router();

const patchMeSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  phone: z.string().min(6).max(20).optional(),
  wilaya: z.string().max(80).optional(),
  gender: z.enum(['male', 'female', '']).optional(),
  age: z.number().int().min(12).max(100).optional(),
  bloodType: z.enum(BLOOD_TYPES).optional(),
  avatar: z.object({ mime: z.string(), dataBase64: z.string() }).optional(),
  // a (re-)upload of the ID card resets verification to pending
  idCard: z.object({ mime: z.string(), dataBase64: z.string() }).optional(),
  role: z.enum(['owner', 'seeker']).optional(),
  languages: z.array(z.enum(['ar', 'fr', 'en'])).min(1).max(3).optional(),
  interests: z.array(z.string().max(60)).max(20).optional(),
  // v4.9 — preferred interface accent color (violet/blue/cyan/teal/emerald/amber/orange/rose/pink/indigo)
  uiTheme: z.string().max(20).optional(),
  skills: z.string().max(300).optional(),
  profileComplete: z.literal(true).optional(),
});

meRouter.get('/', auth, asyncH(async (req: AuthRequest, res) => {
  res.json(req.user);
}));

meRouter.patch('/', auth, asyncH(async (req: AuthRequest, res: Response) => {
  const body = patchMeSchema.parse(req.body);
  const avatar = decodeAvatar(body.avatar, AVATAR_MAX);
  if (avatar.error) { res.status(400).json({ error: avatar.error, code: 'BAD_IMAGE' }); return; }
  // seekers can (re-)submit their ID card — it goes back to "pending" review
  const idCard = decodeIdCard(body.idCard);
  if (idCard.error) { res.status(400).json({ error: idCard.error, code: 'BAD_IMAGE' }); return; }

  // a Google user finishing onboarding must supply everything required
  if (body.profileComplete) {
    const u = req.user!;
    const merged = {
      name: body.name ?? u.name,
      phone: body.phone ?? u.phone,
      wilaya: body.wilaya ?? u.wilaya,
      gender: body.gender ?? u.gender,
      age: body.age ?? u.age,
      bloodType: body.bloodType ?? u.bloodType,
    };
    if (!merged.name || merged.name.length < 2 || !merged.phone || merged.phone.length < 6 || !merged.wilaya || !merged.gender || !merged.age || !merged.bloodType) {
      res.status(400).json({ error: 'All required profile fields must be filled', code: 'PROFILE_INCOMPLETE' });
      return;
    }
  }

  const { avatar: _a, idCard: _i, ...rest } = body;
  const user = await User.findByIdAndUpdate(
    req.user!._id,
    {
      $set: {
        ...rest,
        ...(body.age !== undefined ? { age: body.age } : {}),
        // persist the "has profile photo" flag together with the photo itself
        ...(avatar.data ? { avatar: avatar.data.data, avatarMime: avatar.data.mime, avatarIsSet: true } : {}),
        // new ID-card submission: store it and put verification back to pending
        // (uses the FINAL role — the request may switch role in the same call)
        ...(idCard.data && (body.role || req.user!.role) === 'seeker'
          ? { idCard: idCard.data.data, idCardMime: idCard.data.mime, idVerified: 'pending', idRejectReason: '' }
          : {}),
      },
    },
    { new: true, runValidators: true }
  );
  // fresh ID-card submission → the administration gets a review notification
  if (idCard.data && (body.role || req.user!.role) === 'seeker') {
    notifyAdmins('id_pending', { actorName: user?.name || req.user!.name, userId: String(user?._id || req.user!._id) }).catch(() => {});
  }
  res.json(user);
}));

meRouter.post('/password', auth, asyncH(async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(6).max(100) }).parse(req.body);
  const ok = await bcrypt.compare(currentPassword, req.user!.passwordHash || '');
  if (!ok) { res.status(400).json({ error: 'Current password is incorrect', code: 'BAD_PASSWORD' }); return; }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await User.findByIdAndUpdate(req.user!._id, { $set: { passwordHash } });
  res.json({ ok: true });
}));
