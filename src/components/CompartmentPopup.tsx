

import { X, Pencil, Trash2, AlertTriangle, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { DrawnField } from './PolygonEditor';
import { FieldStatus } from '../lib/types';

interface Props {
  field: DrawnField;
  onEdit:   () => void;
  onDelete: () => void;
  onClose:  () => void;
}

const STATUS_CONFIG: Record<FieldStatus, {
  label: string;
  description: string;
  icon: React.ReactNode;
  border: string;
  bg: string;
  text: string;
  badge: string;
}> = {
  healthy: {
    label: 'Healthy',
    description: 'No disease activity detected. Continue routine monitoring.',
    icon: <CheckCircle className="w-4 h-4" />,
    border: 'border-l-green-600',
    bg:    'bg-green-50',
    text:  'text-green-700',
    badge: 'bg-green-100 text-green-800',
  },
  warning: {
    label: 'Warning',
    description: 'Early disease signs observed. Schedule an inspection within 7 days.',
    icon: <AlertCircle className="w-4 h-4" />,
    border: 'border-l-yellow-500',
    bg:    'bg-yellow-50',
    text:  'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-800',
  },
  moderate: {
    label: 'Moderate',
    description: 'Active spread confirmed. Dispatch treatment team within 3 days.',
    icon: <AlertTriangle className="w-4 h-4" />,
    border: 'border-l-orange-600',
    bg:    'bg-orange-50',
    text:  'text-orange-700',
    badge: 'bg-orange-100 text-orange-800',
  },
  severe: {
    label: 'Severe',
    description: 'Critical infestation. Immediate intervention required.',
    icon: <XCircle className="w-4 h-4" />,
    border: 'border-l-red-700',
    bg:    'bg-red-50',
    text:  'text-red-700',
    badge: 'bg-red-100 text-red-900',
  },
};

const DISEASE_PILL: Record<string, string> = {
  'None':          'bg-gray-100 text-gray-500',
  'Leaf Spot':     'bg-yellow-100 text-yellow-700',
  'Ganoderma':     'bg-red-100 text-red-700',
  'Bud Rot':       'bg-orange-100 text-orange-700',
  'Crown Disease': 'bg-purple-100 text-purple-700',
};

export default function CompartmentPopup({ field, onEdit, onDelete, onClose }: Props) {
  const cfg = STATUS_CONFIG[field.status];

  return (
    <div
      className={`absolute top-4 right-4 z-20 w-72 rounded-2xl overflow-hidden shadow-2xl border-l-4 ${cfg.border}`}
      style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.6)' }}
    >
      {/* Coloured status strip */}
      <div className={`px-4 py-3 ${cfg.bg} border-b border-black/5`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className={cfg.text}>{cfg.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-gray-500">{field.id}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{field.name}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-all flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Disease */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">Detected Disease</p>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${DISEASE_PILL[field.disease]}`}>
            {field.disease === 'None' ? 'No disease detected' : field.disease}
          </span>
        </div>

        {/* Recommendation */}
        <div className={`rounded-xl px-3 py-2.5 text-xs leading-relaxed ${cfg.bg}`}>
          <span className={`font-medium ${cfg.text}`}>Recommendation: </span>
          <span className="text-gray-600">{cfg.description}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-white transition-all hover:opacity-90"
            style={{ background: '#e07c3a' }}>
            <Pencil className="w-3 h-3" /> Edit
          </button>
          <button onClick={onDelete}
            className="w-10 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
