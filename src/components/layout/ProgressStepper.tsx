import clsx from 'clsx';
import type { PageId } from '../../types';
import { pageSteps, progressLabels } from '../../data/demoData';

type ProgressStepperProps = {
  currentPage: PageId;
};

export function ProgressStepper({ currentPage }: ProgressStepperProps) {
  const currentIndex = pageSteps.findIndex((step) => step.id === currentPage);

  return (
    <section className="no-print rounded-2xl border border-sentinel-border bg-white p-4 shadow-soft">
      <div className="grid gap-2 md:grid-cols-3">
        {progressLabels.map((label, index) => {
          const active = index === currentIndex;
          const complete = index < currentIndex;
          return (
            <div
              key={label}
              className={clsx(
                'flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-2 transition',
                active && 'border-sentinel-primary bg-[#2D6A4F]/10',
                complete && !active && 'border-[#2EAD5B]/20 bg-[#2EAD5B]/8',
                !complete && !active && 'border-sentinel-border bg-sentinel-surface/70',
              )}
            >
              <span
                className={clsx(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black',
                  active && 'bg-sentinel-primary text-white',
                  complete && !active && 'bg-[#2EAD5B] text-white',
                  !complete && !active && 'bg-white text-sentinel-muted',
                )}
              >
                {index + 1}
              </span>
              <span className="text-sm font-bold leading-tight text-sentinel-text">{label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
