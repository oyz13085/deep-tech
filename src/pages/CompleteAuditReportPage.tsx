import { motion } from 'framer-motion';
import { CalendarPlus, CheckCircle2, Clock3, FileDown, Send } from 'lucide-react';
import { estate } from '../data/demoData';
import { InteractiveStageMap } from '../components/maps/InteractiveStageMap';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

type CompleteAuditReportPageProps = {
  showToast: (message: string) => void;
};

const actionTimeline = [
  {
    window: 'Do first - within 48 hours',
    stage: '23 urgent palms',
    palms: '23 palms',
    color: '#EB5757',
    action: 'Fell and replant',
    detail: 'Confirm with agronomist before felling.',
    note: 'Stage 3-4 Severe/Critical',
  },
  {
    window: 'Do next - within 7 days',
    stage: '41 treatment palms',
    palms: '41 palms',
    color: '#F2994A',
    action: 'Apply hexaconazole treatment',
    detail: 'Follow estate SOP and agronomist guidance.',
    note: 'Stage 2 Moderate',
  },
  {
    window: 'Monitor - within 30 days',
    stage: '87 mild palms',
    palms: '87 palms',
    color: '#F2C94C',
    action: 'Rescan and monitor',
    detail: 'Use preventive soil treatment if clusters increase.',
    note: 'Stage 1 Mild',
  },
];

const formatCurrency = (value: number) => `RM${value.toLocaleString('en-MY')}`;

export function CompleteAuditReportPage({ showToast }: CompleteAuditReportPageProps) {
  const auditVisitCost = estate.auditVisitCost;
  const yieldAtRiskPercentage = Math.round((estate.yieldAtRisk / estate.estimatedAnnualRevenueBaseline) * 100);
  const costToValueSignal = estate.yieldAtRisk / auditVisitCost;

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
          <MetricTile value="RM280,000" label="Potential crop value at risk" tone="red" />
          <MetricTile value={`${yieldAtRiskPercentage}%`} label="Of estimated yearly revenue" tone="orange" />
          <MetricTile value={formatCurrency(auditVisitCost)} label="Cost to check this cluster" tone="green" />
          <MetricTile value="RM33" label="At-risk value found per RM1 spent" tone="green" />
          <MetricTile value="23 palms" label="Need urgent action" tone="red" />
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-sentinel-border bg-white p-5 shadow-panel lg:p-6">
        <SectionHeading eyebrow="1" title="Money at Risk" />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="rounded-2xl border border-[#EB5757]/20 bg-[#FFF8F5] p-6">
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_13rem] md:items-end">
              <div>
                <div className="text-6xl font-black leading-none text-sentinel-deep">RM280,000</div>
                <h2 className="mt-3 text-2xl font-black text-sentinel-text">
                  Potential crop value at risk in Block 7
                </h2>
                <p className="mt-4 max-w-3xl text-base font-bold leading-relaxed text-sentinel-muted">
                  This is the estimated value that may be affected if action is delayed.
                </p>
              </div>
              <div className="rounded-2xl border border-[#EB5757]/25 bg-white p-5 text-center shadow-soft">
                <div className="text-6xl font-black leading-none text-[#B83232]">{yieldAtRiskPercentage}%</div>
                <div className="mt-2 text-base font-black leading-tight text-sentinel-text">
                  of estimated yearly revenue
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-sentinel-primary/25 bg-sentinel-surface p-5">
            <h3 className="text-xl font-black text-sentinel-text">Cost to check</h3>
            <div className="mt-4 grid gap-3">
              <ValueLine label="Cost to check this cluster" value={formatCurrency(auditVisitCost)} />
              <ValueLine label="Potential crop value at risk" value={formatCurrency(estate.yieldAtRisk)} />
              <div className="rounded-2xl bg-white p-4 shadow-soft">
                <div className="text-sm font-black uppercase tracking-[0.12em] text-sentinel-muted">
                  Value found compared with checking cost
                </div>
                <p className="mt-2 text-2xl font-black leading-tight text-sentinel-primary">
                  RM33 per RM1
                </p>
              </div>
              <p className="text-base font-bold leading-relaxed text-sentinel-muted">
                For every RM1 spent on checking, Dr. Palm identifies about RM33 of crop value at risk.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-sentinel-border bg-white p-5 shadow-soft">
          <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h3 className="text-xl font-black text-sentinel-text">Cost to Check vs Value at Risk</h3>
              <p className="mt-1 text-base font-semibold text-sentinel-muted">
                The check cost is tiny compared with the crop value at risk.
              </p>
            </div>
            <div className="rounded-full bg-sentinel-primary/10 px-4 py-2 text-base font-black text-sentinel-primary">
              About {Math.round(costToValueSignal)}x difference
            </div>
          </div>

          <div className="space-y-4">
            <ComparisonBar
              label="Check cost"
              value={formatCurrency(auditVisitCost)}
              amount={auditVisitCost}
              baseline={estate.yieldAtRisk}
              color="#1F7A4D"
            />
            <ComparisonBar
              label="Crop value at risk"
              value={formatCurrency(estate.yieldAtRisk)}
              amount={estate.yieldAtRisk}
              baseline={estate.yieldAtRisk}
              color="#EB5757"
            />
          </div>

          <p className="mt-4 text-sm font-bold leading-relaxed text-sentinel-muted">
            Demo estimate. Not guaranteed savings. Field validation required.
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-sentinel-border bg-white p-5 shadow-panel lg:p-6">
        <InteractiveStageMap />
      </section>

      <section className="rounded-[1.75rem] border border-sentinel-border bg-white p-5 shadow-panel lg:p-6">
        <SectionHeading eyebrow="3" title="What Should We Do Next?" />
        <div className="space-y-3">
          {actionTimeline.map((item, index) => (
            <TimelineItem key={item.window} item={item} index={index} />
          ))}
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-sentinel-primary/20 bg-[#1F7A4D]/8 p-4">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-sentinel-primary" />
          <p className="text-base font-bold leading-relaxed text-sentinel-muted">
            AI-assisted. Agronomist confirmation recommended before felling.
          </p>
        </div>
      </section>
    </motion.section>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sentinel-primary text-sm font-black text-white">
        {eyebrow}
      </span>
      <h2 className="text-2xl font-black tracking-normal text-sentinel-text md:text-3xl">{title}</h2>
    </div>
  );
}

