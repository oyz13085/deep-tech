import { useEffect, useMemo, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AlertTriangle, RadioTower } from 'lucide-react';
import {
  block7Bounds,
  buildBlockFeatureCollection,
  buildBlockLabelFeatureCollection,
  buildPalmRowFeatureCollection,
  estateBoundaryFeature,
  flaggedMarkerFeatureCollection,
  mapColors,
} from '../../data/mapboxEstateData';
import { tlsScan } from '../../data/demoData';

type StationTlsScanMapProps = {
  activeStationIndex: number | null;
  capturedStations: number;
  scanning?: boolean;
  classified?: boolean;
};

type Station = {
  id: number;
  coordinates: [number, number];
};

type PalmProperties = {
  id: number;
  station: number;
  captured: boolean;
  active: boolean;
};

const stations: Station[] = [
  { id: 1, coordinates: [103.2918, 2.0394] },
  { id: 2, coordinates: [103.3015, 2.0362] },
  { id: 3, coordinates: [103.2938, 2.0278] },
  { id: 4, coordinates: [103.3039, 2.0234] },
];

const stageFillExpression: mapboxgl.Expression = [
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

function circlePolygon(center: [number, number], radius = 0.0042, steps = 64): GeoJSON.Position[] {
  const coordinates: GeoJSON.Position[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    coordinates.push([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius]);
  }
  return coordinates;
}

function buildStationCoverageFeatureCollection(
  activeStationIndex: number | null,
  capturedStations: number,
): GeoJSON.FeatureCollection<GeoJSON.Polygon, { id: number; active: boolean; captured: boolean }> {
  return {
    type: 'FeatureCollection',
    features: stations.map((station, index) => ({
      type: 'Feature',
      properties: {
        id: station.id,
        active: activeStationIndex === index,
        captured: index < capturedStations,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [circlePolygon(station.coordinates)],
      },
    })),
  };
}

function buildRouteFeatureCollection(): GeoJSON.FeatureCollection<GeoJSON.LineString, { name: string }> {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Scanner movement route' },
        geometry: {
          type: 'LineString',
          coordinates: stations.map((station) => station.coordinates),
        },
      },
    ],
  };
}

function buildStationLabelFeatureCollection(): GeoJSON.FeatureCollection<GeoJSON.Point, { id: number; label: string }> {
  return {
    type: 'FeatureCollection',
    features: stations.map((station) => ({
      type: 'Feature',
      properties: { id: station.id, label: `TLS scan station ${station.id}` },
      geometry: { type: 'Point', coordinates: station.coordinates },
    })),
  };
}

function buildPalmProfiles(
  activeStationIndex: number | null,
  capturedStations: number,
): GeoJSON.FeatureCollection<GeoJSON.Point, PalmProperties> {
  const features: GeoJSON.Feature<GeoJSON.Point, PalmProperties>[] = [];

  stations.forEach((station, stationIndex) => {
    Array.from({ length: 28 }, (_, index) => {
      const angle = (index * 137.5 * Math.PI) / 180;
      const radius = 0.0009 + (index % 6) * 0.00048;
      const rowOffset = Math.floor(index / 7) * 0.00072;
      const active = activeStationIndex === stationIndex;
      const captured = stationIndex < capturedStations || active;
      features.push({
        type: 'Feature',
        properties: {
          id: stationIndex * 100 + index,
          station: station.id,
          active,
          captured,
        },
        geometry: {
          type: 'Point',
          coordinates: [
            station.coordinates[0] + Math.cos(angle) * radius + rowOffset * 0.18,
            station.coordinates[1] + Math.sin(angle) * radius - rowOffset,
          ],
        },
      });
    });
  });

  return { type: 'FeatureCollection', features };
}

function buildScannerFeatureCollection(activeStationIndex: number | null): GeoJSON.FeatureCollection<GeoJSON.Point, { label: string }> {
  const station = activeStationIndex === null ? null : stations[activeStationIndex];
  return {
    type: 'FeatureCollection',
    features: station
      ? [
          {
            type: 'Feature',
            properties: { label: `TLS scanner at Station ${station.id}` },
            geometry: { type: 'Point', coordinates: station.coordinates },
          },
        ]
      : [],
  };
}

