'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { DrawnField } from './PolygonEditor';
import Sidebar from './Sidebar';
import LeftPanel from './LeftPanel';

const STORAGE_KEY = 'palmscan_drawn_fields';

function loadFromStorage(): DrawnField[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DrawnField[]) : [];
  } catch { return []; }
}

function saveToStorage(fields: DrawnField[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fields)); } catch { /* ignore */ }
}

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center" style={{ background: '#1a1f18' }}>
      <div className="text-center">
        <div className="w-8 h-8 rounded-full border-2 border-orange-400 border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading map…</p>
      </div>
    </div>
  ),
});

export default function DashboardShell() {
  const [drawnFields, setDrawnFields] = useState<DrawnField[]>(() => loadFromStorage());
  const [selectedId,  setSelectedId]  = useState<string | null>(null);

  const handleFieldsChange = useCallback((fields: DrawnField[]) => {
    setDrawnFields(fields);
    saveToStorage(fields);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: '#f5f3ee' }}>
      <Sidebar />

      <LeftPanel
        fields={drawnFields}
        selectedId={selectedId}
        onSelect={handleSelect}
      />

      <main className="flex-1 relative overflow-hidden">
        <MapView
          drawnFields={drawnFields}
          selectedId={selectedId}
          onSelect={handleSelect}
          onFieldsChange={handleFieldsChange}
        />
      </main>
    </div>
  );
}
