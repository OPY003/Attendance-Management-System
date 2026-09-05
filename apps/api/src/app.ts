import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { getDatabase } from './core/database/db.js';
import { seedDatabase } from './core/database/seed.js';
import { errorHandler } from './middleware/errorHandler.js';
import { attendanceRouter } from './modules/attendance/attendanceRoutes.js';
import { authRouter } from './modules/auth/authRoutes.js';
import { detectionRouter } from './modules/detection/detectionRoutes.js';
import { groupRouter } from './modules/groups/groupRoutes.js';
import { locationRouter } from './modules/locations/locationRoutes.js';
import { organizationRouter } from './modules/organizations/organizationRoutes.js';
import { personRouter } from './modules/persons/personRoutes.js';
import { roleRouter } from './modules/roles/roleRoutes.js';
import { scheduleRouter } from './modules/schedules/scheduleRoutes.js';

if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
  getDatabase();
  await seedDatabase();
}

export function createApp(): express.Application {
  const app = express();

  // Security and standard middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: '*', // Configurable in production
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id'],
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health and readiness endpoints
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'uapms-api',
      version: '2.0.0',
    });
  });

  app.get('/ready', (_req, res) => {
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  });

  // API v1 Routes
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/organizations', organizationRouter);
  app.use('/api/v1', roleRouter);
  app.use('/api/v1', personRouter);
  app.use('/api/v1', locationRouter);
  app.use('/api/v1', groupRouter);
  app.use('/api/v1', scheduleRouter);
  app.use('/api/v1', attendanceRouter);
  app.use('/api/v1/detection', detectionRouter);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `Endpoint ${req.method} ${req.originalUrl} not found`,
      },
    });
  });

  // Global centralized error handler
  app.use(errorHandler);

  return app;
}
