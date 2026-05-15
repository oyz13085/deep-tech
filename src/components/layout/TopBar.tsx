import { Info, Leaf, UserRound } from 'lucide-react';
import { estate } from '../../data/demoData';
import { Button } from '../ui/Button';

type TopBarProps = {
  onOpenDisclosure: () => void;
};

export function TopBar({ onOpenDisclosure }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-sentinel-border bg-white/92 backdrop-blur-xl">
      <div className="flex min-h-20 items-center justify-between gap-5 px-5 lg:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sentinel-deep text-white shadow-soft">
            <Leaf className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-2xl font-black tracking-normal text-sentinel-text">
              {estate.productName}
            </div>
            <div className="truncate text-base font-semibold text-sentinel-muted">
              {estate.name} • {estate.auditCycle} Audit Cycle
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden items-center gap-3 rounded-2xl border border-sentinel-border bg-sentinel-surface px-4 py-3 text-base font-semibold text-sentinel-text md:flex">
            <UserRound className="h-5 w-5 text-sentinel-primary" />
            <span>{estate.user} — {estate.role}</span>
          </div>
          <Button
            type="button"
            variant="secondary"
            icon={<Info className="h-5 w-5" />}
            onClick={onOpenDisclosure}
            className="no-print"
          >
            Demo Disclosure
          </Button>
        </div>
      </div>
    </header>
  );
}
