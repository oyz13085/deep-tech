import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarPlus, CheckCircle2, ChevronDown, Clock3, Download, FileDown, Printer, Send } from 'lucide-react';
import { estate } from '../data/demoData';
import { allBlockDrillData } from '../data/blockTreeData';
import PalmScanShell from '../components/PalmScanShell';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

type CompleteAuditReportPageProps = {
  showToast: (message: string) => void;
};

type PalmStatus = 'healthy' | 'mild' | 'moderate' | 'severe';

type TreeRecord = {
  blockId: number;
  blockName: string;
  treeNum: number;
  row: number;
  position: number;
  lat: number;
  lng: number;
  status: 'severe' | 'moderate' | 'mild';
};

const ROW_THRESHOLD = 0.00015;

function buildFieldReport(): { blockName: string; trees: TreeRecord[] }[] {
  const result: { blockName: string; trees: TreeRecord[] }[] = [];

  // Audit report is scoped to Block 7 only
  Object.entries(allBlockDrillData).filter(([idStr]) => Number(idStr) === 7).forEach(([idStr, data]) => {
    const blockId = Number(idStr);
    const atRiskTrees = data.trees.features.filter(
      (f) => f.properties.status === 'severe' || f.properties.status === 'moderate' || f.properties.status === 'mild',
    );
    if (atRiskTrees.length === 0) return;

    const sorted = [...atRiskTrees].sort((a, b) => {
      const dy = b.geometry.coordinates[1] - a.geometry.coordinates[1];
      if (Math.abs(dy) > 1e-9) return dy;
      return a.geometry.coordinates[0] - b.geometry.coordinates[0];
    });

    let currentRow = 0;
    let lastLat: number | null = null;
    let posInRow = 0;
    let treeNum = 0;

    const records: TreeRecord[] = sorted.map((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      if (lastLat === null || Math.abs(lat - lastLat) > ROW_THRESHOLD) {
        currentRow++;
        posInRow = 0;
        lastLat = lat;
      }
      posInRow++;
      treeNum++;
      return {
        blockId,
        blockName: data.blockName,
        treeNum,
        row: currentRow,
        position: posInRow,
        lat,
        lng,
        status: feature.properties.status as 'severe' | 'moderate' | 'mild',
      };
    });

    result.push({ blockName: data.blockName, trees: records });
  });

  result.sort((a, b) => a.blockName.localeCompare(b.blockName, undefined, { numeric: true }));
  return result;
}

