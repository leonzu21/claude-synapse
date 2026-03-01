import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { Server as SocketIOServer } from 'socket.io';
import { hookRoutes } from './routes/hooks.js';
import { eventRoutes } from './routes/events.js';
import { sessionRoutes } from './routes/sessions.js';
import { initBroadcaster } from './ws/broadcaster.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4800;

async function main() {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });

  // Register API routes
  await app.register(hookRoutes);
  await app.register(eventRoutes);
  await app.register(sessionRoutes);

  // Health check
  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  // Serve dashboard static files if available
  const dashboardDist = resolve(__dirname, '../../dashboard/dist');
  if (existsSync(dashboardDist)) {
    await app.register(fastifyStatic, {
      root: dashboardDist,
      prefix: '/',
      wildcard: false,
    });
    // SPA fallback: serve index.html for non-API routes
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/socket.io/')) {
        return reply.status(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
    console.log(`[synapse] Dashboard available at http://localhost:${PORT}`);
  }

  // Start HTTP server
  await app.listen({ port: PORT, host: '0.0.0.0' });

  // Attach Socket.IO to the underlying Node HTTP server
  const io = new SocketIOServer(app.server, {
    cors: { origin: '*' },
  });

  initBroadcaster(io);

  console.log(`[synapse] Collector listening on http://localhost:${PORT}`);
  console.log(`[synapse] WebSocket ready for dashboard connections`);
}

main().catch((err) => {
  console.error('[synapse] Failed to start:', err);
  process.exit(1);
});
