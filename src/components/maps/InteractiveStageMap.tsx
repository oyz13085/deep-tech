import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import clsx from 'clsx';
import { AlertTriangle, MapPinned } from 'lucide-react';
import {
  block7Bounds,
  buildBlockFeatureCollection,
  buildBlockLabelFeatureCollection,
  buildPalmRowFeatureCollection,
  estateBoundaryFeature,
  mapColors,
} from '../../data/mapboxEstateData';

type StageFilter = 'all' | 'stage1' | 'stage2' | 'stage34' | 'urgent';
type StageKey = 'stage0' | 'stage1' | 'stage2' | 'stage34';

type StageProperties = {
  id: number;
  stage: StageKey;
  label: string;
  count: string;
  action: string;
};

type ClusterProperties = {
  stage: StageKey;
  label: string;
  count: string;
  action: string;
};

const stageMeta: Record<
  StageKey,
  {
    displayLabel: string;
    label: string;
    legendLabel: string;
    count: string;
    color: string;
    action: string;
    note?: string;
  }
> = {
  stage0: {
    displayLabel: 'Low-priority palms',
    label: 'Stage 0 Healthy',
    legendLabel: 'Low priority',
    count: '53 palms',
    color: '#2EAD5B',
    action: 'Continue normal monitoring',
  },
  stage1: {
    displayLabel: 'Monitoring palms',
    label: 'Stage 1 Mild',
    legendLabel: 'Monitoring',
    count: '87 palms',
    color: '#F2C94C',
    action: 'Rescan in 30 days',
  },
  stage2: {
    displayLabel: 'Treatment palms',
    label: 'Stage 2 Moderate',
    legendLabel: 'Treatment',
    count: '41 palms',
    color: '#F2994A',
    action: 'Treat within 7 days',
  },
  stage34: {
    displayLabel: 'Urgent palms',
    legendLabel: 'Urgent',
    label: 'Stage 3–4 Severe/Critical Priority',
    count: '23 palms',
    color: '#EB5757',
    action: 'Action within 48 hours',
    note: 'AI-assisted. Confirm before felling.',
  },
};

const filters: { id: StageFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'stage1', label: 'Stage 1' },
  { id: 'stage2', label: 'Stage 2' },
  { id: 'stage34', label: 'Stage 3–4' },
  { id: 'urgent', label: 'Urgent only' },
];

const fillExpression: mapboxgl.Expression = [
  'match',
  ['get', 'status'],
  'TLS confirmation required',
  mapColors.flagged,
  'No visible severe canopy anomaly',
  mapColors.clear,
  mapColors.neutral,
];

const stageColorExpression: mapboxgl.Expression = [
  'match',
  ['get', 'stage'],
  'stage0',
  stageMeta.stage0.color,
  'stage1',
  stageMeta.stage1.color,
  'stage2',
  stageMeta.stage2.color,
  'stage34',
  stageMeta.stage34.color,
  stageMeta.stage0.color,
];

function tokenFromEnv() {
  return import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
}

function visibleForFilter(stage: StageKey, filter: StageFilter) {
  if (filter === 'all') return true;
  if (filter === 'urgent') return stage === 'stage34';
  return filter === stage;
}

function pointFeature(id: number, stage: StageKey, coordinates: [number, number]): GeoJSON.Feature<GeoJSON.Point, StageProperties> {
  const meta = stageMeta[stage];
  return {
    type: 'Feature',
    properties: {
      id,
      stage,
      label: meta.displayLabel,
      count: meta.count,
      action: meta.action,
    },
    geometry: { type: 'Point', coordinates },
  };
}

function buildStagePalmFeatures(): GeoJSON.Feature<GeoJSON.Point, StageProperties>[] {
  const features: GeoJSON.Feature<GeoJSON.Point, StageProperties>[] = [];
  let id = 1;

  const addCluster = (stage: StageKey, count: number, center: [number, number], spreadLng: number, spreadLat: number) => {
    Array.from({ length: count }, (_, index) => {
      const ring = Math.floor(index / 18) + 1;
      const angle = (index * 137.5 * Math.PI) / 180;
      const lng = center[0] + Math.cos(angle) * spreadLng * ring * (0.22 + (index % 5) * 0.05);
      const lat = center[1] + Math.sin(angle) * spreadLat * ring * (0.24 + (index % 4) * 0.05);
      features.push(pointFeature(id, stage, [lng, lat]));
      id += 1;
    });
  };

  addCluster('stage34', 23, [103.3037, 2.0382], 0.0018, 0.0016);
  addCluster('stage2', 41, [103.301, 2.036], 0.0015, 0.00135);
  addCluster('stage1', 87, [103.299, 2.034], 0.0021, 0.0019);

  Array.from({ length: 53 }, (_, index) => {
    const col = index % 11;
    const row = Math.floor(index / 11);
    const lng = 103.2932 + col * 0.00108 + (row % 2) * 0.00028;
    const lat = 2.0262 + row * 0.00102 + (col % 4) * 0.00008;
    features.push(pointFeature(id, 'stage0', [lng, lat]));
    id += 1;
  });

  return features;
}

