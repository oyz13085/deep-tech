import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import type { StageRecord } from '../../types';

type ClassificationInfographicProps = {
  stages: StageRecord[];
  visibleStageCount: number;
};

const actionsByStage: Record<StageRecord['key'], string> = {
  stage0: 'Routine monitoring',
  stage1: 'Monitor and rescan in 30 days',
  stage2: 'Inspect within 7 days',
  stage34: 'Ground confirmation within 48 hours',
};

const positionsByStage: Record<StageRecord['key'], string> = {
  stage0: 'lg:col-start-1 lg:row-start-1',
  stage1: 'lg:col-start-3 lg:row-start-1',
  stage2: 'lg:col-start-1 lg:row-start-2',
  stage34: 'lg:col-start-3 lg:row-start-2',
};

const connectorLines: Array<{
  key: StageRecord['key'];
  path: string;
}> = [
  { key: 'stage0', path: 'M31 29 C35 29 38 31 40.5 35' },
  { key: 'stage1', path: 'M69 29 C65 29 62 31 59.5 35' },
  { key: 'stage2', path: 'M31 71 C35 71 38 69 40.5 65' },
  { key: 'stage34', path: 'M69 71 C65 71 62 69 59.5 65' },
];

export function ClassificationInfographic({ stages, visibleStageCount }: ClassificationInfographicProps) {
  const visibleStages = stages.slice(0, visibleStageCount);
  const totalPalms = useMemo(() => stages.reduce((sum, stage) => sum + stage.palms, 0), [stages]);
  const priorityPalms = useMemo(
    () => stages.filter((stage) => stage.key !== 'stage0').reduce((sum, stage) => sum + stage.palms, 0),
    [stages],
  );
  const urgentPalms = stages.find((stage) => stage.key === 'stage34')?.palms ?? 0;
  const visibleKeys = new Set(visibleStages.map((stage) => stage.key));

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-sentinel-border bg-white p-6 shadow-panel"
    >
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h2 className="text-3xl font-black tracking-normal text-sentinel-text">UM IP Classification Results</h2>
          <p className="mt-2 text-base font-semibold leading-relaxed text-sentinel-muted">
            AI-assisted staging from {totalPalms} TLS-scanned palms. Ground confirmation required.
          </p>
        </div>
        <div className="rounded-full border border-sentinel-primary/25 bg-[#1F7A4D]/8 px-4 py-2 text-sm font-black text-sentinel-primary">
          Stage 3–4 remains one combined group
        </div>
      </div>

      <div className="relative mt-6 overflow-hidden rounded-2xl border border-sentinel-border bg-sentinel-surface/55 p-4 lg:p-8">
        <svg
          className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full lg:block"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {connectorLines.map((line) => {
            const stage = stages.find((item) => item.key === line.key);
            if (!stage || !visibleKeys.has(line.key)) return null;
            return (
              <motion.path
                key={line.key}
                d={line.path}
                fill="none"
                stroke={stage.color}
                strokeWidth="0.55"
                strokeLinecap="round"
                strokeDasharray="1.4 1.2"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.85 }}
                transition={{ duration: 0.55, delay: visibleStages.findIndex((item) => item.key === line.key) * 0.12 }}
              />
            );
          })}
        </svg>

        <div className="relative z-10 grid gap-5 lg:grid-cols-[minmax(16rem,1fr)_minmax(21rem,23rem)_minmax(16rem,1fr)] lg:grid-rows-2 lg:items-center lg:gap-x-20 lg:gap-y-8">
          {stages.map((stage, index) => {
            const visible = index < visibleStageCount;
            return (
              <StageCallout
                key={stage.key}
                stage={stage}
                action={actionsByStage[stage.key]}
                percentage={(stage.palms / totalPalms) * 100}
                visible={visible}
                className={positionsByStage[stage.key]}
                delay={index * 0.12}
              />
            );
          })}

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45 }}
            className="order-first mx-auto grid min-h-80 w-full max-w-[23rem] place-items-center rounded-2xl border border-white bg-white p-4 shadow-soft lg:order-none lg:col-start-2 lg:row-start-1 lg:row-end-3"
          >
            <div className="relative">
              <PieChart width={330} height={310}>
                <Pie
                  data={stages}
                  dataKey="palms"
                  nameKey="label"
                  cx={165}
                  cy={155}
                  innerRadius={78}
                  outerRadius={122}
                  paddingAngle={3}
                  startAngle={92}
                  endAngle={-268}
                  isAnimationActive
                  animationDuration={900}
                >
                  {stages.map((stage, index) => (
                    <Cell key={stage.key} fill={stage.color} opacity={index < visibleStageCount ? 1 : 0.18} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value} palms`, 'Count']}
                  contentStyle={{ borderRadius: 16, borderColor: '#D8E0D6', fontWeight: 700 }}
                />
              </PieChart>
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="text-5xl font-black leading-none text-sentinel-deep">{totalPalms}</div>
                  <div className="mt-1 text-sm font-black uppercase tracking-[0.12em] text-sentinel-muted">
                    TLS-scanned
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {visibleStageCount >= stages.length ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 rounded-2xl border border-sentinel-border bg-sentinel-surface p-4"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <SummaryPill value={`${totalPalms}`} label="TLS-scanned palms" />
            <SummaryPill value={`${priorityPalms}`} label="BSR-priority palms" />
            <SummaryPill value={`${urgentPalms}`} label="urgent Stage 3–4 palms" />
          </div>
          <p className="mt-4 text-center text-base font-black text-sentinel-primary">
            AI-assisted classification • Ground confirmation required
          </p>
        </motion.div>
      ) : null}
    </motion.section>
  );
}

function StageCallout({
  stage,
  action,
  percentage,
  visible,
  className,
  delay,
}: {
  stage: StageRecord;
  action: string;
  percentage: number;
  visible: boolean;
  className: string;
  delay: number;
}) {
  if (!visible) {
    return <div className={`hidden lg:block ${className}`} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay }}
      className={`relative z-20 rounded-2xl border bg-white p-5 shadow-soft ${className}`}
      style={{ borderColor: `${stage.color}55` }}
    >
      <div className="mb-3 h-2 w-16 rounded-full" style={{ backgroundColor: stage.color }} />
      <h3 className="text-lg font-black leading-tight text-sentinel-text">{stage.label}</h3>
      <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
        <div className="text-4xl font-black leading-none" style={{ color: stage.color }}>
          <CountUp value={stage.palms} />
        </div>
        <div className="pb-1 text-base font-black text-sentinel-muted">palms</div>
      </div>
      <div className="mt-2 text-base font-black text-sentinel-text">{percentage.toFixed(1)}% of TLS-scanned palms</div>
      <div className="mt-3 rounded-xl bg-sentinel-surface px-3 py-2 text-base font-bold leading-snug text-sentinel-muted">
        {action}
      </div>
    </motion.div>
  );
}

function SummaryPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-soft">
      <div className="text-3xl font-black text-sentinel-deep">{value}</div>
      <div className="mt-1 text-sm font-black uppercase tracking-[0.08em] text-sentinel-muted">{label}</div>
    </div>
  );
}

function CountUp({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const totalFrames = 26;
    const timer = window.setInterval(() => {
      frame += 1;
      setDisplayValue(Math.round((value * frame) / totalFrames));
      if (frame >= totalFrames) {
        window.clearInterval(timer);
      }
    }, 24);

    return () => window.clearInterval(timer);
  }, [value]);

  return <>{displayValue}</>;
}
