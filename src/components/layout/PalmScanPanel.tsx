

import { useState, useMemo, useEffect } from 'react';
import {
  Search, TreePine, Layers, PenLine,
  ScanLine, Brain, Target, FileBarChart2,
  CheckCircle2, Clock, Cpu,
} from 'lucide-react';
import { DrawnField } from '../PolygonEditor';
import StatusBadge from '../ui/StatusBadge';

interface Props {
  fields: DrawnField[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  scanComplete: boolean;
  scanning: boolean;
  treeScanActive: boolean;
  treeScanDone: boolean;
  treeScanProgress: number;
}

const DISEASE_PILL: Record<string, string> = {
  'None':          'bg-gray-100 text-gray-500',
  'Leaf Spot':     'bg-yellow-100 text-yellow-700',
  'Ganoderma':     'bg-red-100 text-red-700',
  'Bud Rot':       'bg-orange-100 text-orange-700',
  'Crown Disease': 'bg-purple-100 text-purple-700',
};

const PIPELINE_STAGES = [
  {
    icon: ScanLine,
    title: 'Targeted TLS Data',
    desc:  'Combined captures from 4 scan stations',
    // Completes when drone scan is done (scanComplete)
    doneAt: 'drone',
  },
  {
    icon: Brain,
    title: 'UM Deep-Learning IP',
    desc:  'PI 2023003250 concept',
    // Completes at 33% tree scan progress
    doneAt: 33,
  },
  {
    icon: Target,
    title: 'BSR Stage Classification',
    desc:  'Priority staging from TLS-derived canopy data',
    doneAt: 66,
  },
  {
    icon: FileBarChart2,
    title: 'Ganoderma Sentinel Report',
    desc:  'Actions, yield-at-risk, and audit output',
    doneAt: 100,
  },
] as const;

export default function LeftPanel({
  fields, selectedId, onSelect,
  scanComplete, scanning,
  treeScanActive, treeScanDone, treeScanProgress,
}: Props) {
  const [tab, setTab] = useState<'compartments' | 'pipeline'>('compartments');
  const [query, setQuery] = useState('');

  // Auto-switch to pipeline tab when any scan starts or completes
  useEffect(() => {
    if (scanning || treeScanActive || scanComplete || treeScanDone) {
      setTab('pipeline');
    }
  }, [scanning, treeScanActive, scanComplete, treeScanDone]);

  const filtered = useMemo(() =>
    fields.filter((f) =>
      f.name.toLowerCase().includes(query.toLowerCase()) ||
      f.id.toLowerCase().includes(query.toLowerCase()) ||
      f.disease.toLowerCase().includes(query.toLowerCase())
    ),
    [fields, query]
  );

  const stats = useMemo(() => ({
    total:    fields.length,
    healthy:  fields.filter((f) => f.status === 'healthy').length,
    warning:  fields.filter((f) => f.status === 'warning').length,
    moderate: fields.filter((f) => f.status === 'moderate').length,
    severe:   fields.filter((f) => f.status === 'severe').length,
  }), [fields]);

  return (
    <aside className="flex flex-col bg-white border-r border-gray-100 flex-shrink-0" style={{ width: 300 }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <TreePine className="w-4 h-4" style={{ color: '#e07c3a' }} />
          <span className="text-sm font-semibold text-gray-900">PalmScan Estate</span>
        </div>
        <p className="text-xs text-gray-400 font-mono">{stats.total} compartment{stats.total !== 1 ? 's' : ''} mapped</p>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-gray-100">
        <TabButton
          active={tab === 'compartments'}
          onClick={() => setTab('compartments')}
          label="Compartments"
          icon={<Layers className="w-3.5 h-3.5" />}
        />
        <TabButton
          active={tab === 'pipeline'}
          onClick={() => setTab('pipeline')}
          label="AI Pipeline"
          icon={<Cpu className="w-3.5 h-3.5" />}
          badge={treeScanDone ? 'done' : treeScanActive || scanning ? 'live' : undefined}
        />
      </div>

      {tab === 'compartments' ? (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-px bg-gray-100 border-b border-gray-100">
            <StatCell label="Total Blocks" value={stats.total}    color="text-gray-800" />
            <StatCell label="Healthy"      value={stats.healthy}  color="text-green-700" />
            <StatCell label="Warning"      value={stats.warning}  color="text-yellow-600" />
            <StatCell label="Moderate"     value={stats.moderate} color="text-orange-700" />
            <StatCell label="Severe"       value={stats.severe}   color="text-red-800" />
            <StatCell label="Issues"       value={stats.warning + stats.moderate + stats.severe} color="text-gray-600" />
          </div>

          {/* Search */}
          <div className="px-3 py-2.5 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search by ID, name or disease…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none w-full font-mono"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto panel-scroll">
            {fields.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
                    {filtered.length} Compartment{filtered.length !== 1 ? 's' : ''}
                  </span>
                  <Layers className="w-3.5 h-3.5 text-gray-300" />
                </div>
                <div className="px-2 pb-4 flex flex-col gap-1.5">
                  {filtered.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6">No results for &quot;{query}&quot;</p>
                  ) : (
                    filtered.map((field) => (
                      <FieldCard
                        key={field.drawId}
                        field={field}
                        selected={field.id === selectedId}
                        onClick={() => onSelect(field.id)}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <UMPipeline
          scanComplete={scanComplete}
          scanning={scanning}
          treeScanActive={treeScanActive}
          treeScanDone={treeScanDone}
          treeScanProgress={treeScanProgress}
        />
      )}
    </aside>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────

function TabButton({
  active, onClick, label, icon, badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  badge?: 'live' | 'done';
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
        active
          ? 'border-orange-400 text-orange-600'
          : 'border-transparent text-gray-400 hover:text-gray-600'
      }`}
    >
      {icon}
      {label}
      {badge === 'live' && (
        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
      )}
      {badge === 'done' && (
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      )}
    </button>
  );
}

// ── UM IP Analysis Pipeline ───────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  {
    num: '①',
    title: 'Drone Scan Estate',
    desc: 'Fly over all compartments to capture TLS canopy data',
  },
  {
    num: '②',
    title: 'Enter Infected Compartment',
    desc: 'Tap a red compartment on the map to investigate',
  },
  {
    num: '③',
    title: 'Run Tree Scan',
    desc: 'Classify individual palms and locate infection source',
  },
] as const;

function UMPipeline({
  scanComplete, scanning,
  treeScanActive, treeScanDone, treeScanProgress,
}: {
  scanComplete: boolean;
  scanning: boolean;
  treeScanActive: boolean;
  treeScanDone: boolean;
  treeScanProgress: number;
}) {
  // Which workflow step is current
  const currentStep =
    treeScanDone   ? 3 :
    treeScanActive ? 3 :
    scanComplete   ? 2 :
    scanning       ? 1 :
                     1;
  const allDone = treeScanDone;

  const stepState = (idx: number): 'done' | 'active' | 'locked' => {
    const stepNum = idx + 1;
    if (allDone) return 'done';
    if (stepNum < currentStep) return 'done';
    if (stepNum === currentStep) {
      if (stepNum === 1 && scanComplete) return 'done';
      return 'active';
    }
    return 'locked';
  };

  // Derive per-stage state for technical pipeline
  const stageState = (idx: number): 'done' | 'active' | 'queued' => {
    if (idx === 0) {
      if (scanComplete) return 'done';
      if (scanning)    return 'active';
      return 'queued';
    }
    if (!scanComplete) return 'queued';
    if (treeScanDone)  return 'done';
    if (!treeScanActive) return 'queued';
    const threshold     = idx === 1 ? 33 : idx === 2 ? 66 : 100;
    const prevThreshold = idx === 1 ? 0  : idx === 2 ? 33 : 66;
    if (treeScanProgress >= threshold)     return 'done';
    if (treeScanProgress >= prevThreshold) return 'active';
    return 'queued';
  };

  const overallStatus =
    treeScanDone   ? 'completed' :
    treeScanActive ? 'running'   :
    scanning       ? 'running'   :
    scanComplete   ? 'partial'   :
                     'queued';

  const statusLabel = { completed: 'Completed', running: 'Running', partial: 'TLS Ready', queued: 'Queued' };
  const statusColor = {
    completed: 'bg-green-100 text-green-700',
    running:   'bg-sky-100 text-sky-700',
    partial:   'bg-orange-100 text-orange-700',
    queued:    'bg-gray-100 text-gray-500',
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto panel-scroll">

        {/* ── 3-step workflow guide ───────────────────────────────────── */}
        <div className="px-4 pt-4 pb-3">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 mb-3">How it works</p>
          <div className="flex flex-col gap-0">
            {WORKFLOW_STEPS.map((step, i) => {
              const state = stepState(i);
              const isLast = i === WORKFLOW_STEPS.length - 1;
              return (
                <div key={i} className="flex gap-3">
                  {/* Left column: number bubble + connector */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      state === 'done'   ? 'bg-green-500 text-white' :
                      state === 'active' ? 'bg-orange-400 text-white shadow-[0_0_0_3px_rgba(224,124,58,0.25)]' :
                                           'bg-gray-100 text-gray-400'
                    }`}>
                      {state === 'done' ? <CheckCircle2 className="w-4 h-4" /> : step.num}
                    </div>
                    {!isLast && (
                      <div className={`w-0.5 flex-1 min-h-[20px] my-1 rounded-full ${
                        state === 'done' ? 'bg-green-200' : 'bg-gray-100'
                      }`} />
                    )}
                  </div>
                  {/* Right column: text */}
                  <div className={`pb-4 flex-1 min-w-0 ${isLast ? '' : ''}`}>
                    <p className={`text-xs font-semibold leading-tight ${
                      state === 'done'   ? 'text-green-700' :
                      state === 'active' ? 'text-gray-900'  :
                                           'text-gray-400'
                    }`}>{step.title}</p>
                    <p className={`text-[10px] mt-0.5 leading-relaxed ${
                      state === 'active' ? 'text-gray-500' : 'text-gray-400'
                    }`}>{step.desc}</p>
                    {/* Live status for active step */}
                    {state === 'active' && (
                      <div className="mt-1.5">
                        {i === 0 && scanning && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                            <span className="text-[10px] text-sky-600 font-medium">Drone scanning…</span>
                          </div>
                        )}
                        {i === 0 && !scanning && !scanComplete && (
                          <span className="text-[10px] text-orange-500 font-medium">→ Press Drone Scan on the map</span>
                        )}
                        {i === 1 && (
                          <span className="text-[10px] text-orange-500 font-medium">→ Tap a red area on the map</span>
                        )}
                        {i === 2 && treeScanActive && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                              <span className="text-[10px] text-sky-600 font-medium">Scanning palms… {treeScanProgress}%</span>
                            </div>
                            <div className="w-full h-1 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full bg-sky-400 rounded-full transition-all duration-100"
                                style={{ width: `${treeScanProgress}%` }} />
                            </div>
                          </div>
                        )}
                        {i === 2 && !treeScanActive && !treeScanDone && (
                          <span className="text-[10px] text-orange-500 font-medium">→ Press Tree Scan in compartment view</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-gray-100 mb-3" />

        {/* ── UM IP technical pipeline ────────────────────────────────── */}
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-400">UM IP Analysis Pipeline</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor[overallStatus]}`}>
              {statusLabel[overallStatus]}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {PIPELINE_STAGES.map((stage, i) => {
              const state = stageState(i);
              const Icon  = stage.icon;
              const isLast = i === PIPELINE_STAGES.length - 1;
              return (
                <div key={i} className="relative">
                  <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all ${
                    state === 'done'   ? 'bg-green-50  border border-green-100' :
                    state === 'active' ? 'bg-sky-50    border border-sky-100'   :
                                         'bg-gray-50   border border-gray-100'
                  }`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      state === 'done'   ? 'bg-green-100' :
                      state === 'active' ? 'bg-sky-100'   :
                                           'bg-gray-100'
                    }`}>
                      <Icon className={`w-3.5 h-3.5 ${
                        state === 'done'   ? 'text-green-600' :
                        state === 'active' ? 'text-sky-500'   :
                                             'text-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-semibold leading-tight truncate ${
                        state === 'done'   ? 'text-green-800' :
                        state === 'active' ? 'text-sky-700'   :
                                             'text-gray-500'
                      }`}>{stage.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{stage.desc}</p>
                      {state === 'active' && treeScanActive && i > 0 && (() => {
                        const lo  = i === 1 ? 0  : i === 2 ? 33 : 66;
                        const hi  = i === 1 ? 33 : i === 2 ? 66 : 100;
                        const pct = Math.round(((treeScanProgress - lo) / (hi - lo)) * 100);
                        return (
                          <div className="mt-1.5 w-full h-1 rounded-full bg-sky-100 overflow-hidden">
                            <div className="h-full rounded-full bg-sky-400 transition-all duration-100"
                              style={{ width: `${pct}%` }} />
                          </div>
                        );
                      })()}
                    </div>
                    {state === 'done' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    ) : state === 'active' ? (
                      <div className="w-3.5 h-3.5 flex-shrink-0 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                    ) : (
                      <Clock className="w-3 h-3 text-gray-300 flex-shrink-0" />
                    )}
                  </div>
                  {!isLast && (
                    <div className={`absolute left-6 top-full h-1.5 w-0.5 ${
                      stageState(i + 1) !== 'queued' ? 'bg-green-200' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer banner */}
        <div className="px-4 py-3">
          <div className={`rounded-xl px-3 py-2.5 ${
            treeScanDone         ? 'bg-green-50 border border-green-100' :
            treeScanActive       ? 'bg-sky-50   border border-sky-100'   :
            scanning             ? 'bg-sky-50   border border-sky-100'   :
            scanComplete         ? 'bg-orange-50 border border-orange-100' :
                                   'bg-gray-50  border border-gray-100'
          }`}>
            {treeScanDone ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-green-700">Classification completed</p>
                  <p className="text-[10px] text-green-600 mt-0.5">Ganoderma Sentinel report ready</p>
                </div>
              </div>
            ) : treeScanActive ? (
              <>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-sky-700">Running UM IP classification…</p>
                  <span className="text-[11px] font-mono text-sky-500">{treeScanProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-sky-100 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-400 rounded-full transition-all duration-100"
                    style={{ width: `${treeScanProgress}%` }} />
                </div>
              </>
            ) : scanning ? (
              <>
                <p className="text-xs font-semibold text-sky-700 mb-1.5">Acquiring targeted TLS data…</p>
                <div className="w-full h-1.5 bg-sky-100 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-400 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              </>
            ) : scanComplete ? (
              <div className="flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-orange-700">TLS data acquired</p>
                  <p className="text-[10px] text-orange-600 mt-0.5">Enter a compartment and run Tree Scan</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-600">Waiting for targeted TLS capture…</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Run Drone Scan to begin</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function StatCell({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white px-3 py-2">
      <div className={`text-base font-semibold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(224,124,58,0.1)' }}>
        <PenLine className="w-6 h-6" style={{ color: '#e07c3a' }} />
      </div>
      <p className="text-sm font-semibold text-gray-700 mb-1">No compartments yet</p>
      <p className="text-xs text-gray-400 leading-relaxed">
        Click <span className="font-medium text-gray-600">Draw Boundary</span> on the map to trace your first field compartment.
      </p>
    </div>
  );
}

function FieldCard({ field, selected, onClick }: { field: DrawnField; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl p-3 transition-all border ${
        selected
          ? 'border-orange-300 bg-orange-50 shadow-sm'
          : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-xs font-semibold text-gray-500">{field.id}</span>
            <StatusBadge status={field.status} />
          </div>
          <div className="text-sm font-medium text-gray-800 mt-0.5">{field.name}</div>
        </div>
      </div>

      {field.disease !== 'None' && (
        <div>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${DISEASE_PILL[field.disease]}`}>
            {field.disease}
          </span>
        </div>
      )}
    </button>
  );
}