function buildParticleFeatureCollection(activeStationIndex: number | null): GeoJSON.FeatureCollection<GeoJSON.Point, { id: number }> {
  const station = activeStationIndex === null ? null : stations[activeStationIndex];
  if (!station) return { type: 'FeatureCollection', features: [] };

  return {
    type: 'FeatureCollection',
    features: Array.from({ length: 42 }, (_, index) => {
      const angle = (index * 91 * Math.PI) / 180;
      const radius = 0.00065 + (index % 9) * 0.00034;
      return {
        type: 'Feature',
        properties: { id: index },
        geometry: {
          type: 'Point',
          coordinates: [station.coordinates[0] + Math.cos(angle) * radius, station.coordinates[1] + Math.sin(angle) * radius],
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

export function StationTlsScanMap({
  activeStationIndex,
  capturedStations,
  scanning = false,
  classified = false,
}: StationTlsScanMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapboxToken = tokenFromEnv();
  const missingToken = !mapboxToken;

  const captureLabel = useMemo(() => {
    if (classified || capturedStations >= stations.length) return `${tlsScan.palmsScanned} palm profiles captured`;
    if (activeStationIndex === null) return 'Generating TLS scan route';
    return `Station ${stations[activeStationIndex]?.id ?? 1} capturing nearby palms`;
  }, [activeStationIndex, capturedStations, classified]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || missingToken) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [103.2968, 2.0307],
      zoom: 15.15,
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
      map.addSource('flagged-markers', { type: 'geojson', data: flaggedMarkerFeatureCollection });
      map.addSource('tls-route', { type: 'geojson', data: buildRouteFeatureCollection() });
      map.addSource('tls-stations', { type: 'geojson', data: buildStationLabelFeatureCollection() });
      map.addSource('tls-coverage', { type: 'geojson', data: buildStationCoverageFeatureCollection(activeStationIndex, capturedStations) });
      map.addSource('tls-palms', { type: 'geojson', data: buildPalmProfiles(activeStationIndex, capturedStations) });
      map.addSource('tls-scanner', { type: 'geojson', data: buildScannerFeatureCollection(activeStationIndex) });
      map.addSource('tls-particles', { type: 'geojson', data: buildParticleFeatureCollection(activeStationIndex) });

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
        paint: { 'line-color': mapColors.boundary, 'line-width': 3, 'line-opacity': 0.9 },
      });
      map.addLayer({
        id: 'block-fill',
        type: 'fill',
        source: 'estate-blocks',
        paint: { 'fill-color': stageFillExpression, 'fill-opacity': 0.54 },
      });
      map.addLayer({
        id: 'palm-row-lines',
        type: 'line',
        source: 'palm-rows',
        paint: {
          'line-color': '#F7F2DE',
          'line-width': 1.2,
          'line-opacity': 0.46,
          'line-dasharray': [3, 3],
        },
      });
      map.addLayer({
        id: 'block-outline',
        type: 'line',
        source: 'estate-blocks',
        paint: { 'line-color': '#FFF8E8', 'line-width': 2.2, 'line-opacity': 0.95 },
      });
      map.addLayer({
        id: 'flagged-marker-dot',
        type: 'circle',
        source: 'flagged-markers',
        paint: {
          'circle-radius': 7,
          'circle-color': mapColors.flagged,
          'circle-opacity': 1,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'tls-route-shadow',
        type: 'line',
        source: 'tls-route',
        paint: { 'line-color': '#0F3D2E', 'line-width': 8, 'line-opacity': 0.55, 'line-blur': 2 },
      });
      map.addLayer({
        id: 'tls-route-line',
        type: 'line',
        source: 'tls-route',
        paint: { 'line-color': mapColors.route, 'line-width': 3.5, 'line-opacity': 0.95, 'line-dasharray': [1.2, 1.2] },
      });
      map.addLayer({
        id: 'tls-coverage-fill',
        type: 'fill',
        source: 'tls-coverage',
        paint: {
          'fill-color': '#F2C94C',
          'fill-opacity': ['case', ['get', 'active'], 0.25, ['get', 'captured'], 0.16, 0.08],
        },
      });
      map.addLayer({
        id: 'tls-coverage-line',
        type: 'line',
        source: 'tls-coverage',
        paint: {
          'line-color': '#F2C94C',
          'line-width': ['case', ['get', 'active'], 3.2, 1.8],
          'line-opacity': ['case', ['get', 'active'], 0.98, 0.68],
          'line-dasharray': [2, 1.4],
        },
      });
      map.addLayer({
        id: 'tls-palms-captured',
        type: 'circle',
        source: 'tls-palms',
        paint: {
          'circle-radius': ['case', ['get', 'active'], 5.2, ['get', 'captured'], 4.2, 2.4],
          'circle-color': ['case', ['get', 'captured'], '#35D879', '#D5E7CC'],
          'circle-opacity': ['case', ['get', 'captured'], 0.95, 0.36],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': ['case', ['get', 'captured'], 1.3, 0.6],
        },
      });
      map.addLayer({
        id: 'tls-particles',
        type: 'circle',
        source: 'tls-particles',
        paint: {
          'circle-radius': 2,
          'circle-color': '#F2C94C',
          'circle-opacity': scanning ? 0.95 : 0,
          'circle-blur': 0.4,
        },
      });
      map.addLayer({
        id: 'tls-scanner-halo',
        type: 'circle',
        source: 'tls-scanner',
        paint: {
          'circle-radius': 22,
          'circle-color': '#F2C94C',
          'circle-opacity': 0.22,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1.8,
        },
      });
      map.addLayer({
        id: 'tls-scanner-dot',
        type: 'circle',
        source: 'tls-scanner',
        paint: {
          'circle-radius': 8,
          'circle-color': '#0F3D2E',
          'circle-stroke-color': '#F2C94C',
          'circle-stroke-width': 3,
        },
      });
      map.addLayer({
        id: 'tls-station-labels',
        type: 'symbol',
        source: 'tls-stations',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 12,
          'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
          'text-offset': [0, -2.2],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': 'rgba(0,0,0,0.92)',
          'text-halo-width': 2.4,
          'text-halo-blur': 0.5,
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

      map.fitBounds(block7Bounds, { padding: 64, maxZoom: 15.72, duration: 600 });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken, missingToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    updateSource(map, 'tls-coverage', buildStationCoverageFeatureCollection(activeStationIndex, capturedStations));
    updateSource(map, 'tls-palms', buildPalmProfiles(activeStationIndex, capturedStations));
    updateSource(map, 'tls-scanner', buildScannerFeatureCollection(activeStationIndex));
    updateSource(map, 'tls-particles', buildParticleFeatureCollection(activeStationIndex));
    if (map.getLayer('tls-particles')) {
      map.setPaintProperty('tls-particles', 'circle-opacity', scanning ? 0.95 : 0);
    }
  }, [activeStationIndex, capturedStations, scanning]);

  if (missingToken) {
    return (
      <div className="grid min-h-[590px] place-items-center rounded-2xl border border-sentinel-border bg-sentinel-surface p-8 text-center">
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
    <div className="relative min-h-[590px] overflow-hidden rounded-2xl border border-sentinel-border bg-[#17211B] shadow-panel">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,61,46,0.12),transparent_28%,transparent_68%,rgba(15,61,46,0.32))]" />

      <div className="absolute left-4 top-4 z-10 w-[20rem] rounded-2xl border border-white/20 bg-[rgba(8,20,14,0.94)] p-4 text-white shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#F2C94C]/18 text-[#FFE082]">
            <RadioTower className="h-6 w-6" />
          </div>
          <div>
            <div className="text-base font-black leading-tight text-white">Block 7 TLS station scan</div>
            <div className="text-sm font-semibold leading-snug text-[#DDE8DF]">Mapbox satellite scan view</div>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-white/14 bg-white/12 p-3">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-[#BFD1C5]">Status</div>
          <div className="mt-1 text-base font-black leading-snug text-white">{captureLabel}</div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold text-[#DDE8DF]">
          <div className="rounded-xl border border-white/12 bg-white/10 p-3">
            <div className="font-black text-white">4 stations</div>
            <div className="leading-snug">multi-station TLS route</div>
          </div>
          <div className="rounded-xl border border-white/12 bg-white/10 p-3">
            <div className="font-black text-white">9m radius</div>
            <div className="leading-snug">per scan station</div>
          </div>
        </div>
      </div>

      <div className="absolute right-4 top-4 z-10 rounded-2xl border border-white/20 bg-[rgba(8,20,14,0.94)] px-4 py-3 text-sm font-black text-white shadow-2xl backdrop-blur-xl">
        9m coverage radius per station
      </div>

      <div className="absolute bottom-5 left-5 z-10 rounded-2xl border border-white/20 bg-[rgba(8,20,14,0.94)] p-4 text-white shadow-2xl backdrop-blur-xl">
        <div className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[#BFD1C5]">TLS overlay</div>
        <div className="space-y-2 text-sm font-bold text-white">
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full bg-[#F2C94C]" />
            <span>Scanner movement route</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full bg-[#35D879]" />
            <span>Captured palms</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-sm bg-[#EB5757]" />
            <span>TLS confirmation required</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-5 right-5 z-10 w-[22rem] max-w-[calc(100%-2rem)] rounded-2xl border border-white/20 bg-[rgba(8,20,14,0.94)] p-4 text-white shadow-2xl backdrop-blur-xl">
        <div className="text-xs font-black uppercase tracking-[0.14em] text-[#BFD1C5]">Scan scope</div>
        <div className="mt-2 text-base font-black leading-snug text-white">Targeted GPS zone + 2-row buffer</div>
        <div className="mt-3 rounded-xl border border-[#7EE2A8]/25 bg-[#7EE2A8]/12 px-3 py-2">
          <div className="text-2xl font-black leading-tight text-[#7EE2A8]">
            {tlsScan.palmsScanned} palm profiles captured
          </div>
        </div>
        <div className="mt-3 space-y-1 text-sm font-bold leading-snug text-[#DDE8DF]">
          <div>~1.5 ha TLS scan zone</div>
          <div>TLS captures sent to UM IP model</div>
          <div className="text-[#BFD1C5]">Demo visualisation</div>
        </div>
      </div>
    </div>
  );
}
