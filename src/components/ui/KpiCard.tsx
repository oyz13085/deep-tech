import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

type KpiCardProps = {
  value: string;
  label: string;
  icon?: ReactNode;
  accent?: string;
  delay?: number;
};

export function KpiCard({ value, label, icon, accent = '#1F7A4D', delay = 0 }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="min-h-36 rounded-2xl border border-sentinel-border bg-white p-5 shadow-soft"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="h-1.5 w-16 rounded-full" style={{ backgroundColor: accent }} />
        {icon ? <div className="text-sentinel-muted">{icon}</div> : null}
      </div>
      <div
        className={clsx(
          'whitespace-nowrap text-4xl font-black leading-none tracking-normal text-sentinel-text',
          value.length >= 6 && 'text-2xl',
        )}
      >
        {value}
      </div>
      <p className="mt-3 text-base font-medium leading-snug text-sentinel-muted">{label}</p>
    </motion.div>
  );
}
