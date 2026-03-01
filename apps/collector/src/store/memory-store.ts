import type { AgentEvent } from '@synapse-tools/protocol';

export interface Session {
  id: string;
  startedAt: number;
  endedAt: number | null;
  eventCount: number;
}

class MemoryStore {
  private events: Map<string, AgentEvent[]> = new Map();
  private sessions: Map<string, Session> = new Map();

  addEvent(event: AgentEvent): void {
    const { sessionId } = event;

    // Track session
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        startedAt: event.timestamp,
        endedAt: null,
        eventCount: 0,
      });
    }

    const session = this.sessions.get(sessionId)!;
    session.eventCount++;

    if (event.type === 'session_end') {
      session.endedAt = event.timestamp;
    }

    // Store event
    if (!this.events.has(sessionId)) {
      this.events.set(sessionId, []);
    }
    this.events.get(sessionId)!.push(event);
  }

  getSessionEvents(sessionId: string): AgentEvent[] {
    return this.events.get(sessionId) || [];
  }

  getSessions(): Session[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.startedAt - a.startedAt,
    );
  }

  getLatestSession(): Session | null {
    const sessions = this.getSessions();
    return sessions[0] || null;
  }

  getAllEvents(): AgentEvent[] {
    const all: AgentEvent[] = [];
    for (const events of this.events.values()) {
      all.push(...events);
    }
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }

  clear(): void {
    this.events.clear();
    this.sessions.clear();
  }
}

export const store = new MemoryStore();
