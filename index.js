/**
 * Exports a `PolygonLookup` class, which constructs a data-structure for
 * quickly finding the polygon that a point intersects in a (potentially very
 * large) set.
 */

import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import * as turf from "@turf/helpers";
import Rbush from "rbush";

import { getBoundingBox } from "./utils.js";

// Calculate point in polygon intersection, accounting for any holes
function pointInPolygonWithHoles(point, polygons) {
  const mainPolygon = polygons.geometry.coordinates[0];
  // Create a GeoJSON point using turf.point
  const pointGeoJSON = turf.point(point);

  // Create a GeoJSON polygon for the main polygon using turf.polygon
  const mainPolygonGeoJSON = turf.polygon([mainPolygon]);

  if (booleanPointInPolygon(pointGeoJSON, mainPolygonGeoJSON)) {
    for (let subPolyInd = 1; subPolyInd < polygons.geometry.coordinates.length; subPolyInd++) {
      // Create a GeoJSON polygon for each hole using turf.polygon
      const holePolygonGeoJSON = turf.polygon([polygons.geometry.coordinates[subPolyInd]]);

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
   * @property {rbush} rtree A spatial index for polygons.
   * @property {object} polygons A GeoJSON feature collection.
   *
   * @param {object} [featureCollection] An optional GeoJSON feature collection
   *    to pass to `loadFeatureCollection()`.
   */
  constructor(featureCollection) {
    if (featureCollection !== undefined) {
      this.loadFeatureCollection(featureCollection);
    }
  }

  /*
   * Internal helper method to return a single matching polygon
   */
  searchForOnePolygon(x, y) {
    // find which bboxes contain the search point. their polygons _may_ intersect that point
    const bboxes = this.rtree.search({ minX: x, minY: y, maxX: x, maxY: y });

    const point = [x, y];

    // get the polygon for each possibly matching polygon based on the searched bboxes
    const polygons = bboxes.map((bbox, index) => this.polygons[bboxes[index].polyId]);

    return polygons.find((poly) => pointInPolygonWithHoles(point, poly));
  }

  /*
   * Internal helper method to return multiple matching polygons, up to a given limit.
   * A limit of -1 means unlimited
   */
  searchForMultiplePolygons(x, y, limit) {
    const safeLimit = limit === -1 ? Number.MAX_SAFE_INTEGER : limit;

    const point = [x, y];
    const bboxes = this.rtree.search({ minX: x, minY: y, maxX: x, maxY: y });

    // get the polygon for each possibly matching polygon based on the searched bboxes
    let polygons = bboxes.map((bbox, index) => this.polygons[bboxes[index].polyId]);

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
   * Find polygon(s) that a point intersects. Execute a bounding-box search to
   * narrow down the candidate polygons to a small subset, and then perform
   * additional point-in-polygon intersections to resolve any ambiguities.
   *
   * @param {number} x The x-coordinate of the point.
   * @param {number} y The y-coordinate of the point.
   * @param {number} [limit] Number of results to return (-1 to return all the results).
   * @return {undefined|object} If one or more bounding box intersections are
   *    found and limit is undefined, return the first polygon that intersects (`x`, `y`); otherwise,
   *    `undefined`. If a limit is passed in, return intercecting polygons as a GeoJSON FeatureCollection.
   */
  search(x, y, limit) {
    if (limit === undefined) {
      return this.searchForOnePolygon(x, y);
    }
    return this.searchForMultiplePolygons(x, y, limit);
  }

  /**
   * Build a spatial index for a set of polygons, and store both the polygons and
   * the index in this `PolygonLookup`.
   *
   * @param {object} collection A GeoJSON-formatted FeatureCollection.
   */
  loadFeatureCollection(collection) {
    const bboxes = [];
    const polygons = [];
    let polyId = 0;

    const indexPolygon = (poly) => {
      polygons.push(poly);
      const bbox = getBoundingBox(poly.geometry.coordinates[0]);
      bbox.polyId = polyId++;
      bboxes.push(bbox);
    };

    const indexFeature = (poly) => {
      if (
        poly.geometry &&
        poly.geometry.coordinates[0] !== undefined &&
        poly.geometry.coordinates[0].length > 0
      ) {
        switch (poly.geometry.type) {
          case "Polygon": {
            indexPolygon(poly);
            break;
          }

          case "MultiPolygon": {
            const childPolys = poly.geometry.coordinates;
            for (let ind = 0; ind < childPolys.length; ind++) {
              const childPoly = {
                type: "Feature",
                properties: poly.properties,
                geometry: {
                  type: "Polygon",
                  coordinates: childPolys[ind]
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
    this.rtree = new Rbush().load(bboxes);
    this.polygons = polygons;
  }
}

export default PolygonLookup;