function downloadFieldReportCSV(report: { blockName: string; trees: TreeRecord[] }[]): void {
  const header = 'Block,Tree #,Row,Position,Latitude,Longitude,Status,Action';
  const lines = [header];
  report.forEach(({ blockName, trees }) => {
    trees.forEach(({ treeNum, row, position, lat, lng, status }) => {
      const stageLabel = status === 'severe' ? 'Stage 3-4' : status === 'moderate' ? 'Stage 2' : 'Stage 1';
      const action = status === 'severe' ? 'Fell and replant' : status === 'moderate' ? 'Apply treatment' : 'Monitor / Rescan in 30 days';
      lines.push(`${blockName},${treeNum},${row},${position},${lat.toFixed(6)},${lng.toFixed(6)},${stageLabel},${action}`);
    });
  });
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'severe_trees_field_report.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


const YIELD_PER_RISK_PALM = 4375;

const formatCurrency = (value: number) => `RM${value.toLocaleString('en-MY')}`;

export function CompleteAuditReportPage({ showToast }: CompleteAuditReportPageProps) {
  const scanCounts = useMemo(() => allBlockDrillData[7].stats, []);

  const yieldAtRisk = useMemo(
    () => (scanCounts.severe + scanCounts.moderate) * YIELD_PER_RISK_PALM,
    [scanCounts],
  );

  const treatCount = scanCounts.mild + scanCounts.moderate;

  const actionTimeline = useMemo(() => [
    {
      window: 'Do first - within 48 hours',
      heading: `${scanCounts.severe} urgent palm${scanCounts.severe !== 1 ? 's' : ''}`,
      stageLabel: 'Stage 3–4 Severe/Critical',
      color: '#C0392B',
      action: 'Fell and replant',
      detail: 'Confirm with agronomist before felling.',
    },
    {
      window: 'Do next - within 7 to 30 days',
      heading: `${treatCount} palm${treatCount !== 1 ? 's' : ''} need treatment and follow-up`,
      stageLabel: 'Stage 1 Mild + Stage 2 Moderate',
      color: '#C96B1A',
      action: 'Apply hexaconazole treatment',
      detail: 'Apply hexaconazole treatment according to estate SOP and agronomist guidance.',
    },
  ], [scanCounts, treatCount]);

  const stageItems = useMemo(() => [
    {
      key: 'stage34',
      label: 'Urgent palms',
      sublabel: 'Stage 3–4 Severe/Critical',
      count: scanCounts.severe,
      color: '#C0392B',
      action: 'Action within 48 hours',
      note: 'AI-assisted. Confirm before felling.',
    },
    {
      key: 'stage2',
      label: 'Treatment palms',
      sublabel: 'Stage 2 Moderate',
      count: scanCounts.moderate,
      color: '#C96B1A',
      action: 'Treat within 7 days',
      note: null,
    },
    {
      key: 'stage1',
      label: 'Monitoring palms',
      sublabel: 'Stage 1 Mild',
      count: scanCounts.mild,
      color: '#F2C94C',
      action: 'Rescan in 30 days',
      note: null,
    },
    {
      key: 'stage0',
      label: 'Low-priority palms',
      sublabel: 'Stage 0 Healthy',
      count: scanCounts.healthy,
      color: '#2EAD5B',
      action: 'Continue normal monitoring',
      note: null,
    },
  ], [scanCounts]);

  const auditVisitCost = estate.auditVisitCost;
  const yieldAtRiskPercentage = Math.round((yieldAtRisk / estate.estimatedAnnualRevenueBaseline) * 100);
  const costToValueSignal = yieldAtRisk / auditVisitCost;

  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set());

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exportReport = () => {
    showToast('Report generated successfully.');
    window.setTimeout(() => window.print(), 250);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="space-y-6"
    >
      <section className="overflow-hidden rounded-[1.75rem] border border-sentinel-border bg-white shadow-panel">
        <div className="grid gap-6 bg-[linear-gradient(135deg,#ffffff_0%,#f6f8f5_54%,rgba(31,122,77,0.10)_100%)] p-6 xl:grid-cols-[minmax(0,1fr)_19rem] xl:p-7">
          <div>
            <Badge tone="green">Dr. Palm report</Badge>
            <h1 className="mt-4 text-4xl font-black tracking-normal text-sentinel-text md:text-5xl">
              BSR Disease Audit Report - Block 7
            </h1>
            <p className="mt-3 max-w-5xl text-lg font-medium leading-relaxed text-sentinel-muted">
              Drone scan found a risky area. TLS checked the zone. Dr. Palm shows where to act first.
            </p>
          </div>

          <div className="no-print rounded-2xl border border-sentinel-border bg-white/92 p-4 shadow-soft">
            <div className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-sentinel-muted">Actions</div>
            <div className="grid gap-2">
              <Button type="button" className="w-full" onClick={exportReport} icon={<FileDown className="h-5 w-5" />}>
                Export Report
              </Button>
              <Button
                type="button"
                className="w-full"
                variant="secondary"
                onClick={() => showToast('Report shared with Agronomy Team.')}
                icon={<Send className="h-5 w-5" />}
              >
                Send to Agronomy Team
              </Button>
              <Button
                type="button"
                className="w-full"
                variant="secondary"
                onClick={() => showToast('Next scan recommendation added.')}
                icon={<CalendarPlus className="h-5 w-5" />}
              >
                Schedule Next Scan
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-sentinel-border md:grid-cols-5">
          <MetricTile value={formatCurrency(yieldAtRisk)} label="Potential crop value at risk" tone="red" />
          <MetricTile value={`${yieldAtRiskPercentage}%`} label="Of estimated yearly revenue" tone="orange" />
          <MetricTile value={formatCurrency(auditVisitCost)} label="Cost to check this cluster" tone="green" />
          <MetricTile value={`RM${Math.round(costToValueSignal)}`} label="At-risk value found per RM1 spent" tone="green" />
          <MetricTile value={`${scanCounts.severe} palm${scanCounts.severe !== 1 ? 's' : ''}`} label="Need urgent action" tone="red" />
        </div>
      </section>

      {[
        {
          id: 'money',
          eyebrow: '1',
          title: 'Money at Risk',
          content: (
            <>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="rounded-2xl border border-[#C0392B]/20 bg-[#FFF8F5] p-6">
                  <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_13rem] md:items-end">
                    <div>
                      <div className="text-6xl font-black leading-none text-sentinel-deep">{formatCurrency(yieldAtRisk)}</div>
                      <h2 className="mt-3 text-2xl font-black text-sentinel-text">
                        Potential crop value at risk in scanned compartments
                      </h2>
                      <p className="mt-4 max-w-3xl text-base font-bold leading-relaxed text-sentinel-muted">
                        This is the estimated value that may be affected if action is delayed.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#C0392B]/25 bg-white p-5 text-center shadow-soft">
                      <div className="text-6xl font-black leading-none text-[#B83232]">{yieldAtRiskPercentage}%</div>
                      <div className="mt-2 text-base font-black leading-tight text-sentinel-text">of estimated yearly revenue</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-sentinel-primary/25 bg-sentinel-surface p-5">
                  <h3 className="text-xl font-black text-sentinel-text">Cost to check</h3>
                  <div className="mt-4 grid gap-3">
                    <ValueLine label="Cost to check this cluster" value={formatCurrency(auditVisitCost)} />
                    <ValueLine label="Potential crop value at risk" value={formatCurrency(yieldAtRisk)} />
                    <div className="rounded-2xl bg-white p-4 shadow-soft">
                      <div className="text-sm font-black uppercase tracking-[0.12em] text-sentinel-muted">Value found compared with checking cost</div>
                      <p className="mt-2 text-2xl font-black leading-tight text-sentinel-primary">RM{Math.round(costToValueSignal)} per RM1</p>
                    </div>
                    <p className="text-base font-bold leading-relaxed text-sentinel-muted">
                      For every RM1 spent on checking, Dr. Palm identifies about RM{Math.round(costToValueSignal)} of crop value at risk.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-sentinel-border bg-white p-5 shadow-soft">
                <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <h3 className="text-xl font-black text-sentinel-text">Cost to Check vs Value at Risk</h3>
                    <p className="mt-1 text-base font-semibold text-sentinel-muted">The check cost is tiny compared with the crop value at risk.</p>
                  </div>
                  <div className="rounded-full bg-sentinel-primary/10 px-4 py-2 text-base font-black text-sentinel-primary">
                    About {Math.round(costToValueSignal)}× difference
                  </div>
                </div>
                <div className="space-y-4">
                  <ComparisonBar label="Check cost" value={formatCurrency(auditVisitCost)} amount={auditVisitCost} baseline={estate.yieldAtRisk} color="#2D6A4F" />
                  <ComparisonBar label="Crop value at risk" value={formatCurrency(yieldAtRisk)} amount={yieldAtRisk} baseline={yieldAtRisk} color="#C0392B" />
                </div>
                <p className="mt-4 text-sm font-bold leading-relaxed text-sentinel-muted">Demo estimate. Not guaranteed savings. Field validation required.</p>
              </div>
            </>
          ),
        },
        {
          id: 'map',
          eyebrow: '2',
          title: 'Where Are the Affected Palms?',
          content: (
            <>
              <p className="mb-5 max-w-3xl text-base font-semibold text-sentinel-muted">
                Your scanned compartments with BSR classification results. Pan and zoom to inspect any area.
              </p>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="overflow-hidden rounded-2xl border border-sentinel-border shadow-inner" style={{ height: 560 }}>
                  <PalmScanShell hideScanControls defaultDrillBlockId={7} />
                </div>
                <div className="grid content-start gap-3">
                  {stageItems.map((item) => (
                    <div key={item.key} className="rounded-2xl border border-sentinel-border bg-white p-4 shadow-soft">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-lg font-black leading-tight text-sentinel-text">{item.label}</div>
                          <div className="mt-0.5 text-xs font-black uppercase tracking-[0.1em] text-sentinel-muted">{item.sublabel}</div>
                          <div className="mt-1 text-sm font-semibold text-sentinel-muted">{item.action}</div>
                        </div>
                        <span className="mt-1 h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                      </div>
                      <div className="mt-3 text-4xl font-black leading-none" style={{ color: item.color }}>
                        {item.count} <span className="text-xl font-bold text-sentinel-muted">palms</span>
                      </div>
                      {item.note && <div className="mt-2 text-xs font-bold leading-snug text-sentinel-muted">{item.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ),
        },
        {
          id: 'next',
          eyebrow: '3',
          title: 'What Should We Do Next?',
          content: (
            <>
              <div className="space-y-3">
                {actionTimeline.map((item, index) => (
                  <TimelineItem key={item.window} item={item} index={index} />
                ))}
              </div>
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-sentinel-primary/20 bg-[#2D6A4F]/8 p-4">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-sentinel-primary" />
                <p className="text-base font-bold leading-relaxed text-sentinel-muted">
                  AI-assisted. Agronomist confirmation recommended before felling.
                </p>
              </div>
              <div className="mt-6">
                <h3 className="mb-4 text-xl font-black text-sentinel-text">Severe Tree Field Report</h3>
                <FieldReport />
              </div>
            </>
          ),
        },
      ].map((section) => {
        const isOpen = openSections.has(section.id);
        return (
          <section key={section.id} className="overflow-hidden rounded-[1.75rem] border border-sentinel-border bg-white shadow-panel">
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              className="flex w-full items-center gap-4 px-5 py-5 text-left transition hover:bg-sentinel-surface lg:px-6"
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black transition ${
                isOpen ? 'bg-sentinel-primary text-white' : 'bg-sentinel-surface text-sentinel-muted'
              }`}>
                {section.eyebrow}
              </span>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-black tracking-normal text-sentinel-text md:text-3xl">{section.title}</h2>
                {'subtitle' in section && typeof section.subtitle === 'string' && section.subtitle && (
                  <p className="mt-0.5 text-sm font-semibold text-sentinel-muted">{section.subtitle}</p>
                )}
              </div>
              <ChevronDown className={`h-5 w-5 shrink-0 text-sentinel-muted transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-sentinel-border p-5 lg:p-6">
                    {section.content}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })}
    </motion.section>
  );
}


function MetricTile({ value, label, tone }: { value: string; label: string; tone: 'green' | 'orange' | 'red' }) {
  const color = tone === 'green' ? '#2D6A4F' : tone === 'orange' ? '#C96B1A' : '#C0392B';
  return (
    <div className="bg-white px-5 py-4">
      <div className="text-3xl font-black leading-none" style={{ color }}>
        {value}
      </div>
      <div className="mt-2 text-sm font-black uppercase tracking-[0.08em] text-sentinel-muted">{label}</div>
    </div>
  );
}

function ValueLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 shadow-soft">
      <div className="text-sm font-black uppercase tracking-[0.1em] text-sentinel-muted">{label}</div>
      <div className="text-xl font-black text-sentinel-deep">{value}</div>
    </div>
  );
}

function ComparisonBar({
  label,
  value,
  amount,
  baseline,
  color,
}: {
  label: string;
  value: string;
  amount: number;
  baseline: number;
  color: string;
}) {
  const width = Math.max(2, Math.min((amount / baseline) * 100, 100));

  return (
    <div className="grid gap-3 md:grid-cols-[15rem_minmax(0,1fr)_10rem] md:items-center">
      <div className="text-base font-black text-sentinel-text">{label}</div>
      <div className="h-8 overflow-hidden rounded-full bg-sentinel-surface">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          whileInView={{ width: `${width}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
      <div className="text-xl font-black text-sentinel-deep md:text-right">{value}</div>
    </div>
  );
}

function FieldReport() {
  const report = useMemo(() => buildFieldReport(), []);
  const totalStage34 = report.reduce((s, b) => s + b.trees.filter((t) => t.status === 'severe').length, 0);
  const totalStage2  = report.reduce((s, b) => s + b.trees.filter((t) => t.status === 'moderate').length, 0);
  const totalStage1  = report.reduce((s, b) => s + b.trees.filter((t) => t.status === 'mild').length, 0);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C0392B]/10 px-3 py-1 text-sm font-black text-[#C0392B]">
            <span className="h-2 w-2 rounded-full bg-[#C0392B]" />
            {totalStage34} Stage 3-4 — fell &amp; replant
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C96B1A]/10 px-3 py-1 text-sm font-black text-[#C96B1A]">
            <span className="h-2 w-2 rounded-full bg-[#C96B1A]" />
            {totalStage2} Stage 2 — apply treatment
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F2C94C]/20 px-3 py-1 text-sm font-black text-[#B8940A]">
            <span className="h-2 w-2 rounded-full bg-[#F2C94C]" />
            {totalStage1} Stage 1 — monitor
          </span>
        </div>
        <div className="no-print flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => downloadFieldReportCSV(report)}
            className="flex items-center gap-2 rounded-xl border border-sentinel-border bg-white px-4 py-2 text-sm font-black text-sentinel-text shadow-soft transition hover:bg-sentinel-surface"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-sentinel-border bg-white px-4 py-2 text-sm font-black text-sentinel-text shadow-soft transition hover:bg-sentinel-surface"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {report.map(({ blockName, trees }) => (
          <div key={blockName} className="overflow-hidden rounded-2xl border border-sentinel-border">
            <div className="flex items-center gap-3 border-b border-sentinel-border bg-[#C0392B]/6 px-5 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#C0392B] text-sm font-black text-white">
                {blockName}
              </span>
              <div>
                <span className="text-base font-black text-sentinel-text">Compartment {blockName}</span>
                <span className="ml-3 text-sm font-semibold text-sentinel-muted">
                  {trees.filter((t) => t.status === 'severe').length} Stage 3-4 ·{' '}
                  {trees.filter((t) => t.status === 'moderate').length} Stage 2 ·{' '}
                  {trees.filter((t) => t.status === 'mild').length} Stage 1
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-sentinel-border bg-sentinel-surface">
                    <th className="px-4 py-2.5 text-left text-xs font-black uppercase tracking-[0.1em] text-sentinel-muted">Tree #</th>
                    <th className="px-4 py-2.5 text-left text-xs font-black uppercase tracking-[0.1em] text-sentinel-muted">Row</th>
                    <th className="px-4 py-2.5 text-left text-xs font-black uppercase tracking-[0.1em] text-sentinel-muted">Position</th>
                    <th className="px-4 py-2.5 text-left text-xs font-black uppercase tracking-[0.1em] text-sentinel-muted">Latitude</th>
                    <th className="px-4 py-2.5 text-left text-xs font-black uppercase tracking-[0.1em] text-sentinel-muted">Longitude</th>
                    <th className="px-4 py-2.5 text-left text-xs font-black uppercase tracking-[0.1em] text-sentinel-muted">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-black uppercase tracking-[0.1em] text-sentinel-muted">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {trees.map((tree) => (
                    <tr
                      key={`${tree.blockName}-${tree.treeNum}`}
                      className="border-b border-sentinel-border/60 bg-white transition hover:bg-sentinel-surface/50"
                    >
                      <td className="px-4 py-2.5 font-black text-sentinel-text">#{tree.treeNum}</td>
                      <td className="px-4 py-2.5 font-semibold text-sentinel-muted">R{tree.row}</td>
                      <td className="px-4 py-2.5 font-semibold text-sentinel-muted">P{tree.position}</td>
                      <td className="px-4 py-2.5 font-mono text-sentinel-text">{tree.lat.toFixed(6)}</td>
                      <td className="px-4 py-2.5 font-mono text-sentinel-text">{tree.lng.toFixed(6)}</td>
                      <td className="px-4 py-2.5">
                        {tree.status === 'severe' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C0392B]/10 px-2.5 py-0.5 text-xs font-black text-[#C0392B]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#C0392B]" />
                            Stage 3-4
                          </span>
                        ) : tree.status === 'moderate' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C96B1A]/10 px-2.5 py-0.5 text-xs font-black text-[#C96B1A]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#C96B1A]" />
                            Stage 2
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F2C94C]/20 px-2.5 py-0.5 text-xs font-black text-[#B8940A]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#F2C94C]" />
                            Stage 1
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {tree.status === 'severe' ? (
                          <span className="rounded-full bg-[#C0392B]/10 px-3 py-1 text-xs font-black text-[#C0392B]">
                            Fell &amp; replant
                          </span>
                        ) : tree.status === 'moderate' ? (
                          <span className="rounded-full bg-[#C96B1A]/10 px-3 py-1 text-xs font-black text-[#C96B1A]">
                            Apply treatment
                          </span>
                        ) : (
                          <span className="rounded-full bg-[#F2C94C]/20 px-3 py-1 text-xs font-black text-[#B8940A]">
                            Monitor / Rescan
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs font-bold leading-relaxed text-sentinel-muted">
        GPS coordinates derived from TLS scan. Row (R) and position (P) assigned north-to-south, west-to-east within each compartment. Verify on-site before felling.
      </p>
    </>
  );
}

function TimelineItem({
  item,
  index,
}: {
  item: {
    window: string;
    heading: string;
    stageLabel: string;
    color: string;
    action: string;
    detail: string;
  };
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07 }}
      className="grid gap-4 rounded-2xl border border-sentinel-border bg-white p-4 shadow-soft lg:grid-cols-[10rem_minmax(0,1fr)_13rem] lg:items-center"
    >
      <div className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-2">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ backgroundColor: `${item.color}18`, color: item.color }}>
          <Clock3 className="h-5 w-5" />
        </div>
        <div className="text-sm font-black leading-tight text-sentinel-text">{item.window}</div>
      </div>

      <div className="border-l-4 pl-4" style={{ borderColor: item.color }}>
        <div className="text-xl font-black leading-tight text-sentinel-text">{item.heading}</div>
        <div className="mt-1 text-xs font-black uppercase tracking-[0.1em]" style={{ color: item.color }}>{item.stageLabel}</div>
        <div className="mt-1.5 text-sm font-semibold leading-snug text-sentinel-muted">{item.detail}</div>
      </div>

      <div className="rounded-2xl bg-sentinel-surface px-4 py-3 lg:text-right">
        <div className="text-base font-black leading-snug text-sentinel-text">{item.action}</div>
      </div>
    </motion.div>
  );
}
