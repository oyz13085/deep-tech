declare module '@mapbox/mapbox-gl-draw' {
  import type mapboxgl from 'mapbox-gl';

  class MapboxDraw implements mapboxgl.IControl {
    constructor(options?: Record<string, unknown>);
    onAdd(map: mapboxgl.Map): HTMLElement;
    onRemove(map: mapboxgl.Map): void;
    [key: string]: any;
  }

  export default MapboxDraw;
}