function buildStagePalmFeatureCollection(
  filter: StageFilter,
): GeoJSON.FeatureCollection<GeoJSON.Point, StageProperties> {
  return {
    type: 'FeatureCollection',
    features: buildStagePalmFeatures().filter((feature) => visibleForFilter(feature.properties.stage, filter)),
  };
}

function ellipsePolygon(center: [number, number], radiusLng: number, radiusLat: number, steps = 72): GeoJSON.Position[] {
  const coordinates: GeoJSON.Position[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    coordinates.push([center[0] + Math.cos(angle) * radiusLng, center[1] + Math.sin(angle) * radiusLat]);
  }
  return coordinates;
}

function buildClusterFeatureCollection(
  filter: StageFilter,
): GeoJSON.FeatureCollection<GeoJSON.Polygon, ClusterProperties> {
  const clusters: Array<{ stage: StageKey; center: [number, number]; radiusLng: number; radiusLat: number }> = [
    { stage: 'stage1', center: [103.299, 2.034], radiusLng: 0.0052, radiusLat: 0.0044 },
    { stage: 'stage2', center: [103.301, 2.036], radiusLng: 0.0036, radiusLat: 0.003 },
    { stage: 'stage34', center: [103.3037, 2.0382], radiusLng: 0.002, radiusLat: 0.0017 },
  ];

  return {
    type: 'FeatureCollection',
    features: clusters
      .filter((cluster) => visibleForFilter(cluster.stage, filter))
      .map((cluster) => {
        const meta = stageMeta[cluster.stage];
        return {
          type: 'Feature',
          properties: {
            stage: cluster.stage,
            label: meta.displayLabel,
            count: meta.count,
            action: meta.action,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [ellipsePolygon(cluster.center, cluster.radiusLng, cluster.radiusLat)],
          },
        };
      }),
  };
}

function updateSource<TGeometry extends GeoJSON.Geometry, TProperties extends GeoJSON.GeoJsonProperties>(
  map: mapboxgl.Map,
  id: string,
  data: GeoJSON.FeatureCollection<TGeometry, TProperties>,
) {
  const source = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
  source?.setData(data);
}

function popupHtml(properties: StageProperties | ClusterProperties) {
  const meta = stageMeta[properties.stage];
  const note = meta.note
    ? `<div style="margin-top:8px;font-size:12px;font-weight:800;color:#BFD1C5;line-height:1.35">${meta.note}</div>`
    : '';
  const stageLabel = properties.stage === 'stage34' ? 'Stage 3-4 Severe/Critical' : meta.label;
  return `
    <div style="min-width:250px;padding:13px 15px;border-radius:16px;background:rgba(8,20,14,.96);border:1px solid rgba(255,255,255,.18);color:#FFFFFF;font-family:Inter,ui-sans-serif,system-ui,sans-serif;box-shadow:0 18px 38px rgba(0,0,0,.38)">
      <div style="font-size:15px;font-weight:900;line-height:1.25">${meta.displayLabel}</div>
      <div style="margin-top:4px;font-size:12px;font-weight:800;color:#BFD1C5">${stageLabel}</div>
      <div style="margin-top:8px;font-size:25px;font-weight:900;color:${meta.color}">${meta.count}</div>
      <div style="margin-top:8px;font-size:14px;font-weight:800;color:#DDE8DF;line-height:1.4">${meta.action}</div>
      ${note}
    </div>
  `;
}

