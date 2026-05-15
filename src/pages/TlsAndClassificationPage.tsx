import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ScanLine, Target, Trees } from 'lucide-react';
import type { PageId } from '../types';
import { tlsScan } from '../data/demoData';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { KpiCard } from '../components/ui/KpiCard';
import PalmScanShell from '../components/PalmScanShell';

type TlsAndClassificationPageProps = {
  onNavigate: (page: PageId) => void;
  onWorkflowComplete: () => void;
};

export function TlsAndClassificationPage({ onNavigate, onWorkflowComplete }: TlsAndClassificationPageProps) {
  const [treeScanDone, setTreeScanDone] = useState(false);

  // Listen for tree scan completion to unlock the next-page CTA
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ treeScanDone: boolean }>;
      if (ce.detail.treeScanDone && !treeScanDone) {
        setTreeScanDone(true);
        onWorkflowComplete();
      }
    };
    window.addEventListener('palmscan:treescan-update', handler);
    return () => window.removeEventListener('palmscan:treescan-update', handler);
  }, [onWorkflowComplete, treeScanDone]);

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
          <Badge tone="green">Targeted TLS confirmation + UM IP analysis</Badge>
          <h1 className="mt-4 text-4xl font-black tracking-normal text-sentinel-text md:text-5xl">
            Compartment Scan &amp; UM IP Classification
          </h1>
          <p className="mt-3 max-w-6xl text-lg font-medium leading-relaxed text-sentinel-muted">
            Draw or import your estate compartments, run a Drone Scan to flag infected areas, then drill into any
            compartment and run a Tree Scan to classify individual palms through the UM IP pipeline.
          </p>
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard value="9m coverage radius"      label="Per TLS scan station"        icon={<Target className="h-6 w-6" />} />
        <KpiCard value={`${tlsScan.palmsScanned}`} label="Palm profiles captured"    icon={<Trees  className="h-6 w-6" />} />
        <KpiCard value="TLS route"               label="Multi-station targeted scan" icon={<ScanLine className="h-6 w-6" />} />
      </div>

      {/* ── Interactive PalmScan map shell ─────────────────────────────── */}
      <div
        className="w-full overflow-hidden rounded-2xl border border-sentinel-border shadow-panel"
        style={{ height: 'calc(100vh - 340px)', minHeight: 560 }}
      >
        <PalmScanShell />
      </div>

      {/* ── Instruction strip ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 rounded-2xl border border-sentinel-border bg-white/80 px-5 py-4">
        <div className="flex items-center gap-4 text-sm font-semibold text-sentinel-muted flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[11px] font-black text-orange-600">1</span>
            Draw compartments or import GeoJSON
          </span>
          <span className="text-sentinel-border">→</span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[11px] font-black text-orange-600">2</span>
            Run Drone Scan to flag infected areas
          </span>
          <span className="text-sentinel-border">→</span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[11px] font-black text-orange-600">3</span>
            Enter a compartment and run Tree Scan
          </span>
        </div>
      </div>

      {/* ── Next-page CTA (unlocks after tree scan) ────────────────────── */}
      {treeScanDone && (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center"
        >
          <Button type="button" onClick={() => onNavigate('report')} icon={<ArrowRight className="h-5 w-5" />}>
            Generate Complete Audit Report
          </Button>
        </motion.div>
      )}
    </motion.section>
  );
}
