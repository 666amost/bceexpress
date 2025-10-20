// Minimal type declarations for leaflet.markercluster to satisfy TypeScript without using any
import * as L from 'leaflet';

declare module 'leaflet.markercluster' {
  // Module augmentation only for side-effect import
}

declare global {
  namespace L {
    interface MarkerClusterGroupOptions {
      disableClusteringAtZoom?: number;
      maxClusterRadius?: number | ((zoom: number) => number);
      showCoverageOnHover?: boolean;
      spiderfyOnMaxZoom?: boolean;
    }

    interface MarkerClusterGroup extends L.FeatureGroup {
      addLayer(layer: L.Layer): this;
      clearLayers(): this;
    }

    function markerClusterGroup(options?: MarkerClusterGroupOptions): MarkerClusterGroup;
  }
}

export {};
