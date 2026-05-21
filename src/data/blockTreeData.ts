export type TreeStatus = 'healthy' | 'mild' | 'moderate' | 'severe';

export type BlockDrillStats = {
  total: number;
  healthy: number;
  mild: number;
  moderate: number;
  severe: number;
};

export type BlockDrillData = {
  trees: GeoJSON.FeatureCollection<GeoJSON.Point, { status: TreeStatus }>;
  rows: GeoJSON.FeatureCollection<GeoJSON.LineString, Record<string, never>>;
  stats: BlockDrillStats;
  bounds: [[number, number], [number, number]];
  blockName: string;
  hectares: number;
};

// ── helpers ──────────────────────────────────────────────────────────────────

function pip(pt: [number, number], poly: [number, number][]): boolean {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polyBounds(poly: [number, number][]): [[number, number], [number, number]] {
  const lngs = poly.map((p) => p[0]);
  const lats  = poly.map((p) => p[1]);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

function hIntersect(lat: number, poly: [number, number][]): number[] {
  const xs: number[] = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[j];
    if ((y1 <= lat && y2 > lat) || (y2 <= lat && y1 > lat)) {
      xs.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1));
    }
  }
  return xs.sort((a, b) => a - b);
}

function deterministicRand(seed: number, i: number): number {
  const x = Math.sin(seed * 9301 + i * 49297 + 233) * 43758.5453;
  return x - Math.floor(x);
}

function buildRowFeatures(
  poly: [number, number][],
  rowStep: number,
): GeoJSON.Feature<GeoJSON.LineString, Record<string, never>>[] {
  const [[, minLat], [, maxLat]] = polyBounds(poly);
  const features: GeoJSON.Feature<GeoJSON.LineString, Record<string, never>>[] = [];
  let ri = 0;
  for (let lat = minLat + rowStep * 0.5; lat < maxLat; lat += rowStep, ri++) {
    if (ri % 3 !== 0) continue;
    const xs = hIntersect(lat, poly);
    if (xs.length >= 2) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [[xs[0], lat], [xs[xs.length - 1], lat]] },
      });
    }
  }
  return features;
}

function generateGrid(
  poly: [number, number][],
  rowStep: number,
  colStep: number,
): [number, number][] {
  const [[minLng, minLat], [maxLng, maxLat]] = polyBounds(poly);
  const pts: [number, number][] = [];
  let ri = 0;
  for (let lat = minLat + rowStep * 0.5; lat < maxLat; lat += rowStep, ri++) {
    const offset = (ri % 2) * colStep * 0.5;
    for (let lng = minLng + colStep * 0.5 + offset; lng < maxLng; lng += colStep) {
      if (pip([lng, lat], poly)) pts.push([lng, lat]);
    }
  }
  return pts;
}

// ── Cluster-based: infection radiates from epicenter (B7, B9) ─────────────────

function buildClusterData(
  poly: [number, number][],
  epicenter: [number, number],
  target: BlockDrillStats,
  blockName: string,
  hectares: number,
  rowStep: number,
  colStep: number,
): BlockDrillData {
  const candidates = generateGrid(poly, rowStep, colStep);

  candidates.sort(
    (a, b) =>
      (a[0] - epicenter[0]) ** 2 + (a[1] - epicenter[1]) ** 2 -
      ((b[0] - epicenter[0]) ** 2 + (b[1] - epicenter[1]) ** 2),
  );

  const take = Math.min(target.total, candidates.length);
  const selected = candidates.slice(0, take);

  const severeCut   = target.severe;
  const moderateCut = target.severe + target.moderate;
  const mildCut     = target.severe + target.moderate + target.mild;

  const treeFeatures = selected.map((pt, i) => ({
    type: 'Feature' as const,
    properties: {
      status: (i < severeCut   ? 'severe'
             : i < moderateCut ? 'moderate'
             : i < mildCut     ? 'mild'
             :                   'healthy') as TreeStatus,
    },
    geometry: { type: 'Point' as const, coordinates: pt },
  }));

  const stats: BlockDrillStats = {
    total:    treeFeatures.length,
    healthy:  treeFeatures.filter((f) => f.properties.status === 'healthy').length,
    mild:     treeFeatures.filter((f) => f.properties.status === 'mild').length,
    moderate: treeFeatures.filter((f) => f.properties.status === 'moderate').length,
    severe:   treeFeatures.filter((f) => f.properties.status === 'severe').length,
  };

  return {
    trees: { type: 'FeatureCollection', features: treeFeatures },
    rows:  { type: 'FeatureCollection', features: buildRowFeatures(poly, rowStep) },
    stats,
    bounds: polyBounds(poly),
    blockName,
    hectares,
  };
}

