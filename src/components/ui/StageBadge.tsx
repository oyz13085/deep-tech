import type { StageRecord } from '../../types';

type StageBadgeProps = {
  stage: StageRecord;
};

export function StageBadge({ stage }: StageBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold"
      style={{
        borderColor: `${stage.color}55`,
        backgroundColor: `${stage.color}17`,
        color: stage.color,
      }}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
      {stage.shortLabel}
    </span>
  );
}
