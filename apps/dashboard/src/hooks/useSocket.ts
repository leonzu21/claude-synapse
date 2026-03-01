import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { AgentEvent } from '@synapse-tools/protocol';
import { useAppStore } from '../state/store';

// Socket.IO connection hook for real-time event streaming from collector
const COLLECTOR_URL = 'http://localhost:4800';

// Singleton socket so components can send messages
let globalSocket: Socket | null = null;

export function getSocket(): Socket | null {
  return globalSocket;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { setConnected, setSessions, processEvent } = useAppStore();

  useEffect(() => {
    const socket = io(COLLECTOR_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;
    globalSocket = socket;

    socket.on('connect', () => {
      console.log('[ws] Connected to collector');
      setConnected(true);

      // Auto-load the latest active session on connect
      fetch(`${COLLECTOR_URL}/api/sessions`)
        .then((r) => r.json())
        .then((sessions: { id: string; startedAt: number; endedAt: number | null; eventCount: number }[]) => {
          setSessions(sessions as any);
          // Pick the latest session that's still active, or the most recent one
          const active = sessions.find((s) => !s.endedAt) || sessions[sessions.length - 1];
          if (active && !useAppStore.getState().activeSessionId) {
            useAppStore.getState().setActiveSession(active.id);
            // Replay existing events
            fetch(`${COLLECTOR_URL}/api/sessions/${active.id}/events`)
              .then((r) => r.json())
              .then((events: AgentEvent[]) => {
                useAppStore.getState().loadSessionEvents(events);
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    });

    socket.on('disconnect', () => {
      console.log('[ws] Disconnected from collector');
      setConnected(false);
    });

    socket.on('agent_event', (event: AgentEvent) => {
      processEvent(event);
    });

    socket.on('sessions_updated', (sessions: unknown[]) => {
      setSessions(sessions as any);

      // Auto-switch to new session if none is selected
      const state = useAppStore.getState();
      if (!state.activeSessionId) {
        const list = sessions as { id: string; endedAt: number | null }[];
        const active = list.find((s) => !s.endedAt);
        if (active) {
          state.setActiveSession(active.id);
        }
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      globalSocket = null;
    };
  }, [setConnected, setSessions, processEvent]);

  return socketRef;
}
