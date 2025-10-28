import type { Position } from "geojson";

import type { BoundingBox } from "./types.js";

/**
 * Calculate axis-aligned bounding box for a polygon coordinate ring.
 *
 * @param poly - Array of coordinate positions forming a polygon ring
 * @returns Bounding box with min/max X and Y coordinates
 */
function getBoundingBox(poly: Position[]): BoundingBox {
  const firstPt = poly[0];
  if (!firstPt || firstPt[0] === undefined || firstPt[1] === undefined) {
    throw new Error("getBoundingBox: polygon ring must contain at least one valid point");
  }

  const bbox: BoundingBox = {
    minX: firstPt[0],
    minY: firstPt[1],
    maxX: firstPt[0],
    maxY: firstPt[1]
  };

  for (let ind = 1; ind < poly.length; ind++) {
    const pt = poly[ind];
    if (!pt) continue;

    const x = pt[0];
    const y = pt[1];

    if (x === undefined || y === undefined) continue;

    if (x < bbox.minX) {
      bbox.minX = x;
    } else if (x > bbox.maxX) {
      bbox.maxX = x;
    }

    if (y < bbox.minY) {
      bbox.minY = y;
    } else if (y > bbox.maxY) {
      bbox.maxY = y;
    }
  }

  return bbox;
}

export { getBoundingBox };
