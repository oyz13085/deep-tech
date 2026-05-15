import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-sentinel-primary text-white shadow-soft hover:bg-[#17633e]',
  secondary:
    'border border-sentinel-border bg-white text-sentinel-text shadow-sm hover:border-sentinel-primary hover:text-sentinel-primary',
  ghost: 'text-sentinel-muted hover:bg-sentinel-surface hover:text-sentinel-text',
  danger: 'bg-sentinel-severe text-white shadow-soft hover:bg-[#d84545]',
};

export function Button({
  className,
  children,
  variant = 'primary',
  icon,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-base font-semibold transition duration-200 focus:outline-none focus:ring-4 focus:ring-sentinel-primary/20 enabled:hover:-translate-y-0.5 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
