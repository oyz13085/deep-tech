import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { CalendarPlus, ChevronDown, Clock3, FileDown, Send } from 'lucide-react';
import { estate, tlsScan } from '../data/demoData';
import { InteractiveStageMap } from '../components/maps/InteractiveStageMap';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

type CompleteAuditReportPageProps = {
  showToast: (message: string) => void;
};

type AccordionSection = 'money' | 'map' | 'actions';

const actionTimeline = [
  {
    window: 'Do first - within 48 hours',
    stage: '23 urgent palms',
    color: '#EB5757',
    action: 'Fell and replant',
    details: ['Confirm with agronomist before felling.'],
    note: 'Stage 3-4 Severe/Critical',
  },
  {
    window: 'Do next - within 7 to 30 days',
    stage: '128 palms need treatment and follow-up',
    color: '#F2994A',
    action: 'Apply hexaconazole treatment',
    details: ['Apply hexaconazole treatment according to estate SOP and agronomist guidance.'],
    note: 'Stage 1 Mild + Stage 2 Moderate',
  },
];

const formatCurrency = (value: number) => `RM${value.toLocaleString('en-MY')}`;

function buildPrintableReportHtml() {
  const auditVisitCost = estate.auditVisitCost;
  const cropValueAtRisk = estate.yieldAtRisk;
  const yearlyRevenuePercent = Math.round((cropValueAtRisk / estate.estimatedAnnualRevenueBaseline) * 100);
  const valuePerRinggit = Math.round(cropValueAtRisk / auditVisitCost);
  const checkCostWidth = Math.max(2, (auditVisitCost / cropValueAtRisk) * 100);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Dr. Palm - BSR Disease Audit Report - Block 7</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #ffffff;
      color: #17211B;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.45;
    }
    .page {
      min-height: 265mm;
      page-break-after: always;
      padding: 0;
    }
    .page:last-child { page-break-after: auto; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      border-bottom: 3px solid #1F7A4D;
      padding-bottom: 18px;
      margin-bottom: 18px;
    }
    .brand {
      color: #1F7A4D;
      font-size: 21px;
      font-weight: 900;
      letter-spacing: .02em;
    }
    h1 {
      margin: 6px 0 8px;
      font-size: 28px;
      line-height: 1.08;
      font-weight: 900;
      color: #0F3D2E;
    }
    .meta {
      color: #526157;
      font-size: 13px;
      font-weight: 700;
    }
    .subtitle {
      max-width: 560px;
      margin: 10px 0 0;
      font-size: 14px;
      font-weight: 700;
      color: #526157;
    }
    .badge {
      border-radius: 999px;
      border: 1px solid #D8E0D6;
      padding: 8px 12px;
      color: #0F3D2E;
      font-weight: 900;
      background: #EEF3ED;
      white-space: nowrap;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin: 18px 0;
    }
    .metric {
      border: 1px solid #D8E0D6;
      border-radius: 14px;
      padding: 12px;
      background: #FFFFFF;
      min-height: 82px;
      break-inside: avoid;
    }
    .metric .value {
      font-size: 22px;
      font-weight: 900;
      line-height: 1;
      color: #0F3D2E;
    }
    .metric.red .value { color: #EB5757; }
    .metric.orange .value { color: #F2994A; }
    .metric.green .value { color: #1F7A4D; }
    .metric .label {
      margin-top: 7px;
      font-size: 10.5px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: #526157;
    }
    .plain-summary {
      margin: 16px 0 18px;
      border-left: 5px solid #1F7A4D;
      border-radius: 12px;
      background: #F6F8F5;
      padding: 14px 16px;
      font-size: 15px;
      font-weight: 800;
      color: #17211B;
    }
    .section {
      margin-top: 18px;
      break-inside: avoid;
    }
    .section h2 {
      margin: 0 0 12px;
      font-size: 20px;
      font-weight: 900;
      color: #0F3D2E;
    }
    .money-grid, .stage-grid, .action-grid {
      display: grid;
      gap: 10px;
    }
    .money-grid { grid-template-columns: repeat(3, 1fr); }
    .card {
      border: 1px solid #D8E0D6;
      border-radius: 14px;
      background: #FFFFFF;
      padding: 13px;
      break-inside: avoid;
    }
    .card-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: #526157;
      font-weight: 900;
    }
    .card-value {
      margin-top: 6px;
      font-size: 21px;
      line-height: 1.08;
      font-weight: 900;
      color: #0F3D2E;
    }
    .bar-box {
      margin-top: 12px;
      border: 1px solid #D8E0D6;
      border-radius: 14px;
      padding: 14px;
      background: #FFFFFF;
    }
    .bar-row {
      display: grid;
      grid-template-columns: 145px 1fr 100px;
      gap: 10px;
      align-items: center;
      margin-top: 10px;
      font-weight: 900;
    }
    .bar-bg {
      height: 18px;
      border-radius: 999px;
      overflow: hidden;
      background: #EEF3ED;
    }
    .bar-fill {
      height: 100%;
      border-radius: 999px;
    }
    .note {
      margin-top: 10px;
      font-size: 11px;
      font-weight: 800;
      color: #526157;
    }
    .map-layout {
      display: grid;
      grid-template-columns: 1.35fr .9fr;
      gap: 14px;
      align-items: stretch;
    }
    .map-card {
      border: 1px solid #D8E0D6;
      border-radius: 16px;
      background: #F6F8F5;
      padding: 12px;
      break-inside: avoid;
    }
    .map-title {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
      color: #526157;
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .05em;
    }
    svg { display: block; width: 100%; height: auto; }
    .stage-grid { grid-template-columns: 1fr; }
    .stage-card {
      display: grid;
      grid-template-columns: 14px 1fr auto;
      gap: 10px;
      align-items: center;
      border: 1px solid #D8E0D6;
      border-radius: 14px;
      padding: 10px;
      background: #FFFFFF;
    }
    .dot { width: 14px; height: 14px; border-radius: 50%; }
    .stage-name { font-size: 13px; font-weight: 900; color: #17211B; }
    .stage-sub { font-size: 11px; font-weight: 800; color: #526157; }
    .stage-count { font-size: 18px; font-weight: 900; color: #0F3D2E; text-align: right; }
    .action-card {
      display: grid;
      grid-template-columns: 160px 1fr 150px;
      gap: 12px;
      align-items: center;
      border: 1px solid #D8E0D6;
      border-left: 6px solid #1F7A4D;
      border-radius: 14px;
      padding: 13px;
      background: #FFFFFF;
      break-inside: avoid;
    }
    .action-card.red { border-left-color: #EB5757; }
    .action-card.orange { border-left-color: #F2994A; }
    .time { font-size: 13px; font-weight: 900; color: #17211B; }
    .action-main { font-size: 17px; font-weight: 900; color: #17211B; }
    .action-sub { margin-top: 3px; font-size: 11.5px; font-weight: 900; color: #526157; text-transform: uppercase; letter-spacing: .04em; }
    .action-note { margin-top: 5px; font-size: 12px; font-weight: 800; color: #526157; }
    .action-pill {
      border-radius: 14px;
      background: #EEF3ED;
      padding: 10px;
      font-size: 13px;
      font-weight: 900;
      color: #0F3D2E;
      text-align: center;
    }
    .notes {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      padding-left: 0;
      list-style: none;
    }
    .notes li {
      border: 1px solid #D8E0D6;
      border-radius: 12px;
      padding: 10px 12px;
      background: #FFFFFF;
      font-weight: 800;
      color: #17211B;
    }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page { page-break-after: always; }
      .page:last-child { page-break-after: auto; }
      .card, .metric, .action-card, .map-card, .bar-box { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main>
    <section class="page">
      <div class="header">
        <div>
          <div class="brand">Dr. Palm</div>
          <h1>BSR Disease Audit Report &mdash; Block 7</h1>
          <div class="meta">${estate.name} &bull; ${estate.auditCycle} Audit Cycle</div>
          <p class="subtitle">Drone scan found a risky area. TLS checked the zone. Dr. Palm shows where to act first.</p>
        </div>
        <div class="badge">Professional audit report</div>
      </div>

      <div class="summary-grid">
        <div class="metric red"><div class="value">${formatCurrency(cropValueAtRisk)}</div><div class="label">Potential crop value at risk</div></div>
        <div class="metric orange"><div class="value">${yearlyRevenuePercent}%</div><div class="label">Of estimated yearly revenue</div></div>
        <div class="metric green"><div class="value">${formatCurrency(auditVisitCost)}</div><div class="label">Cost to check this cluster</div></div>
        <div class="metric green"><div class="value">RM${valuePerRinggit}</div><div class="label">At-risk value found per RM1 spent</div></div>
        <div class="metric red"><div class="value">23 palms</div><div class="label">Need urgent action</div></div>
      </div>

      <section class="section">
        <h2>Executive Summary</h2>
      </section>
      <div class="plain-summary">
        Block 7 contains a targeted GPS anomaly zone. Dr. Palm checked a 1.5 ha zone plus a 2-row buffer and found 151 palms needing attention. 23 palms need urgent action.
      </div>

      <section class="section">
        <h2>Money at Risk</h2>
        <div class="money-grid">
          <div class="card"><div class="card-title">Potential crop value at risk</div><div class="card-value">${formatCurrency(cropValueAtRisk)}</div></div>
          <div class="card"><div class="card-title">Cost to check</div><div class="card-value">${formatCurrency(auditVisitCost)}</div></div>
          <div class="card"><div class="card-title">Value found compared with cost</div><div class="card-value">About RM${valuePerRinggit} per RM1 spent</div></div>
        </div>
        <div class="bar-box">
          <div class="card-title">Cost to Check vs Value at Risk</div>
          <div class="bar-row">
            <div>Check cost</div>
            <div class="bar-bg"><div class="bar-fill" style="width:${checkCostWidth}%; background:#1F7A4D;"></div></div>
            <div>${formatCurrency(auditVisitCost)}</div>
          </div>
          <div class="bar-row">
            <div>Crop value at risk</div>
            <div class="bar-bg"><div class="bar-fill" style="width:100%; background:#EB5757;"></div></div>
            <div>${formatCurrency(cropValueAtRisk)}</div>
          </div>
          <div class="note">Demo estimate. Not guaranteed savings. Field validation required.</div>
        </div>
      </section>
    </section>

    <section class="page">
      <div class="header">
        <div>
          <div class="brand">Dr. Palm</div>
          <h1>Where Are the Affected Palms?</h1>
          <div class="meta">Checked area: ~1.5 ha GPS zone + 2-row buffer &bull; Total checked: ${tlsScan.palmsScanned} palm profiles</div>
        </div>
      </div>

      <div class="map-layout">
        <div class="map-card">
          <div class="map-title"><span>Block 7 report map</span><span>Red = urgent &bull; Orange = treatment &bull; Yellow = monitoring &bull; Green = low priority</span></div>
          <svg viewBox="0 0 720 420" role="img" aria-label="Static Block 7 affected palm map">
            <rect x="0" y="0" width="720" height="420" rx="22" fill="#E7EFE4"/>
            <path d="M78 54 L650 38 L684 226 L600 374 L148 386 L42 228 Z" fill="#CFE4C8" stroke="#0F3D2E" stroke-width="5"/>
            <path d="M126 90 C238 72 400 68 612 78" stroke="#FFF8E8" stroke-width="10" stroke-linecap="round" opacity=".9"/>
            <path d="M98 164 C250 148 430 154 654 156" stroke="#FFF8E8" stroke-width="9" stroke-linecap="round" opacity=".85"/>
            <path d="M86 246 C260 230 452 238 632 248" stroke="#FFF8E8" stroke-width="9" stroke-linecap="round" opacity=".85"/>
            <path d="M132 324 C286 304 432 318 570 334" stroke="#FFF8E8" stroke-width="9" stroke-linecap="round" opacity=".85"/>
            <ellipse cx="515" cy="132" rx="92" ry="58" fill="#F2C94C" opacity=".42" stroke="#F2C94C" stroke-width="4"/>
            <ellipse cx="554" cy="116" rx="62" ry="39" fill="#F2994A" opacity=".45" stroke="#F2994A" stroke-width="4"/>
            <ellipse cx="584" cy="101" rx="36" ry="24" fill="#EB5757" opacity=".72" stroke="#B83232" stroke-width="4"/>
            <text x="404" y="205" fill="#0F3D2E" font-size="18" font-weight="900">TLS-scanned zone - Block 7 flagged cluster</text>
            <text x="432" y="229" fill="#526157" font-size="14" font-weight="800">~1.5 ha GPS zone + 2-row buffer</text>
            <g fill="#2EAD5B" opacity=".9">
              <circle cx="160" cy="130" r="7"/><circle cx="205" cy="122" r="7"/><circle cx="250" cy="138" r="7"/><circle cx="174" cy="218" r="7"/><circle cx="228" cy="240" r="7"/><circle cx="302" cy="208" r="7"/><circle cx="348" cy="292" r="7"/><circle cx="410" cy="304" r="7"/>
            </g>
            <g fill="#F2C94C">
              <circle cx="482" cy="144" r="8"/><circle cx="506" cy="162" r="8"/><circle cx="526" cy="128" r="8"/><circle cx="468" cy="110" r="8"/>
            </g>
            <g fill="#F2994A">
              <circle cx="548" cy="124" r="9"/><circle cx="570" cy="132" r="9"/><circle cx="540" cy="98" r="9"/>
            </g>
            <g fill="#EB5757">
              <circle cx="586" cy="102" r="10"/><circle cx="604" cy="108" r="10"/><circle cx="574" cy="88" r="10"/>
            </g>
          </svg>
        </div>
        <div class="stage-grid">
          <div class="stage-card"><div class="dot" style="background:#EB5757"></div><div><div class="stage-name">Urgent palms</div><div class="stage-sub">Stage 3-4 Severe/Critical</div></div><div class="stage-count">23</div></div>
          <div class="stage-card"><div class="dot" style="background:#F2994A"></div><div><div class="stage-name">Treatment palms</div><div class="stage-sub">Stage 2 Moderate</div></div><div class="stage-count">41</div></div>
          <div class="stage-card"><div class="dot" style="background:#F2C94C"></div><div><div class="stage-name">Monitoring palms</div><div class="stage-sub">Stage 1 Mild</div></div><div class="stage-count">87</div></div>
          <div class="stage-card"><div class="dot" style="background:#2EAD5B"></div><div><div class="stage-name">Low-priority palms</div><div class="stage-sub">Stage 0 Healthy</div></div><div class="stage-count">53</div></div>
        </div>
      </div>

      <section class="section">
        <h2>What Should We Do Next?</h2>
        <div class="action-grid">
          <div class="action-card red">
            <div class="time">Do first &mdash; within 48 hours</div>
            <div><div class="action-main">23 urgent palms</div><div class="action-sub">Stage 3-4 Severe/Critical</div><div class="action-note">Note: Confirm with agronomist before felling.</div></div>
            <div class="action-pill">Fell and replant</div>
          </div>
          <div class="action-card orange">
            <div class="time">Do next &mdash; within 7 to 30 days</div>
            <div><div class="action-main">128 palms need treatment and follow-up</div><div class="action-sub">Stage 1 Mild + Stage 2 Moderate</div><div class="action-note">Note: Apply according to estate SOP and agronomist guidance.</div></div>
            <div class="action-pill">Apply hexaconazole treatment</div>
          </div>
        </div>
      </section>
    </section>

    <section class="page">
      <div class="header">
        <div>
          <div class="brand">Dr. Palm</div>
          <h1>Notes</h1>
        </div>
      </div>
      <ul class="notes">
        <li>Drone scan flagged a GPS anomaly zone.</li>
        <li>Dr. Palm added a 2-row buffer.</li>
        <li>TLS checked about 1.5 ha / ${tlsScan.palmsScanned} palm profiles.</li>
        <li>Results are AI-assisted.</li>
        <li>Field validation is required.</li>
        <li>Savings are not guaranteed.</li>
      </ul>
    </section>
  </main>
</body>
</html>`;
}

export function CompleteAuditReportPage({ showToast }: CompleteAuditReportPageProps) {
  const [openSection, setOpenSection] = useState<AccordionSection | null>(null);
  const auditVisitCost = estate.auditVisitCost;
  const yearlyRevenuePercent = Math.round((estate.yieldAtRisk / estate.estimatedAnnualRevenueBaseline) * 100);
  const valuePerRinggit = Math.round(estate.yieldAtRisk / auditVisitCost);

  const exportReport = () => {
    const printWindow = window.open('', '_blank', 'width=960,height=1200');
    if (!printWindow) {
      showToast('Allow pop-ups to export report.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildPrintableReportHtml());
    printWindow.document.close();
    printWindow.focus();
    showToast('Report generated successfully.');
    window.setTimeout(() => {
      printWindow.print();
    }, 350);
  };

  const toggleSection = (section: AccordionSection) => {
    setOpenSection((current) => (current === section ? null : section));
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="space-y-5"
    >
      <section className="overflow-hidden rounded-[1.75rem] border border-sentinel-border bg-white shadow-panel">
        <div className="grid gap-5 bg-[linear-gradient(135deg,#ffffff_0%,#f6f8f5_54%,rgba(31,122,77,0.10)_100%)] p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start xl:p-6">
          <div>
            <Badge tone="green">Dr. Palm report</Badge>
            <h1 className="mt-4 text-4xl font-black tracking-normal text-sentinel-text md:text-5xl">
              BSR Disease Audit Report {'\u2014'} Block 7
            </h1>
            <p className="mt-3 max-w-4xl text-lg font-semibold leading-relaxed text-sentinel-muted">
              Drone scan found a risky area. TLS checked the zone. Dr. Palm shows where to act first.
            </p>
          </div>

          <div className="no-print rounded-2xl border border-sentinel-border bg-white/95 p-3 shadow-soft lg:w-[17rem]">
            <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-sentinel-muted">Actions</div>
            <div className="grid gap-2">
              <Button type="button" className="w-full justify-center" onClick={exportReport} icon={<FileDown className="h-5 w-5" />}>
                Export Report
              </Button>
              <Button
                type="button"
                className="w-full justify-center"
                variant="secondary"
                onClick={() => showToast('Report shared with Agronomy Team.')}
                icon={<Send className="h-5 w-5" />}
              >
                Send to Agronomy Team
              </Button>
              <Button
                type="button"
                className="w-full justify-center"
                variant="secondary"
                onClick={() => showToast('Next scan recommendation added.')}
                icon={<CalendarPlus className="h-5 w-5" />}
              >
                Schedule Next Scan
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-sentinel-border sm:grid-cols-2 xl:grid-cols-5">
          <MetricTile value="RM280,000" label="Crop value at risk" tone="red" />
          <MetricTile value={`${yearlyRevenuePercent}%`} label="Of yearly revenue" tone="orange" />
          <MetricTile value={formatCurrency(auditVisitCost)} label="Cost to check" tone="green" />
          <MetricTile value={`RM${valuePerRinggit}`} label="Value found per RM1" tone="green" />
          <MetricTile value="23 palms" label="Need urgent action" tone="red" />
        </div>
      </section>

      <section className="space-y-3">
        <ReportAccordion
          id="money"
          title="Money at Risk"
          preview="RM280,000 at risk - RM8,433 to check - about RM33 found per RM1 spent"
          openSection={openSection}
          onToggle={toggleSection}
        >
          <MoneyAtRiskContent
            auditVisitCost={auditVisitCost}
            valuePerRinggit={valuePerRinggit}
            yieldAtRisk={estate.yieldAtRisk}
          />
        </ReportAccordion>

        <ReportAccordion
          id="map"
          title="Where Are the Affected Palms?"
          preview="23 urgent - 41 treatment - 87 monitoring - 53 low-priority palms"
          openSection={openSection}
          onToggle={toggleSection}
        >
          <InteractiveStageMap />
        </ReportAccordion>

        <ReportAccordion
          id="actions"
          title="What Should We Do Next?"
          preview="Do first: fell/replant 23 palms - Treat and follow up 128 palms"
          openSection={openSection}
          onToggle={toggleSection}
        >
          <ActionPlanContent />
        </ReportAccordion>
      </section>
    </motion.section>
  );
}

function ReportAccordion({
  id,
  title,
  preview,
  openSection,
  onToggle,
  children,
}: {
  id: AccordionSection;
  title: string;
  preview: string;
  openSection: AccordionSection | null;
  onToggle: (section: AccordionSection) => void;
  children: ReactNode;
}) {
  const isOpen = openSection === id;

  return (
    <div className="overflow-hidden rounded-2xl border border-sentinel-border bg-white shadow-soft">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-sentinel-surface"
        aria-expanded={isOpen}
      >
        <div>
          <h2 className="text-xl font-black tracking-normal text-sentinel-text md:text-2xl">{title}</h2>
          <p className="mt-1 text-base font-semibold leading-snug text-sentinel-muted">{preview}</p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sentinel-surface text-sentinel-primary">
          <ChevronDown className={`h-6 w-6 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            <div className="border-t border-sentinel-border bg-[#FBFCFA] p-5">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MoneyAtRiskContent({
  auditVisitCost,
  valuePerRinggit,
  yieldAtRisk,
}: {
  auditVisitCost: number;
  valuePerRinggit: number;
  yieldAtRisk: number;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-3">
        <DecisionCard value="RM280,000" label="Crop value at risk in Block 7" tone="red" />
        <DecisionCard value={formatCurrency(auditVisitCost)} label="Cost to check this cluster" tone="green" />
        <DecisionCard value={`RM${valuePerRinggit} per RM1`} label="Value found compared with cost" tone="green" />
      </div>

      <div className="rounded-2xl border border-sentinel-border bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <h3 className="text-xl font-black text-sentinel-text">Cost to Check vs Value at Risk</h3>
          <div className="w-fit rounded-full bg-sentinel-primary/10 px-4 py-2 text-base font-black text-sentinel-primary">
            About {valuePerRinggit}x difference
          </div>
        </div>
        <div className="space-y-4">
          <ComparisonBar
            label="Check cost"
            value={formatCurrency(auditVisitCost)}
            amount={auditVisitCost}
            baseline={yieldAtRisk}
            color="#1F7A4D"
          />
          <ComparisonBar
            label="Crop value at risk"
            value={formatCurrency(yieldAtRisk)}
            amount={yieldAtRisk}
            baseline={yieldAtRisk}
            color="#EB5757"
          />
        </div>
        <p className="mt-4 text-sm font-bold leading-relaxed text-sentinel-muted">
          Demo estimate. Not guaranteed savings. Field validation required.
        </p>
      </div>
    </div>
  );
}

function ActionPlanContent() {
  return (
    <div className="space-y-3">
      {actionTimeline.map((item, index) => (
        <TimelineItem key={item.window} item={item} index={index} />
      ))}
    </div>
  );
}

function MetricTile({ value, label, tone }: { value: string; label: string; tone: 'green' | 'orange' | 'red' }) {
  const color = tone === 'green' ? '#1F7A4D' : tone === 'orange' ? '#F2994A' : '#EB5757';
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-2xl font-black leading-none md:text-3xl" style={{ color }}>
        {value}
      </div>
      <div className="mt-1.5 text-sm font-black uppercase tracking-[0.08em] text-sentinel-muted">{label}</div>
    </div>
  );
}

function DecisionCard({ value, label, tone }: { value: string; label: string; tone: 'green' | 'red' }) {
  const color = tone === 'green' ? '#1F7A4D' : '#EB5757';
  return (
    <div className="rounded-2xl border border-sentinel-border bg-white p-4 shadow-soft">
      <div className="text-3xl font-black leading-tight" style={{ color }}>
        {value}
      </div>
      <div className="mt-2 text-base font-black leading-snug text-sentinel-text">{label}</div>
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
    <div className="grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)_9rem] md:items-center">
      <div className="text-base font-black text-sentinel-text">{label}</div>
      <div className="h-7 overflow-hidden rounded-full bg-sentinel-surface">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          whileInView={{ width: `${width}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
      <div className="text-lg font-black text-sentinel-deep md:text-right">{value}</div>
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
    color: string;
    action: string;
    actionSubtext?: string;
    details: string[];
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
      className="grid gap-4 rounded-2xl border border-sentinel-border bg-white p-4 shadow-soft lg:grid-cols-[12rem_minmax(0,1fr)_13rem] lg:items-center"
    >
      <div className="flex items-center gap-3">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
          style={{ backgroundColor: `${item.color}18`, color: item.color }}
        >
          <Clock3 className="h-6 w-6" />
        </div>
        <div className="text-base font-black leading-tight text-sentinel-text">{item.window}</div>
      </div>

      <div className="border-l-4 pl-4" style={{ borderColor: item.color }}>
        <div className="text-xl font-black leading-tight text-sentinel-text">{item.stage}</div>
        <div className="mt-1 text-sm font-black uppercase tracking-[0.08em] text-sentinel-muted">{item.note}</div>
        <div className="mt-2 grid gap-1.5">
          {item.details.map((detail) => (
            <div key={detail} className="text-base font-bold leading-snug text-sentinel-muted">
              {detail}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-sentinel-surface px-4 py-3 lg:text-right">
        <div className="text-lg font-black text-sentinel-text">{item.action}</div>
        {item.actionSubtext ? <div className="mt-1 text-sm font-bold leading-snug text-sentinel-muted">{item.actionSubtext}</div> : null}
      </div>
    </motion.div>
  );
}