function MetricTile({ value, label, tone }: { value: string; label: string; tone: 'green' | 'orange' | 'red' }) {
  const color = tone === 'green' ? '#1F7A4D' : tone === 'orange' ? '#F2994A' : '#EB5757';
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

function TimelineItem({
  item,
  index,
}: {
  item: {
    window: string;
    stage: string;
    palms: string;
    color: string;
    action: string;
    detail: string;
    note?: string;
  };
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07 }}
      className="grid gap-4 rounded-2xl border border-sentinel-border bg-white p-4 shadow-soft lg:grid-cols-[11rem_minmax(0,1fr)_12rem] lg:items-center"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: `${item.color}18`, color: item.color }}>
          <Clock3 className="h-6 w-6" />
        </div>
        <div className="text-base font-black leading-tight text-sentinel-text">{item.window}</div>
      </div>

      <div className="border-l-4 pl-4" style={{ borderColor: item.color }}>
        <div className="text-xl font-black leading-tight text-sentinel-text">{item.stage}</div>
        <div className="mt-1 text-base font-bold text-sentinel-muted">{item.detail}</div>
        {item.note ? <div className="mt-1 text-sm font-bold text-sentinel-muted">{item.note}</div> : null}
      </div>

      <div className="rounded-2xl bg-sentinel-surface px-4 py-3 lg:text-right">
        <div className="text-lg font-black text-sentinel-text">{item.action}</div>
      </div>
    </motion.div>
  );
}
