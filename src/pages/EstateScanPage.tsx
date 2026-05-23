import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileBarChart,
  Scan,
  ScanLine,
  ShieldAlert,
  Target,
} from 'lucide-react';
import type { PageId } from '../types';
import { stages } from '../data/demoData';
import { allBlockDrillData } from '../data/blockTreeData';
import { ClassificationInfographic } from '../components/analysis/ClassificationInfographic';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import PalmScanShell from '../components/PalmScanShell';

function readLiveCounts(): { healthy: number; mild: number; moderate: number; severe: number } | null {
  try {
    const raw = localStorage.getItem('palmscan_scan_results');
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, Record<string, string>>;
    const counts = { healthy: 0, mild: 0, moderate: 0, severe: 0 };
    Object.values(all).forEach((compartment) => {
      Object.values(compartment).forEach((status) => {
        if (status in counts) counts[status as keyof typeof counts]++;
      });
    });
    const total = counts.healthy + counts.mild + counts.moderate + counts.severe;
    return total > 0 ? counts : null;
  } catch { return null; }
}

type EstateScanPageProps = {
  onNavigate: (page: PageId) => void;
  onWorkflowComplete: () => void;
};

type PipelinePhase = 'idle' | 'tls' | 'model' | 'classify' | 'report' | 'done';

const pipelineCards = [
  { title: 'Targeted TLS Data',        subtitle: 'Combined captures from 4 scan stations',        icon: <ScanLine     className="h-8 w-8" /> },
  { title: 'UM Deep-Learning IP',      subtitle: 'PI 2023003250 concept',                         icon: <BrainCircuit className="h-8 w-8" /> },
  { title: 'BSR Stage Classification', subtitle: 'Priority staging from TLS-derived canopy data', icon: <Target       className="h-8 w-8" /> },
  { title: 'Dr. Palm Report',          subtitle: 'Actions, yield-at-risk, and audit output',      icon: <FileBarChart className="h-8 w-8" /> },
];

const modelStatuses: Record<PipelinePhase, string> = {
  idle:     'Run a Drone Scan to begin the pipeline...',
  tls:      'TLS data captured — sending to UM IP model...',
  model:    'Running UM deep-learning classification...',
  classify: 'Grouping BSR priority stages...',
  report:   'Generating Dr. Palm report...',
  done:     'Classification completed',
};

