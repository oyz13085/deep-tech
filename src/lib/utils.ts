import { FieldStatus } from './types';

export const STATUS_COLORS: Record<FieldStatus, string> = {
  healthy:  '#166534',
  warning:  '#a16207',
  moderate: '#9a3412',
  severe:   '#7f1d1d',
};

export const STATUS_BG: Record<FieldStatus, string> = {
  healthy:  'bg-green-900/20 text-green-700 border-green-700/30',
  warning:  'bg-yellow-900/20 text-yellow-700 border-yellow-700/30',
  moderate: 'bg-orange-900/20 text-orange-800 border-orange-700/30',
  severe:   'bg-red-900/20 text-red-800 border-red-700/30',
};

export const STATUS_BAR: Record<FieldStatus, string> = {
  healthy:  'bg-green-600',
  warning:  'bg-yellow-500',
  moderate: 'bg-orange-600',
  severe:   'bg-red-800',
};

export const STATUS_PULSE: Record<FieldStatus, string> = {
  healthy:  '#166534',
  warning:  '#a16207',
  moderate: '#9a3412',
  severe:   '#7f1d1d',
};
