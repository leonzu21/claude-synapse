import { stat } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import { transformClaudeHook } from '@synapse-tools/protocol';
import type { AgentEvent } from '@synapse-tools/protocol';
import { store } from '../store/memory-store.js';
import { broadcastEvent, broadcastSessionList } from '../ws/broadcaster.js';

let contextEventCounter = 0;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function getTranscriptSize(
  transcriptPath: string,
  sessionId: string,
): Promise<AgentEvent | null> {
  try {
    const stats = await stat(transcriptPath);

    return {
      id: `ctx_${Date.now()}_${++contextEventCounter}`,
      type: 'session_meta',
      timestamp: Date.now(),
      sessionId,
      agentId: 'system',
      agentName: 'Transcript',
      agentType: 'system',
      parentAgentId: null,
      payload: {
        metadata: {
          transcriptBytes: stats.size,
          transcriptSize: formatBytes(stats.size),
        },
      },
      source: 'claude_hooks',
    };
  } catch {
    return null;
  }
}

export async function hookRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { hookEvent: string };
    Body: Record<string, unknown>;
  }>('/api/hooks/:hookEvent', async (request, reply) => {
    const { hookEvent } = request.params;
    const body = request.body || {};

    console.log(`[hook] ${hookEvent}`, JSON.stringify(body, null, 2));

    try {
      const events = transformClaudeHook(hookEvent, body);

      for (const event of events) {
        store.addEvent(event);
        broadcastEvent(event);
      }

      // Get transcript file size
      const transcriptPath = body.transcript_path as string | undefined;
      const sessionId = body.session_id as string | undefined;
      if (transcriptPath && sessionId) {
        const ctxEvent = await getTranscriptSize(transcriptPath, sessionId);
        if (ctxEvent) {
          store.addEvent(ctxEvent);
          broadcastEvent(ctxEvent);
        }
      }

      // Notify dashboards of updated session list
      broadcastSessionList(store.getSessions());

      return reply.status(200).send({ ok: true, eventsCreated: events.length });
    } catch (err) {
      console.error(`[hook] Error processing ${hookEvent}:`, err);
      // Still return 200 so we don't block Claude Code
      return reply.status(200).send({ ok: false, error: 'processing_error' });
    }
  });
}