export function EstateScanPage({ onNavigate, onWorkflowComplete }: EstateScanPageProps) {
  const [scanComplete, setScanComplete] = useState(() => {
    try { return localStorage.getItem('palmscan_scan_done') === 'true'; } catch { return false; }
  });
  const [fullTlsDone, setFullTlsDone] = useState(() => {
    try { return localStorage.getItem('palmscan_fulltls_done') === 'true'; } catch { return false; }
  });
  const [treeScanDone, setTreeScanDone] = useState(() => {
    try {
      const raw = localStorage.getItem('palmscan_scan_results');
      if (!raw) return false;
      const data = JSON.parse(raw) as Record<string, Record<string, string>>;
      return Object.values(data).some((c) => Object.keys(c).length > 0);
    } catch { return false; }
  });
  const [treeScanActive,   setTreeScanActive]   = useState(false);
  const [treeScanProgress, setTreeScanProgress] = useState(0);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ scanComplete: boolean }>;
      setScanComplete(ce.detail.scanComplete);
    };
    window.addEventListener('palmscan:scan-update', handler);
    return () => window.removeEventListener('palmscan:scan-update', handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      setFullTlsDone(true);
      try { localStorage.setItem('palmscan_fulltls_done', 'true'); } catch {}
    };
    window.addEventListener('palmscan:fullscan-complete', handler);
    return () => window.removeEventListener('palmscan:fullscan-complete', handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      setFullTlsDone(false);
      setScanComplete(false);
      setTreeScanDone(false);
      setTreeScanActive(false);
      setTreeScanProgress(0);
      setPipelinePhase('idle');
      setLiveStages(stages.slice()); // reset to default demo stage counts
    };
    window.addEventListener('palmscan:reset', handler);
    return () => window.removeEventListener('palmscan:reset', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ treeScanActive: boolean; treeScanDone: boolean; treeScanProgress: number }>;
      setTreeScanActive(ce.detail.treeScanActive);
      setTreeScanDone(ce.detail.treeScanDone);
      setTreeScanProgress(ce.detail.treeScanProgress);
      if (ce.detail.treeScanDone) onWorkflowComplete();
    };
    window.addEventListener('palmscan:treescan-update', handler);
    return () => window.removeEventListener('palmscan:treescan-update', handler);
  }, [onWorkflowComplete]);

  // Pipeline + infographic driven by the per-block TLS drill scan
  const [pipelinePhase, setPipelinePhase] = useState<PipelinePhase>('idle');

  useEffect(() => {
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ blockId: number | null; phase: string }>;
      const { phase } = ce.detail;
      if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }

      if (phase === 'scanning') {
        setTreeScanActive(true);
        setTreeScanProgress(100);
        setPipelinePhase('tls');
        pendingTimer = setTimeout(() => setPipelinePhase('model'), 700);
      } else if (phase === 'animating') {
        setTreeScanActive(true);
        setTreeScanProgress(100);
        setPipelinePhase('classify');
        pendingTimer = setTimeout(() => setPipelinePhase('report'), 800);
      } else if (phase === 'done') {
        setTreeScanActive(false);
        setTreeScanDone(true);
        setTreeScanProgress(100);
        setPipelinePhase('done');
        onWorkflowComplete();
      }
    };

    window.addEventListener('palmscan:block-drill-update', handler);
    return () => {
      window.removeEventListener('palmscan:block-drill-update', handler);
      if (pendingTimer) clearTimeout(pendingTimer);
    };
  }, [onWorkflowComplete]);

  const phase = pipelinePhase;

  const activePipelineIndex = useMemo(() => {
    if (phase === 'idle' || phase === 'tls') return 0;
    if (phase === 'model')    return 1;
    if (phase === 'classify') return 2;
    if (phase === 'report')   return 3;
    return 4;
  }, [phase]);

  const visibleStageCount = useMemo(() => {
    if (!treeScanDone && !treeScanActive) return 0;
    if (treeScanDone) return stages.length;
    return Math.floor((treeScanProgress / 100) * stages.length);
  }, [treeScanActive, treeScanDone, treeScanProgress]);

  const buildLiveStages = useCallback(() => {
    // Prefer live tree-scan counts from localStorage
    const live = readLiveCounts();
    if (live) {
      const countMap: Record<string, number> = {
        stage0: live.healthy, stage1: live.mild, stage2: live.moderate, stage34: live.severe,
      };
      return stages.map((s) => ({ ...s, palms: countMap[s.key] ?? s.palms }));
    }
    // Fall back to Block 7 data (only block being scanned)
    const b7 = allBlockDrillData[7].stats;
    const countMap: Record<string, number> = {
      stage0: b7.healthy, stage1: b7.mild, stage2: b7.moderate, stage34: b7.severe,
    };
    return stages.map((s) => ({ ...s, palms: countMap[s.key] ?? s.palms }));
  }, []);

  const [liveStages, setLiveStages] = useState(buildLiveStages);
  useEffect(() => {
    if (treeScanDone) setLiveStages(buildLiveStages());
  }, [treeScanDone, buildLiveStages]);

  const analysingActive = phase === 'model' || phase === 'classify';
  const packetsActive   = phase === 'tls' || analysingActive;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="space-y-6"
    >
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div>
        <Badge tone="green">Map compartments → Drone Scan → Tree Scan → Classify</Badge>
        <h1 className="mt-4 text-4xl font-black tracking-normal text-sentinel-text md:text-5xl">
          Estate Scan &amp; UM IP Classification
        </h1>
        <p className="mt-3 max-w-5xl text-lg font-medium leading-relaxed text-sentinel-muted">
          Draw or import your estate compartments, run a Drone Scan to flag infected areas, then enter any infected
          compartment and run a Tree Scan to classify individual palms through the UM IP pipeline.
        </p>
      </div>

      {/* ── Map + UM IP pipeline ────────────────────────────────────────── */}
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.15fr)_minmax(28rem,0.85fr)]">

        {/* Interactive map */}
        <div
          className="w-full overflow-hidden rounded-2xl border border-sentinel-border shadow-panel"
          style={{ height: 'calc(100vh - 300px)', minHeight: 560 }}
        >
          <PalmScanShell />
        </div>

        {/* UM IP pipeline panel */}
        <div className="rounded-2xl border border-sentinel-border bg-white p-5 shadow-panel">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-sentinel-text">UM IP analysis pipeline</h2>
              <p className="mt-1 text-base font-semibold text-sentinel-muted">
                TLS-derived canopy data moves through staged AI-assisted classification.
              </p>
            </div>
            <Badge tone={phase === 'done' ? 'green' : analysingActive ? 'yellow' : 'neutral'}>
              {phase === 'done' ? 'Completed' : analysingActive ? 'Analysing' : 'Queued'}
            </Badge>
          </div>

          <div className="relative grid gap-3">
            {pipelineCards.map((card, index) => (
              <PipelineStep
                key={card.title}
                {...card}
                active={index === activePipelineIndex}
                complete={index < activePipelineIndex || phase === 'done'}
                index={index}
              />
            ))}
            {packetsActive && <PipelinePackets />}
          </div>

          <div className="mt-5 rounded-2xl border border-sentinel-border bg-sentinel-surface px-5 py-4">
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-black text-sentinel-text"
            >
              {modelStatuses[phase]}
            </motion.div>
            {analysingActive && <NeuralPulse />}
          </div>
        </div>

      </div>

      {/* ── Classification infographic — full width, below map + pipeline ─ */}
      {visibleStageCount > 0 && (
        <ClassificationInfographic
          stages={liveStages}
          visibleStageCount={visibleStageCount}
        />
      )}

      {/* ── Context cards ───────────────────────────────────────────────── */}
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
            Drone pre-screening does not classify BSR stages. TLS-derived canopy data from the targeted zone is sent to the UM IP model for tree-level classification.
          </p>
        </Card>
      </div>

      {/* ── CTA (unlocks after tree scan) ───────────────────────────────── */}
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

