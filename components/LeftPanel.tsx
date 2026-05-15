'use client';

import { useState, useMemo } from 'react';
import { Search, TreePine, Layers, PenLine } from 'lucide-react';
import { DrawnField } from './PolygonEditor';
import StatusBadge from './StatusBadge';

interface Props {
  fields: DrawnField[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const DISEASE_PILL: Record<string, string> = {
  'None':          'bg-gray-100 text-gray-500',
  'Leaf Spot':     'bg-yellow-100 text-yellow-700',
  'Ganoderma':     'bg-red-100 text-red-700',
  'Bud Rot':       'bg-orange-100 text-orange-700',
  'Crown Disease': 'bg-purple-100 text-purple-700',
};

export default function LeftPanel({ fields, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState('');

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
    </aside>
  );
}

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
