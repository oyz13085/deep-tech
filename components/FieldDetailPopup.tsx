'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Droplets, Thermometer, FlaskConical, Cpu, RefreshCw, History, Truck, Sparkles } from 'lucide-react';
import { Field } from '@/lib/types';
import StatusBadge from './StatusBadge';
import SeverityBar from './SeverityBar';

interface Props {
  field: Field | null;
  onClose: () => void;
}

const DISEASE_COLOR: Record<string, string> = {
  'None':          'text-gray-400',
  'Leaf Spot':     'text-yellow-600',
  'Ganoderma':     'text-red-700',
  'Bud Rot':       'text-orange-600',
  'Crown Disease': 'text-purple-600',
};

export default function FieldDetailPopup({ field, onClose }: Props) {
  const [insight, setInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);

  const fetchInsight = useCallback(async () => {
    if (!field) return;
    setInsight('');
    setLoadingInsight(true);
    try {
      const res = await fetch('/api/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId: field.id,
          status: field.status,
          disease: field.disease,
          severity: field.severity,
        }),
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setInsight((prev) => prev + decoder.decode(value));
      }
    } catch {
      setInsight('Unable to fetch AI insight at this time.');
    } finally {
      setLoadingInsight(false);
    }
  }, [field]);

  useEffect(() => {
    if (field) fetchInsight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field?.id]);

  if (!field) return null;

  return (
    <div
      className="absolute top-4 right-4 z-20 w-80 rounded-2xl overflow-hidden shadow-2xl"
      style={{ backdropFilter: 'blur(16px)', background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(255,255,255,0.6)' }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100/80">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-gray-400">{field.id}</span>
              <StatusBadge status={field.status} />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mt-0.5">{field.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          <span className="font-mono">{field.area} ha</span>
          <span className="text-gray-300">·</span>
          <span className="font-mono">{field.palms} palms</span>
        </div>
      </div>

      {/* Disease info */}
      <div className="px-4 py-3 border-b border-gray-100/80">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Detected Disease</div>
            <div className={`text-sm font-semibold ${DISEASE_COLOR[field.disease]}`}>
              {field.disease}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Severity</div>
            <div className="text-2xl font-bold text-gray-800 font-mono leading-none">
              {field.severity}<span className="text-sm font-normal text-gray-400">%</span>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <SeverityBar severity={field.severity} status={field.status} />
          <div className="flex justify-between text-[10px] text-gray-300 font-mono">
            <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
          </div>
        </div>
      </div>

      {/* Sensor readings */}
      <div className="px-4 py-3 border-b border-gray-100/80">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
          <Cpu className="w-3 h-3" /> Sensor Readings
        </div>
        <div className="grid grid-cols-3 gap-2">
          <SensorCard
            icon={<Droplets className="w-3.5 h-3.5 text-blue-400" />}
            label="Humidity"
            value={`${field.sensor.humidity}%`}
          />
          <SensorCard
            icon={<FlaskConical className="w-3.5 h-3.5 text-purple-400" />}
            label="Soil pH"
            value={field.sensor.soilPH.toFixed(1)}
          />
          <SensorCard
            icon={<Thermometer className="w-3.5 h-3.5 text-red-400" />}
            label="Temp"
            value={`${field.sensor.temperature}°C`}
          />
        </div>
      </div>

      {/* AI Insight */}
      <div className="px-4 py-3 border-b border-gray-100/80">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3" style={{ color: '#e07c3a' }} /> AI Insight
          </div>
          <button
            onClick={fetchInsight}
            disabled={loadingInsight}
            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all"
          >
            <RefreshCw className={`w-3 h-3 ${loadingInsight ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div
          className="rounded-lg p-2.5 text-xs text-gray-700 leading-relaxed min-h-[52px]"
          style={{ background: 'rgba(224,124,58,0.06)', border: '1px solid rgba(224,124,58,0.15)' }}
        >
          {loadingInsight && !insight ? (
            <span className="text-gray-400 italic">Analyzing field data…</span>
          ) : insight ? (
            insight
          ) : (
            <span className="text-gray-400 italic">Click refresh to generate insight.</span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 py-3 flex gap-2">
        <ActionButton icon={<RefreshCw className="w-3 h-3" />} label="Rescan" primary />
        <ActionButton icon={<History className="w-3 h-3" />} label="History" />
        <ActionButton icon={<Truck className="w-3 h-3" />} label="Dispatch" />
      </div>
    </div>
  );
}

function SensorCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <div className="text-xs font-semibold text-gray-700 font-mono">{value}</div>
      <div className="text-[9px] text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

function ActionButton({ icon, label, primary }: { icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <button
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
        primary
          ? 'text-white hover:opacity-90'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
      style={primary ? { background: '#e07c3a' } : {}}
    >
      {icon}
      {label}
    </button>
  );
}