export function InteractiveStageMap() {
  const [filter, setFilter] = useState<StageFilter>('all');
  const [hoveredStage, setHoveredStage] = useState<StageKey | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const filterRef = useRef(filter);
  const mapboxToken = tokenFromEnv();
  const missingToken = !mapboxToken;

  const filteredCounts = useMemo(
    () =>
      (['stage34', 'stage2', 'stage1', 'stage0'] as StageKey[]).map((stage) => ({
        stage,
        visible: visibleForFilter(stage, filter),
      })),
    [filter],
  );

  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || missingToken) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [103.2978, 2.0304],
      zoom: 15,
      maxZoom: 19,
      pitch: 0,
      bearing: -11,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('estate-boundary', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [estateBoundaryFeature] },
      });
      map.addSource('estate-blocks', { type: 'geojson', data: buildBlockFeatureCollection(true) });
      map.addSource('block-labels', { type: 'geojson', data: buildBlockLabelFeatureCollection(true) });
      map.addSource('palm-rows', { type: 'geojson', data: buildPalmRowFeatureCollection() });
      map.addSource('stage-clusters', { type: 'geojson', data: buildClusterFeatureCollection(filterRef.current) });
      map.addSource('stage-palms', { type: 'geojson', data: buildStagePalmFeatureCollection(filterRef.current) });

      map.addLayer({
        id: 'estate-boundary-fill',
        type: 'fill',
        source: 'estate-boundary',
        paint: { 'fill-color': '#1F7A4D', 'fill-opacity': 0.08 },
      });
      map.addLayer({
        id: 'estate-boundary-line',
        type: 'line',
        source: 'estate-boundary',
        paint: { 'line-color': mapColors.boundary, 'line-width': 3, 'line-opacity': 0.88 },
      });
      map.addLayer({
        id: 'block-fill',
        type: 'fill',
        source: 'estate-blocks',
        paint: { 'fill-color': fillExpression, 'fill-opacity': 0.42 },
      });
      map.addLayer({
        id: 'palm-row-lines',
        type: 'line',
        source: 'palm-rows',
        paint: {
          'line-color': '#F7F2DE',
          'line-width': 1.2,
          'line-opacity': 0.44,
          'line-dasharray': [3, 3],
        },
      });
      map.addLayer({
        id: 'block-outline',
        type: 'line',
        source: 'estate-blocks',
        paint: { 'line-color': '#FFF8E8', 'line-width': 2.1, 'line-opacity': 0.92 },
      });
      map.addLayer({
        id: 'stage-cluster-fill',
        type: 'fill',
        source: 'stage-clusters',
        paint: { 'fill-color': stageColorExpression, 'fill-opacity': 0.18 },
      });
      map.addLayer({
        id: 'stage-cluster-line',
        type: 'line',
        source: 'stage-clusters',
        paint: {
          'line-color': stageColorExpression,
          'line-width': ['case', ['==', ['get', 'stage'], 'stage34'], 3.2, 2],
          'line-opacity': 0.95,
        },
      });
      map.addLayer({
        id: 'stage-palms',
        type: 'circle',
        source: 'stage-palms',
        paint: {
          'circle-radius': ['case', ['==', ['get', 'stage'], 'stage34'], 5.8, ['==', ['get', 'stage'], 'stage2'], 4.7, 3.7],
          'circle-color': stageColorExpression,
          'circle-opacity': ['case', ['==', ['get', 'stage'], 'stage0'], 0.62, 0.9],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': ['case', ['==', ['get', 'stage'], 'stage34'], 1.8, 0.9],
        },
      });
      map.addLayer({
        id: 'stage34-halo',
        type: 'circle',
        source: 'stage-palms',
        filter: ['==', ['get', 'stage'], 'stage34'],
        paint: {
          'circle-radius': 12,
          'circle-color': '#EB5757',
          'circle-opacity': 0.22,
          'circle-blur': 0.4,
        },
      });
      map.addLayer({
        id: 'block-labels',
        type: 'symbol',
        source: 'block-labels',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 12, 15, 15],
          'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': 'rgba(0,0,0,0.9)',
          'text-halo-width': 2.3,
          'text-halo-blur': 0.5,
        },
      });

      const showPopup = (event: mapboxgl.MapMouseEvent) => {
        const feature = event.features?.[0];
        if (!feature?.properties) return;
        const properties = feature.properties as StageProperties | ClusterProperties;
        const stage = properties.stage;
        setHoveredStage(stage);
        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup({
          className: 'ganoderma-map-popup',
          closeButton: false,
          closeOnClick: false,
          offset: 12,
        })
          .setLngLat(event.lngLat)
          .setHTML(popupHtml(properties))
          .addTo(map);
      };

      ['stage-palms', 'stage-cluster-fill'].forEach((layerId) => {
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
          setHoveredStage(null);
          popupRef.current?.remove();
        });
        map.on('mousemove', layerId, showPopup);
        map.on('click', layerId, showPopup);
      });

      map.fitBounds(block7Bounds, { padding: 64, maxZoom: 15.62, duration: 600 });
    });

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken, missingToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    updateSource(map, 'stage-clusters', buildClusterFeatureCollection(filter));
    updateSource(map, 'stage-palms', buildStagePalmFeatureCollection(filter));
    popupRef.current?.remove();
    setHoveredStage(null);
  }, [filter]);

  if (missingToken) {
    return (
      <div className="rounded-2xl border border-sentinel-border bg-white p-5 shadow-panel">
        <div className="grid min-h-[520px] place-items-center rounded-2xl border border-sentinel-border bg-sentinel-surface p-8 text-center">
          <div>
            <AlertTriangle className="mx-auto h-10 w-10 text-sentinel-severe" />
            <h3 className="mt-4 text-2xl font-black text-sentinel-text">Mapbox token missing</h3>
            <p className="mt-2 text-lg font-semibold text-sentinel-muted">
              Mapbox token missing. Add VITE_MAPBOX_TOKEN to .env.local.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-sentinel-border bg-white p-5 shadow-soft">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h2 className="text-3xl font-black tracking-normal text-sentinel-text">
            Affected Palm Map
          </h2>
          <p className="mt-2 text-base font-semibold leading-relaxed text-sentinel-muted">
            Red needs urgent action. Orange needs treatment. Yellow needs monitoring. Green is low priority.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={clsx(
                'min-h-10 rounded-full border px-4 py-2 text-sm font-black transition',
                filter === item.id
                  ? 'border-sentinel-primary bg-sentinel-primary text-white shadow-soft'
                  : 'border-sentinel-border bg-white text-sentinel-muted hover:border-sentinel-primary hover:text-sentinel-primary',
              )}
            >
              {item.id === 'stage34' ? 'Stage 3-4' : item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="relative min-h-[620px] overflow-hidden rounded-2xl border border-sentinel-border bg-[#17211B] shadow-inner">
          <div ref={containerRef} className="absolute inset-0" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,61,46,0.12),transparent_28%,transparent_68%,rgba(15,61,46,0.32))]" />

          <div className="absolute left-4 top-4 z-10 w-[20rem] rounded-2xl border border-white/20 bg-[rgba(8,20,14,0.94)] p-4 text-white shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#F2C94C]/18 text-[#FFE082]">
                <MapPinned className="h-6 w-6" />
              </div>
              <div>
                <div className="text-base font-black leading-tight text-white">Block 7 disease stage map</div>
                <div className="text-sm font-semibold leading-snug text-[#DDE8DF]">Mapbox satellite report view</div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-white/14 bg-white/12 p-3">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-[#BFD1C5]">Focus</div>
              <div className="mt-1 text-base font-black leading-snug text-white">TLS-scanned zone — Block 7 flagged cluster</div>
              <div className="mt-1 text-sm font-semibold leading-snug text-[#DDE8DF]">
                Checked area: ~1.5 ha GPS zone + 2-row buffer
              </div>
            </div>
          </div>

          <div className="absolute bottom-5 left-5 z-10 rounded-2xl border border-white/20 bg-[rgba(8,20,14,0.94)] p-4 text-white shadow-2xl backdrop-blur-xl">
            <div className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[#BFD1C5]">Legend</div>
            <div className="grid gap-2 text-sm font-bold text-white sm:grid-cols-2">
              {(Object.keys(stageMeta) as StageKey[]).map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: stageMeta[key].color }} />
                  <span>{stageMeta[key].legendLabel}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid content-start gap-3">
          {filteredCounts.map(({ stage, visible }) => {
            const meta = stageMeta[stage];
            const active = hoveredStage === stage || (filter !== 'all' && visible);
            return (
              <button
                key={stage}
                type="button"
                onClick={() => setFilter(stage === 'stage34' ? 'stage34' : stage === 'stage0' ? 'all' : stage)}
                className={clsx(
                  'rounded-2xl border bg-white p-4 text-left shadow-sm transition',
                  active ? 'border-sentinel-primary ring-4 ring-sentinel-primary/10' : 'border-sentinel-border',
                  visible ? 'opacity-100' : 'opacity-45',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black leading-tight text-sentinel-text">{meta.displayLabel}</div>
                    <div className="mt-1 text-xs font-black uppercase tracking-[0.1em] text-sentinel-muted">
                      {stage === 'stage34' ? 'Stage 3-4 Severe/Critical' : meta.label}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-sentinel-muted">{meta.action}</div>
                  </div>
                  <div className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                </div>
                <div className="mt-3 text-4xl font-black leading-none" style={{ color: meta.color }}>
                  {meta.count}
                </div>
                {meta.note ? <div className="mt-2 text-xs font-bold leading-snug text-sentinel-muted">{meta.note}</div> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
