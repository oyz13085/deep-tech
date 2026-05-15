import { useState, useCallback, Suspense, lazy } from 'react';
import { DrawnField } from './PolygonEditor';

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

function getFirstScannedCompartmentId(): string | null {
  try {
    const raw = localStorage.getItem('palmscan_scan_results');
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, Record<string, string>>;
    const keys = Object.keys(data);
    return keys.length > 0 ? keys[0] : null;
  } catch { return null; }
}

const PalmScanMapView = lazy(() => import('./maps/PalmScanMapView'));

type PalmScanShellProps = {
  autoEnter?: boolean;
};

export default function PalmScanShell({ autoEnter = false }: PalmScanShellProps) {
  const [drawnFields, setDrawnFields] = useState<DrawnField[]>(() => loadFromStorage());
  const [selectedId,  setSelectedId]  = useState<string | null>(null);

  const defaultCompartmentId = autoEnter ? getFirstScannedCompartmentId() : null;

  const handleFieldsChange = useCallback((fields: DrawnField[]) => {
    setDrawnFields(fields);
    saveToStorage(fields);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="h-full w-full overflow-hidden" style={{ background: '#1a1f18' }}>
      <Suspense fallback={
        <div className="flex h-full w-full items-center justify-center">
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
          defaultCompartmentId={defaultCompartmentId}
        />
      </Suspense>
    </div>
  );
}