// ── Scatter-based: severity distributed across block (green / monitor blocks) ─

function buildScatterData(
  poly: [number, number][],
  blockId: number,
  mildPct: number,
  moderatePct: number,
  severePct: number,
  blockName: string,
  hectares: number,
  rowStep: number,
  colStep: number,
): BlockDrillData {
  const candidates = generateGrid(poly, rowStep, colStep);

  const treeFeatures = candidates.map((pt, i) => {
    const r = deterministicRand(blockId * 97, i);
    const status: TreeStatus =
      r < severePct                         ? 'severe'
      : r < severePct + moderatePct         ? 'moderate'
      : r < severePct + moderatePct + mildPct ? 'mild'
      : 'healthy';
    return {
      type: 'Feature' as const,
      properties: { status },
      geometry: { type: 'Point' as const, coordinates: pt },
    };
  });

  const stats: BlockDrillStats = {
    total:    treeFeatures.length,
    healthy:  treeFeatures.filter((f) => f.properties.status === 'healthy').length,
    mild:     treeFeatures.filter((f) => f.properties.status === 'mild').length,
    moderate: treeFeatures.filter((f) => f.properties.status === 'moderate').length,
    severe:   treeFeatures.filter((f) => f.properties.status === 'severe').length,
  };

  return {
    trees: { type: 'FeatureCollection', features: treeFeatures },
    rows:  { type: 'FeatureCollection', features: buildRowFeatures(poly, rowStep) },
    stats,
    bounds: polyBounds(poly),
    blockName,
    hectares,
  };
}

// ── Block polygon coordinates (from mapboxEstateData) ─────────────────────────

const B1: [number, number][] = [[103.399576,2.120063],[103.399334,2.119712],[103.398714,2.118642],[103.398905,2.118646],[103.399625,2.119011],[103.399894,2.119004],[103.400487,2.119332],[103.400521,2.119392],[103.400166,2.119504],[103.399576,2.120059],[103.399576,2.120063]];
const B2: [number, number][] = [[103.398714,2.118652],[103.397912,2.118648],[103.39774,2.118708],[103.397706,2.119148],[103.397886,2.119316],[103.398292,2.119532],[103.398934,2.120132],[103.399289,2.120315],[103.399584,2.120058],[103.39933,2.119715],[103.398714,2.118652]];
const B3: [number, number][] = [[103.3977,2.119145],[103.396446,2.118159],[103.39628,2.117864],[103.396167,2.117828],[103.396131,2.117638],[103.395996,2.117581],[103.395606,2.117329],[103.395204,2.117099],[103.395181,2.116891],[103.395216,2.116859],[103.397572,2.118162],[103.397791,2.11822],[103.398468,2.118219],[103.39872,2.118646],[103.397909,2.118648],[103.397743,2.11871],[103.397701,2.119145],[103.3977,2.119145]];
const B4: [number, number][] = [[103.396378,2.117476],[103.39641,2.117395],[103.396393,2.116063],[103.396273,2.115887],[103.395825,2.116156],[103.395311,2.1165],[103.395038,2.11674],[103.396378,2.117476]];
const B5: [number, number][] = [[103.396278,2.115885],[103.396783,2.115568],[103.397433,2.116348],[103.397635,2.116829],[103.39677,2.117331],[103.396505,2.117539],[103.396385,2.117483],[103.396416,2.117396],[103.396408,2.116726],[103.3964,2.116064],[103.396338,2.115974],[103.396278,2.115886],[103.396278,2.115885]];
const B6: [number, number][] = [[103.398428,2.118187],[103.397795,2.118209],[103.39758,2.118149],[103.396509,2.11754],[103.396789,2.117327],[103.397632,2.116834],[103.398022,2.11754],[103.39843,2.118187],[103.398428,2.118187]];
const B7: [number, number][] = [[103.398197,2.117767],[103.399666,2.116835],[103.400756,2.117421],[103.400617,2.117617],[103.399329,2.118439],[103.399189,2.118446],[103.398761,2.118217],[103.398602,2.118205],[103.398453,2.118211],[103.398197,2.117767]];
const B8: [number, number][] = [[103.39758,2.116687],[103.397783,2.116567],[103.39799,2.116423],[103.398404,2.116152],[103.399662,2.116833],[103.398924,2.117299],[103.398193,2.117762],[103.397677,2.116892],[103.397581,2.116687],[103.39758,2.116687]];
const B9: [number, number][] = [[103.397581,2.116684],[103.397437,2.116349],[103.397112,2.115958],[103.39695,2.115763],[103.396869,2.115662],[103.396785,2.115567],[103.396943,2.11543],[103.397146,2.115573],[103.39729,2.115798],[103.397494,2.115856],[103.397627,2.115852],[103.39782,2.115714],[103.397862,2.115567],[103.397846,2.115307],[103.397519,2.115086],[103.397496,2.115047],[103.397739,2.114848],[103.397994,2.115009],[103.398127,2.115182],[103.398177,2.115391],[103.398196,2.115709],[103.398266,2.115961],[103.398325,2.116073],[103.398398,2.116151],[103.397988,2.116418],[103.397788,2.116558],[103.39758,2.116683],[103.397581,2.116684]];
const B10: [number, number][] = [[103.399307,2.118847],[103.399963,2.118441],[103.401195,2.117659],[103.400765,2.117425],[103.400746,2.117454],[103.400731,2.117478],[103.400698,2.117519],[103.400667,2.117562],[103.400623,2.11762],[103.399996,2.118025],[103.399322,2.118448],[103.39926,2.118453],[103.39919,2.118452],[103.398778,2.118231],[103.398626,2.118215],[103.398485,2.118218],[103.398722,2.118644],[103.398898,2.118644],[103.399307,2.118843],[103.399307,2.118847]];
const B11: [number, number][] = [[103.399982,2.119057],[103.401752,2.117943],[103.401199,2.117659],[103.400262,2.118255],[103.399791,2.118552],[103.399319,2.118847],[103.399615,2.119003],[103.399877,2.118999],[103.399982,2.119057]];
const B12: [number, number][] = [[103.399991,2.119059],[103.400491,2.11932],[103.400522,2.119394],[103.402433,2.118159],[103.402136,2.118139],[103.401743,2.117945],[103.399991,2.119059]];

