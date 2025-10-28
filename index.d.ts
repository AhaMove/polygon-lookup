/**
 * TypeScript definitions for polygon-lookup
 *
 * Provides spatial indexing and fast point-in-polygon queries using R-tree.
 */

import type { Feature, FeatureCollection, Polygon, Position } from 'geojson';
import type RBush from 'rbush';

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
 * Calculate axis-aligned bounding box for a polygon coordinate ring.
 *
 * @param poly - Array of coordinate positions forming a polygon ring
 * @returns Bounding box with min/max X and Y coordinates
 */
export function getBoundingBox(poly: Position[]): BoundingBox;

/**
 * PolygonLookup provides fast spatial queries for point-in-polygon intersection
 * against large sets of polygons using R-tree indexing.
 *
 * @example
 * ```typescript
 * import PolygonLookup from 'polygon-lookup';
 * import { FeatureCollection } from 'geojson';
 *
 * const featureCollection: FeatureCollection = { ... };
 * const lookup = new PolygonLookup(featureCollection);
 *
 * // Find single polygon
 * const polygon = lookup.search(-77.0364, 38.8951);
 *
 * // Find multiple polygons
 * const polygons = lookup.search(-77.0364, 38.8951, 5);
 * ```
 */
export default class PolygonLookup {
  /**
   * R-tree spatial index containing bounding boxes with polygon references.
   */
  rtree: RBush<BoundingBox>;

  /**
   * Array of indexed GeoJSON polygon features.
   */
  polygons: Array<Feature<Polygon>>;

  /**
   * Create a new PolygonLookup instance.
   *
   * @param featureCollection - Optional GeoJSON FeatureCollection to index immediately
   * @throws Error if featureCollection is invalid
   */
  constructor(featureCollection?: FeatureCollection<Polygon>);

  /**
   * Find the first polygon that contains the given point.
   *
   * @param x - The x-coordinate (longitude)
   * @param y - The y-coordinate (latitude)
   * @returns The first intersecting polygon feature, or undefined if none found
   */
  search(x: number, y: number): Feature<Polygon> | undefined;

  /**
   * Find multiple polygons that contain the given point, up to a specified limit.
   *
   * @param x - The x-coordinate (longitude)
   * @param y - The y-coordinate (latitude)
   * @param limit - Maximum number of results to return. Use -1 for all results.
   * @returns FeatureCollection containing matching polygon features (up to limit)
   */
  search(x: number, y: number, limit: number): FeatureCollection<Polygon>;

  /**
   * Build spatial index from a GeoJSON FeatureCollection.
   *
   * MultiPolygons are automatically expanded into individual Polygons.
   * Properly handles polygons with holes.
   *
   * @param collection - GeoJSON FeatureCollection with Polygon or MultiPolygon features
   * @throws Error if collection is null, undefined, or missing features property
   */
  loadFeatureCollection(collection: FeatureCollection<Polygon>): void;
}
