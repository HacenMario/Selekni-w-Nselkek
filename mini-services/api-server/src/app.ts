import express from 'express';
import cors from 'cors';
import { authRouter, meRouter } from './routes/auth.routes';
import offersRoutes from './routes/offers.routes';
import notificationsRoutes from './routes/notifications.routes';
import subscriptionsRoutes from './routes/subscriptions.routes';
import settingsRoutes from './routes/settings.routes';
import statsRoutes from './routes/stats.routes';
import imagesRoutes from './routes/images.routes';
import mediaRoutes from './routes/media.routes';
import complaintsRoutes from './routes/complaints.routes';
import adminRoutes from './routes/admin.routes';
import { env } from './config/env';
import { errorHandler } from './middleware/error';

export function createApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: env.allowedOrigins.includes('*') ? true : env.allowedOrigins,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      credentials: false,
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'slekni-api', time: new Date().toISOString() }));

  // v4.11 — friendly root: the API serves /api/* only; visiting the bare domain
  // now confirms the deployment instead of showing the generic 404 JSON
  app.get('/', (_req, res) => {
    res.json({
      ok: true,
      service: 'Selekni w Nselkek — API',
      developer: 'MADOUNINE Hacene',
      health: '/api/health',
      api: '/api/...',
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/me', meRouter);
  app.use('/api/offers', offersRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/subscriptions', subscriptionsRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/images', imagesRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/complaints', complaintsRoutes);
  app.use('/api/admin', adminRoutes);

  app.use((_req, res) => res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }));
  app.use(errorHandler);
  return app;
}
