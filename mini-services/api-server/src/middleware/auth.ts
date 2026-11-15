import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User, IUser } from '../models/user.model';

export interface AuthRequest extends Request {
  user?: IUser;
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: '30d' });
}

export async function auth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token as string) || '';
    if (!token) { res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' }); return; }
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
    const user = await User.findById(payload.sub);
    if (!user) { res.status(401).json({ error: 'User not found', code: 'NO_USER' }); return; }
    if (user.isBanned) { res.status(403).json({ error: 'Account banned', code: 'BANNED' }); return; }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token', code: 'BAD_TOKEN' });
  }
}

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user?.isSuperAdmin) { res.status(403).json({ error: 'Super admin only', code: 'NOT_ADMIN' }); return; }
  next();
}
