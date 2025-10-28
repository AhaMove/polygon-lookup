# polygon-lookup

<!-- [![Greenkeeper badge](https://badges.greenkeeper.io/pelias/polygon-lookup.svg)](https://greenkeeper.io/)

[![NPM](https://nodei.co/npm/polygon-lookup.png)](https://nodei.co/npm/polygon-lookup/) -->

## Inspired by [Pelias Polygon Lookup](https://github.com/pelias/polygon-lookup) with updated dependencies and ESM

A data-structure for performing fast, accurate point-in-polygon intersections against (potentially very large) sets of
polygons. `PolygonLookup` builds an [R-tree](http://en.wikipedia.org/wiki/R-tree), or bounding-box spatial index, for its
polygons and uses it to quickly narrow down the set of candidate polygons for any given point. If there are any
ambiguities, it'll perform point-in-polygon intersections to identify the one that *really* intersects. `PolygonLookup`
operates entirely in memory, and works best for polygons with little overlap.

## API

##### `PolygonLookup(featureCollection)`

* `featureCollection` (**optional**): A GeoJSON collection to optionally immediately load with `.loadFeatureCollection()`.

##### `PolygonLookup.search(x, y, limit)`

Narrows down the candidate polygons by bounding-box, and then performs point-in-polygon intersections to identify the first n container polygon (with n = limit, even if more polygons really do intersect).

* `x`: the x-coordinate to search for
* `y`: the y-coordinate to search for
* `limit` **optional**: the upper bound for number of intersecting polygon found (default value is 1, -1 to return all intersecting polygons)
* `return`: the intersecting polygon if one was found; a GeoJson FeatureCollection if multiple polygons were found and limit > 1; otherwise, `undefined`.

##### `PolygonLookup.loadFeatureCollection(featureCollection)`

Stores a feature collection in this `PolygonLookup`, and builds a spatial index for it. The polygons and rtree can be
accessed via the `.polygons` and `.rtree` properties.

* `featureCollection` (**optional**): A GeoJSON collection containing some Polygons/MultiPolygons. Note that
    MultiPolygons will get expanded into multiple polygons.

## Example Usage

### Basic Usage

```javascript
import PolygonLookup from '@ahamove/polygon-lookup';

const featureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { id: 'bar' },
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 1], [2, 1], [3, 4], [1, 5], [0, 1]]]
    }
  }]
};

const lookup = new PolygonLookup(featureCollection);
const poly = lookup.search(1, 2);
console.log(poly.properties.id); // bar
```

### Using the `limit` Parameter

Find multiple overlapping polygons:

```javascript
// Without limit - returns first matching polygon
const singlePoly = lookup.search(1, 2);
console.log(singlePoly.properties.id); // Returns single polygon object

// With limit=3 - returns up to 3 matching polygons as FeatureCollection
const multiplePolys = lookup.search(1, 2, 3);
console.log(multiplePolys.type); // 'FeatureCollection'
console.log(multiplePolys.features.length); // Number of matching polygons (up to 3)

// With limit=-1 - returns ALL matching polygons
const allPolys = lookup.search(1, 2, -1);
console.log(allPolys.features.length); // All intersecting polygons
```

### Working with MultiPolygons

MultiPolygons are automatically expanded into individual polygons during indexing:

```javascript
const multiPolygonCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { country: 'USA' },
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        // Alaska polygon
        [[[−170, 63], [−170, 68], [−140, 68], [−140, 63], [−170, 63]]],
        // Contiguous US polygon
        [[[−125, 25], [−125, 49], [−65, 49], [−65, 25], [−125, 25]]]
      ]
    }
  }]
};

const lookup = new PolygonLookup(multiPolygonCollection);
// Both Alaska and mainland coordinates will match the same properties
const alaskaPoly = lookup.search(−150, 65);
const mainlandPoly = lookup.search(−100, 40);
console.log(alaskaPoly.properties.country); // 'USA'
console.log(mainlandPoly.properties.country); // 'USA'
```

### Polygons with Holes

The library correctly handles polygons with holes (donuts):

```javascript
const polygonWithHole = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { id: 'donut' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        // Outer ring
        [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
        // Hole (inner ring)
        [[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]]
      ]
    }
  }]
};

const lookup = new PolygonLookup(polygonWithHole);
const outsideHole = lookup.search(1, 1); // Inside outer ring
console.log(outsideHole.properties.id); // 'donut'

const insideHole = lookup.search(5, 5); // Inside the hole
console.log(insideHole); // undefined (holes are excluded)
```
