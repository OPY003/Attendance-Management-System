import http from 'http';
import { WebSocketServer } from 'ws';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { getDatabase } from './core/database/db.js';
import { seedDatabase } from './core/database/seed.js';
import { logger } from './core/logger.js';

async function bootstrap() {
  try {
    logger.info('Initializing UAPMS API Server...');

    // Initialize database and migrations
    getDatabase();
    logger.info('Database initialized and schemas migrated.');

    // Seed default roles and data if empty
    await seedDatabase();
    logger.info('Database seeded with standard permissions and default roles.');

    const app = createApp();
    const server = http.createServer(app);

    // Initialize WebSocket server for real-time monitoring
    const wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws, req) => {
      logger.info(`WebSocket client connected from ${req.socket.remoteAddress}`);
      ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Connected to UAPMS Real-Time Stream' }));

      ws.on('message', (message) => {
        try {
          const parsed = JSON.parse(message.toString());
          if (parsed.type === 'SUBSCRIBE_SESSION') {
            // Register client to session channel
            (ws as any).subscribedSessionId = parsed.session_id;
            ws.send(JSON.stringify({ type: 'SUBSCRIBED', session_id: parsed.session_id }));
          }
        } catch {}
      });

      ws.on('close', () => {
        logger.info('WebSocket client disconnected');
      });
    });

    server.listen(config.port, () => {
      logger.info(`🚀 UAPMS API Server listening on port ${config.port} [${config.env}]`);
      logger.info(`Health check available at http://localhost:${config.port}/health`);
    });
  } catch (err: any) {
    logger.error('Fatal error during startup', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}
