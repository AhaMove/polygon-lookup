/**
 * @file The package's unit tests.
 */

import rbush from "rbush";
import { describe, expect, test } from "vitest";

import PolygonLookup from "../index.js";
import { getBoundingBox } from "../utils.js";

/**
 * Convenience function for creating a GeoJSON polygon.
 */
function geojsonPoly(coords, props) {
  return {
    type: "Feature",
    properties: props || {},
    geometry: {
      type: "Polygon",
      coordinates: coords
    }
  };
}

describe("PolygonLookup", () => {
  test("exports a class", () => {
    expect(typeof PolygonLookup).toBe("function");
    expect(PolygonLookup.prototype.constructor).toBe(PolygonLookup);
    expect(PolygonLookup.prototype.search).toBeInstanceOf(Function);
    expect(PolygonLookup.prototype.loadFeatureCollection).toBeInstanceOf(Function);
  });
});

describe("PolygonLookup.loadFeatureCollection", () => {
  test("method sets properties", () => {
    const collection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [0, 1],
                [2, 1]
              ]
            ]
          }
        }
      ]
    };

    const lookup = new PolygonLookup();
    lookup.loadFeatureCollection(collection);
    expect(lookup.rtree).toBeInstanceOf(rbush);
    expect(lookup.polygons).toEqual(collection.features);
  });
});

describe("PolygonLookup.search", () => {
  test("method searches correctly", () => {
    const collection = {
      type: "FeatureCollection",
      features: [
        geojsonPoly(
          [
            [
              [2, 2],
              [6, 4],
              [4, 7],
              [2, 2]
            ]
          ],
          { id: 1 }
        ),
        geojsonPoly(
          [
            [
              [3, 0],
              [7, 2],
              [4, 4],
              [3, 0]
            ]
          ],
          { id: 2 }
        ),
        geojsonPoly(
          [
            [
              [8, 5],
              [10, 6],
              [9, 7],
              [8, 5]
            ]
          ],
          { id: 3 }
        )
      ]
    };

    const lookup = new PolygonLookup(collection);
    const testCases = [
      { point: [1, 5] },
      { point: [6, 3] },
      { point: [4, 6], id: 1 },
      { point: [3.5, 3.5], id: 1 },
      { point: [5.5, 3.5] },
      { point: [4, 1], id: 2 },
      { point: [9, 6], id: 3 },
      { point: [9.7, 6.7] },
      { point: [10, 11] },
      { point: [3, 3.9], id: 1 }
    ];

    testCases.forEach((testCase) => {
      const pt = testCase.point;
      const poly = lookup.search(pt[0], pt[1]);
      if ("id" in testCase) {
        expect(poly.properties.id).toBe(testCase.id);
      } else {
        expect(poly).toBeUndefined();
      }
    });
  });
});

describe("PolygonLookup.search with multiple rings", () => {
  test("method handles polygons with multiple rings", () => {
    const poly1Hole = [
      [3, 3],
      [6, 3],
      [6, 7],
      [4, 6],
      [3, 3]
    ];
    const collection = {
      type: "FeatureCollection",
      features: [
        geojsonPoly(
          [
            [
              [1, 12],
              [0, 0],
              [15, -1],
              [15, 13],
              [1, 12]
            ],
            [
              [2, 11],
              [1, 2],
              [6, 0],
              [14, 0],
              [14, 11],
              [2, 11]
            ]
          ],
          { id: 0 }
        ),
        geojsonPoly(
          [
            [
              [1, 2],
              [7, 1],
              [8, 9],
              [3, 7],
              [1, 2]
            ],
            poly1Hole
          ],
          { id: 1 }
        ),
        geojsonPoly([poly1Hole], { id: 2 })
      ]
    };
    const lookup = new PolygonLookup(collection);

    const testCases = [
      { point: [10, 12], id: 0 },
      { point: [5, 4], id: 2 },
      { point: [2, 3], id: 1 },
      { point: [13, 4] }
    ];

    testCases.forEach((testCase) => {
      const pt = testCase.point;
      const poly = lookup.search(pt[0], pt[1]);
      if (!("id" in testCase)) {
        expect(poly).toBeUndefined();
      } else {
        expect(poly.properties.id).toBe(testCase.id);
      }
    });
  });
});

describe("PolygonLookup.search with limit parameter", () => {
  const collection = {
    type: "FeatureCollection",
    features: [
      geojsonPoly(
        [
          [
            [2, 2],
            [6, 4],
            [4, 7],
            [2, 2]
          ]
        ],
        { id: 1 }
      ),
      geojsonPoly(
        [
          [
            [3, 0],
            [7, 2],
            [4, 4],
            [3, 0]
          ]
        ],
        { id: 2 }
      ),
      geojsonPoly(
        [
          [
            [1, 0],
            [10, 2],
            [2, 7],
            [1, 0]
          ]
        ],
        { id: 3 }
      )
    ]
  };

  const lookup = new PolygonLookup(collection);

  test("no limit returns first matching polygon", () => {
    const point = [3, 3];
    const result = lookup.search(point[0], point[1]);
    expect(result.properties.id).toBe(1);
  });

  test("limit=1 returns FeatureCollection with one polygon", () => {
    const point = [3, 3];
    const result = lookup.search(point[0], point[1], 1);

    expect(result.type).toBe("FeatureCollection");
    expect(result.features.length).toBe(1);
    expect(result.features[0].properties.id).toBe(1);
  });

  test("limit=-1 returns all matching polygons", () => {
    const point = [3, 3];
    const result = lookup.search(point[0], point[1], -1);

    expect(result.type).toBe("FeatureCollection");
    expect(result.features.length).toBe(2);
    expect(result.features[0].properties.id).toBe(1);
    expect(result.features[1].properties.id).toBe(3);
  });

  test("no matches with limit=-1 returns empty FeatureCollection", () => {
    const point = [10, 10];
    const result = lookup.search(point[0], point[1], -1);

    expect(result.type).toBe("FeatureCollection");
    expect(result.features.length).toBe(0);
  });

  test("no matches with no limit returns undefined", () => {
    const point = [10, 10];
    const result = lookup.search(point[0], point[1]);

    expect(result).toBeUndefined();
  });
});

describe("getBoundingBox utility", () => {
  test("finds correct bounding boxes", () => {
    const testCases = [
      {
        poly: [
          [2, 2],
          [6, 4],
          [4, 7],
          [2, 2]
        ],
        bbox: { minX: 2, minY: 2, maxX: 6, maxY: 7 }
      },
      {
        poly: [
          [0, 0],
          [2, 1],
          [3, -1],
          [5, 1],
          [6, 4],
          [3, 5],
          [0, 0]
        ],
        bbox: { minX: 0, minY: -1, maxX: 6, maxY: 5 }
      },
      {
        poly: [
          [2, 1],
          [3, 0],
          [4, 3],
          [0, 5],
          [1, -3],
          [2, 1]
        ],
        bbox: { minX: 0, minY: -3, maxX: 4, maxY: 5 }
      }
    ];

    testCases.forEach((testCase) => {
      const bbox = getBoundingBox(testCase.poly);
      expect(bbox).toEqual(testCase.bbox);
    });
  });
});

describe("PolygonLookup edge cases", () => {
  test("handles undefined geometries gracefully", () => {
    const collection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {}
        }
      ]
    };

    const lookup = new PolygonLookup();
    lookup.loadFeatureCollection(collection);
    expect(lookup.rtree).toBeInstanceOf(rbush);
  });
});
