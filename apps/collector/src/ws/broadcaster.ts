import type { Server as SocketIOServer } from 'socket.io';
import type { AgentEvent } from '@synapse-tools/protocol';

let io: SocketIOServer | null = null;

export function initBroadcaster(socketServer: SocketIOServer): void {
  io = socketServer;

  io.on('connection', (socket) => {
    console.log(`[ws] Dashboard connected: ${socket.id}`);

    // Join a session room when requested
    socket.on('join_session', (sessionId: string) => {
      socket.join(`session:${sessionId}`);
      console.log(`[ws] ${socket.id} joined session: ${sessionId}`);
    });

    socket.on('leave_session', (sessionId: string) => {
      socket.leave(`session:${sessionId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[ws] Dashboard disconnected: ${socket.id}`);
    });
  });
}

export function broadcastEvent(event: AgentEvent): void {
  if (!io) return;

  // Broadcast to everyone (for the activity feed / auto-join)
  io.emit('agent_event', event);

  // Also broadcast to session-specific room
  io.to(`session:${event.sessionId}`).emit('session_event', event);
}

export function broadcastSessionList(sessions: unknown[]): void {
  if (!io) return;
  io.emit('sessions_updated', sessions);
}

