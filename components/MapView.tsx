'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import PolygonEditor, { DrawnField } from './PolygonEditor';
import CompartmentPopup from './CompartmentPopup';
import { Pencil, X, Save, Trash2 } from 'lucide-react';

interface Props {
  drawnFields:    DrawnField[];
  selectedId:     string | null;
  onSelect:       (id: string) => void;
  onFieldsChange: (fields: DrawnField[]) => void;
}

type LayerStyle = 'satellite' | 'topo' | 'slope' | 'ndvi';

const STYLE_URLS: Record<LayerStyle, string> = {
  satellite: 'mapbox://styles/mapbox/satellite-v9',
  topo:      'mapbox://styles/mapbox/outdoors-v12',
  slope:     'mapbox://styles/mapbox/terrain-v2',
  ndvi:      'mapbox://styles/mapbox/satellite-streets-v12',
};

const STATUS_COLORS: Record<string, string> = {
  healthy:  '#166534',
  warning:  '#a16207',
  moderate: '#9a3412',
  severe:   '#7f1d1d',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DRAW_STYLES: any[] = [
  { id: 'gl-draw-polygon-fill',          type: 'fill',   filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']], paint: { 'fill-color': '#e07c3a', 'fill-opacity': 0.18 } },
  { id: 'gl-draw-polygon-stroke',        type: 'line',   filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']], paint: { 'line-color': '#e07c3a', 'line-width': 2, 'line-dasharray': [4, 2] } },
  { id: 'gl-draw-polygon-midpoint',      type: 'circle', filter: ['all', ['==', '$type', 'Point'],   ['==', 'meta', 'midpoint']], paint: { 'circle-radius': 4, 'circle-color': '#e07c3a' } },
  { id: 'gl-draw-polygon-vertex',        type: 'circle', filter: ['all', ['==', '$type', 'Point'],   ['==', 'meta', 'vertex']],   paint: { 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-color': '#e07c3a', 'circle-stroke-width': 2 } },
  // Saved polygons rendered invisible via Draw — we draw them ourselves on a custom layer
  { id: 'gl-draw-polygon-fill-static',   type: 'fill',   filter: ['all', ['==', '$type', 'Polygon'], ['==', 'mode', 'static']], paint: { 'fill-opacity': 0 } },
  { id: 'gl-draw-polygon-stroke-static', type: 'line',   filter: ['all', ['==', '$type', 'Polygon'], ['==', 'mode', 'static']], paint: { 'line-opacity': 0 } },
];

function polygonCentroid(coords: [number, number][]): [number, number] {
  const n = coords.length - 1; // last point repeats first
  const sum = coords.slice(0, n).reduce(
    (acc, c) => [acc[0] + c[0], acc[1] + c[1]],
    [0, 0]
  );
  return [sum[0] / n, sum[1] / n];
}

function buildCompartmentGeoJSON(fields: DrawnField[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fields.map((f) => ({
      type: 'Feature',
      properties: { id: f.id, name: f.name, status: f.status, disease: f.disease, drawId: f.drawId },
      geometry: { type: 'Polygon', coordinates: f.coordinates },
    })),
  };
}

function buildLabelGeoJSON(fields: DrawnField[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fields.map((f) => ({
      type: 'Feature',
      properties: { id: f.id, name: f.name, status: f.status },
      geometry: { type: 'Point', coordinates: polygonCentroid(f.coordinates[0]) },
    })),
  };
}

export default function MapView({ drawnFields, selectedId, onSelect, onFieldsChange }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const mapRef         = useRef<mapboxgl.Map | null>(null);
  const drawRef        = useRef<MapboxDraw | null>(null);
  const drawnFieldsRef = useRef<DrawnField[]>(drawnFields);

  const [activeLayer,    setActiveLayer]    = useState<LayerStyle>('satellite');
  const [mapReady,       setMapReady]       = useState(false);
  const [drawMode,       setDrawMode]       = useState(false);
  const [saveToast,      setSaveToast]      = useState(false);
  // editingFeature → PolygonEditor open (drawing new or editing existing)
  const [editingFeature, setEditingFeature] = useState<{ id: string; coordinates: [number, number][][] } | null>(null);
  // viewingFieldId → CompartmentPopup open (read-only info)
  const [viewingFieldId, setViewingFieldId] = useState<string | null>(null);

  useEffect(() => { drawnFieldsRef.current = drawnFields; }, [drawnFields]);

  // ── Sync custom compartment layers when drawnFields changes ──────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const compSource = map.getSource('compartments') as mapboxgl.GeoJSONSource | undefined;
    const lblSource  = map.getSource('compartment-labels') as mapboxgl.GeoJSONSource | undefined;
    if (compSource) compSource.setData(buildCompartmentGeoJSON(drawnFields));
    if (lblSource)  lblSource.setData(buildLabelGeoJSON(drawnFields));
  }, [drawnFields, mapReady]);

  // ── Add compartment + label layers ──────────────────────────────────────────
  function addCompartmentLayers(map: mapboxgl.Map, fields: DrawnField[]) {
    if (map.getSource('compartments')) return;

    map.addSource('compartments', { type: 'geojson', data: buildCompartmentGeoJSON(fields) });
    map.addSource('compartment-labels', { type: 'geojson', data: buildLabelGeoJSON(fields) });

    // Fill — colour by status, darker when selected
    map.addLayer({
      id: 'comp-fill',
      type: 'fill',
      source: 'compartments',
      paint: {
        'fill-color': ['match', ['get', 'status'],
          'healthy', STATUS_COLORS.healthy,
          'warning', STATUS_COLORS.warning,
          'moderate', STATUS_COLORS.moderate,
          'severe', STATUS_COLORS.severe,
          '#888',
        ],
        'fill-opacity': ['case', ['==', ['get', 'id'], selectedId ?? ''], 0.55, 0.35],
      },
    });

    // Outline — thicker when selected
    map.addLayer({
      id: 'comp-outline',
      type: 'line',
      source: 'compartments',
      paint: {
        'line-color': ['match', ['get', 'status'],
          'healthy', STATUS_COLORS.healthy,
          'warning', STATUS_COLORS.warning,
          'moderate', STATUS_COLORS.moderate,
          'severe', STATUS_COLORS.severe,
          '#888',
        ],
        'line-width': ['case', ['==', ['get', 'id'], selectedId ?? ''], 3, 1.5],
        'line-opacity': 1,
      },
    });

    // Selected highlight ring (orange)
    map.addLayer({
      id: 'comp-selected',
      type: 'line',
      source: 'compartments',
      filter: ['==', ['get', 'id'], selectedId ?? ''],
      paint: { 'line-color': '#e07c3a', 'line-width': 3, 'line-gap-width': 1 },
    });

    // Hover fill
    map.addLayer({
      id: 'comp-hover',
      type: 'fill',
      source: 'compartments',
      filter: ['==', ['get', 'id'], ''],
      paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.15 },
    });

    // Compartment ID labels
    map.addLayer({
      id: 'comp-labels',
      type: 'symbol',
      source: 'compartment-labels',
      layout: {
        'text-field': ['concat', ['get', 'id'], '\n', ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 9, 16, 13],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-line-height': 1.3,
        'text-anchor': 'center',
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0,0,0,0.6)',
        'text-halo-width': 1.5,
      },
    });

    // Hover + click interactions
    let hoveredId: string | null = null;

    map.on('mousemove', 'comp-fill', (e) => {
      const fid = e.features?.[0]?.properties?.id as string;
      if (fid && hoveredId !== fid) {
        hoveredId = fid;
        map.setFilter('comp-hover', ['==', ['get', 'id'], fid]);
      }
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'comp-fill', () => {
      hoveredId = null;
      map.setFilter('comp-hover', ['==', ['get', 'id'], '']);
      map.getCanvas().style.cursor = '';
    });

    map.on('click', 'comp-fill', (e) => {
      const fid = e.features?.[0]?.properties?.id as string;
      if (!fid) return;
      onSelect(fid);
      setViewingFieldId(fid);
      setEditingFeature(null);
    });
  }

  // ── Init map ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE_URLS.satellite,
      center: [103.272, 2.040],
      zoom: 13.2,
      maxZoom: 21,
    });

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      styles: DRAW_STYLES,
    });

    map.addControl(draw, 'top-right');
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    drawRef.current = draw;

    map.on('load', () => {
      addCompartmentLayers(map, drawnFieldsRef.current);

      // Add existing polygons to GL Draw for editing support
      if (drawnFieldsRef.current.length > 0) {
        draw.add({
          type: 'FeatureCollection',
          features: drawnFieldsRef.current.map((f) => ({
            id: f.drawId,
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'Polygon' as const, coordinates: f.coordinates },
          })),
        });
      }

      setMapReady(true);
    });

    // New polygon drawn → open editor
    map.on('draw.create', (e: { features: GeoJSON.Feature[] }) => {
      const f = e.features[0];
      if (!f || f.geometry.type !== 'Polygon') return;
      setEditingFeature({ id: String(f.id), coordinates: (f.geometry as GeoJSON.Polygon).coordinates as [number, number][][] });
      setViewingFieldId(null);
    });

    // Existing polygon vertex moved → re-open editor
    map.on('draw.update', (e: { features: GeoJSON.Feature[] }) => {
      const f = e.features[0];
      if (!f || f.geometry.type !== 'Polygon') return;
      setEditingFeature({ id: String(f.id), coordinates: (f.geometry as GeoJSON.Polygon).coordinates as [number, number][][] });
      setViewingFieldId(null);
    });

    // Click on draw polygon while in draw mode — handled separately via comp-fill click
    map.on('draw.selectionchange', (e: { features: GeoJSON.Feature[] }) => {
      // Only care about this when we're actively drawing (unsaved polygon)
      if (e.features.length === 0) {
        // Don't clear editingFeature if the user just clicked away — they may still need to save
        return;
      }
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync selected highlight on the custom layer ──────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (map.getLayer('comp-selected')) map.setFilter('comp-selected', ['==', ['get', 'id'], selectedId ?? '']);
    if (map.getLayer('comp-fill')) {
      map.setPaintProperty('comp-fill', 'fill-opacity',
        ['case', ['==', ['get', 'id'], selectedId ?? ''], 0.55, 0.35]);
    }
    if (map.getLayer('comp-outline')) {
      map.setPaintProperty('comp-outline', 'line-width',
        ['case', ['==', ['get', 'id'], selectedId ?? ''], 3, 1.5]);
    }
  }, [selectedId, mapReady]);

  // ── Fly to selected compartment ───────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId || !mapReady) return;
    const field = drawnFields.find((f) => f.id === selectedId);
    if (!field) return;
    const coords = field.coordinates[0];
    const lngs = coords.map((c) => c[0]);
    const lats  = coords.map((c) => c[1]);
    mapRef.current?.fitBounds(
      new mapboxgl.LngLatBounds([Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]),
      { padding: 140, maxZoom: 16, duration: 700 }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, mapReady]);

  // ── Basemap switch ────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.once('styledata', () => addCompartmentLayers(map, drawnFieldsRef.current));
    map.setStyle(STYLE_URLS[activeLayer]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayer]);

  // ── Draw mode ─────────────────────────────────────────────────────────────────
  const toggleDrawMode = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;
    if (!drawMode) {
      draw.changeMode('draw_polygon');
      setDrawMode(true);
      setViewingFieldId(null);
      setEditingFeature(null);
    } else {
      draw.changeMode('simple_select');
      setDrawMode(false);
      setEditingFeature(null);
    }
  }, [drawMode]);

  // ── Save compartment ──────────────────────────────────────────────────────────
  const handleSave = useCallback((field: DrawnField) => {
    const next = [...drawnFieldsRef.current.filter((f) => f.drawId !== field.drawId), field];
    onFieldsChange(next);
    setEditingFeature(null);
    setViewingFieldId(field.id);
    drawRef.current?.changeMode('simple_select');
    setDrawMode(false);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
    onSelect(field.id);
  }, [onFieldsChange, onSelect]);

  // ── Delete compartment ────────────────────────────────────────────────────────
  const handleDeleteById = useCallback((drawId: string) => {
    if (!confirm('Remove this compartment?')) return;
    drawRef.current?.delete(drawId);
    const next = drawnFieldsRef.current.filter((f) => f.drawId !== drawId);
    onFieldsChange(next);
    setEditingFeature(null);
    setViewingFieldId(null);
  }, [onFieldsChange]);

  // ── Edit from popup ───────────────────────────────────────────────────────────
  const handleEditFromPopup = useCallback((field: DrawnField) => {
    setViewingFieldId(null);
    setEditingFeature({ id: field.drawId, coordinates: field.coordinates });
    drawRef.current?.changeMode('simple_select', { featureIds: [field.drawId] });
  }, []);

  // ── Clear all ─────────────────────────────────────────────────────────────────
  const handleClearAll = useCallback(() => {
    if (!confirm(`Delete all ${drawnFieldsRef.current.length} compartment(s)?`)) return;
    drawRef.current?.deleteAll();
    onFieldsChange([]);
    setEditingFeature(null);
    setViewingFieldId(null);
  }, [onFieldsChange]);

  // ── Export GeoJSON ────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const fields = drawnFieldsRef.current;
    if (!fields.length) return;
    const fc = { type: 'FeatureCollection', features: fields.map((f) => ({ type: 'Feature', properties: { id: f.id, name: f.name, status: f.status, disease: f.disease }, geometry: { type: 'Polygon', coordinates: f.coordinates } })) };
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'compartments.geojson'; a.click();
    URL.revokeObjectURL(url);
  }, []);

  const viewingField = drawnFields.find((f) => f.id === viewingFieldId) ?? null;

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="map-container" />

      {/* Layer tabs */}
      <div className="absolute top-4 left-4 z-10 flex gap-1 rounded-xl p-1"
        style={{ background: 'rgba(26,31,24,0.85)', backdropFilter: 'blur(8px)' }}>
        {(['satellite','topo','slope','ndvi'] as LayerStyle[]).map((key) => (
          <button key={key} onClick={() => setActiveLayer(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${activeLayer === key ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`}
            style={activeLayer === key ? { background: '#e07c3a' } : {}}>
            {key}
          </button>
        ))}
      </div>

      {/* Top-centre toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        <button onClick={toggleDrawMode}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium shadow-lg transition-all"
          style={{ background: drawMode ? '#e07c3a' : 'rgba(26,31,24,0.85)', backdropFilter: 'blur(8px)', border: drawMode ? '1.5px solid #e07c3a' : '1.5px solid rgba(255,255,255,0.08)', color: '#fff' }}>
          {drawMode ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
          {drawMode ? 'Cancel Drawing' : 'Draw Compartment'}
        </button>

        {drawnFields.length > 0 && !drawMode && (
          <>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-200 hover:text-white shadow-lg transition-all"
              style={{ background: 'rgba(26,31,24,0.85)', backdropFilter: 'blur(8px)', border: '1.5px solid rgba(255,255,255,0.08)' }}>
              <Save className="w-3 h-3" /> Export GeoJSON
            </button>
            <button onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:text-red-300 shadow-lg transition-all"
              style={{ background: 'rgba(26,31,24,0.85)', backdropFilter: 'blur(8px)', border: '1.5px solid rgba(255,255,255,0.08)' }}>
              <Trash2 className="w-3 h-3" /> Clear All
            </button>
          </>
        )}
      </div>

      {/* Drawing hint */}
      {drawMode && !editingFeature && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-xl text-xs text-gray-200 pointer-events-none"
          style={{ background: 'rgba(26,31,24,0.85)', backdropFilter: 'blur(8px)' }}>
          Click to place corners · Double-click to finish the polygon
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-10 left-4 z-10 rounded-xl p-3"
        style={{ background: 'rgba(26,31,24,0.85)', backdropFilter: 'blur(8px)' }}>
        <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Status</p>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color }} />
            <span className="text-xs text-gray-300 capitalize">{status}</span>
          </div>
        ))}
      </div>

      {/* Save toast */}
      {saveToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-xl pointer-events-none"
          style={{ background: '#166534' }}>
          <Save className="w-3.5 h-3.5" /> Compartment saved
        </div>
      )}

      {/* Compartment info popup (view mode — click on map) */}
      {viewingField && !editingFeature && (
        <CompartmentPopup
          field={viewingField}
          onEdit={() => handleEditFromPopup(viewingField)}
          onDelete={() => handleDeleteById(viewingField.drawId)}
          onClose={() => setViewingFieldId(null)}
        />
      )}

      {/* Polygon editor (draw / edit mode) */}
      {editingFeature && (
        <PolygonEditor
          feature={editingFeature}
          existingFields={drawnFields}
          onSave={handleSave}
          onDelete={(drawId) => handleDeleteById(drawId)}
          onClose={() => {
            setEditingFeature(null);
            drawRef.current?.changeMode('simple_select');
            setDrawMode(false);
          }}
        />
      )}
    </div>
  );
}
