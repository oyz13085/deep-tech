import { blocks, neutralBlockColor } from './demoData';

export type MapBlockProperties = {
  id: number;
  name: string;
  status: string;
  hectares: number;
};

type PolygonFeature = GeoJSON.Feature<GeoJSON.Polygon, MapBlockProperties>;
type LabelFeature = GeoJSON.Feature<GeoJSON.Point, MapBlockProperties>;
type RowFeature = GeoJSON.Feature<GeoJSON.LineString, { blockId: number; row: number }>;

const blockStatusById = new Map(blocks.map((block) => [block.id, block.status]));

const blockSeeds = [
  { id: 1, hectares: 39, coords: [[103.244, 2.064], [103.258, 2.071], [103.273, 2.067], [103.271, 2.053], [103.251, 2.050], [103.244, 2.064]] },
  { id: 2, hectares: 43, coords: [[103.273, 2.067], [103.289, 2.069], [103.303, 2.061], [103.300, 2.047], [103.282, 2.045], [103.271, 2.053], [103.273, 2.067]] },
  { id: 3, hectares: 41, coords: [[103.303, 2.061], [103.320, 2.061], [103.335, 2.052], [103.328, 2.039], [103.309, 2.038], [103.300, 2.047], [103.303, 2.061]] },
  { id: 4, hectares: 36, coords: [[103.335, 2.052], [103.350, 2.046], [103.358, 2.032], [103.348, 2.020], [103.331, 2.024], [103.328, 2.039], [103.335, 2.052]] },
  { id: 5, hectares: 44, coords: [[103.358, 2.032], [103.371, 2.021], [103.375, 2.006], [103.361, 1.995], [103.342, 2.004], [103.348, 2.020], [103.358, 2.032]] },
  { id: 6, hectares: 38, coords: [[103.251, 2.050], [103.271, 2.053], [103.282, 2.034], [103.274, 2.016], [103.253, 2.017], [103.238, 2.031], [103.251, 2.050]] },
  { id: 7, hectares: 42, coords: [[103.282, 2.045], [103.300, 2.047], [103.309, 2.028], [103.301, 2.012], [103.279, 2.012], [103.274, 2.016], [103.282, 2.034], [103.282, 2.045]] },
  { id: 8, hectares: 40, coords: [[103.309, 2.038], [103.328, 2.039], [103.331, 2.024], [103.322, 2.006], [103.301, 2.012], [103.309, 2.028], [103.309, 2.038]] },
  { id: 9, hectares: 37, coords: [[103.331, 2.024], [103.348, 2.020], [103.342, 2.004], [103.324, 1.991], [103.322, 2.006], [103.331, 2.024]] },
  { id: 10, hectares: 41, coords: [[103.274, 2.016], [103.301, 2.012], [103.298, 1.991], [103.276, 1.984], [103.257, 1.996], [103.253, 2.017], [103.274, 2.016]] },
  { id: 11, hectares: 39, coords: [[103.301, 2.012], [103.322, 2.006], [103.324, 1.991], [103.307, 1.973], [103.288, 1.976], [103.298, 1.991], [103.301, 2.012]] },
  { id: 12, hectares: 34, coords: [[103.324, 1.991], [103.342, 2.004], [103.361, 1.995], [103.345, 1.974], [103.322, 1.964], [103.307, 1.973], [103.324, 1.991]] },
];

export const mapColors = {
  neutral: neutralBlockColor,
  clear: '#2EAD5B',
  flagged: '#EB5757',
  boundary: '#FFF8E8',
  route: '#F2C94C',
};

export const estateBounds: [[number, number], [number, number]] = [
  [103.232, 1.956],
  [103.382, 2.078],
];

export const block7Bounds: [[number, number], [number, number]] = [
  [103.271, 2.006],
  [103.313, 2.052],
];

export const estateBoundaryFeature: GeoJSON.Feature<GeoJSON.Polygon, { name: string }> = {
  type: 'Feature',
  properties: { name: 'Johor Estate A' },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [103.238, 2.070],
      [103.282, 2.079],
      [103.329, 2.066],
      [103.366, 2.039],
      [103.382, 2.006],
      [103.355, 1.972],
      [103.314, 1.956],
      [103.270, 1.979],
      [103.238, 2.006],
      [103.232, 2.040],
      [103.238, 2.070],
    ]],
  },
};

function centroid(coords: [number, number][]): [number, number] {
  const unique = coords.slice(0, -1);
  const total = unique.reduce(
    (acc, point) => [acc[0] + point[0], acc[1] + point[1]],
    [0, 0],
  );
  return [total[0] / unique.length, total[1] / unique.length];
}

function statusForBlock(id: number, revealStatus: boolean) {
  if (!revealStatus) return 'Scanning';
  return blockStatusById.get(id) ?? 'No visible severe canopy anomaly';
}

export function buildBlockFeatureCollection(revealStatus: boolean): GeoJSON.FeatureCollection<GeoJSON.Polygon, MapBlockProperties> {
  const features: PolygonFeature[] = blockSeeds.map((block) => ({
    type: 'Feature',
    properties: {
      id: block.id,
      name: `Block ${block.id}`,
      status: statusForBlock(block.id, revealStatus),
      hectares: block.hectares,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [block.coords as [number, number][]],
    },
  }));

  return { type: 'FeatureCollection', features };
}

export function buildBlockLabelFeatureCollection(revealStatus: boolean): GeoJSON.FeatureCollection<GeoJSON.Point, MapBlockProperties> {
  const features: LabelFeature[] = blockSeeds.map((block) => ({
    type: 'Feature',
    properties: {
      id: block.id,
      name: `Block ${block.id}`,
      status: statusForBlock(block.id, revealStatus),
      hectares: block.hectares,
    },
    geometry: {
      type: 'Point',
      coordinates: centroid(block.coords as [number, number][]),
    },
  }));

  return { type: 'FeatureCollection', features };
}

export function buildPalmRowFeatureCollection(): GeoJSON.FeatureCollection<GeoJSON.LineString, { blockId: number; row: number }> {
  const features: RowFeature[] = [];

  blockSeeds.forEach((block) => {
    const coords = block.coords as [number, number][];
    const lngs = coords.map((point) => point[0]);
    const lats = coords.map((point) => point[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    Array.from({ length: 5 }, (_, index) => index + 1).forEach((row) => {
      const lat = minLat + ((maxLat - minLat) / 6) * row;
      features.push({
        type: 'Feature',
        properties: { blockId: block.id, row },
        geometry: {
          type: 'LineString',
          coordinates: [
            [minLng + (maxLng - minLng) * 0.12, lat],
            [maxLng - (maxLng - minLng) * 0.12, lat],
          ],
        },
      });
    });
  });

  return { type: 'FeatureCollection', features };
}

export const flaggedMarkerFeatureCollection: GeoJSON.FeatureCollection<GeoJSON.Point, { id: number; name: string }> = {
  type: 'FeatureCollection',
  features: [7, 9].map((id) => {
    const block = blockSeeds.find((item) => item.id === id);
    return {
      type: 'Feature',
      properties: { id, name: `Block ${id}` },
      geometry: {
        type: 'Point',
        coordinates: centroid((block?.coords ?? blockSeeds[6].coords) as [number, number][]),
      },
    };
  }),
};
