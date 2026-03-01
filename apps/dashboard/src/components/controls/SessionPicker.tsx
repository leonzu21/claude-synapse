import { useAppStore } from '../../state/store';

const COLLECTOR_URL = 'http://localhost:4800';

async function fetchAndLoadSession(sessionId: string) {
  const { setActiveSession, loadSessionEvents } = useAppStore.getState();
  setActiveSession(sessionId);

  try {
    const res = await fetch(`${COLLECTOR_URL}/api/sessions/${sessionId}/events`);
    if (res.ok) {
      const events = await res.json();
      loadSessionEvents(events);
    }
  } catch {
    // Collector unreachable — new events will still arrive via WebSocket
  }
}

export default function SessionPicker() {
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);

  if (sessions.length === 0) return null;

  return (
    <select
      className="text-[13px] font-bold uppercase px-1.5 py-0.5 border outline-none appearance-none flex-shrink-0"
      style={{
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text-dim)',
        borderColor: 'var(--border)',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='8' viewBox='0 0 8 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='1' y='2' width='2' height='2' fill='%238888a0'/%3E%3Crect x='3' y='4' width='2' height='2' fill='%238888a0'/%3E%3Crect x='5' y='2' width='2' height='2' fill='%238888a0'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 4px center',
        paddingRight: '16px',
      }}
      value={activeSessionId || ''}
      onChange={(e) => {
        const id = e.target.value || null;
        if (id) {
          fetchAndLoadSession(id);
        } else {
          useAppStore.getState().setActiveSession(null);
        }
      }}
    >
      <option value="">ALL SESSIONS</option>
      {sessions.map((s) => (
        <option key={s.id} value={s.id}>
          {s.id.slice(0, 12)}... ({s.eventCount})
        </option>
      ))}
    </select>
  );
}
