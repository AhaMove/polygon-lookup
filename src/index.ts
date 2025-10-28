/**
 * Exports a `PolygonLookup` class, which constructs a data-structure for
 * quickly finding the polygon that a point intersects in a (potentially very
 * large) set.
 */

import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import * as turf from "@turf/helpers";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type RBush from "rbush";
import Rbush from "rbush";

import type { BoundingBox } from "./types.js";
import { getBoundingBox } from "./utils.js";

/**
 * Calculate point in polygon intersection, accounting for any holes.
 * @private
 * @param point - The [x, y] coordinate to test.
 * @param polygon - A GeoJSON Feature with Polygon geometry.
 * @returns True if the point is inside the polygon (and not in any holes), false otherwise.
 */
function pointInPolygonWithHoles(point: number[], polygon: Feature<Polygon>): boolean {
  const { coordinates } = polygon.geometry;
  const mainPolygon = coordinates[0];
  if (!mainPolygon) {
    return false;
  }

  // Create a GeoJSON point using turf.point
  const pointGeoJSON = turf.point(point);

  // Create a GeoJSON polygon for the main polygon using turf.polygon
  const mainPolygonGeoJSON = turf.polygon([mainPolygon]);

  if (booleanPointInPolygon(pointGeoJSON, mainPolygonGeoJSON)) {
    for (let subPolyInd = 1; subPolyInd < coordinates.length; subPolyInd++) {
      const holePolygon = coordinates[subPolyInd];
      if (!holePolygon) continue;

      // Create a GeoJSON polygon for each hole using turf.polygon
      const holePolygonGeoJSON = turf.polygon([holePolygon]);

      if (booleanPointInPolygon(pointGeoJSON, holePolygonGeoJSON)) {
        return false;
      }
    }
    return true;
  }
  return false;
}

class PolygonLookup {
  /**
   * R-tree spatial index containing bounding boxes with polygon references.
   */
  rtree!: RBush<BoundingBox>;

  /**
   * Array of indexed GeoJSON polygon features.
   */
  polygons!: Array<Feature<Polygon>>;

  /**
   * Create a new PolygonLookup instance.
   *
   * @param featureCollection - Optional GeoJSON FeatureCollection to index immediately
   * @throws Error if featureCollection is invalid
   */
  constructor(featureCollection?: FeatureCollection<Polygon | MultiPolygon>) {
    if (featureCollection !== undefined) {
      this.loadFeatureCollection(featureCollection);
    }
  }

  /**
   * Internal helper method to return a single matching polygon.
   * @private
   * @param x - The x-coordinate to search for.
   * @param y - The y-coordinate to search for.
   * @returns The first polygon that intersects (x, y), or undefined if none found.
   */
  private searchForOnePolygon(x: number, y: number): Feature<Polygon> | undefined {
    // find which bboxes contain the search point. their polygons _may_ intersect that point
    const bboxes = this.rtree.search({ minX: x, minY: y, maxX: x, maxY: y });

    const point = [x, y];

    // get the polygon for each possibly matching polygon based on the searched bboxes
    const polygons = bboxes.map((bbox) => this.polygons[bbox.polyId!]!);

    return polygons.find((poly) => pointInPolygonWithHoles(point, poly));
  }

