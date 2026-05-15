import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppShell } from './components/layout/AppShell';
import { Toast } from './components/ui/Toast';
import { pageSteps } from './data/demoData';
import type { PageId, ToastMessage } from './types';
import { EstateScanPage } from './pages/EstateScanPage';
import { CompleteAuditReportPage } from './pages/CompleteAuditReportPage';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('scan');
  const [scanWorkflowComplete, setScanWorkflowComplete] = useState(false);
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const currentIndex = useMemo(
    () => pageSteps.findIndex((step) => step.id === currentPage),
    [currentPage],
  );

  const navigate = useCallback((page: PageId) => {
    setCurrentPage(page);
  }, []);

  const next = useCallback(() => {
    setCurrentPage((page) => {
      if (page === 'scan' && !scanWorkflowComplete) return page;
      const index = pageSteps.findIndex((step) => step.id === page);
      return pageSteps[Math.min(index + 1, pageSteps.length - 1)].id;
    });
  }, [scanWorkflowComplete]);

  const back = useCallback(() => {
    setCurrentPage((page) => {
      const index = pageSteps.findIndex((step) => step.id === page);
      return pageSteps[Math.max(index - 1, 0)].id;
    });
  }, []);

  const showToast = useCallback((message: string) => {
    const id = Date.now();
    setToasts((existing) => [...existing, { id, message }]);
    window.setTimeout(() => {
      setToasts((existing) => existing.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft')  back();
      if (event.key === 'Escape')     setDisclosureOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [back, next]);

  const page = useMemo(() => {
    switch (currentPage) {
      case 'scan':
        return (
          <EstateScanPage
            onNavigate={navigate}
            onWorkflowComplete={() => setScanWorkflowComplete(true)}
          />
        );
      case 'report':
        return <CompleteAuditReportPage showToast={showToast} />;
      default:
        return (
          <EstateScanPage
            onNavigate={navigate}
            onWorkflowComplete={() => setScanWorkflowComplete(true)}
          />
        );
    }
  }, [currentPage, navigate, showToast]);

  return (
    <AppShell
      disclosureOpen={disclosureOpen}
      onOpenDisclosure={() => setDisclosureOpen(true)}
      onCloseDisclosure={() => setDisclosureOpen(false)}
      currentPage={currentPage}
      onNavigate={navigate}
    >
      <AnimatePresence mode="wait">
        <motion.div key={`${currentPage}-${currentIndex}`} initial={false}>
          {page}
        </motion.div>
      </AnimatePresence>
      <Toast toasts={toasts} />
    </AppShell>
  );
}
