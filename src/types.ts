/**
 * TypeScript type definitions for polygon-lookup
 */

export type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";

/**
 * Bounding box structure used in the R-tree spatial index.
 */
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  polyId?: number;
}

/**
 * Configuration options for PolygonLookup.
 */
export interface PolygonLookupOptions {
  /**
   * Spatial index type to use
   * - 'rbush': Dynamic R-tree (default) - allows modifications after build
   * - 'flatbush': Static packed R-tree - 2-4x faster, but immutable after build
   * @default 'rbush'
   */
  indexType?: "rbush" | "flatbush";

  /**
   * Node size for the spatial index (affects performance)
   * @default 16 for flatbush, 9 for rbush
   */
  nodeSize?: number;
}
