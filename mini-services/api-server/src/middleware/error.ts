import { Response, NextFunction } from 'express';
import { ZodError } from 'zod';

type AsyncHandler = (req: any, res: Response, next: NextFunction) => Promise<void> | void;

export function asyncH(fn: AsyncHandler) {
  return (req: any, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(err: any, _req: any, res: Response, _next: any): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message || 'Invalid input', code: 'VALIDATION' });
    return;
  }
  console.error('[error]', err?.message || err);
  const status = err?.status || 500;
  res.status(status).json({ error: err?.message || 'Server error', code: err?.code || 'SERVER' });
}