  /**
   * Internal helper method to return multiple matching polygons, up to a given limit.
   * @private
   * @param x - The x-coordinate to search for.
   * @param y - The y-coordinate to search for.
   * @param limit - Maximum number of results to return. Use -1 for unlimited.
   * @returns A GeoJSON FeatureCollection containing matching polygons (up to limit).
   */
  private searchForMultiplePolygons(x: number, y: number, limit: number): FeatureCollection<Polygon> {
    const safeLimit = limit === -1 ? Number.MAX_SAFE_INTEGER : limit;

    const point = [x, y];
    const bboxes = this.rtree.search({ minX: x, minY: y, maxX: x, maxY: y });

    // get the polygon for each possibly matching polygon based on the searched bboxes
    let polygons = bboxes.map((bbox) => this.polygons[bbox.polyId!]!);

    // keep track of matches to avoid extra expensive calculations if limit reached
    let matchesFound = 0;

    // filter matching polygons, up to the limit
    polygons = polygons.filter((polygon) => {
      // short circuit if limit reached
      if (matchesFound >= safeLimit) {
        return false;
      }

      const intersects = pointInPolygonWithHoles(point, polygon);
      if (intersects) {
        matchesFound++;
        return true;
      }
      return false;
    });

    // return all matching polygons as a GeoJSON FeatureCollection
    return {
      type: "FeatureCollection",
      features: polygons
    };
  }

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
   * Find polygon(s) that a point intersects. Execute a bounding-box search to
   * narrow down the candidate polygons to a small subset, and then perform
   * additional point-in-polygon intersections to resolve any ambiguities.
   *
   * @param x - The x-coordinate of the point.
   * @param y - The y-coordinate of the point.
   * @param limit - Number of results to return (-1 to return all the results).
   * @returns If one or more bounding box intersections are found and limit is undefined,
   *    return the first polygon that intersects (`x`, `y`); otherwise, `undefined`.
   *    If a limit is passed in, return intersecting polygons as a GeoJSON FeatureCollection.
   */
  search(x: number, y: number, limit?: number): Feature<Polygon> | FeatureCollection<Polygon> | undefined {
    if (limit === undefined) {
      return this.searchForOnePolygon(x, y);
    }
    return this.searchForMultiplePolygons(x, y, limit);
  }

  /**
   * Build spatial index from a GeoJSON FeatureCollection.
   *
   * MultiPolygons are automatically expanded into individual Polygons.
   * Properly handles polygons with holes.
   *
   * @param collection - GeoJSON FeatureCollection with Polygon or MultiPolygon features
   * @throws Error if collection is null, undefined, or missing features property
   */
  loadFeatureCollection(collection: FeatureCollection<Polygon | MultiPolygon>): void {
    if (!collection) {
      throw new Error("PolygonLookup.loadFeatureCollection: collection parameter is required");
    }

    if (!collection.features) {
      throw new Error("PolygonLookup.loadFeatureCollection: collection must have a 'features' property");
    }

    if (!Array.isArray(collection.features)) {
      throw new Error("PolygonLookup.loadFeatureCollection: collection.features must be an array");
    }

    const bboxes: BoundingBox[] = [];
    const polygons: Array<Feature<Polygon>> = [];
    let polyId = 0;

    const indexPolygon = (poly: Feature<Polygon>): void => {
      polygons.push(poly);
      const coordinates = poly.geometry.coordinates[0];
      if (!coordinates) return;

      const bbox = getBoundingBox(coordinates);
      bbox.polyId = polyId++;
      bboxes.push(bbox);
    };

    const indexFeature = (poly: Feature<Polygon | MultiPolygon>): void => {
      if (
        poly.geometry &&
        poly.geometry.coordinates[0] !== undefined &&
        poly.geometry.coordinates[0].length > 0
      ) {
        switch (poly.geometry.type) {
          case "Polygon": {
            indexPolygon(poly as Feature<Polygon>);
            break;
          }

          case "MultiPolygon": {
            const multiPoly = poly as Feature<MultiPolygon>;
            const childPolys = multiPoly.geometry.coordinates;
            for (let ind = 0; ind < childPolys.length; ind++) {
              const childPolyCoords = childPolys[ind];
              if (!childPolyCoords) continue;

              const childPoly: Feature<Polygon> = {
                type: "Feature",
                properties: poly.properties,
                geometry: {
                  type: "Polygon",
                  coordinates: childPolyCoords
                }
              };
              indexPolygon(childPoly);
            }
            break;
          }
          default:
            break;
        }
      }
    };

    collection.features.forEach(indexFeature);
    this.rtree = new Rbush<BoundingBox>().load(bboxes);
    this.polygons = polygons;
  }
}

export default PolygonLookup;
export type { BoundingBox } from "./types.js";
export { getBoundingBox } from "./utils.js";
