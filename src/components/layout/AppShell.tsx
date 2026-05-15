import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { TopBar } from './TopBar';
import type { PageId } from '../../types';
import { pageSteps } from '../../data/demoData';

type AppShellProps = {
  children: ReactNode;
  disclosureOpen: boolean;
  onOpenDisclosure: () => void;
  onCloseDisclosure: () => void;
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
};

export function AppShell({
  children,
  disclosureOpen,
  onOpenDisclosure,
  onCloseDisclosure,
  currentPage,
  onNavigate,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-transparent">
      <TopBar onOpenDisclosure={onOpenDisclosure} />
      <nav className="sticky top-20 z-30 border-b border-sentinel-border bg-white/92 backdrop-blur-xl no-print">
        <div className="mx-auto flex max-w-[1500px] gap-1 px-5 lg:px-8">
          {pageSteps.map((step, i) => {
            const active = step.id === currentPage;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onNavigate(step.id)}
                className={`relative flex items-center gap-2 px-4 py-4 text-base font-semibold transition ${
                  active
                    ? 'text-sentinel-primary'
                    : 'text-sentinel-muted hover:text-sentinel-text'
                }`}
              >
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black ${
                  active ? 'bg-sentinel-primary text-white' : 'bg-sentinel-surface text-sentinel-muted'
                }`}>{i + 1}</span>
                {step.label}
                {active && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-sentinel-primary" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
      <main className="min-w-0 px-4 py-5 md:px-6 lg:px-8">
        <div className="mx-auto max-w-[1500px] space-y-5">
          {children}
        </div>
      </main>
      <AnimatePresence>
        {disclosureOpen ? (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-sentinel-deep/35 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="disclosure-title"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-sentinel-border bg-white p-7 shadow-panel"
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 id="disclosure-title" className="text-3xl font-black tracking-normal text-sentinel-text">
                    What is real vs simulated?
                  </h2>
                  <p className="mt-2 text-lg text-sentinel-muted">
                    This separates the UM IP basis from pitch-demo mock behaviour.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCloseDisclosure}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-sentinel-border text-sentinel-muted transition hover:bg-sentinel-surface hover:text-sentinel-text"
                  aria-label="Close disclosure"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-[#2EAD5B]/25 bg-[#2EAD5B]/8 p-5">
                  <h3 className="text-xl font-black text-sentinel-deep">Real</h3>
                  <ul className="mt-4 space-y-3 text-base font-semibold leading-snug text-sentinel-text">
                    <li>UM IP PI 2023003250</li>
                    <li>TLS-based 3D canopy scanning concept</li>
                    <li>Deep-learning classification concept</li>
                    <li>Healthy / mild / moderate / severe grouping</li>
                    <li>Commercialisation direction: targeted BSR disease audit and command centre</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-sentinel-border bg-sentinel-surface p-5">
                  <h3 className="text-xl font-black text-sentinel-deep">Simulated</h3>
                  <ul className="mt-4 space-y-3 text-base font-semibold leading-snug text-sentinel-text">
                    <li>Drone scan</li>
                    <li>Estate data</li>
                    <li>Block map</li>
                    <li>Palm locations</li>
                    <li>Confidence scores</li>
                    <li>AI-assisted recommendations</li>
                    <li>Yield-at-risk values</li>
                    <li>Report export</li>
                    <li>Pilot customer scenario</li>
                  </ul>
                </div>
              </div>
              <p className="mt-6 rounded-2xl border border-sentinel-border bg-white px-5 py-4 text-base font-semibold text-sentinel-muted">
                This prototype demonstrates the commercial workflow. Field validation is required before deployment.
              </p>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
