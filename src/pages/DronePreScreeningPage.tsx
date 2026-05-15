import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Scan, ShieldAlert } from 'lucide-react';
import type { PageId } from '../types';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import PalmScanShell from '../components/PalmScanShell';

type DronePreScreeningPageProps = {
  onNavigate: (page: PageId) => void;
  onFlowReady: () => void;
};

export function DronePreScreeningPage({ onNavigate, onFlowReady }: DronePreScreeningPageProps) {
  const [scanComplete, setScanComplete] = useState(() => {
    try { return localStorage.getItem('palmscan_scan_done') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ scanComplete: boolean }>;
      if (ce.detail.scanComplete && !scanComplete) {
        setScanComplete(true);
        onFlowReady();
      }
    };
    window.addEventListener('palmscan:scan-update', handler);
    return () => window.removeEventListener('palmscan:scan-update', handler);
  }, [onFlowReady, scanComplete]);

  useEffect(() => {
    if (scanComplete) onFlowReady();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="space-y-6"
    >
      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <Badge tone="green">Step 1 — Map your estate and run a Drone Scan</Badge>
          <h1 className="mt-4 text-4xl font-black tracking-normal text-sentinel-text md:text-5xl">
            Estate Mapping &amp; Drone Pre-Screening
          </h1>
          <p className="mt-3 max-w-4xl text-lg font-medium leading-relaxed text-sentinel-muted">
            Import or draw your estate compartments on the map, then run a Drone Scan to identify infected areas.
            Infected compartments are highlighted — proceed to Step 2 to classify individual palms.
          </p>
        </div>
        {scanComplete && (
          <Button type="button" onClick={() => onNavigate('tls')} icon={<ArrowRight className="h-5 w-5" />}>
            Run Targeted TLS Scan
          </Button>
        )}
      </div>

      {/* ── Interactive map ─────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-black text-sentinel-text">Estate compartment pre-screening</h2>
            <p className="mt-1 text-base font-semibold text-sentinel-muted">
              Draw compartments, run a Drone Scan, then enter any infected area to begin tree-level classification.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">Safe</Badge>
            <Badge tone="red">Infected — TLS confirmation required</Badge>
          </div>
        </div>
        <div
          className="w-full overflow-hidden rounded-xl border border-sentinel-border"
          style={{ height: 'calc(100vh - 420px)', minHeight: 520 }}
        >
          <PalmScanShell />
        </div>
      </Card>

      {/* ── Info cards ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-white">
          <ShieldAlert className="h-7 w-7 text-sentinel-primary" />
          <h3 className="mt-4 text-xl font-black text-sentinel-text">Drone Scan</h3>
          <p className="mt-2 text-base font-semibold leading-relaxed text-sentinel-muted">
            Fly over all compartments to detect canopy stress patterns. Infected compartments are flagged red for targeted TLS follow-up.
          </p>
        </Card>
        <Card className="bg-white">
          <AlertTriangle className="h-7 w-7 text-sentinel-severe" />
          <h3 className="mt-4 text-xl font-black text-sentinel-text">Investigate</h3>
          <p className="mt-2 text-base font-semibold leading-relaxed text-sentinel-muted">
            Enter any flagged compartment on the map to activate Tree Scan mode and classify individual palms by BSR stage.
          </p>
        </Card>
        <Card className="bg-white">
          <Scan className="h-7 w-7 text-sentinel-primary" />
          <h3 className="mt-4 text-xl font-black text-sentinel-text">Technical boundary</h3>
          <p className="mt-2 text-base font-semibold leading-relaxed text-sentinel-muted">
            Drone pre-screening does not classify BSR stages. TLS-derived canopy data from the targeted zone is sent to the UM IP model in Step 2.
          </p>
        </Card>
      </div>
    </motion.section>
  );
}
