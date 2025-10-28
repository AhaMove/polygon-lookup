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