function PipelineStep({ title, subtitle, icon, active, complete, index }: {
  title: string; subtitle: string; icon: ReactNode;
  active: boolean; complete: boolean; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`relative rounded-2xl border p-5 shadow-soft transition ${
        active || complete ? 'border-sentinel-primary/35 bg-[#2D6A4F]/8' : 'border-sentinel-border bg-white'
      }`}
    >
      <div className="flex items-start gap-4">
        <motion.div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-sentinel-primary shadow-soft"
          animate={active ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={{ duration: 1.1, repeat: active ? Infinity : 0 }}
        >
          {icon}
        </motion.div>
        <div>
          <h3 className="text-xl font-black leading-tight text-sentinel-text">{title}</h3>
          <p className="mt-1 text-base font-semibold leading-snug text-sentinel-muted">{subtitle}</p>
        </div>
      </div>
      {complete && <CheckCircle2 className="absolute right-5 top-5 h-6 w-6 text-sentinel-primary" />}
    </motion.div>
  );
}

function PipelinePackets() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-full">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute right-8 h-3 w-3 rounded-full bg-sentinel-primary shadow-[0_0_18px_rgba(31,122,77,0.55)]"
          style={{ top: `${18 + i * 27}%` }}
          animate={{ x: [0, -260, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 1.65, repeat: Infinity, delay: i * 0.28 }}
        />
      ))}
    </div>
  );
}

function NeuralPulse() {
  return (
    <div className="mt-4 flex items-center gap-2">
      {Array.from({ length: 6 }, (_, i) => (
        <motion.span
          key={i}
          className="h-2.5 w-2.5 rounded-full bg-sentinel-primary"
          animate={{ y: [0, -7, 0], opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.08 }}
        />
      ))}
    </div>
  );
}
