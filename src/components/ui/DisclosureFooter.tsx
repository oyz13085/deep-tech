import clsx from 'clsx';
import { decisionSupportFooterText, requiredFooterText } from '../../data/demoData';

type DisclosureFooterProps = {
  decisionSupport?: boolean;
  className?: string;
};

export function DisclosureFooter({ decisionSupport = false, className }: DisclosureFooterProps) {
  return (
    <footer
      className={clsx(
        'mt-6 rounded-2xl border border-sentinel-border bg-white/75 px-5 py-4 text-base font-semibold text-sentinel-muted shadow-sm',
        className,
      )}
    >
      <div>{requiredFooterText}</div>
      {decisionSupport ? <div className="mt-1 text-sentinel-primary">{decisionSupportFooterText}</div> : null}
    </footer>
  );
}
