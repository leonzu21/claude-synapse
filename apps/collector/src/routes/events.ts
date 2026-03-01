import type { FastifyInstance } from 'fastify';
import type { AgentEvent } from '@synapse-tools/protocol';
import { store } from '../store/memory-store.js';
import { broadcastEvent, broadcastSessionList } from '../ws/broadcaster.js';

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  // SDK event ingestion
  app.post<{ Body: AgentEvent }>('/api/events', async (request, reply) => {
    const event = request.body;

    if (!event || !event.type || !event.sessionId) {
      return reply.status(400).send({ error: 'Invalid event: requires type and sessionId' });
    }

    console.log(`[sdk] ${event.type} from ${event.agentName}`);

    store.addEvent(event);
    broadcastEvent(event);
    broadcastSessionList(store.getSessions());

    return reply.status(200).send({ ok: true });
  });

  // Batch SDK events
  app.post<{ Body: AgentEvent[] }>('/api/events/batch', async (request, reply) => {
    const events = request.body;

    if (!Array.isArray(events)) {
      return reply.status(400).send({ error: 'Expected array of events' });
    }

    for (const event of events) {
      store.addEvent(event);
      broadcastEvent(event);
    }

    broadcastSessionList(store.getSessions());

    return reply.status(200).send({ ok: true, count: events.length });
  });
}
