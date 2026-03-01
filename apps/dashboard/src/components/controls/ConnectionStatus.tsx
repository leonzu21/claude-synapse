import { useAppStore } from '../../state/store';

export default function ConnectionStatus() {
  const connected = useAppStore((s) => s.connected);

  return (
    <div className="flex items-center gap-1 flex-shrink-0 whitespace-nowrap">
      <span
        className="w-1.5 h-1.5"
        style={{
          backgroundColor: connected ? 'var(--agent-working)' : 'var(--agent-error)',
        }}
      />
      <span className="text-[12px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>
        {connected ? 'ONLINE' : 'OFFLINE'}
      </span>
    </div>
  );
}
