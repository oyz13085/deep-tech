'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import PolygonEditor, { DrawnField } from './PolygonEditor';
import CompartmentPopup from './CompartmentPopup';
import { Circle, MousePointer2, Pencil, Route, Save, Trash2, X } from 'lucide-react';

interface Props {
  drawnFields:    DrawnField[];
  selectedId:     string | null;
  onSelect:       (id: string) => void;
  onFieldsChange: (fields: DrawnField[]) => void;
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
  const activeCompartmentIdRef = useRef<string | null>(null);
  const activeBlockIdRef = useRef<string | null>(null);
  const annotationModeRef = useRef<AnnotationMode>('select');
  const palmStatusRef = useRef<PalmStatus>('healthy');
  const rowStartRef = useRef<[number, number] | null>(null);

  const [activeLayer,    setActiveLayer]    = useState<LayerStyle>('satellite');
  const [mapReady,       setMapReady]       = useState(false);
  const [drawMode,       setDrawMode]       = useState(false);
  const [saveToast,      setSaveToast]      = useState(false);
  const [activeCompartmentId, setActiveCompartmentId] = useState<string | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>('select');
  const [palmStatus, setPalmStatus] = useState<PalmStatus>('healthy');
  const [rowStart, setRowStart] = useState<[number, number] | null>(null);
  const [annotations, setAnnotations] = useState<BlockAnnotations>(() => loadAnnotations());
  // editingFeature → PolygonEditor open (drawing new or editing existing)
  const [editingFeature, setEditingFeature] = useState<{ id: string; coordinates: [number, number][][] } | null>(null);
  // viewingFieldId → CompartmentPopup open (read-only info)
  const [viewingFieldId, setViewingFieldId] = useState<string | null>(null);

  useEffect(() => { drawnFieldsRef.current = drawnFields; }, [drawnFields]);
  useEffect(() => { activeCompartmentIdRef.current = activeCompartmentId; }, [activeCompartmentId]);
  useEffect(() => { activeBlockIdRef.current = activeBlockId; }, [activeBlockId]);
  useEffect(() => { annotationModeRef.current = annotationMode; }, [annotationMode]);
  useEffect(() => { palmStatusRef.current = palmStatus; }, [palmStatus]);
  useEffect(() => { rowStartRef.current = rowStart; }, [rowStart]);
  useEffect(() => { saveAnnotations(annotations); }, [annotations]);

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

    const blocks = buildBlockGeoJSON(null);
    const blockSource = map.getSource('compartment-blocks') as mapboxgl.GeoJSONSource | undefined;
    const labelSource = map.getSource('block-labels') as mapboxgl.GeoJSONSource | undefined;
    const rowSource = map.getSource('block-palm-rows') as mapboxgl.GeoJSONSource | undefined;

