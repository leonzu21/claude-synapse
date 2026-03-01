import type { FastifyInstance } from 'fastify';
import { store } from '../store/memory-store.js';

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  // List all sessions
  app.get('/api/sessions', async (_request, reply) => {
    return reply.send(store.getSessions());
  });

  // Get events for a specific session
  app.get<{ Params: { sessionId: string } }>(
    '/api/sessions/:sessionId/events',
    async (request, reply) => {
      const { sessionId } = request.params;
      const events = store.getSessionEvents(sessionId);
      return reply.send(events);
    },
  );
}
