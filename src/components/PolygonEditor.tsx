

import { useState } from 'react';
import { X, Check, Trash2, Download, Copy } from 'lucide-react';
import { FieldStatus, DiseaseType } from '../lib/types';

export interface DrawnField {
  drawId: string;      // Mapbox GL Draw internal ID
  id: string;          // compartment ID e.g. C28
  name: string;
  status: FieldStatus;
  disease: DiseaseType;
  coordinates: [number, number][][];
}

interface Props {
  feature: { id: string; coordinates: [number, number][][] } | null;
  existingFields: DrawnField[];
  onSave: (field: DrawnField) => void;
  onDelete: (drawId: string) => void;
  onClose: () => void;
}

const STATUSES: FieldStatus[]  = ['healthy', 'warning', 'moderate', 'severe'];
const DISEASES: DiseaseType[]  = ['None', 'Leaf Spot', 'Ganoderma', 'Bud Rot', 'Crown Disease'];

const STATUS_DOT: Record<FieldStatus, string> = {
  healthy:  'bg-green-600',
  warning:  'bg-yellow-500',
  moderate: 'bg-orange-600',
  severe:   'bg-red-800',
};

export default function PolygonEditor({ feature, existingFields, onSave, onDelete, onClose }: Props) {
  const existing = feature ? existingFields.find((f) => f.drawId === feature.id) : null;

  const [id,      setId]      = useState(existing?.id      ?? `C${String(existingFields.length + 28).padStart(2,'0')}`);
  const [name,    setName]    = useState(existing?.name    ?? '');
  const [status,  setStatus]  = useState<FieldStatus> (existing?.status  ?? 'healthy');
  const [disease, setDisease] = useState<DiseaseType> (existing?.disease ?? 'None');
  const [copied,  setCopied]  = useState(false);

  if (!feature) return null;

  const coords = feature.coordinates;
  const coordJson = JSON.stringify(coords, null, 2);

  function handleSave() {
    if (!name.trim()) return;
    onSave({ drawId: feature!.id, id: id.trim(), name: name.trim(), status, disease, coordinates: coords });
  }

  function handleCopy() {
    navigator.clipboard.writeText(coordJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleExport() {
    const geojson = {
      type: 'Feature',
      properties: { id, name, status, disease },
      geometry: { type: 'Polygon', coordinates: coords },
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${id || 'polygon'}.geojson`; a.click();
    URL.revokeObjectURL(url);
  }

  const vertexCount = coords[0]?.length ?? 0;

  return (
    <div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-[480px] rounded-2xl shadow-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)', border: '1px solid rgba(0,0,0,0.08)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          <span className="text-sm font-semibold text-gray-800">
            {existing ? `Edit — ${existing.name || existing.id}` : 'New Compartment Polygon'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleExport} title="Export GeoJSON" className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex gap-0 divide-x divide-gray-100">
        {/* Left — form */}
        <div className="flex-1 px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Compartment ID</label>
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                className="w-full text-sm font-mono bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-orange-400 transition-colors"
                placeholder="C28"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-orange-400 transition-colors"
                placeholder="Block Name"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Status</label>
            <div className="flex gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    status === s
                      ? 'border-transparent text-white'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                  style={status === s ? {
                    background: s === 'healthy' ? '#166534' : s === 'warning' ? '#a16207' : s === 'moderate' ? '#9a3412' : '#7f1d1d'
                  } : {}}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s]}`} />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Disease</label>
            <select
              value={disease}
              onChange={(e) => setDisease(e.target.value as DiseaseType)}
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-orange-400 transition-colors"
            >
              {DISEASES.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40"
              style={{ background: '#e07c3a' }}
            >
              <Check className="w-3.5 h-3.5" /> Save Compartment
            </button>
            {existing && (
              <button
                onClick={() => onDelete(feature.id)}
                className="w-9 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right — raw coordinates */}
        <div className="w-44 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">
              {vertexCount - 1} vertices
            </span>
            <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-700 transition-colors">
              <Copy className="w-3 h-3" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="flex-1 overflow-auto p-2 text-[9px] font-mono text-gray-500 leading-relaxed" style={{ maxHeight: 180 }}>
            {coords[0]?.map((c, i) =>
              `[${c[0].toFixed(6)},\n ${c[1].toFixed(6)}]${i < coords[0].length - 1 ? ',' : ''}`
            ).join('\n')}
          </pre>
        </div>
      </div>
    </div>
  );
}
