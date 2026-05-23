

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import PolygonEditor, { DrawnField } from '../PolygonEditor';
import CompartmentPopup from '../CompartmentPopup';
import { ArrowLeft, CheckCircle2, ChevronRight, Circle, Download, MoreHorizontal, MousePointer2, Pencil, RotateCcw, Route, Scan, Trash2, Upload, X } from 'lucide-react';
import {
  estateBounds,
  buildBlockFeatureCollection,
  buildBlockLabelFeatureCollection,
  mapColors,
} from '../../data/mapboxEstateData';
import { allBlockDrillData } from '../../data/blockTreeData';

interface Props {
  drawnFields:           DrawnField[];
  selectedId:            string | null;
  onSelect:              (id: string) => void;
  onFieldsChange:        (fields: DrawnField[]) => void;
  defaultCompartmentId?: string | null;
  hideScanControls?:     boolean;
  defaultDrillBlockId?:  number;
}

type LayerStyle = 'satellite' | 'topo' | 'slope' | 'ndvi';

type BlockProperties = {
  id: string;
  name: string;
  status: string;
  palmCount: number;
  severity: number;
};

type AnnotationMode = 'select' | 'row' | 'palm';
type PalmStatus = 'healthy' | 'mild' | 'moderate' | 'severe';

type BlockPopupData = {
  name: string;
  status: string;
  hectares: number;
};

type RowAnnotation = {
  id: string;
  blockId: string;
  coordinates: [[number, number], [number, number]];
};

type PalmAnnotation = {
  id: string;
  blockId: string;
  coordinates: [number, number];
  status: PalmStatus;
};

type BlockAnnotations = {
  rows: RowAnnotation[];
  palms: PalmAnnotation[];
};

const ANNOTATION_STORAGE_KEY = 'palmscan_block_annotations';
const SCAN_RESULTS_KEY        = 'palmscan_scan_results';

function loadScanResults(): Record<string, Record<string, PalmStatus>> {
  try {
    const raw = localStorage.getItem(SCAN_RESULTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Record<string, PalmStatus>>) : {};
  } catch { return {}; }
}

function saveScanResult(compartmentId: string, overrides: Record<string, PalmStatus>) {
  try {
    const all = loadScanResults();
    all[compartmentId] = overrides;
    localStorage.setItem(SCAN_RESULTS_KEY, JSON.stringify(all));
  } catch {}
}

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

const PALM_COLORS: Record<PalmStatus, string> = {
  healthy: '#4ade80',
  mild: '#fbbf24',
  moderate: '#f97316',
  severe: '#ef4444',
};

// Vivid block-fill colors so severity is obvious inside a compartment
const BLOCK_COLORS: Record<string, string> = {
  healthy:  '#4ade80',
  warning:  '#facc15',
  moderate: '#fb923c',
  severe:   '#f87171',
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

function getPolygonBounds(coords: [number, number][]) {
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return {
    minLng: Math.min(...lngs),
    minLat: Math.min(...lats),
    maxLng: Math.max(...lngs),
    maxLat: Math.max(...lats),
  };
}

function pointInPolygon(point: [number, number], polygon: [number, number][]) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersects) inside = !inside;
  }

  return inside;
}

function getLongestEdgeAngle(coords: [number, number][]) {
  let bestAngle = 0;
  let bestLength = 0;

  for (let i = 0; i < coords.length - 1; i += 1) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);

    if (length > bestLength) {
      bestLength = length;
      bestAngle = Math.atan2(dy, dx);
    }
  }

  return bestAngle;
}

function generateCompartmentAnnotations(field: DrawnField): BlockAnnotations {
  const polygon = field.coordinates[0];
  const centroid = polygonCentroid(polygon);
  const angle = getLongestEdgeAngle(polygon);
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const vx = -uy;
  const vy = ux;

  const projected = polygon.map(([lng, lat]) => {
    const dx = lng - centroid[0];
    const dy = lat - centroid[1];
    return {
      t: dx * ux + dy * uy,
      o: dx * vx + dy * vy,
    };
  });

  const tMin = Math.min(...projected.map((p) => p.t));
  const tMax = Math.max(...projected.map((p) => p.t));
  const oMin = Math.min(...projected.map((p) => p.o));
  const oMax = Math.max(...projected.map((p) => p.o));
  const longSpan = tMax - tMin;
  const shortSpan = oMax - oMin;
  const rowCount = Math.max(4, Math.min(18, Math.round(shortSpan / Math.max(longSpan / 32, 0.00001))));
  const palmsPerRow = Math.max(6, Math.min(36, Math.round(longSpan / Math.max(shortSpan / 7, 0.00001))));
  const rowStep = shortSpan / (rowCount + 1);
  const palmStep = longSpan / (palmsPerRow + 1);
  const rows: RowAnnotation[] = [];
  const palms: PalmAnnotation[] = [];

  for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
    const offset = oMin + rowStep * rowIndex;
    const rowPoints: [number, number][] = [];

    for (let palmIndex = 1; palmIndex <= palmsPerRow; palmIndex += 1) {
      const along = tMin + palmStep * palmIndex;
      const point: [number, number] = [
        centroid[0] + ux * along + vx * offset,
        centroid[1] + uy * along + vy * offset,
      ];

      if (pointInPolygon(point, polygon)) {
        rowPoints.push(point);
        const centerBias = Math.abs(rowIndex - rowCount / 2) + Math.abs(palmIndex - palmsPerRow / 2) / 2;
        const status: PalmStatus = field.status === 'severe' && centerBias < rowCount * 0.18
          ? 'severe'
          : field.status === 'severe' && centerBias < rowCount * 0.28
            ? 'moderate'
            : 'healthy';

        palms.push({
          id: `${field.id}-P-${rowIndex}-${palmIndex}`,
          blockId: field.id,
          coordinates: point,
          status,
        });
      }
    }

    if (rowPoints.length >= 2) {
      rows.push({
        id: `${field.id}-R-${rowIndex}`,
        blockId: field.id,
        coordinates: [rowPoints[0], rowPoints[rowPoints.length - 1]],
      });
    }
  }

  return { rows, palms };
}

function loadAnnotations(): BlockAnnotations {
  if (typeof window === 'undefined') return { rows: [], palms: [] };
  try {
    const raw = localStorage.getItem(ANNOTATION_STORAGE_KEY);
    if (!raw) return { rows: [], palms: [] };
    const parsed = JSON.parse(raw) as Partial<BlockAnnotations>;
    return {
      rows: Array.isArray(parsed.rows) ? parsed.rows : [],
      palms: Array.isArray(parsed.palms) ? parsed.palms : [],
    };
  } catch {
    return { rows: [], palms: [] };
  }
}

function saveAnnotations(annotations: BlockAnnotations) {
  try {
    localStorage.setItem(ANNOTATION_STORAGE_KEY, JSON.stringify(annotations));
  } catch {
    // localStorage can fail in private browsing; the map should still work for the session.
  }
}

function buildBlockGeoJSON(field: DrawnField | null): GeoJSON.FeatureCollection<GeoJSON.Polygon, BlockProperties> {
  if (!field) return { type: 'FeatureCollection', features: [] };

  const { minLng, minLat, maxLng, maxLat } = getPolygonBounds(field.coordinates[0]);
  const width = maxLng - minLng;
  const height = maxLat - minLat;
  const padX = width * 0.08;
  const padY = height * 0.08;
  const gapX = width * 0.025;
  const gapY = height * 0.025;
  const cols = 2;
  const rows = 3;
  const blockWidth = (width - padX * 2 - gapX * (cols - 1)) / cols;
  const blockHeight = (height - padY * 2 - gapY * (rows - 1)) / rows;
  const statusOrder = ['healthy', 'warning', 'moderate', 'severe'];
  const baseIndex = Math.max(0, statusOrder.indexOf(field.status));

  const features: GeoJSON.Feature<GeoJSON.Polygon, BlockProperties>[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      const x1 = minLng + padX + col * (blockWidth + gapX);
      const y1 = minLat + padY + row * (blockHeight + gapY);
      const x2 = x1 + blockWidth;
      const y2 = y1 + blockHeight;
      const status = statusOrder[Math.min(statusOrder.length - 1, Math.max(0, baseIndex + ((index % 3) - 1)))];
      const severity = Math.min(96, Math.max(8, 18 + baseIndex * 22 + index * 5));

      features.push({
        type: 'Feature',
        properties: {
          id: `${field.id}-B${index + 1}`,
          name: `Block ${index + 1}`,
          status,
          palmCount: 76 + index * 11,
          severity,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [x1, y1],
            [x2, y1],
            [x2, y2],
            [x1, y2],
            [x1, y1],
          ]],
        },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

function buildBlockLabelGeoJSON(blocks: GeoJSON.FeatureCollection<GeoJSON.Polygon, BlockProperties>): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: blocks.features.map((feature) => ({
      type: 'Feature',
      properties: feature.properties,
      geometry: { type: 'Point', coordinates: polygonCentroid(feature.geometry.coordinates[0] as [number, number][]) },
    })),
  };
}

function buildPalmRowGeoJSON(blocks: GeoJSON.FeatureCollection<GeoJSON.Polygon, BlockProperties>): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];

  blocks.features.forEach((block) => {
    const bounds = getPolygonBounds(block.geometry.coordinates[0] as [number, number][]);
    const rowCount = 5;
    for (let i = 1; i <= rowCount; i += 1) {
      const y = bounds.minLat + ((bounds.maxLat - bounds.minLat) / (rowCount + 1)) * i;
      features.push({
        type: 'Feature',
        properties: { blockId: block.properties.id, row: i },
        geometry: {
          type: 'LineString',
          coordinates: [
            [bounds.minLng + (bounds.maxLng - bounds.minLng) * 0.06, y],
            [bounds.maxLng - (bounds.maxLng - bounds.minLng) * 0.06, y],
          ],
        },
      });
    }
  });

  return { type: 'FeatureCollection', features };
}

function buildUserRowGeoJSON(annotations: BlockAnnotations, visibleBlockIds: Set<string>): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: annotations.rows
      .filter((row) => visibleBlockIds.has(row.blockId))
      .map((row) => ({
        type: 'Feature',
        properties: { id: row.id, blockId: row.blockId },
        geometry: { type: 'LineString', coordinates: row.coordinates },
      })),
  };
}

function buildUserPalmGeoJSON(annotations: BlockAnnotations, visibleBlockIds: Set<string>): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: annotations.palms
      .filter((palm) => visibleBlockIds.has(palm.blockId))
      .map((palm) => ({
        type: 'Feature',
        properties: { id: palm.id, blockId: palm.blockId, status: palm.status },
        geometry: { type: 'Point', coordinates: palm.coordinates },
      })),
  };
}

