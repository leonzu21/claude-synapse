import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../state/store';
import ToastItem from './ToastItem';

export default function ToastContainer() {
  const toastQueue = useAppStore((s) => s.toastQueue);

  return (
    <div
      className="fixed top-12 right-3 z-50 flex flex-col gap-2 pointer-events-auto"
    >
      <AnimatePresence>
        {toastQueue.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