const RS = 0.000090; // row step (~10 m lat)
const CS = 0.000120; // col step (~10 m lng)

// ── All 12 blocks ─────────────────────────────────────────────────────────────
export const allBlockDrillData: Record<number, BlockDrillData> = {
  1:  buildScatterData(B1,  1,  0.04, 0.01, 0.00, 'B1',  38, RS, CS),
  2:  buildScatterData(B2,  2,  0.05, 0.02, 0.00, 'B2',  42, RS, CS),
  3:  buildScatterData(B3,  3,  0.03, 0.00, 0.00, 'B3',  45, RS, CS),
  4:  buildScatterData(B4,  4,  0.06, 0.02, 0.01, 'B4',  36, RS, CS),
  5:  buildScatterData(B5,  5,  0.03, 0.01, 0.00, 'B5',  40, RS, CS),
  6:  buildScatterData(B6,  6,  0.07, 0.04, 0.01, 'B6',  38, RS, CS),
  7:  buildClusterData(B7,  [103.399700, 2.118200], { total: 204, healthy: 53, mild: 87, moderate: 41, severe: 23 }, 'B7', 44, RS, CS),
  8:  buildScatterData(B8,  8,  0.04, 0.02, 0.00, 'B8',  41, RS, CS),
  9:  buildClusterData(B9,  [103.397700, 2.115650], { total: 150, healthy: 52, mild: 58, moderate: 27, severe: 13 }, 'B9', 35, RS, CS),
  10: buildScatterData(B10, 10, 0.06, 0.03, 0.01, 'B10', 37, RS, CS),
  11: buildScatterData(B11, 11, 0.03, 0.01, 0.00, 'B11', 39, RS, CS),
  12: buildScatterData(B12, 12, 0.02, 0.00, 0.00, 'B12', 45, RS, CS),
};

// ── Combined GeoJSON for the all-blocks estate view ───────────────────────────
export function buildAllTreesGeoJSON(): GeoJSON.FeatureCollection<GeoJSON.Point, { status: TreeStatus }> {
  const features = Object.values(allBlockDrillData).flatMap((d) => d.trees.features);
  return { type: 'FeatureCollection', features };
}
