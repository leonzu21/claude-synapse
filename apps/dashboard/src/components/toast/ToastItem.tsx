import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ToastNotification } from '../../state/store';
import { useAppStore } from '../../state/store';

const typeStyles: Record<ToastNotification['type'], { borderColor: string; icon: string; iconColor: string }> = {
  achievement: { borderColor: '#fbbf24', icon: '\u2605', iconColor: '#fbbf24' },
  level_up: { borderColor: '#a855f7', icon: '\u2191', iconColor: '#a855f7' },
  info: { borderColor: '#475569', icon: '\u25cf', iconColor: '#60a5fa' },
};

export default function ToastItem({ toast }: { toast: ToastNotification }) {
  const dismissToast = useAppStore((s) => s.dismissToast);

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, dismissToast]);

  const style = typeStyles[toast.type] || typeStyles.info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className="cursor-pointer"
      onClick={() => dismissToast(toast.id)}
      style={{
        backgroundColor: '#0f172a',
        border: `2px solid ${style.borderColor}`,
        borderRadius: '6px',
        padding: '10px 14px',
        minWidth: '240px',
        maxWidth: '320px',
        boxShadow: `0 4px 12px ${style.borderColor}33`,
      }}
    >
      <div className="flex items-start gap-2">
        <span className="text-sm flex-shrink-0" style={{ color: style.iconColor }}>
          {style.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div
            className="text-[13px] font-bold uppercase"
            style={{ color: 'var(--text-primary)' }}
          >
            {toast.title}
          </div>
          {toast.description && (
            <div
              className="text-[11px] mt-0.5"
              style={{ color: 'var(--text-muted)' }}
            >
              {toast.description}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
