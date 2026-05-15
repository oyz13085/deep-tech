import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AlertTriangle, Layers, LocateFixed, ScanLine } from 'lucide-react';
import {
  block7Bounds,
  buildBlockFeatureCollection,
  buildBlockLabelFeatureCollection,
  buildPalmRowFeatureCollection,
  estateBoundaryFeature,
  estateBounds,
  flaggedMarkerFeatureCollection,
  mapColors,
} from '../../data/mapboxEstateData';
import { estate } from '../../data/demoData';
import { Button } from '../ui/Button';

type GanodermaMapboxFlowProps = {
  mode?: 'drone';
  scanComplete?: boolean;
  onRunTls?: () => void;
};

const fillExpression: mapboxgl.Expression = [
  'match',
  ['get', 'status'],
  'TLS confirmation required',
  mapColors.flagged,
  'No visible severe canopy anomaly',
  mapColors.clear,
  mapColors.neutral,
];

function tokenFromEnv() {
  return import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
}

export function GanodermaMapboxFlow({
  scanComplete = false,
  onRunTls,
}: GanodermaMapboxFlowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [pulseRadius, setPulseRadius] = useState(18);
  const revealStatus = scanComplete;
  const mapboxToken = tokenFromEnv();

  const missingToken = !mapboxToken;

  const statusCopy = useMemo(() => {
    if (scanComplete) return '2 GPS anomaly zones flagged. Zooming to Block 7.';
    return 'Drone / field pre-screening in progress';
  }, [scanComplete]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || missingToken) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [103.302, 2.025],
      zoom: 12.85,
      maxZoom: 19,
      pitch: 0,
      bearing: -8,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('estate-boundary', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [estateBoundaryFeature] },
      });
      map.addSource('estate-blocks', {
        type: 'geojson',
        data: buildBlockFeatureCollection(revealStatus),
      });
      map.addSource('block-labels', {
        type: 'geojson',
        data: buildBlockLabelFeatureCollection(revealStatus),
      });
      map.addSource('palm-rows', {
        type: 'geojson',
        data: buildPalmRowFeatureCollection(),
      });
      map.addSource('flagged-markers', {
        type: 'geojson',
        data: flaggedMarkerFeatureCollection,
      });

      map.addLayer({
        id: 'estate-boundary-fill',
        type: 'fill',
        source: 'estate-boundary',
        paint: {
          'fill-color': '#1F7A4D',
          'fill-opacity': 0.08,
        },
      });

      map.addLayer({
        id: 'estate-boundary-line',
        type: 'line',
        source: 'estate-boundary',
        paint: {
          'line-color': mapColors.boundary,
          'line-width': 3,
          'line-opacity': 0.9,
        },
      });

      map.addLayer({
        id: 'block-fill',
        type: 'fill',
        source: 'estate-blocks',
        paint: {
          'fill-color': fillExpression,
          'fill-opacity': ['case', ['==', ['get', 'status'], 'Scanning'], 0.34, 0.58],
        },
      });

      map.addLayer({
        id: 'palm-row-lines',
        type: 'line',
        source: 'palm-rows',
        paint: {
          'line-color': '#F7F2DE',
          'line-width': 1.2,
          'line-opacity': 0.48,
          'line-dasharray': [3, 3],
        },
      });

      map.addLayer({
        id: 'block-outline',
        type: 'line',
        source: 'estate-blocks',
        paint: {
          'line-color': '#FFF8E8',
          'line-width': 2.2,
          'line-opacity': 0.95,
        },
      });

      map.addLayer({
        id: 'block-selected',
        type: 'line',
        source: 'estate-blocks',
        filter: ['==', ['get', 'id'], selectedBlock ?? ''],
        paint: {
          'line-color': '#FFFFFF',
          'line-width': 5,
          'line-opacity': 0.95,
        },
      });

      map.addLayer({
        id: 'block-labels',
        type: 'symbol',
        source: 'block-labels',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 11, 15, 15],
          'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': 'rgba(0,0,0,0.9)',
          'text-halo-width': 2.4,
          'text-halo-blur': 0.5,
        },
      });

      map.addLayer({
        id: 'flagged-marker-halo',
        type: 'circle',
        source: 'flagged-markers',
        paint: {
          'circle-radius': pulseRadius,
          'circle-color': mapColors.flagged,
          'circle-opacity': revealStatus ? 0.18 : 0,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1,
          'circle-stroke-opacity': revealStatus ? 0.55 : 0,
        },
      });

      map.addLayer({
        id: 'flagged-marker-dot',
        type: 'circle',
        source: 'flagged-markers',
        paint: {
          'circle-radius': 7,
          'circle-color': mapColors.flagged,
          'circle-opacity': revealStatus ? 1 : 0,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });

      map.on('mouseenter', 'block-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'block-fill', () => {
        map.getCanvas().style.cursor = '';
        popupRef.current?.remove();
      });
      map.on('mousemove', 'block-fill', (event) => {
        const feature = event.features?.[0] as GeoJSON.Feature<GeoJSON.Polygon, { id: number; name: string; status: string }> | undefined;
        if (!feature?.properties || !event.lngLat) return;
        const isFlagged = feature.properties.status === 'TLS confirmation required';
        const status = isFlagged ? 'TLS confirmation required' : 'No visible severe canopy anomaly';
        const body = isFlagged
          ? 'Flagged GPS zone + 2-row buffer.<br/>Click to inspect / run targeted TLS scan.'
          : 'No visible severe canopy anomaly.';
        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup({
          className: 'ganoderma-map-popup',
          closeButton: false,
          closeOnClick: false,
          offset: 12,
        })
          .setLngLat(event.lngLat)
          .setHTML(`<div style="min-width:230px;padding:12px 14px;border-radius:16px;background:rgba(8,20,14,.96);border:1px solid rgba(255,255,255,.18);font:700 13px/1.4 Inter,ui-sans-serif,system-ui,sans-serif;color:#FFFFFF;box-shadow:0 18px 38px rgba(0,0,0,.38)"><div style="font-size:15px;font-weight:900;line-height:1.25">${feature.properties.name}</div><div style="display:inline-flex;align-items:center;gap:7px;margin-top:8px;border-radius:999px;background:${isFlagged ? 'rgba(235,87,87,.22)' : 'rgba(126,226,168,.18)'};border:1px solid ${isFlagged ? 'rgba(255,186,186,.35)' : 'rgba(126,226,168,.35)'};padding:5px 9px;color:#FFFFFF;font-size:12px;font-weight:900"><span style="width:8px;height:8px;border-radius:999px;background:${isFlagged ? '#FF7B7B' : '#7EE2A8'}"></span>${status}</div><div style="margin-top:8px;color:#DDE8DF;font-weight:700">${body}</div></div>`)
          .addTo(map);
      });
      map.on('click', 'block-fill', (event) => {
        const feature = event.features?.[0] as GeoJSON.Feature<GeoJSON.Polygon, { id: number; status: string }> | undefined;
        const blockId = feature?.properties?.id;
        if (!blockId) return;
        setSelectedBlock(blockId);
        if (blockId === 7) {
          map.fitBounds(block7Bounds, { padding: 88, maxZoom: 15.65, duration: 900 });
        }
      });

      setMapReady(true);
      map.fitBounds(estateBounds, { padding: 72, maxZoom: 13.1, duration: 500 });
    });

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [mapboxToken, missingToken]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const blockSource = mapRef.current.getSource('estate-blocks') as mapboxgl.GeoJSONSource | undefined;
    const labelSource = mapRef.current.getSource('block-labels') as mapboxgl.GeoJSONSource | undefined;
    blockSource?.setData(buildBlockFeatureCollection(revealStatus));
    labelSource?.setData(buildBlockLabelFeatureCollection(revealStatus));

    if (mapRef.current.getLayer('flagged-marker-halo')) {
      mapRef.current.setPaintProperty('flagged-marker-halo', 'circle-opacity', revealStatus ? 0.18 : 0);
      mapRef.current.setPaintProperty('flagged-marker-halo', 'circle-stroke-opacity', revealStatus ? 0.55 : 0);
      mapRef.current.setPaintProperty('flagged-marker-dot', 'circle-opacity', revealStatus ? 1 : 0);
    }

    if (revealStatus) {
      setSelectedBlock(7);
      mapRef.current.fitBounds(block7Bounds, { padding: 90, maxZoom: 15.65, duration: 1200 });
    }
  }, [mapReady, revealStatus]);

  useEffect(() => {
    if (!mapReady || !mapRef.current?.getLayer('block-selected')) return;
    mapRef.current.setFilter('block-selected', ['==', ['get', 'id'], selectedBlock ?? '']);
  }, [mapReady, selectedBlock]);

  useEffect(() => {
    if (!revealStatus || !mapReady || !mapRef.current?.getLayer('flagged-marker-halo')) return;
    const timer = window.setInterval(() => {
      setPulseRadius((current) => (current >= 28 ? 15 : current + 1.5));
    }, 80);
    return () => window.clearInterval(timer);
  }, [mapReady, revealStatus]);

  useEffect(() => {
    if (!mapReady || !mapRef.current?.getLayer('flagged-marker-halo')) return;
    mapRef.current.setPaintProperty('flagged-marker-halo', 'circle-radius', pulseRadius);
    mapRef.current.setPaintProperty('flagged-marker-halo', 'circle-opacity', revealStatus ? Math.max(0.06, (30 - pulseRadius) / 78) : 0);
  }, [mapReady, pulseRadius, revealStatus]);

  if (missingToken) {
    return (
      <div className="grid min-h-[680px] place-items-center rounded-2xl border border-sentinel-border bg-sentinel-surface p-8 text-center">
        <div>
          <AlertTriangle className="mx-auto h-10 w-10 text-sentinel-severe" />
          <h3 className="mt-4 text-2xl font-black text-sentinel-text">Mapbox token missing</h3>
          <p className="mt-2 text-lg font-semibold text-sentinel-muted">
            Mapbox token missing. Add VITE_MAPBOX_TOKEN to .env.local.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[680px] overflow-hidden rounded-2xl border border-sentinel-border bg-[#17211B] shadow-panel">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,61,46,0.2),transparent_26%,transparent_70%,rgba(15,61,46,0.28))]" />

      <div className="absolute left-4 top-4 z-10 w-[19rem] rounded-2xl border border-white/20 bg-[rgba(8,20,14,0.94)] p-4 text-white shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-[#F2C94C]" />
          <div>
            <div className="text-base font-black leading-tight text-white">{estate.productName}</div>
            <div className="text-sm font-semibold leading-snug text-[#DDE8DF]">Mapbox satellite estate view</div>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-white/14 bg-white/12 p-3">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-[#BFD1C5]">Status</div>
          <div className="mt-1 text-base font-black leading-snug text-white">{statusCopy}</div>
        </div>
        <div className="mt-3 grid gap-2">
          <BlockListButton
            block="Block 7"
            status="TLS confirmation required"
            selected={selectedBlock === 7}
            revealStatus={revealStatus}
            onClick={() => {
              setSelectedBlock(7);
              mapRef.current?.fitBounds(block7Bounds, { padding: 86, maxZoom: 15.65, duration: 850 });
            }}
          />
          <BlockListButton
            block="Block 9"
            status="TLS confirmation pending"
            selected={selectedBlock === 9}
            revealStatus={revealStatus}
            onClick={() => setSelectedBlock(9)}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => mapRef.current?.fitBounds(block7Bounds, { padding: 86, maxZoom: 15.65, duration: 850 })}
        className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-2xl border border-white/20 bg-[rgba(8,20,14,0.94)] px-4 py-3 text-sm font-black text-white shadow-2xl backdrop-blur-xl transition hover:bg-[rgba(8,20,14,0.98)]"
      >
        <LocateFixed className="h-5 w-5 text-[#F2C94C]" />
        Locate Block 7
      </button>

      <div className="absolute bottom-5 left-5 z-10 rounded-2xl border border-white/20 bg-[rgba(8,20,14,0.94)] p-4 text-white shadow-2xl backdrop-blur-xl">
        <div className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[#BFD1C5]">Legend</div>
        <div className="space-y-2 text-sm font-bold text-white">
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-sm bg-[#2EAD5B]" />
            <span>No visible severe canopy anomaly</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-sm bg-[#EB5757]" />
            <span>TLS confirmation required</span>
          </div>
        </div>
      </div>

      {revealStatus ? (
        <div className="absolute bottom-5 right-5 z-10 w-[25rem] max-w-[calc(100%-2rem)] rounded-2xl border border-white/20 bg-[rgba(8,20,14,0.94)] p-5 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FF7B7B]/18 text-[#FFB3B3]">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div>
              <div className="text-2xl font-black leading-tight text-white">
                Block 7 - TLS Confirmation Required
              </div>
              <div className="mt-2 text-base font-black text-[#DDE8DF]">Targeted TLS scan zone: ~1.5 ha</div>
              <p className="mt-2 text-base font-semibold leading-snug text-[#E6F0EA]">
                Flagged GPS anomaly zone + 2-row buffer.
              </p>
              <p className="mt-2 text-base font-black leading-snug text-[#7EE2A8]">
                Targeted TLS confirmation recommended. BSR stage classification happens after targeted TLS + UM IP analysis.
              </p>
            </div>
          </div>
          <Button type="button" className="mt-5 w-full" onClick={onRunTls} icon={<ScanLine className="h-5 w-5" />}>
            Run Targeted TLS Scan
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function BlockListButton({
  block,
  status,
  selected,
  revealStatus,
  onClick,
}: {
  block: string;
  status: string;
  selected: boolean;
  revealStatus: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!revealStatus}
      className={`rounded-xl border px-3 py-3 text-left transition ${
        selected ? 'border-[#F2C94C]/90 bg-[#F2C94C]/16' : 'border-white/18 bg-white/10 hover:bg-white/14'
      } ${revealStatus ? 'text-white' : 'text-[#BFD1C5]'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-black">{block}</span>
        <span className={`h-2.5 w-2.5 rounded-full ${revealStatus ? 'bg-[#EB5757]' : 'bg-white/30'}`} />
      </div>
      <div className="mt-1 text-sm font-semibold leading-snug text-[#DDE8DF]">
        {revealStatus ? status : 'Awaiting drone / field pre-screening'}
      </div>
    </button>
  );
}
