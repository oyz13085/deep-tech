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
  { id: 1,  name: 'B1',  hectares: 38, coords: [[103.399576,2.120063],[103.399334,2.119712],[103.398714,2.118642],[103.398905,2.118646],[103.399625,2.119011],[103.399894,2.119004],[103.400487,2.119332],[103.400521,2.119392],[103.400166,2.119504],[103.399576,2.120059],[103.399576,2.120063]] },
  { id: 2,  name: 'B2',  hectares: 42, coords: [[103.398714,2.118652],[103.397912,2.118648],[103.39774,2.118708],[103.397706,2.119148],[103.397886,2.119316],[103.398292,2.119532],[103.398934,2.120132],[103.399289,2.120315],[103.399584,2.120058],[103.39933,2.119715],[103.398714,2.118652]] },
  { id: 3,  name: 'B3',  hectares: 45, coords: [[103.3977,2.119145],[103.396446,2.118159],[103.39628,2.117864],[103.396167,2.117828],[103.396131,2.117638],[103.395996,2.117581],[103.395606,2.117329],[103.395204,2.117099],[103.395181,2.116891],[103.395216,2.116859],[103.397572,2.118162],[103.397791,2.11822],[103.398468,2.118219],[103.39872,2.118646],[103.397909,2.118648],[103.397743,2.11871],[103.397701,2.119145],[103.3977,2.119145]] },
  { id: 4,  name: 'B4',  hectares: 36, coords: [[103.396378,2.117476],[103.39641,2.117395],[103.396393,2.116063],[103.396273,2.115887],[103.395825,2.116156],[103.395311,2.1165],[103.395038,2.11674],[103.396378,2.117476]] },
  { id: 5,  name: 'B5',  hectares: 40, coords: [[103.396278,2.115885],[103.396783,2.115568],[103.397433,2.116348],[103.397635,2.116829],[103.39677,2.117331],[103.396505,2.117539],[103.396385,2.117483],[103.396416,2.117396],[103.396408,2.116726],[103.3964,2.116064],[103.396338,2.115974],[103.396278,2.115886],[103.396278,2.115885]] },
  { id: 6,  name: 'B6',  hectares: 38, coords: [[103.398428,2.118187],[103.397795,2.118209],[103.39758,2.118149],[103.396509,2.11754],[103.396789,2.117327],[103.397632,2.116834],[103.398022,2.11754],[103.39843,2.118187],[103.398428,2.118187]] },
  { id: 7,  name: 'B7',  hectares: 44, coords: [[103.398197,2.117767],[103.399666,2.116835],[103.400756,2.117421],[103.400617,2.117617],[103.399329,2.118439],[103.399189,2.118446],[103.398761,2.118217],[103.398602,2.118205],[103.398453,2.118211],[103.398197,2.117767]] },
  { id: 8,  name: 'B8',  hectares: 41, coords: [[103.39758,2.116687],[103.397783,2.116567],[103.39799,2.116423],[103.398404,2.116152],[103.399662,2.116833],[103.398924,2.117299],[103.398193,2.117762],[103.397677,2.116892],[103.397581,2.116687],[103.39758,2.116687]] },
  { id: 9,  name: 'B9',  hectares: 35, coords: [[103.397581,2.116684],[103.397437,2.116349],[103.397112,2.115958],[103.39695,2.115763],[103.396869,2.115662],[103.396785,2.115567],[103.396943,2.11543],[103.397146,2.115573],[103.39729,2.115798],[103.397494,2.115856],[103.397627,2.115852],[103.39782,2.115714],[103.397862,2.115567],[103.397846,2.115307],[103.397519,2.115086],[103.397496,2.115047],[103.397739,2.114848],[103.397994,2.115009],[103.398127,2.115182],[103.398177,2.115391],[103.398196,2.115709],[103.398266,2.115961],[103.398325,2.116073],[103.398398,2.116151],[103.397988,2.116418],[103.397788,2.116558],[103.39758,2.116683],[103.397581,2.116684]] },
  { id: 10, name: 'B10', hectares: 37, coords: [[103.399307,2.118847],[103.399963,2.118441],[103.401195,2.117659],[103.400765,2.117425],[103.400746,2.117454],[103.400731,2.117478],[103.400698,2.117519],[103.400667,2.117562],[103.400623,2.11762],[103.399996,2.118025],[103.399322,2.118448],[103.39926,2.118453],[103.39919,2.118452],[103.398778,2.118231],[103.398626,2.118215],[103.398485,2.118218],[103.398722,2.118644],[103.398898,2.118644],[103.399307,2.118843],[103.399307,2.118847]] },
  { id: 11, name: 'B11', hectares: 39, coords: [[103.399982,2.119057],[103.401752,2.117943],[103.401199,2.117659],[103.400262,2.118255],[103.399791,2.118552],[103.399319,2.118847],[103.399615,2.119003],[103.399877,2.118999],[103.399982,2.119057]] },
  { id: 12, name: 'B12', hectares: 45, coords: [[103.399991,2.119059],[103.400491,2.11932],[103.400522,2.119394],[103.402433,2.118159],[103.402136,2.118139],[103.401743,2.117945],[103.399991,2.119059]] },
];

export const mapColors = {
  neutral:  neutralBlockColor,
  clear:    '#2EAD5B',
  monitor:  '#F2A93B',
  flagged:  '#EB5757',
  boundary: '#FFF8E8',
  route:    '#F2C94C',
};

export const estateBounds: [[number, number], [number, number]] = [
  [103.395038, 2.114848],
  [103.402433, 2.120315],
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
  // Proper polygon centroid using the signed-area formula so concave blocks
  // don't push the label into a neighbouring compartment.
  const pts = coords[coords.length - 1][0] === coords[0][0] && coords[coords.length - 1][1] === coords[0][1]
    ? coords.slice(0, -1)
    : coords;
  const n = pts.length;
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area /= 2;
  return [cx / (6 * area), cy / (6 * area)];
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
      name: block.name,
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
      name: block.name,
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
      properties: { id, name: block?.name ?? `B${id}` },
      geometry: {
        type: 'Point',
        coordinates: centroid((block?.coords ?? blockSeeds[6].coords) as [number, number][]),
      },
    };
  }),
};
