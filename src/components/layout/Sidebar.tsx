import { ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import type { PageId } from '../../types';
import { pageSteps } from '../../data/demoData';

type SidebarProps = {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
};

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const currentIndex = pageSteps.findIndex((step) => step.id === currentPage);

  return (
    <aside className="no-print hidden w-72 shrink-0 border-r border-sentinel-border bg-white/70 p-5 lg:block">
      <div className="mb-5 text-sm font-black uppercase tracking-[0.18em] text-sentinel-muted">
        Pitch Demo Flow
      </div>
      <nav className="space-y-2">
        {pageSteps.map((step, index) => {
          const active = step.id === currentPage;
          const complete = index < currentIndex;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onNavigate(step.id)}
              className={clsx(
                'flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-base font-bold transition',
                active && 'border-sentinel-primary bg-sentinel-primary text-white shadow-soft',
                !active && complete && 'border-sentinel-primary/20 bg-[#2D6A4F]/8 text-sentinel-deep',
                !active && !complete && 'border-transparent text-sentinel-muted hover:bg-sentinel-surface',
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={clsx(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm',
                    active && 'bg-white/20 text-white',
                    !active && complete && 'bg-sentinel-primary text-white',
                    !active && !complete && 'bg-sentinel-surface text-sentinel-muted',
                  )}
                >
                  {index + 1}
                </span>
                <span className="truncate">{step.label}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
