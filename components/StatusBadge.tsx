import { FieldStatus } from '@/lib/types';
import { STATUS_BG } from '@/lib/utils';

const LABELS: Record<FieldStatus, string> = {
  healthy:  'Healthy',
  warning:  'Warning',
  moderate: 'Moderate',
  severe:   'Severe',
};

export default function StatusBadge({ status }: { status: FieldStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BG[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
