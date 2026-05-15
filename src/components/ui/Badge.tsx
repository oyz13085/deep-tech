import type { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type BadgeTone = 'green' | 'yellow' | 'orange' | 'red' | 'neutral';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: BadgeTone;
};

const tones: Record<BadgeTone, string> = {
  green: 'border-[#2EAD5B]/30 bg-[#2EAD5B]/10 text-[#1c6f39]',
  yellow: 'border-[#F2C94C]/40 bg-[#F2C94C]/16 text-[#7a6000]',
  orange: 'border-[#F2994A]/40 bg-[#F2994A]/14 text-[#8d4d12]',
  red: 'border-[#EB5757]/35 bg-[#EB5757]/10 text-[#b23636]',
  neutral: 'border-sentinel-border bg-sentinel-surface text-sentinel-muted',
};

export function Badge({ children, tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold',
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
