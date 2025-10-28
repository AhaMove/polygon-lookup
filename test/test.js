/**
 * @file The package's unit tests.
 */

import rbush from "rbush";
import tape from "tape";
import { format } from "util";

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

tape("Exports a class", (test) => {
  test.equal(typeof PolygonLookup, "function", "Is a class constructor.");
  test.ok(PolygonLookup.prototype.constructor === PolygonLookup, "Has proper prototype chain.");
  test.ok(PolygonLookup.prototype.search instanceof Function, "Has search method.");
  test.ok(
    PolygonLookup.prototype.loadFeatureCollection instanceof Function,
    "Has loadFeatureCollection method."
  );
  test.end();
});

tape("PolygonLookup.loadFeatureCollection method sets properties", (test) => {
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
  test.ok(lookup.rtree instanceof rbush, "Creates R-tree index.");
  test.deepEqual(lookup.polygons, collection.features, "Stores polygon features.");
  test.end();
});

tape("PolygonLookup.search method searches correctly", (test) => {
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
      test.equal(poly.properties.id, testCase.id, `Point ${pt} intersects polygon ${testCase.id}`);
    } else {
      test.equal(poly, undefined, `Point ${pt} intersects no polygon`);
    }
  });
  test.end();
});

tape("PolygonLookup.search method handles polygons with multiple rings", (test) => {
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
      test.equal(poly, undefined, `Point ${pt} intersects no polygon`);
    } else {
      test.equal(poly.properties.id, testCase.id, format("Point %j intersects polygon %d", pt, testCase.id));
    }
  });
  test.end();
});

tape("PolygonLookup.search method respects limit parameter", (test) => {
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

  test.test("no limit returns first matching polygon", (t) => {
    const point = [3, 3];
    const result = lookup.search(point[0], point[1]);
    t.equal(result.properties.id, 1, "Returns first matching polygon");
    t.end();
  });

  test.test("limit=1 returns FeatureCollection with one polygon", (t) => {
    const point = [3, 3];
    const result = lookup.search(point[0], point[1], 1);

    t.equal(result.type, "FeatureCollection", "Returns FeatureCollection");
    t.equal(result.features.length, 1, "Contains one feature");
    t.equal(result.features[0].properties.id, 1, "Contains first matching polygon");
    t.end();
  });

  test.test("limit=-1 returns all matching polygons", (t) => {
    const point = [3, 3];
    const result = lookup.search(point[0], point[1], -1);

    t.equal(result.type, "FeatureCollection", "Returns FeatureCollection");
    t.equal(result.features.length, 2, "Contains all matching features");
    t.equal(result.features[0].properties.id, 1, "Contains first polygon");
    t.equal(result.features[1].properties.id, 3, "Contains second polygon");
    t.end();
  });

  test.test("no matches with limit=-1 returns empty FeatureCollection", (t) => {
    const point = [10, 10];
    const result = lookup.search(point[0], point[1], -1);

    t.equal(result.type, "FeatureCollection", "Returns FeatureCollection");
    t.equal(result.features.length, 0, "Contains no features");
    t.end();
  });

  test.test("no matches with no limit returns undefined", (t) => {
    const point = [10, 10];
    const result = lookup.search(point[0], point[1]);

    t.equal(result, undefined, "Returns undefined");
    t.end();
  });
});

tape("getBoundingBox utility function finds correct bounding boxes", (test) => {
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
    test.deepEqual(bbox, testCase.bbox, "Calculates correct bounding box");
  });

  test.end();
});

tape("PolygonLookup handles undefined geometries gracefully", (test) => {
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
  test.ok(lookup.rtree instanceof rbush, "Creates valid R-tree even with undefined geometries");
  test.end();
});
