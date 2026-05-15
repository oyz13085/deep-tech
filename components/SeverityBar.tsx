import { FieldStatus } from '@/lib/types';
import { STATUS_BAR } from '@/lib/utils';

export default function SeverityBar({ severity, status }: { severity: number; status: FieldStatus }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${STATUS_BAR[status]}`}
        style={{ width: `${severity}%` }}
      />
    </div>
  );
}