    if (blockSource) blockSource.setData(blocks);
    if (labelSource) labelSource.setData(buildBlockLabelGeoJSON(blocks));
    if (rowSource) rowSource.setData(buildPalmRowGeoJSON(blocks));
  }, [activeCompartmentId, drawnFields, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const visibleBlockIds = activeCompartmentId ? new Set([activeCompartmentId]) : new Set<string>();
    const rowSource = map.getSource('user-row-lines') as mapboxgl.GeoJSONSource | undefined;
    const palmSource = map.getSource('user-palm-dots') as mapboxgl.GeoJSONSource | undefined;

    if (rowSource) rowSource.setData(buildUserRowGeoJSON(annotations, visibleBlockIds));
    if (palmSource) palmSource.setData(buildUserPalmGeoJSON(annotations, visibleBlockIds));
  }, [annotations, activeCompartmentId, drawnFields, mapReady]);

  function addBlockLayers(map: mapboxgl.Map) {
    if (map.getSource('compartment-blocks')) return;

    const emptyBlocks = buildBlockGeoJSON(null);
    map.addSource('compartment-blocks', { type: 'geojson', data: emptyBlocks });
    map.addSource('block-labels', { type: 'geojson', data: buildBlockLabelGeoJSON(emptyBlocks) });
    map.addSource('block-palm-rows', { type: 'geojson', data: buildPalmRowGeoJSON(emptyBlocks) });
    map.addSource('user-row-lines', { type: 'geojson', data: buildUserRowGeoJSON({ rows: [], palms: [] }, new Set()) });
    map.addSource('user-palm-dots', { type: 'geojson', data: buildUserPalmGeoJSON({ rows: [], palms: [] }, new Set()) });

    map.addLayer({
      id: 'block-fill',
      type: 'fill',
      source: 'compartment-blocks',
      paint: {
        'fill-color': ['match', ['get', 'status'],
          'healthy', STATUS_COLORS.healthy,
          'warning', STATUS_COLORS.warning,
          'moderate', STATUS_COLORS.moderate,
          'severe', STATUS_COLORS.severe,
          '#888',
        ],
        'fill-opacity': 0.48,
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
      id: 'block-palm-rows',
      type: 'line',
      source: 'block-palm-rows',
      paint: {
        'line-color': '#d9f99d',
        'line-width': 1,
        'line-opacity': 0.42,
        'line-dasharray': [3, 2],
      },
    });

    map.addLayer({
      id: 'block-labels',
      type: 'symbol',
      source: 'block-labels',
      layout: {
        'text-field': ['concat', ['get', 'id'], '\n', ['get', 'palmCount'], ' palms'],
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

    map.on('mousemove', 'block-fill', () => {
      map.getCanvas().style.cursor = 'zoom-in';
    });

    map.on('mouseleave', 'block-fill', () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('click', 'block-fill', (e) => {
      if (annotationModeRef.current !== 'select') return;
      if (!activeCompartmentIdRef.current) return;
      const blockId = e.features?.[0]?.properties?.id as string;
      const geometry = e.features?.[0]?.geometry;
      if (!blockId || !geometry || geometry.type !== 'Polygon') return;

      setActiveBlockId(blockId);
      setAnnotationMode('select');
      setRowStart(null);
      map.setFilter('block-selected', ['==', ['get', 'id'], blockId]);

      const coords = (geometry as GeoJSON.Polygon).coordinates[0] as [number, number][];
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      map.fitBounds(
        new mapboxgl.LngLatBounds([Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]),
        { padding: 120, maxZoom: 19, duration: 650 }
      );
    });
  }

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
      addBlockLayers(map);

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
      if (!blockId || mode === 'select') return;

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
      if (!start) {
        setRowStart(point);
        return;
      }

      const id = `${blockId}-R-${Date.now()}`;
      setAnnotations((prev) => ({
        ...prev,
        rows: [...prev.rows, { id, blockId, coordinates: [start, point] }],
      }));
      setRowStart(null);
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
      const activeField = drawnFieldsRef.current.find((f) => f.id === activeCompartmentId) ?? null;
      const blocks = buildBlockGeoJSON(null);
      const blockSource = map.getSource('compartment-blocks') as mapboxgl.GeoJSONSource | undefined;
      const labelSource = map.getSource('block-labels') as mapboxgl.GeoJSONSource | undefined;
      const rowSource = map.getSource('block-palm-rows') as mapboxgl.GeoJSONSource | undefined;
      if (blockSource) blockSource.setData(blocks);
      if (labelSource) labelSource.setData(buildBlockLabelGeoJSON(blocks));
      if (rowSource) rowSource.setData(buildPalmRowGeoJSON(blocks));
      const visibleBlockIds = activeField ? new Set([activeField.id]) : new Set<string>();
      const userRowSource = map.getSource('user-row-lines') as mapboxgl.GeoJSONSource | undefined;
      const userPalmSource = map.getSource('user-palm-dots') as mapboxgl.GeoJSONSource | undefined;
      if (userRowSource) userRowSource.setData(buildUserRowGeoJSON(annotations, visibleBlockIds));
      if (userPalmSource) userPalmSource.setData(buildUserPalmGeoJSON(annotations, visibleBlockIds));
      if (map.getLayer('block-selected')) map.setFilter('block-selected', ['==', ['get', 'id'], activeBlockId ?? '']);
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

      {activeCompartment && !drawMode && (
        <div className="absolute top-16 left-4 z-10 flex items-center gap-2 rounded-xl px-3 py-2 shadow-lg"
          style={{ background: 'rgba(26,31,24,0.88)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={handleBackToEstate}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: '#e07c3a' }}>
            Back to estate
          </button>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400">Row definition view</p>
            <p className="text-xs font-semibold text-white">{activeCompartment.id} · {activeCompartment.name}</p>
          </div>
        </div>
      )}

      {activeBlock && !drawMode && (
        <div className="absolute top-16 right-4 z-10 w-[310px] rounded-xl p-3 shadow-xl"
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
