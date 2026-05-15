import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppShell } from './components/layout/AppShell';
import { Toast } from './components/ui/Toast';
import { pageSteps } from './data/demoData';
import type { PageId, ToastMessage } from './types';
import { CompleteAuditReportPage } from './pages/CompleteAuditReportPage';
import { DronePreScreeningPage } from './pages/DronePreScreeningPage';
import { TlsAndClassificationPage } from './pages/TlsAndClassificationPage';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('drone');
  const [droneFlowReady, setDroneFlowReady] = useState(false);
  const [tlsWorkflowComplete, setTlsWorkflowComplete] = useState(false);
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const currentIndex = useMemo(
    () => pageSteps.findIndex((step) => step.id === currentPage),
    [currentPage],
  );

  const navigate = useCallback(
    (page: PageId) => {
      if (page === 'tls' && currentPage !== 'tls') {
        setTlsWorkflowComplete(false);
      }
      setCurrentPage(page);
    },
    [currentPage],
  );

  const next = useCallback(() => {
    setCurrentPage((page) => {
      const index = pageSteps.findIndex((step) => step.id === page);
      if (page === 'drone' && !droneFlowReady) {
        return page;
      }
      if (page === 'tls' && !tlsWorkflowComplete) {
        return page;
      }
      const nextPage = pageSteps[Math.min(index + 1, pageSteps.length - 1)].id;
      if (nextPage === 'tls') {
        setTlsWorkflowComplete(false);
      }
      return nextPage;
    });
  }, [droneFlowReady, tlsWorkflowComplete]);

  const back = useCallback(() => {
    setCurrentPage((page) => {
      const index = pageSteps.findIndex((step) => step.id === page);
      const previousPage = pageSteps[Math.max(index - 1, 0)].id;
      if (previousPage === 'tls') {
        setTlsWorkflowComplete(false);
      }
      return previousPage;
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
      if (event.key === 'ArrowRight') {
        next();
      }
      if (event.key === 'ArrowLeft') {
        back();
      }
      if (event.key === 'Escape') {
        setDisclosureOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [back, next]);

  const page = useMemo(() => {
    switch (currentPage) {
      case 'drone':
        return <DronePreScreeningPage onNavigate={navigate} onFlowReady={() => setDroneFlowReady(true)} />;
      case 'tls':
        return (
          <TlsAndClassificationPage
            onNavigate={navigate}
            onWorkflowComplete={() => setTlsWorkflowComplete(true)}
          />
        );
      case 'report':
        return <CompleteAuditReportPage showToast={showToast} />;
      default:
        return <DronePreScreeningPage onNavigate={navigate} onFlowReady={() => setDroneFlowReady(true)} />;
    }
  }, [currentPage, navigate, showToast]);

  return (
    <AppShell
      currentPage={currentPage}
      disclosureOpen={disclosureOpen}
      onOpenDisclosure={() => setDisclosureOpen(true)}
      onCloseDisclosure={() => setDisclosureOpen(false)}
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
