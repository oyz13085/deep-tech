import { useState, useCallback, useEffect, Suspense, lazy } from 'react';
import { DrawnField } from './PolygonEditor';
import PalmScanPanel from './layout/PalmScanPanel';

const STORAGE_KEY = 'palmscan_drawn_fields';

function loadFromStorage(): DrawnField[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DrawnField[]) : [];
  } catch { return []; }
}

function saveToStorage(fields: DrawnField[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fields)); } catch {}
}

const PalmScanMapView = lazy(() => import('./maps/PalmScanMapView'));

export default function PalmScanShell() {
  const [drawnFields,  setDrawnFields]  = useState<DrawnField[]>(() => loadFromStorage());
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [scanComplete, setScanComplete] = useState<boolean>(() => {
    try { return localStorage.getItem('palmscan_scan_done') === 'true'; } catch { return false; }
  });
  const [scanning,         setScanning]         = useState(false);
  const [treeScanActive,   setTreeScanActive]   = useState(false);
  const [treeScanDone,     setTreeScanDone]     = useState(false);
  const [treeScanProgress, setTreeScanProgress] = useState(0);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ scanComplete: boolean; scanning: boolean }>;
      setScanComplete(ce.detail.scanComplete);
      setScanning(ce.detail.scanning);
    };
    window.addEventListener('palmscan:scan-update', handler);
    return () => window.removeEventListener('palmscan:scan-update', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ treeScanActive: boolean; treeScanDone: boolean; treeScanProgress: number }>;
      setTreeScanActive(ce.detail.treeScanActive);
      setTreeScanDone(ce.detail.treeScanDone);
      setTreeScanProgress(ce.detail.treeScanProgress);
    };
    window.addEventListener('palmscan:treescan-update', handler);
    return () => window.removeEventListener('palmscan:treescan-update', handler);
  }, []);

  const handleFieldsChange = useCallback((fields: DrawnField[]) => {
    setDrawnFields(fields);
    saveToStorage(fields);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: '#f5f3ee' }}>
      <PalmScanPanel
        fields={drawnFields}
        selectedId={selectedId}
        onSelect={handleSelect}
        scanComplete={scanComplete}
        scanning={scanning}
        treeScanActive={treeScanActive}
        treeScanDone={treeScanDone}
        treeScanProgress={treeScanProgress}
      />

      <main className="flex-1 relative overflow-hidden">
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center h-full" style={{ background: '#1a1f18' }}>
            <div className="text-center">
              <div className="w-8 h-8 rounded-full border-2 border-orange-400 border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Loading map…</p>
            </div>
          </div>
        }>
          <PalmScanMapView
            drawnFields={drawnFields}
            selectedId={selectedId}
            onSelect={handleSelect}
            onFieldsChange={handleFieldsChange}
          />
        </Suspense>
      </main>
    </div>
  );
}
