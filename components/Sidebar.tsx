'use client';

import { Leaf, Map, Activity, AlertTriangle, Settings } from 'lucide-react';

const navItems = [
  { icon: Map,           label: 'Map View',   active: true  },
  { icon: Activity,      label: 'Analytics',  active: false },
  { icon: Leaf,          label: 'Crop Health', active: false },
  { icon: Settings,      label: 'Settings',   active: false },
];

export default function Sidebar() {
  return (
    <aside
      className="flex flex-col items-center py-4 gap-2 flex-shrink-0"
      style={{ width: 52, background: '#1a1f18' }}
    >
      {/* Logo */}
      <div className="mb-3 flex flex-col items-center gap-0.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: '#e07c3a' }}
        >
          <Leaf className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Nav icons */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {navItems.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            title={label}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              active
                ? 'text-white'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
            style={active ? { background: '#e07c3a22', color: '#e07c3a' } : {}}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}

        {/* Alert badge */}
        <button
          title="Alerts"
          className="w-9 h-9 rounded-lg flex items-center justify-center relative text-gray-500 hover:text-gray-300 hover:bg-white/5 mt-2"
        >
          <AlertTriangle className="w-4 h-4" />
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full"
            style={{ background: '#e07c3a' }}
          />
        </button>
      </nav>

      {/* Avatar */}
      <div className="mt-auto">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
          style={{ background: '#2d3b2a' }}>
          PM
        </div>
      </div>
    </aside>
  );
}
