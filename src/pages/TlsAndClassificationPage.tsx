import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileBarChart,
  ScanLine,
  Send,
  Target,
  Trees,
} from 'lucide-react';
import type { PageId } from '../types';
import { stages, tlsScan } from '../data/demoData';
import { ClassificationInfographic } from '../components/analysis/ClassificationInfographic';
import { StationTlsScanMap } from '../components/maps/StationTlsScanMap';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { KpiCard } from '../components/ui/KpiCard';

type TlsAndClassificationPageProps = {
  onNavigate: (page: PageId) => void;
  onWorkflowComplete: () => void;
};

type WorkflowPhase = 'scanning' | 'scanComplete' | 'sendingToModel' | 'analysing' | 'classificationReady';

const scanStatuses = [
  'Generating TLS scan route...',
  'Positioning scanner at Station 1...',
  'Capturing nearby palms within 9m radius...',
  'Moving scanner to next station...',
  'Positioning scanner at Station 2...',
  'Capturing nearby palms within 9m radius...',
  'Moving scanner to next station...',
  'Positioning scanner at Station 3...',
  'Capturing nearby palms within 9m radius...',
  'Moving scanner to next station...',
  'Positioning scanner at Station 4...',
  'Capturing nearby palms within 9m radius...',
  'Building combined TLS point-cloud profiles...',
  '204 palm profiles captured from targeted GPS zone + buffer.',
  'Sending TLS-derived canopy data to UM IP model...',
  'Running UM IP classification...',
];

const modelStatuses = [
  'Receiving TLS-derived canopy data...',
  'Extracting canopy structure patterns...',
  'Running UM deep-learning classification...',
  'Grouping BSR priority stages...',
  'Classification completed',
];

const pipelineCards = [
  {
    title: 'Targeted TLS Data',
    subtitle: 'Combined captures from 4 scan stations',
    icon: <ScanLine className="h-8 w-8" />,
  },
  {
    title: 'UM Deep-Learning IP',
    subtitle: 'PI 2023003250 concept',
    icon: <BrainCircuit className="h-8 w-8" />,
  },
  {
    title: 'BSR Stage Classification',
    subtitle: 'Priority staging from TLS-derived canopy data',
    icon: <Target className="h-8 w-8" />,
  },
  {
    title: 'Dr. Palm Report',
    subtitle: 'Actions, yield-at-risk, and audit output',
    icon: <FileBarChart className="h-8 w-8" />,
  },
];

