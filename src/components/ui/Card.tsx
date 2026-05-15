import type { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  interactive?: boolean;
};

export function Card({ children, className, interactive = false, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-sentinel-border bg-white p-6 shadow-panel',
        interactive &&
          'transition hover:-translate-y-0.5 hover:border-sentinel-primary hover:shadow-[0_22px_60px_rgba(31,122,77,0.13)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
