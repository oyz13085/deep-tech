import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import type { ToastMessage } from '../../types';

type ToastProps = {
  toasts: ToastMessage[];
};

export function Toast({ toasts }: ToastProps) {
  return (
    <div className="pointer-events-none fixed right-5 top-24 z-50 flex w-[min(28rem,calc(100vw-2.5rem))] flex-col gap-3">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.96 }}
            className="flex items-start gap-3 rounded-2xl border border-sentinel-border bg-white p-4 text-base font-semibold text-sentinel-text shadow-panel"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sentinel-primary" />
            <span>{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