export function TlsAndClassificationPage({ onNavigate, onWorkflowComplete }: TlsAndClassificationPageProps) {
  const [phase, setPhase] = useState<WorkflowPhase>('scanning');
  const [scanStatusIndex, setScanStatusIndex] = useState(0);
  const [modelStatusIndex, setModelStatusIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [visibleStageCount, setVisibleStageCount] = useState(0);
  const [ctaVisible, setCtaVisible] = useState(false);

  useEffect(() => {
    const progressTimer = window.setInterval(() => {
      setProgress((value) => Math.min(value + 1.3, 100));
    }, 120);

    const timers = [
      ...scanStatuses.map((_, index) =>
        window.setTimeout(() => {
          setScanStatusIndex(index);
        }, index * 900),
      ),
      window.setTimeout(() => setPhase('scanComplete'), 12000),
      window.setTimeout(() => setPhase('sendingToModel'), 12900),
      window.setTimeout(() => setPhase('analysing'), 13800),
      ...modelStatuses.map((_, index) =>
        window.setTimeout(() => {
          setModelStatusIndex(index);
        }, 13800 + index * 1100),
      ),
      window.setTimeout(() => setPhase('classificationReady'), 19200),
      ...stages.map((_, index) =>
        window.setTimeout(() => {
          setVisibleStageCount(index + 1);
        }, 19600 + index * 320),
      ),
      window.setTimeout(() => {
        setCtaVisible(true);
        onWorkflowComplete();
      }, 21150),
    ];

    return () => {
      window.clearInterval(progressTimer);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [onWorkflowComplete]);

  const scanningActive = phase === 'scanning' || phase === 'scanComplete' || phase === 'sendingToModel';
  const analysingActive = phase === 'analysing';
  const resultsReady = phase === 'classificationReady';
  const activePipelineIndex = useMemo(() => {
    if (phase === 'scanning' || phase === 'scanComplete') return 0;
    if (phase === 'sendingToModel') return 1;
    if (phase === 'analysing' && modelStatusIndex < 3) return 1;
    if (phase === 'analysing') return 2;
    return 3;
  }, [modelStatusIndex, phase]);

  const activeStationIndex = getActiveStationIndex(scanStatusIndex, phase);
  const capturedStations = getCapturedStationCount(scanStatusIndex, phase);
  const capturedProfiles = getCapturedProfiles(scanStatusIndex, phase);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="space-y-6"
    >
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <Badge tone="green">Targeted TLS confirmation + UM IP analysis</Badge>
          <h1 className="mt-4 text-4xl font-black tracking-normal text-sentinel-text md:text-5xl">
            Targeted TLS Scan & UM IP Classification — Block 7
          </h1>
          <p className="mt-3 max-w-6xl text-lg font-medium leading-relaxed text-sentinel-muted">
            TLS is moved between scan stations in the flagged GPS zone + 2-row buffer. Each station captures nearby
            palm trees within a 9m coverage radius before the combined TLS-derived data is sent to the UM IP model.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard value="9m coverage radius" label="Per TLS scan station" icon={<Target className="h-6 w-6" />} />
        <KpiCard value={`${tlsScan.palmsScanned}`} label="Palm profiles captured" icon={<Trees className="h-6 w-6" />} />
        <KpiCard value="TLS route" label="Multi-station targeted scan" icon={<ScanLine className="h-6 w-6" />} />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.15fr)_minmax(28rem,0.85fr)]">
        <Card className="p-5">
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-black text-sentinel-text">{tlsScan.block}</h2>
              <p className="mt-1 text-base font-semibold text-sentinel-muted">
                Scan scope: {tlsScan.scope}. Combined TLS captures are limited to the targeted zone + buffer for demo
                visualisation.
              </p>
            </div>
            <Badge tone={resultsReady ? 'green' : 'yellow'}>{resultsReady ? 'Classified' : tlsScan.scanType}</Badge>
          </div>

          <div className="relative">
            <StationTlsScanMap
              activeStationIndex={activeStationIndex}
              capturedStations={capturedStations}
              scanning={scanningActive && !resultsReady}
              classified={resultsReady}
            />
          </div>

          <WorkflowStatus
            icon={<ScanLine className="h-6 w-6 text-sentinel-primary" />}
            title={scanStatuses[scanStatusIndex]}
            subtitle={
              resultsReady
                ? 'TLS-derived canopy data classified'
                : `${capturedProfiles} / ${tlsScan.palmsScanned} captured palm profiles`
            }
            progress={progress}
            complete={phase !== 'scanning'}
          />
        </Card>

        <Card className="p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-sentinel-text">UM IP analysis pipeline</h2>
              <p className="mt-1 text-base font-semibold text-sentinel-muted">
                TLS-derived canopy data moves through staged AI-assisted classification.
              </p>
            </div>
            <Badge tone={resultsReady ? 'green' : analysingActive ? 'yellow' : 'neutral'}>
              {resultsReady ? 'Completed' : analysingActive ? 'Analysing' : 'Queued'}
            </Badge>
          </div>

          <div className="relative grid gap-3">
            {pipelineCards.map((card, index) => (
              <PipelineStep
                key={card.title}
                {...card}
                active={index === activePipelineIndex}
                complete={index < activePipelineIndex || resultsReady}
                index={index}
              />
            ))}
            {!resultsReady ? <PipelinePackets active={phase === 'sendingToModel' || analysingActive} /> : null}
          </div>

          <div className="mt-5 rounded-2xl border border-sentinel-border bg-sentinel-surface px-5 py-4">
            <motion.div
              key={`${phase}-${modelStatusIndex}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-black text-sentinel-text"
            >
              {phase === 'scanning' || phase === 'scanComplete'
                ? 'Waiting for targeted TLS capture...'
                : phase === 'sendingToModel'
                  ? 'Sending TLS-derived canopy data to UM IP model...'
                  : modelStatuses[modelStatusIndex]}
            </motion.div>
            {analysingActive ? <NeuralPulse /> : null}
          </div>
        </Card>
      </div>

      {visibleStageCount > 0 ? (
        <ClassificationInfographic stages={stages} visibleStageCount={visibleStageCount} />
      ) : null}

      {ctaVisible ? (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center"
        >
          <Button type="button" onClick={() => onNavigate('report')} icon={<ArrowRight className="h-5 w-5" />}>
            Generate Complete Audit Report
          </Button>
        </motion.div>
      ) : null}
    </motion.section>
  );
}

function WorkflowStatus({
  icon,
  title,
  subtitle,
  progress,
  complete,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  progress: number;
  complete: boolean;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-sentinel-border bg-white/94 p-5 shadow-panel">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl font-black text-sentinel-text"
          >
            {title}
          </motion.div>
          <div className="text-base font-semibold text-sentinel-muted">{subtitle}</div>
        </div>
      </div>
      <div className="mt-4 h-4 overflow-hidden rounded-full bg-sentinel-surface">
        <motion.div
          className="h-full rounded-full bg-sentinel-primary"
          initial={{ width: '0%' }}
          animate={{ width: `${complete ? 100 : progress}%` }}
          transition={{ duration: 0.25 }}
        />
      </div>
    </div>
  );
}

function PipelineStep({
  title,
  subtitle,
  icon,
  active,
  complete,
  index,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  active: boolean;
  complete: boolean;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`relative rounded-2xl border p-5 shadow-soft transition ${
        active || complete
          ? 'border-sentinel-primary/35 bg-[#1F7A4D]/8'
          : 'border-sentinel-border bg-white'
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
      {complete ? <CheckCircle2 className="absolute right-5 top-5 h-6 w-6 text-sentinel-primary" /> : null}
    </motion.div>
  );
}

function PipelinePackets({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-full">
      {[0, 1, 2].map((item) => (
        <motion.div
          key={item}
          className="absolute right-8 h-3 w-3 rounded-full bg-sentinel-primary shadow-[0_0_18px_rgba(31,122,77,0.55)]"
          style={{ top: `${18 + item * 27}%` }}
          animate={{ x: [0, -260, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 1.65, repeat: Infinity, delay: item * 0.28 }}
        />
      ))}
    </div>
  );
}

function NeuralPulse() {
  const nodes = Array.from({ length: 6 }, (_, index) => index);

  return (
    <div className="mt-4 flex items-center gap-2">
      {nodes.map((node) => (
        <motion.span
          key={node}
          className="h-2.5 w-2.5 rounded-full bg-sentinel-primary"
          animate={{ y: [0, -7, 0], opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: node * 0.08 }}
        />
      ))}
    </div>
  );
}

function getActiveStationIndex(statusIndex: number, phase: WorkflowPhase) {
  if (phase !== 'scanning') return null;
  if (statusIndex >= 1 && statusIndex <= 2) return 0;
  if (statusIndex === 3) return 1;
  if (statusIndex >= 4 && statusIndex <= 5) return 1;
  if (statusIndex === 6) return 2;
  if (statusIndex >= 7 && statusIndex <= 8) return 2;
  if (statusIndex === 9) return 3;
  if (statusIndex >= 10 && statusIndex <= 11) return 3;
  return null;
}

function getCapturedStationCount(statusIndex: number, phase: WorkflowPhase) {
  if (phase !== 'scanning') return 4;
  if (statusIndex >= 12) return 4;
  if (statusIndex >= 9) return 3;
  if (statusIndex >= 6) return 2;
  if (statusIndex >= 3) return 1;
  return 0;
}

function getCapturedProfiles(statusIndex: number, phase: WorkflowPhase) {
  if (phase !== 'scanning') return 204;
  if (statusIndex >= 13) return 204;
  if (statusIndex >= 12) return 188;
  if (statusIndex >= 9) return 154;
  if (statusIndex >= 6) return 102;
  if (statusIndex >= 3) return 52;
  return 0;
}