// ── Hardcoded stress detection ───────────────────────────────────────────────
// Edit the rules inside here to tune what the drone flags as stressed.
function detectStressZones(fields: DrawnField[]): string[] {
  const stressed: string[] = [];
  for (const f of fields) {
    if (f.status === 'severe')   { stressed.push(f.id); continue; }
    if (f.status === 'moderate') { stressed.push(f.id); continue; }
    if (f.status === 'warning' && f.disease !== 'None') { stressed.push(f.id); continue; }
    // Add more rules here, e.g.:
    // if (f.disease === 'Ganoderma') { stressed.push(f.id); continue; }
  }
  return stressed;
}

function buildStressGeoJSON(fields: DrawnField[], stressedIds: string[]): GeoJSON.FeatureCollection {
  const set = new Set(stressedIds);
  return {
    type: 'FeatureCollection',
    features: fields
      .filter((f) => set.has(f.id))
      .map((f) => ({
        type: 'Feature' as const,
        properties: { id: f.id, name: f.name },
        geometry: { type: 'Polygon' as const, coordinates: f.coordinates },
      })),
  };
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

export function triggerDroneScan() {
  window.dispatchEvent(new CustomEvent('palmscan:trigger-drone-scan'));
}

export default function MapView({ drawnFields, selectedId, onSelect, onFieldsChange, defaultCompartmentId, hideScanControls = false, defaultDrillBlockId }: Props) {
  const containerRef     = useRef<HTMLDivElement>(null);
  const mapRef           = useRef<mapboxgl.Map | null>(null);
  const drawRef          = useRef<MapboxDraw | null>(null);
  const importInputRef   = useRef<HTMLInputElement>(null);
  const drawnFieldsRef      = useRef<DrawnField[]>(drawnFields);
  const scanIntervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const treeScanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanCompleteRef        = useRef(false);
  const defaultDrillAppliedRef = useRef(false);
  const activeCompartmentIdRef = useRef<string | null>(null);
  const activeBlockIdRef = useRef<string | null>(null);
  const annotationModeRef = useRef<AnnotationMode>('select');
  const palmStatusRef = useRef<PalmStatus>('healthy');
  const rowStartRef = useRef<[number, number] | null>(null);

  const [activeLayer,    setActiveLayer]    = useState<LayerStyle>('satellite');
  const [mapReady,       setMapReady]       = useState(false);
  const [drawMode,       setDrawMode]       = useState(false);
  const [saveToast,      setSaveToast]      = useState(false);
  const [activeCompartmentId, setActiveCompartmentId] = useState<string | null>(defaultCompartmentId ?? null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>('select');
  const [palmStatus, setPalmStatus] = useState<PalmStatus>('healthy');
  const [rowStart, setRowStart] = useState<[number, number] | null>(null);
  const [annotations,   setAnnotations]   = useState<BlockAnnotations>(() => loadAnnotations());
  const [scanning,           setScanning]           = useState(false);
  const [scanComplete,       setScanComplete]       = useState(() => {
    try { return localStorage.getItem('palmscan_scan_done') === 'true'; } catch { return false; }
  });
  const [showDroneScanPanel, setShowDroneScanPanel] = useState(false);
  const [stressZones,        setStressZones]        = useState<string[]>([]);
  const [treeScanActive,      setTreeScanActive]      = useState(false);
  const [treeScanDone,        setTreeScanDone]        = useState(false);
  const [treeScanProgress,    setTreeScanProgress]    = useState(0);
  const [palmStatusOverrides, setPalmStatusOverrides] = useState<Record<string, PalmStatus>>({});
  // editingFeature → PolygonEditor open (drawing new or editing existing)
  const [editingFeature, setEditingFeature] = useState<{ id: string; coordinates: [number, number][][] } | null>(null);
  // viewingFieldId → CompartmentPopup open (read-only info)
  const [viewingFieldId, setViewingFieldId] = useState<string | null>(null);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [blockPopup, setBlockPopup] = useState<BlockPopupData | null>(null);
  const [drillBlockId, setDrillBlockId] = useState<number | null>(null);
  const drillBlockIdRef = useRef<number | null>(null);
  const [tlsScanPhase, setTlsScanPhase] = useState<'idle' | 'scanning' | 'animating' | 'done'>('idle');
  const [tlsScanProgress, setTlsScanProgress] = useState(0);
  const tlsScanPhaseRef = useRef<'idle' | 'scanning' | 'animating' | 'done'>('idle');
  const scannedBlocksRef = useRef<Set<number>>(new Set());
  const tlsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [fullScanPhase, setFullScanPhase] = useState<'idle' | 'scanning' | 'done'>(() => {
    try { return localStorage.getItem('palmscan_fulltls_done') === 'true' ? 'done' : 'idle'; } catch { return 'idle'; }
  });
  const [fullScanProgress, setFullScanProgress] = useState(0);

  const fullScanPhaseRef = useRef<'idle' | 'scanning' | 'done'>('idle');
  const fullScanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { drawnFieldsRef.current = drawnFields; }, [drawnFields]);
  useEffect(() => { activeCompartmentIdRef.current = activeCompartmentId; }, [activeCompartmentId]);
  useEffect(() => { activeBlockIdRef.current = activeBlockId; }, [activeBlockId]);
  useEffect(() => { annotationModeRef.current = annotationMode; }, [annotationMode]);
  useEffect(() => { palmStatusRef.current = palmStatus; }, [palmStatus]);
  useEffect(() => { rowStartRef.current = rowStart; }, [rowStart]);
  useEffect(() => { drillBlockIdRef.current = drillBlockId; }, [drillBlockId]);

  // ── Persist drillBlockId to localStorage so the map state survives navigation ─
  useEffect(() => {
    try {
      if (drillBlockId !== null) localStorage.setItem('palmscan_drill_block_id', String(drillBlockId));
      else localStorage.removeItem('palmscan_drill_block_id');
    } catch {}
  }, [drillBlockId]);

  // ── Seed scannedBlocksRef from localStorage on first mount ───────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem('palmscan_tls_scanned');
      if (raw) (JSON.parse(raw) as number[]).forEach((id) => scannedBlocksRef.current.add(id));
    } catch {}
  }, []);

  // ── Auto-drill: prop (audit report) OR localStorage (estate scan restore) ────
  useEffect(() => {
    if (!mapReady || defaultDrillAppliedRef.current) return;
    defaultDrillAppliedRef.current = true;

    if (defaultDrillBlockId != null) {
      scannedBlocksRef.current.add(defaultDrillBlockId);
      setDrillBlockId(defaultDrillBlockId);
      return;
    }

    // Restore saved drill state for the estate scan page
    try {
      const savedId = localStorage.getItem('palmscan_drill_block_id');
      if (savedId !== null) {
        const blockId = Number(savedId);
        if (allBlockDrillData[blockId] && scannedBlocksRef.current.has(blockId)) {
          setDrillBlockId(blockId);
        }
      }
    } catch {}
  }, [mapReady, defaultDrillBlockId]);
  useEffect(() => { tlsScanPhaseRef.current = tlsScanPhase; }, [tlsScanPhase]);
  useEffect(() => {
    const data = drillBlockId !== null && tlsScanPhase === 'done' ? allBlockDrillData[drillBlockId] ?? null : null;
    window.dispatchEvent(new CustomEvent('palmscan:block-drill-update', { detail: { blockId: drillBlockId, phase: tlsScanPhase, data } }));
  }, [drillBlockId, tlsScanPhase]);
  useEffect(() => { fullScanPhaseRef.current = fullScanPhase; }, [fullScanPhase]);

  // ── Restore estate dots + scannedBlocksRef when map loads after a previous full TLS scan ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || fullScanPhase !== 'done') return;
    // Pre-populate estate-dots source so drill-in shows cached dots instantly
    const allFeatures = Object.values(allBlockDrillData).flatMap((d) => d.trees.features);
    const estateSrc = map.getSource('estate-dots') as mapboxgl.GeoJSONSource | undefined;
    if (estateSrc) estateSrc.setData({ type: 'FeatureCollection', features: allFeatures } as GeoJSON.GeoJSON);
    // Layer stays hidden in estate view — dots only appear on block drill-in via tls-tree-dots
    Object.keys(allBlockDrillData).forEach((id) => scannedBlocksRef.current.add(Number(id)));
  }, [mapReady, fullScanPhase]);

  // ── Restore revealed block colors after drone scan (persists to Page 2) ────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !scanComplete) return;
    const blockSrc = map.getSource('compartment-blocks') as mapboxgl.GeoJSONSource | undefined;
    const labelSrc = map.getSource('block-labels')       as mapboxgl.GeoJSONSource | undefined;
    if (blockSrc) blockSrc.setData(buildBlockFeatureCollection(true));
    if (labelSrc) labelSrc.setData(buildBlockLabelFeatureCollection(true));
  }, [mapReady, scanComplete]);

  useEffect(() => { saveAnnotations(annotations); }, [annotations]);
  useEffect(() => {
    scanCompleteRef.current = scanComplete;
    try { localStorage.setItem('palmscan_scan_done', String(scanComplete)); } catch {}
    window.dispatchEvent(new CustomEvent('palmscan:scan-update', { detail: { scanComplete, scanning } }));
  }, [scanComplete, scanning]);



  useEffect(() => {
    window.dispatchEvent(new CustomEvent('palmscan:treescan-update', {
      detail: { treeScanActive, treeScanDone, treeScanProgress },
    }));
  }, [treeScanActive, treeScanDone, treeScanProgress]);

  // ── Sync custom compartment layers when drawnFields changes ──────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const compSource = map.getSource('compartments') as mapboxgl.GeoJSONSource | undefined;
    const lblSource  = map.getSource('compartment-labels') as mapboxgl.GeoJSONSource | undefined;
    if (compSource) compSource.setData(buildCompartmentGeoJSON(drawnFields));
    if (lblSource)  lblSource.setData(buildLabelGeoJSON(drawnFields));
  }, [drawnFields, mapReady]);


  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const visibleBlockIds = activeCompartmentId ? new Set([activeCompartmentId]) : new Set<string>();
    const rowSource  = map.getSource('user-row-lines') as mapboxgl.GeoJSONSource | undefined;
    const palmSource = map.getSource('user-palm-dots') as mapboxgl.GeoJSONSource | undefined;

    if (rowSource) rowSource.setData(buildUserRowGeoJSON(annotations, visibleBlockIds));
    if (palmSource) {
      const palmData = buildUserPalmGeoJSON(annotations, visibleBlockIds);
      const hasScanColors = Object.keys(palmStatusOverrides).length > 0;
      // Inside a compartment: show healthy until scan runs, then apply overrides
      if (activeCompartmentId) {
        palmData.features = palmData.features.map((f) => ({
          ...f,
          properties: {
            ...f.properties,
            status: hasScanColors
              ? (palmStatusOverrides[f.properties?.id as string] ?? 'healthy')
              : 'healthy',
          },
        }));
      }
      palmSource.setData(palmData);
    }
  }, [annotations, activeCompartmentId, drawnFields, mapReady, palmStatusOverrides]); // palmStatusOverrides drives scan coloring

  // ── Load/clear tree-scan results when entering or leaving a compartment ───────
  useEffect(() => {
    if (!activeCompartmentId) {
      setPalmStatusOverrides({});
      setTreeScanDone(false);
      setTreeScanActive(false);
      setTreeScanProgress(0);
      if (treeScanIntervalRef.current) {
        clearInterval(treeScanIntervalRef.current);
        treeScanIntervalRef.current = null;
      }
      return;
    }
    // Restore saved scan result if one exists, otherwise start fresh (all-green)
    const saved = loadScanResults()[activeCompartmentId];
    if (saved && Object.keys(saved).length > 0) {
      setPalmStatusOverrides(saved);
      setTreeScanDone(true);
    } else {
      setPalmStatusOverrides({});
      setTreeScanDone(false);
    }
  }, [activeCompartmentId]);

  // ── Reveal danger colors + stress overlay only after drone scan ──────────────
  // Skip while drilled into a compartment so tree-scan cannot affect estate colors.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (activeCompartmentId) return;

    // Compartment fill/outline: all-green before scan, binary after
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const binaryColor: any = scanComplete
      ? ['case', ['==', ['get', 'status'], 'healthy'], '#166534', '#7f1d1d']
      : '#166534';
    if (map.getLayer('comp-fill'))    map.setPaintProperty('comp-fill',    'fill-color', binaryColor);
    if (map.getLayer('comp-outline')) map.setPaintProperty('comp-outline', 'line-color', binaryColor);

    // Stress overlay: only populate after scan
    const stressSrc = map.getSource('stress-zones') as mapboxgl.GeoJSONSource | undefined;
    if (stressSrc) {
      stressSrc.setData(
        scanComplete
          ? buildStressGeoJSON(drawnFields, detectStressZones(drawnFields))
          : { type: 'FeatureCollection', features: [] }
      );
    }

  }, [scanComplete, drawnFields, mapReady, activeCompartmentId]);

  // ── Hide stress overlay when drilling into a compartment ─────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const vis = activeCompartmentId ? 'none' : 'visible';
    if (map.getLayer('stress-fill'))    map.setLayoutProperty('stress-fill',    'visibility', vis);
    if (map.getLayer('stress-outline')) map.setLayoutProperty('stress-outline', 'visibility', vis);
  }, [activeCompartmentId, mapReady]);

  // ── Block drill-down: zoom to block then run TLS scan sequence ───────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Always cancel any in-flight scan and reset panel state immediately
    if (tlsIntervalRef.current) { clearInterval(tlsIntervalRef.current); tlsIntervalRef.current = null; }
    setTlsScanPhase('idle');
    setTlsScanProgress(0);
    if (map.getLayer('tls-tree-dots')) map.setLayoutProperty('tls-tree-dots', 'visibility', 'none');
    const prevDotsSrc = map.getSource('tls-tree-dots') as mapboxgl.GeoJSONSource | undefined;
    if (prevDotsSrc) prevDotsSrc.setData({ type: 'FeatureCollection', features: [] });
    if (map.getLayer('tls-scan-line')) map.setLayoutProperty('tls-scan-line', 'visibility', 'none');

    if (drillBlockId !== null) {
      // Hide estate-wide dots while inside a single block
      if (map.getLayer('estate-dots')) map.setLayoutProperty('estate-dots', 'visibility', 'none');
      const data = allBlockDrillData[drillBlockId];
      if (!data) return;
      map.fitBounds(data.bounds, {
        padding: { top: 80, bottom: 100, left: 80, right: 340 },
        maxZoom: 17,
        duration: 800,
      });
      // Wait for zoom to settle, then run TLS scan
      const t = setTimeout(() => runTlsScanSequence(drillBlockId), 900);
      return () => clearTimeout(t);
    } else {
      // Returning to estate view
      if (!activeCompartmentIdRef.current) {
        map.fitBounds(estateBounds, { padding: 40, duration: 800 });
      }
      // estate-dots intentionally kept hidden in estate view — dots only show on block drill-in
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillBlockId, mapReady]);

  // ── Exit drill mode if scan is reset ─────────────────────────────────────────
  useEffect(() => {
    if (!scanComplete) setDrillBlockId(null);
  }, [scanComplete]);


  function addScanLayers(map: mapboxgl.Map) {
    if (map.getSource('scan-swath')) return;

    map.addSource('scan-swath',  { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('stress-zones', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    // Animated scan swath — cyan sweep
    map.addLayer({ id: 'scan-swath-fill', type: 'fill', source: 'scan-swath',
      paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.18 } });
    map.addLayer({ id: 'scan-swath-line', type: 'line', source: 'scan-swath',
      paint: { 'line-color': '#38bdf8', 'line-width': 2.5, 'line-opacity': 0.95 } });

    // Stress zone overlay — solid red fill + outline
    map.addLayer({ id: 'stress-fill', type: 'fill', source: 'stress-zones',
      paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.42 } });
    map.addLayer({ id: 'stress-outline', type: 'line', source: 'stress-zones',
      paint: { 'line-color': '#ef4444', 'line-width': 3, 'line-opacity': 1 } });
  }

  function addBlockLayers(map: mapboxgl.Map) {
    if (map.getSource('compartment-blocks')) return;

    map.addSource('compartment-blocks', { type: 'geojson', data: buildBlockFeatureCollection(false) });
    map.addSource('block-labels',       { type: 'geojson', data: buildBlockLabelFeatureCollection(false) });
    map.addSource('user-row-lines', { type: 'geojson', data: buildUserRowGeoJSON({ rows: [], palms: [] }, new Set()) });
    map.addSource('user-palm-dots', { type: 'geojson', data: buildUserPalmGeoJSON({ rows: [], palms: [] }, new Set()) });

    map.addLayer({
      id: 'block-fill',
      type: 'fill',
      source: 'compartment-blocks',
      paint: {
        'fill-color': ['match', ['get', 'status'],
          'No visible severe canopy anomaly', mapColors.clear,
          'Early stage monitoring',           mapColors.monitor,
          'TLS confirmation required',        mapColors.flagged,
          mapColors.neutral,
        ],
        'fill-opacity': 0.55,
      },
    });

    map.addLayer({
      id: 'block-outline',
      type: 'line',
      source: 'compartment-blocks',
      paint: {
        'line-color': '#f8fafc',
        'line-width': 1.6,
        'line-opacity': 0.8,
      },
    });

    map.addLayer({
      id: 'block-selected',
      type: 'line',
      source: 'compartment-blocks',
      filter: ['==', ['get', 'id'], ''],
      paint: { 'line-color': '#e07c3a', 'line-width': 3, 'line-gap-width': 1.5 },
    });

    map.addLayer({
      id: 'block-labels',
      type: 'symbol',
      source: 'block-labels',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 9, 17, 12],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-line-height': 1.2,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0,0,0,0.7)',
        'text-halo-width': 1.4,
      },
    });

    map.addLayer({
      id: 'user-row-lines',
      type: 'line',
      source: 'user-row-lines',
      paint: {
        'line-color': '#38bdf8',
        'line-width': 3,
        'line-opacity': 0.95,
      },
    });

    map.addLayer({
      id: 'user-palm-dots',
      type: 'circle',
      source: 'user-palm-dots',
      paint: {
        'circle-radius': ['case', ['==', ['get', 'status'], 'severe'], 7, 5.5],
        'circle-color': ['match', ['get', 'status'],
          'healthy', PALM_COLORS.healthy,
          'mild', PALM_COLORS.mild,
          'moderate', PALM_COLORS.moderate,
          'severe', PALM_COLORS.severe,
          '#ffffff',
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.4,
      },
    });

    // ── TLS scan sweep line (animates top→bottom during phase 1) ─────────
    map.addSource('tls-scan-line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: 'tls-scan-line',
      type: 'line',
      source: 'tls-scan-line',
      layout: { visibility: 'none' },
      paint: {
        'line-color': '#34d399',
        'line-width': 3,
        'line-opacity': 1,
        'line-blur': 1,
      },
    });

    // ── TLS tree dots (per-block, animated row-by-row during phase 2) ────
    map.addSource('tls-tree-dots', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: 'tls-tree-dots',
      type: 'circle',
      source: 'tls-tree-dots',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 1.2, 15, 2.5, 17, 4.5, 19, 7],
        'circle-color': ['match', ['get', 'status'],
          'healthy',  '#4ade80',
          'mild',     '#fbbf24',
          'moderate', '#f97316',
          'severe',   '#ef4444',
          '#ffffff',
        ],
        'circle-stroke-color': 'rgba(0,0,0,0.25)',
        'circle-stroke-width': 0.6,
        'circle-opacity': 0.85,
      },
    });

    // ── Estate-wide dots (all 12 blocks, shown after full TLS scan) ───────
    map.addSource('estate-dots', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: 'estate-dots',
      type: 'circle',
      source: 'estate-dots',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 1.0, 15, 2.0, 17, 3.5, 19, 6],
        'circle-color': ['match', ['get', 'status'],
          'healthy',  '#4ade80',
          'mild',     '#fbbf24',
          'moderate', '#f97316',
          'severe',   '#ef4444',
          '#ffffff',
        ],
        'circle-stroke-color': 'rgba(0,0,0,0.2)',
        'circle-stroke-width': 0.5,
        'circle-opacity': 0.8,
      },
    });

    map.on('mousemove', 'block-fill', () => {
      map.getCanvas().style.cursor = 'zoom-in';
    });

    map.on('mouseleave', 'block-fill', () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('click', 'block-fill', (e) => {
      if (annotationModeRef.current !== 'select') return;
      const props = e.features?.[0]?.properties as { id: string; name: string; status: string; hectares: number } | undefined;
      const geometry = e.features?.[0]?.geometry;
      if (!props || !geometry || geometry.type !== 'Polygon') return;

      if (!activeCompartmentIdRef.current) {
        // Any block after drone scan → TLS drill-down
        if (scanCompleteRef.current) {
          setBlockPopup(null);
          setDrillBlockId(Number(props.id));
          return;
        }
        // Estate view (pre-scan) — show info popup
        setBlockPopup({ name: props.name, status: props.status, hectares: props.hectares });
        return;
      }

      // Inside compartment — existing drill-in behaviour
      setBlockPopup(null);
      setActiveBlockId(props.id);
      setAnnotationMode('select');
      setRowStart(null);
      map.setFilter('block-selected', ['==', ['get', 'id'], props.id]);
      const coords = (geometry as GeoJSON.Polygon).coordinates[0] as [number, number][];
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      map.fitBounds(
        new mapboxgl.LngLatBounds([Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]),
        { padding: 120, maxZoom: 19, duration: 650 }
      );
    });

    // Click on empty map — close popup; exit drill mode if active
    map.on('click', (e) => {
      const hit = map.queryRenderedFeatures(e.point, { layers: ['block-fill'] });
      if (hit.length === 0) {
        setBlockPopup(null);
        if (drillBlockIdRef.current !== null) setDrillBlockId(null);
      }
    });
  }

  // ── Add compartment + label layers ──────────────────────────────────────────
  function addCompartmentLayers(map: mapboxgl.Map, fields: DrawnField[]) {
    if (map.getSource('compartments')) return;

    map.addSource('compartments', { type: 'geojson', data: buildCompartmentGeoJSON(fields) });
    map.addSource('compartment-labels', { type: 'geojson', data: buildLabelGeoJSON(fields) });

    // Fill — starts all-green; turns binary after drone scan
    map.addLayer({
      id: 'comp-fill',
      type: 'fill',
      source: 'compartments',
      paint: {
        'fill-color': '#166534',
        'fill-opacity': ['case', ['==', ['get', 'id'], selectedId ?? ''], 0.55, 0.35],
      },
    });

    // Outline — starts all-green; turns binary after drone scan
    map.addLayer({
      id: 'comp-outline',
      type: 'line',
      source: 'compartments',
      paint: {
        'line-color': '#166534',
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
      if (activeCompartmentIdRef.current === fid) {
        setActiveBlockId(fid);
        return;
      }
      onSelect(fid);
      setActiveCompartmentId(fid);
      setActiveBlockId(fid);
      setAnnotationMode('select');
      setRowStart(null);
      setViewingFieldId(null);
      setEditingFeature(null);
    });
  }

  // ── Init map ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE_URLS.satellite,
      center: [103.398736, 2.117582],
      zoom: 14,
      maxZoom: 21,
    });

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      styles: DRAW_STYLES,
    });

    map.addControl(draw, 'top-left');
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    drawRef.current = draw;

    map.on('load', () => {
      map.fitBounds(estateBounds, { padding: 40 });
      addCompartmentLayers(map, drawnFieldsRef.current);
      addBlockLayers(map);
      addScanLayers(map);

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

    map.on('click', (e) => {
      const blockId = activeBlockIdRef.current;
      const mode = annotationModeRef.current;

      // Annotation drawing — only when a block is active and in draw mode
      if (blockId && mode !== 'select') {
        const point: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        if (mode === 'palm') {
          const id = `${blockId}-P-${Date.now()}`;
          setAnnotations((prev) => ({
            ...prev,
            palms: [...prev.palms, { id, blockId, coordinates: point, status: palmStatusRef.current }],
          }));
          return;
        }
        const start = rowStartRef.current;
        if (!start) { setRowStart(point); return; }
        const id = `${blockId}-R-${Date.now()}`;
        setAnnotations((prev) => ({
          ...prev,
          rows: [...prev.rows, { id, blockId, coordinates: [start, point] }],
        }));
        setRowStart(null);
        return;
      }

      // Click on empty map space → exit compartment / block view
      if (activeCompartmentIdRef.current) {
        const hits = map.queryRenderedFeatures(e.point, { layers: ['comp-fill'] });
        if (hits.length === 0) {
          setActiveCompartmentId(null);
          setActiveBlockId(null);
          setAnnotationMode('select');
          setRowStart(null);
        }
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (map.getLayer('block-selected')) map.setFilter('block-selected', ['==', ['get', 'id'], activeBlockId ?? '']);
  }, [activeBlockId, mapReady]);

  // ── Fly to selected compartment ───────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId || !mapReady) return;
    if (activeCompartmentId) return;
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

  useEffect(() => {
    if (!activeCompartmentId || !mapReady) return;
    const field = drawnFields.find((f) => f.id === activeCompartmentId);
    if (!field) return;
    const coords = field.coordinates[0];
    const lngs = coords.map((c) => c[0]);
    const lats  = coords.map((c) => c[1]);
    mapRef.current?.fitBounds(
      new mapboxgl.LngLatBounds([Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]),
      { padding: 80, maxZoom: 17.25, duration: 850 }
    );
  }, [activeCompartmentId, drawnFields, mapReady]);

  // ── Basemap switch ────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.once('styledata', () => {
      addCompartmentLayers(map, drawnFieldsRef.current);
      addBlockLayers(map);
      addScanLayers(map);
      const revealed = scanCompleteRef.current;
      const blockSource = map.getSource('compartment-blocks') as mapboxgl.GeoJSONSource | undefined;
      const labelSource = map.getSource('block-labels')       as mapboxgl.GeoJSONSource | undefined;
      if (blockSource) blockSource.setData(buildBlockFeatureCollection(revealed));
      if (labelSource) labelSource.setData(buildBlockLabelFeatureCollection(revealed));
      const visibleBlockIds = activeCompartmentId ? new Set([activeCompartmentId]) : new Set<string>();
      const userRowSource = map.getSource('user-row-lines') as mapboxgl.GeoJSONSource | undefined;
      const userPalmSource = map.getSource('user-palm-dots') as mapboxgl.GeoJSONSource | undefined;
      if (userRowSource) userRowSource.setData(buildUserRowGeoJSON(annotations, visibleBlockIds));
      if (userPalmSource) userPalmSource.setData(buildUserPalmGeoJSON(annotations, visibleBlockIds));
      if (map.getLayer('block-selected')) map.setFilter('block-selected', ['==', ['get', 'id'], activeBlockId ?? '']);
      // Restore TLS dots if in drill mode and scan was complete
      const drillId = drillBlockIdRef.current;
      if (drillId !== null && allBlockDrillData[drillId] && tlsScanPhaseRef.current === 'done') {
        const drillData = allBlockDrillData[drillId];
        const dotsSrc = map.getSource('tls-tree-dots') as mapboxgl.GeoJSONSource | undefined;
        if (dotsSrc) dotsSrc.setData(drillData.trees as GeoJSON.GeoJSON);
        if (map.getLayer('tls-tree-dots')) map.setLayoutProperty('tls-tree-dots', 'visibility', 'visible');
      }
      // estate-dots intentionally kept hidden — dots only show on block drill-in
    });
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
      setActiveCompartmentId(null);
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

  // ── Reset demo colors only ────────────────────────────────────────────────────
  // Clears scan colors (compartments back to all-green, dots back to all-green).
  // Compartments, annotations, and row/palm data are preserved.
  const handleReset = useCallback(() => {
    if (!confirm('Reset scan colors? Compartments and annotations will be kept.')) return;

    // Stop any running scan intervals
    if (scanIntervalRef.current)     { clearInterval(scanIntervalRef.current);     scanIntervalRef.current = null; }
    if (treeScanIntervalRef.current) { clearInterval(treeScanIntervalRef.current); treeScanIntervalRef.current = null; }

    // Clear persisted scan state
    try { localStorage.removeItem(SCAN_RESULTS_KEY); } catch {}
    try { localStorage.removeItem('palmscan_scan_done'); } catch {}
    try { localStorage.removeItem('palmscan_fulltls_done'); } catch {}
    try { localStorage.removeItem('palmscan_tls_scanned'); } catch {}
    try { localStorage.removeItem('palmscan_drill_block_id'); } catch {}

    // Exit any compartment/draw view so the full toolbar is visible
    const draw = drawRef.current;
    if (draw) draw.changeMode('simple_select');
    setDrawMode(false);
    setActiveCompartmentId(null);
    setActiveBlockId(null);
    setAnnotationMode('select');
    setRowStart(null);

    // Reset color-related state only
    setScanComplete(false);
    setShowDroneScanPanel(false);
    setStressZones([]);
    setPalmStatusOverrides({});
    setTreeScanDone(false);
    setTreeScanActive(false);
    setTreeScanProgress(0);
    setScanning(false);
    setDrillBlockId(null);
    setTlsScanPhase('idle');
    setTlsScanProgress(0);
    scannedBlocksRef.current.clear();
    if (tlsIntervalRef.current) { clearInterval(tlsIntervalRef.current); tlsIntervalRef.current = null; }
    setFullScanPhase('idle');
    setFullScanProgress(0);
    if (fullScanIntervalRef.current) { clearInterval(fullScanIntervalRef.current); fullScanIntervalRef.current = null; }
    const map = mapRef.current;
    if (map) {
      // Clear estate-wide dots
      const estateSrc = map.getSource('estate-dots') as mapboxgl.GeoJSONSource | undefined;
      if (estateSrc) estateSrc.setData({ type: 'FeatureCollection', features: [] });
      if (map.getLayer('estate-dots')) map.setLayoutProperty('estate-dots', 'visibility', 'none');
      // Reset block colors to neutral (pre-scan state)
      const blockSrc = map.getSource('compartment-blocks') as mapboxgl.GeoJSONSource | undefined;
      const labelSrc = map.getSource('block-labels')       as mapboxgl.GeoJSONSource | undefined;
      if (blockSrc) blockSrc.setData(buildBlockFeatureCollection(false));
      if (labelSrc) labelSrc.setData(buildBlockLabelFeatureCollection(false));
    }

    // Notify the rest of the app (EstateScanPage pipeline, infographic, etc.)
    window.dispatchEvent(new CustomEvent('palmscan:reset'));

    // Fit map back to estate view
    const fields = drawnFieldsRef.current;
    if (fields.length) {
      const points = fields.flatMap((f) => f.coordinates[0]);
      const lngs = points.map((p) => p[0]);
      const lats = points.map((p) => p[1]);
      mapRef.current?.fitBounds(
        new mapboxgl.LngLatBounds([Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]),
        { padding: 120, maxZoom: 14.5, duration: 750 }
      );
    }
  }, []);

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

  // ── Import GeoJSON ────────────────────────────────────────────────────────────
  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const fc = JSON.parse(evt.target?.result as string) as GeoJSON.FeatureCollection;
        if (fc.type !== 'FeatureCollection') return;

        const VALID_STATUS  = new Set(['healthy', 'warning', 'moderate', 'severe']);
        const VALID_DISEASE = new Set(['None', 'Leaf Spot', 'Ganoderma', 'Bud Rot', 'Crown Disease']);

        const imported: DrawnField[] = fc.features
          .filter((f) => f.geometry?.type === 'Polygon')
          .map((f) => {
            const p = f.properties ?? {};
            const drawId = (f.id as string) || `imported-${Date.now()}-${Math.random()}`;
            return {
              drawId,
              id:       String(p.id   ?? drawId),
              name:     String(p.name ?? 'Imported'),
              status:   VALID_STATUS .has(p.status)  ? p.status  as DrawnField['status']  : 'healthy',
              disease:  VALID_DISEASE.has(p.disease) ? p.disease as DrawnField['disease'] : 'None',
              coordinates: (f.geometry as GeoJSON.Polygon).coordinates as [number, number][][],
            };
          });

        if (!imported.length) return;

        // Merge with existing (skip any whose drawId already exists)
        const existing = new Set(drawnFieldsRef.current.map((f) => f.drawId));
        const fresh    = imported.filter((f) => !existing.has(f.drawId));
        const next     = [...drawnFieldsRef.current, ...fresh];
        onFieldsChange(next);

        // Register with GL Draw so they can be edited
        const draw = drawRef.current;
        if (draw) {
          draw.add({
            type: 'FeatureCollection',
            features: fresh.map((f) => ({
              id:         f.drawId,
              type:       'Feature' as const,
              properties: {},
              geometry:   { type: 'Polygon' as const, coordinates: f.coordinates },
            })),
          });
        }

        // Fly to the imported polygons
        const pts  = fresh.flatMap((f) => f.coordinates[0]);
        if (pts.length) {
          const lngs = pts.map((c) => c[0]);
          const lats  = pts.map((c) => c[1]);
          mapRef.current?.fitBounds(
            new mapboxgl.LngLatBounds([Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]),
            { padding: 120, maxZoom: 15, duration: 800 }
          );
        }
      } catch {
        // silently ignore malformed files
      } finally {
        // reset so the same file can be re-imported if needed
        if (importInputRef.current) importInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  }, [onFieldsChange]);

  const handleBackToEstate = useCallback(() => {
    setActiveCompartmentId(null);
    setActiveBlockId(null);
    setAnnotationMode('select');
    setRowStart(null);
    const fields = drawnFieldsRef.current;
    if (!fields.length) return;

    const points = fields.flatMap((field) => field.coordinates[0]);
    const lngs = points.map((point) => point[0]);
    const lats = points.map((point) => point[1]);
    mapRef.current?.fitBounds(
      new mapboxgl.LngLatBounds([Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]),
      { padding: 120, maxZoom: 14.5, duration: 750 }
    );
  }, []);

  const handleBackToBlocks = useCallback(() => {
    setActiveBlockId(null);
    setAnnotationMode('select');
    setRowStart(null);

    const field = drawnFieldsRef.current.find((f) => f.id === activeCompartmentIdRef.current);
    if (!field) return;
    const coords = field.coordinates[0];
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    mapRef.current?.fitBounds(
      new mapboxgl.LngLatBounds([Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]),
      { padding: 80, maxZoom: 17.25, duration: 650 }
    );
  }, []);

  const handleUndoAnnotation = useCallback(() => {
    if (!activeBlockId) return;
    setAnnotations((prev) => {
      const blockRows = prev.rows.filter((row) => row.blockId === activeBlockId);
      const blockPalms = prev.palms.filter((palm) => palm.blockId === activeBlockId);
      const lastRow = blockRows.at(-1);
      const lastPalm = blockPalms.at(-1);
      const lastRowTime = lastRow ? Number(lastRow.id.split('-').at(-1)) : 0;
      const lastPalmTime = lastPalm ? Number(lastPalm.id.split('-').at(-1)) : 0;
      const removePalm = lastPalm && (!lastRow || lastPalmTime > lastRowTime);

      if (removePalm) {
        return { ...prev, palms: prev.palms.filter((palm) => palm.id !== lastPalm.id) };
      }
      if (lastRow) {
        return { ...prev, rows: prev.rows.filter((row) => row.id !== lastRow.id) };
      }
      return prev;
    });
    setRowStart(null);
  }, [activeBlockId]);

  const handleClearBlockAnnotations = useCallback(() => {
    if (!activeBlockId) return;
    setAnnotations((prev) => ({
      rows: prev.rows.filter((row) => row.blockId !== activeBlockId),
      palms: prev.palms.filter((palm) => palm.blockId !== activeBlockId),
    }));
    setRowStart(null);
  }, [activeBlockId]);

  const handleAutoFillCompartment = useCallback(() => {
    const field = drawnFieldsRef.current.find((f) => f.id === activeCompartmentIdRef.current);
    if (!field) return;

    const generated = generateCompartmentAnnotations(field);
    setAnnotations((prev) => ({
      rows: [
        ...prev.rows.filter((row) => row.blockId !== field.id),
        ...generated.rows,
      ],
      palms: [
        ...prev.palms.filter((palm) => palm.blockId !== field.id),
        ...generated.palms,
      ],
    }));
    setActiveBlockId(field.id);
    setAnnotationMode('select');
    setRowStart(null);
  }, []);

  // ── Tree-level scan ───────────────────────────────────────────────────────────
  // Projects each existing palm dot onto its nearest row line to determine
  // (rowIdx, colFraction), then progressively overrides dot colors in that order.
  const handleTreeScan = useCallback(() => {
    const compartmentId = activeCompartmentIdRef.current;
    if (!compartmentId || treeScanActive) return;

    const compartmentPalms = annotations.palms.filter((p) => p.blockId === compartmentId);
    if (compartmentPalms.length === 0) return;

    const compartmentRows = annotations.rows.filter((r) => r.blockId === compartmentId);

    type Assigned = { palm: PalmAnnotation; rowIdx: number; colFraction: number };

    let assigned: Assigned[];

    if (compartmentRows.length > 0) {
      // Project each palm onto its nearest row line
      assigned = compartmentPalms.map((palm) => {
        let bestRow = 0, bestDist = Infinity, bestFraction = 0;
        compartmentRows.forEach((row, rowIdx) => {
          const [s, e] = row.coordinates;
          const dx = e[0] - s[0], dy = e[1] - s[1];
          const len2 = dx * dx + dy * dy;
          if (len2 === 0) return;
          const t = Math.max(0, Math.min(1,
            ((palm.coordinates[0] - s[0]) * dx + (palm.coordinates[1] - s[1]) * dy) / len2
          ));
          const dist = Math.hypot(palm.coordinates[0] - (s[0] + t * dx), palm.coordinates[1] - (s[1] + t * dy));
          if (dist < bestDist) { bestDist = dist; bestRow = rowIdx; bestFraction = t; }
        });
        return { palm, rowIdx: bestRow, colFraction: bestFraction };
      });
    } else {
      // No rows defined — sort spatially (lat desc, lng asc)
      const sorted = [...compartmentPalms].sort((a, b) =>
        b.coordinates[1] - a.coordinates[1] || a.coordinates[0] - b.coordinates[0]
      );
      const perRow = Math.ceil(Math.sqrt(sorted.length));
      assigned = sorted.map((palm, i) => ({
        palm,
        rowIdx: Math.floor(i / perRow),
        colFraction: (i % perRow) / Math.max(1, perRow - 1),
      }));
    }

    // Sort row-by-row, left-to-right within each row
    assigned.sort((a, b) => a.rowIdx - b.rowIdx || a.colFraction - b.colFraction);

    // Determine infection pattern
    const uniqueRows = Array.from(new Set(assigned.map((a) => a.rowIdx))).sort((a, b) => a - b);
    const srcRowIdx  = uniqueRows[Math.floor(uniqueRows.length * 0.3)] ?? 0;
    const srcRowPalms = assigned.filter((a) => a.rowIdx === srcRowIdx);
    const srcEntry   = srcRowPalms[Math.floor(srcRowPalms.length / 2)];
    const srcFrac    = srcEntry?.colFraction ?? 0.5;

    const targetStatuses = new Map<string, PalmStatus>();
    assigned.forEach(({ palm, rowIdx, colFraction }) => {
      const rd = rowIdx - srcRowIdx;
      const cd = Math.abs(colFraction - srcFrac);
      let status: PalmStatus;
      if (palm.id === srcEntry?.palm.id) {
        status = 'severe';
      } else if (rd === 2 && (Math.abs(colFraction - (srcFrac - 0.08)) < 0.05 || Math.abs(colFraction - (srcFrac + 0.15)) < 0.05)) {
        status = 'severe';
      } else if (rd >= 0 && rd <= 1 && cd < 0.18) {
        status = 'moderate';
      } else if (rd === 2 && cd < 0.22) {
        status = 'moderate';
      } else if (rd === 3 && cd < 0.16) {
        status = 'mild';
      } else {
        status = 'healthy';
      }
      targetStatuses.set(palm.id, status);
    });

    // Dots are already green from compartment entry — just start the scan
    setPalmStatusOverrides({});
    setTreeScanActive(true);
    setTreeScanDone(false);
    setTreeScanProgress(0);

    const total = assigned.length;
    let idx = 0;
    if (treeScanIntervalRef.current) clearInterval(treeScanIntervalRef.current);
    treeScanIntervalRef.current = setInterval(() => {
      if (idx >= total) {
        clearInterval(treeScanIntervalRef.current!);
        treeScanIntervalRef.current = null;
        // Build final overrides map and persist to localStorage
        const finalOverrides: Record<string, PalmStatus> = {};
        assigned.forEach(({ palm }) => {
          finalOverrides[palm.id] = targetStatuses.get(palm.id) ?? 'healthy';
        });
        saveScanResult(compartmentId, finalOverrides);
        setTreeScanProgress(100);
        setTreeScanActive(false);
        setTreeScanDone(true);
        return;
      }
      const palmId = assigned[idx].palm.id;
      const status = targetStatuses.get(palmId) ?? 'healthy';
      setPalmStatusOverrides((prev) => ({ ...prev, [palmId]: status }));
      idx++;
      setTreeScanProgress(Math.round((idx / total) * 100));
    }, 25);
  }, [treeScanActive, annotations.palms, annotations.rows]);

  // ── Aggregate estate-wide tree stats ────────────────────────────────────────
  const estateTotals = useMemo(() => {
    const t = { total: 0, healthy: 0, mild: 0, moderate: 0, severe: 0 };
    Object.values(allBlockDrillData).forEach((d) => {
      t.total    += d.stats.total;
      t.healthy  += d.stats.healthy;
      t.mild     += d.stats.mild;
      t.moderate += d.stats.moderate;
      t.severe   += d.stats.severe;
    });
    return t;
  }, []);

  // ── Full estate TLS scan (all 12 blocks in parallel, estate view) ────────────
  const handleFullEstateScan = useCallback(() => {
    const map = mapRef.current;
    if (!map || fullScanPhaseRef.current === 'scanning') return;

    setFullScanPhase('scanning');
    setFullScanProgress(0);
    const blockIds = Object.keys(allBlockDrillData).map(Number).sort((a, b) => a - b);
    const totalPalms = blockIds.reduce((sum, id) => sum + allBlockDrillData[id].stats.total, 0);
    let palmsScanned = 0;
    let blockIdx = 0;
    const accumulated: typeof allBlockDrillData[1]['trees']['features'] = [];

    if (fullScanIntervalRef.current) clearInterval(fullScanIntervalRef.current);

    // Each block "completes" every 420 ms → 12 blocks = ~5 s
    fullScanIntervalRef.current = setInterval(() => {
      if (blockIdx >= blockIds.length) {
        clearInterval(fullScanIntervalRef.current!);
        fullScanIntervalRef.current = null;

        // Populate source so drill-in shows cached dots instantly; keep layer hidden in estate view
        const estateSrc = map.getSource('estate-dots') as mapboxgl.GeoJSONSource | undefined;
        if (estateSrc) estateSrc.setData({ type: 'FeatureCollection', features: accumulated } as GeoJSON.GeoJSON);

        blockIds.forEach((id) => scannedBlocksRef.current.add(id));
        setFullScanPhase('done');
        setFullScanProgress(100);
        try { localStorage.setItem('palmscan_fulltls_done', 'true'); } catch {}
        window.dispatchEvent(new CustomEvent('palmscan:fullscan-complete'));
        return;
      }

      const blockId = blockIds[blockIdx];
      accumulated.push(...allBlockDrillData[blockId].trees.features);
      palmsScanned += allBlockDrillData[blockId].stats.total;

      const estateSrc = map.getSource('estate-dots') as mapboxgl.GeoJSONSource | undefined;
      if (estateSrc) estateSrc.setData({ type: 'FeatureCollection', features: accumulated } as GeoJSON.GeoJSON);

      setFullScanProgress(Math.round((palmsScanned / totalPalms) * 100));
      blockIdx++;
    }, 420);
  }, []);

  // ── TLS-IP scan sequence (phase 1: sweep line, phase 2: dot reveal) ─────────
  const runTlsScanSequence = useCallback((blockId: number) => {
    const map = mapRef.current;
    if (!map) return;
    const data = allBlockDrillData[blockId];
    if (!data) return;

    // Cached result: show instantly
    if (scannedBlocksRef.current.has(blockId)) {
      setTlsScanPhase('done');
      setTlsScanProgress(100);
      const dotsSrc = map.getSource('tls-tree-dots') as mapboxgl.GeoJSONSource | undefined;
      if (dotsSrc) dotsSrc.setData(data.trees as GeoJSON.GeoJSON);
      if (map.getLayer('tls-tree-dots')) map.setLayoutProperty('tls-tree-dots', 'visibility', 'visible');
      return;
    }

    // Phase 1 — TLS sweep line (30 steps × 50 ms = 1.5 s)
    setTlsScanPhase('scanning');
    setTlsScanProgress(0);

    const [[minLng, minLat], [maxLng, maxLat]] = data.bounds;
    const SCAN_STEPS = 30;
    let scanStep = 0;

    if (tlsIntervalRef.current) clearInterval(tlsIntervalRef.current);
    if (map.getLayer('tls-scan-line')) map.setLayoutProperty('tls-scan-line', 'visibility', 'visible');

    tlsIntervalRef.current = setInterval(() => {
      scanStep++;
      const lat = maxLat - (maxLat - minLat) * (scanStep / SCAN_STEPS);
      const scanLineSrc = map.getSource('tls-scan-line') as mapboxgl.GeoJSONSource | undefined;
      if (scanLineSrc) {
        scanLineSrc.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: [[minLng - 0.0002, lat], [maxLng + 0.0002, lat]] },
          }],
        });
      }
      setTlsScanProgress(Math.round((scanStep / SCAN_STEPS) * 50));

      if (scanStep >= SCAN_STEPS) {
        clearInterval(tlsIntervalRef.current!);
        tlsIntervalRef.current = null;
        if (map.getLayer('tls-scan-line')) map.setLayoutProperty('tls-scan-line', 'visibility', 'none');
        const sl = map.getSource('tls-scan-line') as mapboxgl.GeoJSONSource | undefined;
        if (sl) sl.setData({ type: 'FeatureCollection', features: [] });

        // Phase 2 — animate dots top→bottom (40 steps × 50 ms = 2 s)
        setTlsScanPhase('animating');
        const allFeatures = [...data.trees.features].sort(
          (a, b) => b.geometry.coordinates[1] - a.geometry.coordinates[1] || a.geometry.coordinates[0] - b.geometry.coordinates[0],
        );
        const ANIM_STEPS = 40;
        const chunkSize = Math.max(1, Math.ceil(allFeatures.length / ANIM_STEPS));
        let animStep = 0;
        const revealed: typeof allFeatures = [];

        if (map.getLayer('tls-tree-dots')) map.setLayoutProperty('tls-tree-dots', 'visibility', 'visible');

        tlsIntervalRef.current = setInterval(() => {
          animStep++;
          const end = Math.min(animStep * chunkSize, allFeatures.length);
          while (revealed.length < end) revealed.push(allFeatures[revealed.length]);

          const dotsSrc = map.getSource('tls-tree-dots') as mapboxgl.GeoJSONSource | undefined;
          if (dotsSrc) dotsSrc.setData({ type: 'FeatureCollection', features: [...revealed] } as GeoJSON.GeoJSON);
          setTlsScanProgress(50 + Math.round((animStep / ANIM_STEPS) * 50));

          if (animStep >= ANIM_STEPS || revealed.length >= allFeatures.length) {
            clearInterval(tlsIntervalRef.current!);
            tlsIntervalRef.current = null;
            const ds = map.getSource('tls-tree-dots') as mapboxgl.GeoJSONSource | undefined;
            if (ds) ds.setData(data.trees as GeoJSON.GeoJSON);
            scannedBlocksRef.current.add(blockId);
            try { localStorage.setItem('palmscan_tls_scanned', JSON.stringify([...scannedBlocksRef.current])); } catch {}
            setTlsScanPhase('done');
            setTlsScanProgress(100);
          }
        }, 50);
      }
    }, 50);
  }, []);

  // ── Drone scan ────────────────────────────────────────────────────────────────
  const handleDroneScan = useCallback(() => {
    const map = mapRef.current;
    if (!map || scanning) return;

    setShowDroneScanPanel(false);
    setStressZones([]);
    setScanning(true);

    const [[minLng, minLat], [maxLng, maxLat]] = estateBounds;

    // Zoom out to show the whole estate during scan
    map.fitBounds(
      new mapboxgl.LngLatBounds([minLng, minLat], [maxLng, maxLat]),
      { padding: 80, maxZoom: 15, duration: 800 }
    );

    const STEPS = 80;
    const swathH = (maxLat - minLat) / 10;
    let step = 0;

    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    scanIntervalRef.current = setInterval(() => {
      step += 1;
      const progress = step / STEPS;
      const top = minLat + (maxLat - minLat) * progress;
      const bottom = Math.max(minLat, top - swathH);

      const swathSrc = map.getSource('scan-swath') as mapboxgl.GeoJSONSource | undefined;
      if (swathSrc) {
        swathSrc.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [minLng - 0.002, bottom],
                [maxLng + 0.002, bottom],
                [maxLng + 0.002, top],
                [minLng - 0.002, top],
                [minLng - 0.002, bottom],
              ]],
            },
          }],
        });
      }

      if (step >= STEPS) {
        clearInterval(scanIntervalRef.current!);
        scanIntervalRef.current = null;
        // Clear swath
        const swathSrc2 = map.getSource('scan-swath') as mapboxgl.GeoJSONSource | undefined;
        if (swathSrc2) swathSrc2.setData({ type: 'FeatureCollection', features: [] });
        // Reveal real block statuses — B7 & B9 red, rest green
        const revealed = buildBlockFeatureCollection(true);
        const blockSrc = map.getSource('compartment-blocks') as mapboxgl.GeoJSONSource | undefined;
        const labelSrc = map.getSource('block-labels')       as mapboxgl.GeoJSONSource | undefined;
        if (blockSrc) blockSrc.setData(revealed);
        if (labelSrc) labelSrc.setData(buildBlockLabelFeatureCollection(true));
        setScanning(false);
        setScanComplete(true);
        setShowDroneScanPanel(true);
      }
    }, 50);
  }, [scanning]);

  useEffect(() => {
    const handler = () => handleDroneScan();
    window.addEventListener('palmscan:trigger-drone-scan', handler);
    return () => window.removeEventListener('palmscan:trigger-drone-scan', handler);
  }, [handleDroneScan]);

  const viewingField = drawnFields.find((f) => f.id === viewingFieldId) ?? null;
  const activeCompartment = drawnFields.find((f) => f.id === activeCompartmentId) ?? null;
  const activeBlock = activeCompartment && activeBlockId === activeCompartment.id
    ? {
        properties: {
          id: activeCompartment.id,
          name: activeCompartment.name,
          status: activeCompartment.status,
          palmCount: annotations.palms.filter((palm) => palm.blockId === activeCompartment.id).length,
          severity: 0,
        },
      }
    : null;
  const activeBlockRows = activeBlockId ? annotations.rows.filter((row) => row.blockId === activeBlockId).length : 0;
  const activeBlockPalms = activeBlockId ? annotations.palms.filter((palm) => palm.blockId === activeBlockId).length : 0;

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="map-container" />
      {/* Hidden file input for GeoJSON import */}
      <input ref={importInputRef} type="file" accept=".geojson,.json" className="hidden" onChange={handleImport} />

      {/* ── Top-left: layer tabs ─────────────────────────────────────────── */}
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

      {/* ── Compartment breadcrumb — below layer tabs, top-left ──────────── */}
      {activeCompartment && !drawMode && (
        <div className="absolute top-16 left-4 z-10 flex items-center gap-1.5 rounded-xl px-3 py-2 shadow-lg"
          style={{ background: 'rgba(26,31,24,0.88)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={handleBackToEstate}
            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-xs">
            <ArrowLeft className="w-3 h-3" /> Estate
          </button>
          <ChevronRight className="w-3 h-3 text-gray-600" />
          <span className="text-xs font-semibold text-white">{activeCompartment.id}</span>
          <span className="text-xs text-gray-400 truncate max-w-[120px]">· {activeCompartment.name}</span>
        </div>
      )}

      {/* ── Top-right: draw toggle + overflow menu ──────────────────────── */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
        <IconBtn
          onClick={toggleDrawMode}
          title={drawMode ? 'Cancel drawing' : 'Draw compartment'}
          active={drawMode}>
          {drawMode ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
        </IconBtn>

        {!drawMode && (
          <div className="relative">
            <IconBtn onClick={() => setToolMenuOpen((v) => !v)} title="Tools" active={toolMenuOpen}>
              <MoreHorizontal className="w-4 h-4" />
            </IconBtn>
            {toolMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setToolMenuOpen(false)} />
                <div className="absolute top-11 right-0 z-20 rounded-xl overflow-hidden shadow-xl min-w-[168px]"
                  style={{ background: 'rgba(26,31,24,0.97)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <ToolMenuItem icon={<Upload className="w-3.5 h-3.5" />} label="Import GeoJSON"
                    onClick={() => { importInputRef.current?.click(); setToolMenuOpen(false); }} />
                  {drawnFields.length > 0 && (
                    <ToolMenuItem icon={<Download className="w-3.5 h-3.5" />} label="Export GeoJSON"
                      onClick={() => { handleExport(); setToolMenuOpen(false); }} />
                  )}
                  {drawnFields.length > 0 && (
                    <ToolMenuItem icon={<Trash2 className="w-3.5 h-3.5" />} label="Clear all" danger
                      onClick={() => { handleClearAll(); setToolMenuOpen(false); }} />
                  )}
                  <ToolMenuItem icon={<RotateCcw className="w-3.5 h-3.5" />} label="Reset demo" danger
                    onClick={() => { handleReset(); setToolMenuOpen(false); }} />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {activeBlock && !drawMode && (
        <div className="absolute top-20 right-4 z-10 w-[310px] rounded-xl p-3 shadow-xl"
          style={{ background: 'rgba(26,31,24,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Annotating compartment</p>
              <p className="text-sm font-semibold text-white">{activeBlock.properties.id}</p>
              <p className="text-xs text-gray-400">{activeBlockRows} rows · {activeBlockPalms} palms · saved locally</p>
            </div>
            <button
              onClick={handleBackToBlocks}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: '#374151' }}>
              Hide tools
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 mb-3">
            {[
              { key: 'select' as const, label: 'Select', icon: MousePointer2 },
              { key: 'row' as const, label: 'Row line', icon: Route },
              { key: 'palm' as const, label: 'Palm dot', icon: Circle },
            ].map((item) => {
              const Icon = item.icon;
              const active = annotationMode === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    setAnnotationMode(item.key);
                    setRowStart(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-all ${active ? 'text-white' : 'text-gray-300 hover:text-white'}`}
                  style={{ background: active ? '#e07c3a' : 'rgba(255,255,255,0.08)' }}>
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleAutoFillCompartment}
            className="mb-3 w-full rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all hover:brightness-110"
            style={{ background: '#166534' }}>
            Auto fill rows and palms
          </button>

          {annotationMode === 'palm' && (
            <div className="flex items-center gap-1 mb-3">
              {(['healthy', 'mild', 'moderate', 'severe'] as PalmStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setPalmStatus(status)}
                  className={`h-7 flex-1 rounded-lg text-[10px] font-semibold capitalize ${palmStatus === status ? 'text-white ring-2 ring-white/70' : 'text-gray-950'}`}
                  style={{ background: PALM_COLORS[status] }}>
                  {status}
                </button>
              ))}
            </div>
          )}

          <p className="mb-3 rounded-lg px-3 py-2 text-xs text-gray-300" style={{ background: 'rgba(0,0,0,0.22)' }}>
            {annotationMode === 'row'
              ? rowStart ? 'Click the second endpoint to save this row line.' : 'Click two points on the map to draw one row line.'
              : annotationMode === 'palm'
                ? 'Click anywhere inside the block to place a palm dot.'
                : 'Choose Row line or Palm dot to start defining this block.'}
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleUndoAnnotation}
              className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-gray-200 hover:text-white"
              style={{ background: 'rgba(255,255,255,0.08)' }}>
              Undo last
            </button>
            <button
              onClick={handleClearBlockAnnotations}
              className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-red-300 hover:text-red-200"
              style={{ background: 'rgba(239,68,68,0.12)' }}>
              Clear block
            </button>
          </div>
        </div>
      )}

      {/* Drawing hint */}
      {drawMode && !editingFeature && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-xl text-xs text-gray-200 pointer-events-none"
          style={{ background: 'rgba(26,31,24,0.85)', backdropFilter: 'blur(8px)' }}>
          Click to place corners · Double-click to finish the polygon
        </div>
      )}

      {/* Legend — estate view: binary; compartment view: severity */}
      <div className="absolute bottom-24 left-4 z-10 rounded-xl p-3"
        style={{ background: 'rgba(26,31,24,0.85)', backdropFilter: 'blur(8px)' }}>
        {activeCompartmentId || drillBlockId !== null ? (
          <>
            <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Tree Severity</p>
            {[
              { label: 'Healthy',  color: BLOCK_COLORS.healthy  },
              { label: 'Warning',  color: BLOCK_COLORS.warning  },
              { label: 'Moderate', color: BLOCK_COLORS.moderate },
              { label: 'Severe',   color: BLOCK_COLORS.severe   },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-xs text-gray-300">{label}</span>
              </div>
            ))}
          </>
        ) : (
          <>
            <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Block status</p>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#2EAD5B' }} />
              <span className="text-xs text-gray-300">Clear</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#F2A93B' }} />
              <span className="text-xs text-gray-300">Monitor</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#EB5757' }} />
              <span className="text-xs text-gray-300">Flagged</span>
            </div>
          </>
        )}
      </div>

      {/* Tree scan results panel */}
      {treeScanDone && activeCompartmentId && (
        <div className="absolute bottom-24 right-4 z-20 w-56 rounded-xl overflow-hidden shadow-xl"
          style={{ background: 'rgba(26,31,24,0.93)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-3 py-2.5 border-b border-white/8">
            <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Tree Scan · {activeCompartmentId}</p>
            <p className="text-xs font-semibold text-white mt-0.5">{Object.keys(palmStatusOverrides).length} trees scanned</p>
          </div>
          <div className="px-3 py-2.5 flex flex-col gap-1.5">
            {[
              { key: 'healthy',  label: 'Healthy',  color: BLOCK_COLORS.healthy  },
              { key: 'mild',     label: 'Mild',     color: BLOCK_COLORS.warning  },
              { key: 'moderate', label: 'Moderate', color: BLOCK_COLORS.moderate },
              { key: 'severe',   label: 'Severe',   color: BLOCK_COLORS.severe   },
            ].map(({ key, label, color }) => {
              const total = Object.keys(palmStatusOverrides).length;
              const count = Object.values(palmStatusOverrides).filter((s) => s === key).length;
              const pct   = total ? Math.round((count / total) * 100) : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[10px] text-gray-300">{label}</span>
                    <span className="text-[10px] font-mono text-gray-400">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-3 pb-2.5">
            <p className="text-[10px] text-yellow-400 leading-relaxed">
              ⚠ Infection source detected · 2 severe cases propagated 2 rows downstream
            </p>
          </div>
        </div>
      )}

      {/* ── Block info popup (estate view) ──────────────────────────────── */}
      {blockPopup && !drawMode && !activeCompartmentId && (() => {
        const flagged = blockPopup.status === 'TLS confirmation required';
        const monitor = blockPopup.status === 'Early stage monitoring';
        const clear   = blockPopup.status === 'No visible severe canopy anomaly';
        const palmCount = Math.round(blockPopup.hectares * 136 / 10) * 10;
        const badgeBg = flagged ? '#EB5757' : monitor ? '#F2A93B' : clear ? '#2EAD5B' : 'rgba(255,255,255,0.15)';
        const badgeLabel = flagged ? 'Flagged' : monitor ? 'Monitor' : clear ? 'Clear' : 'Scanning';
        const msgBg = flagged ? 'bg-red-50' : monitor ? 'bg-amber-50' : clear ? 'bg-green-50' : 'bg-gray-50';
        const msgColor = flagged ? 'text-red-700' : monitor ? 'text-amber-700' : clear ? 'text-green-700' : 'text-gray-400';
        const msg = flagged
          ? 'Stage 1–2 BSR detected — treatment window open'
          : monitor
          ? 'Early stage indicators detected — continue monitoring'
          : clear
          ? 'No anomaly detected'
          : 'Awaiting drone scan…';
        return (
          <div className="absolute top-20 right-4 z-10 w-72 rounded-2xl overflow-hidden shadow-2xl"
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ background: '#1a3d2b' }}>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-green-400">Estate Block</p>
                <p className="text-xl font-black text-white">{blockPopup.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-white" style={{ background: badgeBg }}>
                  {badgeLabel}
                </span>
                <button onClick={() => setBlockPopup(null)} className="text-green-400 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Body */}
            <div className="bg-white p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Area</p>
                  <p className="text-sm font-black text-gray-900">{blockPopup.hectares} ha</p>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Est. palms</p>
                  <p className="text-sm font-black text-gray-900">~{palmCount}</p>
                </div>
              </div>
              <div className={`rounded-xl px-3 py-2.5 ${msgBg}`}>
                <p className={`text-xs font-bold leading-snug ${msgColor}`}>{msg}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Block drill-down panel (visible only when TLS scan is done) ──── */}
      {drillBlockId !== null && allBlockDrillData[drillBlockId] && tlsScanPhase === 'done' && (() => {
        const dd = allBlockDrillData[drillBlockId];
        const { stats } = dd;
        const FLAGGED_IDS = new Set([7, 9]);
        const MONITOR_IDS = new Set([4, 6, 10]);
        const isFlagged = FLAGGED_IDS.has(drillBlockId);
        const isMonitor = MONITOR_IDS.has(drillBlockId);
        const badgeColor  = isFlagged ? '#EB5757' : isMonitor ? '#F2A93B' : '#2EAD5B';
        const badgeLabel  = isFlagged ? 'TLS Flagged' : isMonitor ? 'Monitor' : 'Clear';
        const warnBg      = isFlagged ? 'bg-red-50'   : isMonitor ? 'bg-amber-50' : 'bg-green-50';
        const warnBorder  = isFlagged ? 'border-red-100' : isMonitor ? 'border-amber-100' : 'border-green-100';
        const warnColor   = isFlagged ? 'text-red-700'   : isMonitor ? 'text-amber-700'   : 'text-green-700';
        const warnMsg     = isFlagged
          ? `⚠ BSR infection cluster detected — ${stats.severe} urgent palm${stats.severe !== 1 ? 's' : ''} require immediate ground confirmation`
          : isMonitor
          ? `Early stage indicators detected — ${stats.mild + stats.moderate} at-risk palms require monitoring`
          : '✓ No BSR activity detected — continue routine monitoring schedule';
        const severityRows = [
          { key: 'severe',   label: 'Stage 3–4 Severe',   color: '#ef4444', count: stats.severe },
          { key: 'moderate', label: 'Stage 2 Moderate',   color: '#f97316', count: stats.moderate },
          { key: 'mild',     label: 'Stage 1 Mild',       color: '#fbbf24', count: stats.mild },
          { key: 'healthy',  label: 'Stage 0 Healthy',    color: '#4ade80', count: stats.healthy },
        ] as const;
        return (
          <div className="absolute top-16 right-4 z-20 rounded-2xl overflow-hidden shadow-2xl slide-in-right"
            style={{ width: 300, border: '1px solid rgba(255,255,255,0.12)' }}>
            {/* Header */}
            <div className="px-4 py-3" style={{ background: '#1a2e1e' }}>
              <div className="flex items-center justify-between mb-1">
                <button
                  onClick={() => setDrillBlockId(null)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-green-400 hover:text-white transition-colors">
                  <ArrowLeft className="w-3 h-3" /> Estate view
                </button>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-white"
                  style={{ background: badgeColor }}>
                  {badgeLabel}
                </span>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-green-400 mt-1">
                TLS-IP Scan Result
              </p>
              <p className="text-2xl font-black text-white">{dd.blockName}</p>
              <p className="text-xs text-gray-400 mt-0.5">{dd.hectares} ha · {stats.total} palms classified</p>
            </div>

            {/* Stage breakdown */}
            <div className="bg-white px-4 py-4 space-y-3">
              {severityRows.map(({ key, label, color, count }) => {
                const pct = stats.total ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-700">{label}</span>
                      <span className="text-xs font-mono text-gray-500">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-100">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Status message */}
            <div className={`px-4 py-3 ${warnBg} border-t ${warnBorder}`}>
              <p className={`text-xs font-bold leading-relaxed ${warnColor}`}>{warnMsg}</p>
            </div>

            {/* TLS scan complete badge */}
            <div className="px-4 py-2.5 flex items-center gap-2"
              style={{ background: 'rgba(6,78,59,0.08)', borderTop: '1px solid rgba(52,211,153,0.2)' }}>
              <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-emerald-700">TLS-IP scan complete</span>
            </div>
          </div>
        );
      })()}

      {/* ── Bottom-centre: primary action dock ──────────────────────────── */}
      {!drawMode && !hideScanControls && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">

          {/* Grouped step buttons — estate view, not scanning */}
          {!activeCompartmentId && !scanning && fullScanPhase !== 'scanning' && drillBlockId === null && (
            <div className="flex items-center gap-1.5 px-1.5 py-1.5 rounded-2xl shadow-2xl"
              style={{ background: 'rgba(22,28,20,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {/* Step 1: Drone Scan */}
              <button
                onClick={!scanComplete ? handleDroneScan : undefined}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all ${!scanComplete ? 'btn-cta-ring hover:brightness-110' : 'cursor-default'}`}
                style={{ background: scanComplete ? 'rgba(22,101,52,0.6)' : '#e07c3a', border: scanComplete ? '1px solid rgba(74,222,128,0.25)' : 'none' }}>
                {scanComplete ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Scan className="w-4 h-4" />}
                <span>{scanComplete ? '① Drone Done' : '① Drone Scan Estate'}</span>
              </button>
            </div>
          )}

          {/* Drone scanning in progress */}
          {scanning && (
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl"
              style={{ background: 'rgba(26,31,24,0.95)', backdropFilter: 'blur(12px)', border: '1.5px solid rgba(56,189,248,0.4)' }}>
              <Scan className="w-4 h-4 text-sky-400 animate-pulse flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-sky-300 mb-1">Drone scanning estate…</p>
                <div className="w-44 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-sky-400 animate-[scan-progress_4s_linear_forwards]" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          )}


          {/* Drone scan done — prompt to enter compartment */}
          {!activeCompartmentId && scanComplete && !scanning && showDroneScanPanel && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl shadow-xl"
              style={{ background: 'rgba(26,31,24,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2">
                {stressZones.length > 0 ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    <span className="text-xs text-red-300 font-medium">
                      {stressZones.length} infected compartment{stressZones.length !== 1 ? 's' : ''} — tap one to investigate
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex gap-1.5 items-center">
                      <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                      <span className="text-xs font-semibold text-red-300">2 flagged</span>
                    </div>
                    <span className="text-gray-600 text-xs">·</span>
                    <div className="flex gap-1.5 items-center">
                      <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                      <span className="text-xs font-semibold text-amber-300">3 monitoring</span>
                    </div>
                    <span className="text-gray-600 text-xs">·</span>
                    <div className="flex gap-1.5 items-center">
                      <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                      <span className="text-xs font-semibold text-green-300">7 clear</span>
                    </div>
                    <span className="text-gray-600 text-xs">·</span>
                    <span className="text-xs font-semibold text-emerald-400">② Click any block → TLS-IP scan</span>
                  </>
                )}
              </div>
              <button onClick={() => setShowDroneScanPanel(false)}
                className="text-gray-600 hover:text-gray-400 transition-colors ml-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Tree scan CTA — inside compartment, after drone scan */}
          {activeCompartmentId && scanComplete && !treeScanDone && !treeScanActive && (
            <button
              onClick={handleTreeScan}
              className="btn-cta-ring flex items-center gap-2.5 px-6 py-3 rounded-2xl text-sm font-semibold text-white shadow-2xl transition-all hover:brightness-110"
              style={{ background: '#e07c3a', border: '1.5px solid rgba(255,255,255,0.2)' }}>
              <Scan className="w-4 h-4" />
              ③ Tree Scan Compartment
            </button>
          )}

          {/* Tree scan done badge */}
          {activeCompartmentId && treeScanDone && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl shadow-lg"
              style={{ background: 'rgba(22,101,52,0.9)', backdropFilter: 'blur(8px)', border: '1px solid rgba(74,222,128,0.3)' }}>
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs font-semibold text-green-200">Tree scan complete</span>
            </div>
          )}

          {/* TLS scanning in progress badge */}
          {drillBlockId !== null && !activeCompartmentId && (tlsScanPhase === 'scanning' || tlsScanPhase === 'animating') && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl shadow-lg"
              style={{ background: 'rgba(6,78,59,0.9)', backdropFilter: 'blur(8px)', border: '1px solid rgba(52,211,153,0.3)' }}>
              <Scan className="w-3.5 h-3.5 text-emerald-400 animate-pulse flex-shrink-0" />
              <span className="text-xs font-semibold text-emerald-200">
                {tlsScanPhase === 'scanning' ? 'TLS-IP scanning…' : 'Classifying palms…'} {allBlockDrillData[drillBlockId]?.blockName}
              </span>
            </div>
          )}

          {/* TLS scan complete badge */}
          {drillBlockId !== null && !activeCompartmentId && tlsScanPhase === 'done' && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl shadow-lg"
              style={{ background: 'rgba(6,78,59,0.9)', backdropFilter: 'blur(8px)', border: '1px solid rgba(52,211,153,0.3)' }}>
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-emerald-200">
                TLS-IP scan complete — {allBlockDrillData[drillBlockId]?.blockName}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Compartment tree-scan progress bar ──────────────────────────── */}
      {treeScanActive && !hideScanControls && (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-6 py-3 flex items-center gap-4"
          style={{ background: 'rgba(22,28,20,0.97)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(56,189,248,0.25)' }}>
          <Scan className="w-4 h-4 text-sky-400 animate-pulse flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-sky-300">Tree-level scan in progress</span>
              <span className="text-[11px] font-mono text-sky-400">{treeScanProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-sky-400 transition-all duration-75"
                style={{ width: `${treeScanProgress}%` }} />
            </div>
          </div>
          <span className="text-[10px] text-gray-500 flex-shrink-0 font-mono">{activeCompartmentId}</span>
        </div>
      )}

      {/* ── TLS-IP scan progress bar — full-width bottom strip ───────────── */}
      {(tlsScanPhase === 'scanning' || tlsScanPhase === 'animating') && drillBlockId !== null && !hideScanControls && (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-6 py-3 flex items-center gap-4"
          style={{ background: 'rgba(6,18,14,0.97)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(52,211,153,0.3)' }}>
          <Scan className="w-4 h-4 text-emerald-400 animate-pulse flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-emerald-300">
                {tlsScanPhase === 'scanning' ? 'TLS-IP deep scan — point cloud processing…' : 'Classifying palm health status…'}
              </span>
              <span className="text-[11px] font-mono text-emerald-400">{tlsScanProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400 transition-all duration-75"
                style={{ width: `${tlsScanProgress}%` }} />
            </div>
          </div>
          <span className="text-[10px] text-gray-500 flex-shrink-0 font-mono">{allBlockDrillData[drillBlockId]?.blockName}</span>
        </div>
      )}

      {/* ── Full estate TLS scan progress bar ───────────────────────────── */}
      {fullScanPhase === 'scanning' && !hideScanControls && (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-6 py-3 flex items-center gap-4"
          style={{ background: 'rgba(4,14,10,0.98)', backdropFilter: 'blur(12px)', borderTop: '2px solid rgba(52,211,153,0.4)' }}>
          <Scan className="w-4 h-4 text-emerald-400 animate-pulse flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-emerald-300">
                Full estate TLS-IP scan — {Math.round(fullScanProgress / 100 * 12)} of 12 blocks classified
              </span>
              <span className="text-[11px] font-mono text-emerald-400">
                {Math.round(fullScanProgress / 100 * estateTotals.total).toLocaleString()} / {estateTotals.total.toLocaleString()} palms
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${fullScanProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Save toast */}
      {saveToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-xl pointer-events-none"
          style={{ background: '#166534' }}>
          Compartment saved
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

// ── Icon-only utility button ──────────────────────────────────────────────────
function IconBtn({
  onClick, title, active = false, danger = false, children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-9 h-9 flex items-center justify-center rounded-xl shadow-lg transition-all hover:brightness-125"
      style={{
        background: active ? '#e07c3a' : 'rgba(26,31,24,0.88)',
        backdropFilter: 'blur(8px)',
        border: active ? '1.5px solid #e07c3a' : '1.5px solid rgba(255,255,255,0.08)',
        color: active ? '#fff' : danger ? '#f87171' : '#d1d5db',
      }}>
      {children}
    </button>
  );
}

// ── Overflow menu item ────────────────────────────────────────────────────────
function ToolMenuItem({
  icon, label, danger = false, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition-colors hover:bg-white/8"
      style={{ color: danger ? '#f87171' : '#d1d5db' }}>
      {icon}
      {label}
    </button>
  );
}
