# polygon-lookup

> Inspired by [Pelias Polygon Lookup](https://github.com/pelias/polygon-lookup) with TypeScript, updated dependencies, and ESM support

A data-structure for performing fast, accurate point-in-polygon intersections against (potentially very large) sets of
polygons. `PolygonLookup` builds an [R-tree](http://en.wikipedia.org/wiki/R-tree), or bounding-box spatial index, for its
polygons and uses it to quickly narrow down the set of candidate polygons for any given point. If there are any
ambiguities, it'll perform point-in-polygon intersections to identify the one that *really* intersects. `PolygonLookup`
operates entirely in memory, and works best for polygons with little overlap.

**Features:**
- ✅ TypeScript with full type safety
- ✅ ESM module support
- ✅ Updated dependencies
- ✅ Comprehensive type definitions
- ✅ Optional [Flatbush](https://github.com/mourner/flatbush) backend for 2-4x faster performance

## Performance Optimization with Flatbush

By default, polygon-lookup uses RBush, a dynamic R-tree that allows modifications after building the index. For performance-critical applications where the polygon set is static, you can opt into Flatbush:

```typescript
// Default: RBush (dynamic, flexible)
const lookup = new PolygonLookup(geojson);

// Performance mode: Flatbush (static, fast)
const lookupFast = new PolygonLookup(geojson, { indexType: 'flatbush' });
```

### When to Use Flatbush

✅ **Use Flatbush when:**
- You load all polygons once and never modify the index
- Performance is critical (millions of queries)
- Working with large datasets (>100K polygons)
- Memory usage is a concern

❌ **Stick with RBush when:**
- You need to add/remove polygons dynamically
- Dataset is small (<10K polygons) where performance difference is negligible

### Performance Comparison

Based on [Flatbush benchmarks](https://github.com/mourner/flatbush) with 1,000,000 rectangles:

| Operation | RBush | Flatbush | Speedup |
|-----------|-------|----------|---------|
| Build index | 1143ms | 273ms | **4.2x faster** |
| 1000 searches (1% area) | 155ms | 63ms | **2.5x faster** |
| 1000 searches (0.01% area) | 17ms | 6ms | **2.8x faster** |

**Key Benefits:**
- 2-4x faster indexing and queries
- 50-70% lower memory usage
- O(log n + k) query complexity for both backends

### Configuration Options

```typescript
interface PolygonLookupOptions {
  indexType?: 'rbush' | 'flatbush';  // Default: 'rbush'
  nodeSize?: number;                  // Default: 16 (flatbush), 9 (rbush)
}
```

**Note:** Flatbush indexes are immutable after building. To update polygons, create a new PolygonLookup instance.

## API

##### `PolygonLookup(featureCollection, options)`

* `featureCollection` (**optional**): A GeoJSON collection to optionally immediately load with `.loadFeatureCollection()`.
* `options` (**optional**): Configuration options object
  * `indexType`: `'rbush'` (default) or `'flatbush'` - Spatial index backend to use
  * `nodeSize`: Custom node size for the spatial index (default: 16 for flatbush, 9 for rbush)

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

##### `getBoundingBox(coordinates)` (Utility Function)

Calculates the axis-aligned bounding box for polygon coordinates. This utility is exported from the package and can be used independently.

* `coordinates`: GeoJSON polygon coordinate array (array of rings, where each ring is an array of [x, y] positions)
* `return`: Object with `{ minX, minY, maxX, maxY }` representing the bounding box

**Example:**
```typescript
import { getBoundingBox } from '@ahamove/polygon-lookup';

const coords = [[[0, 1], [2, 1], [3, 4], [1, 5], [0, 1]]];
const bbox = getBoundingBox(coords);
// bbox = { minX: 0, minY: 1, maxX: 3, maxY: 5 }
```

## Example Usage

### Basic Usage

```typescript
import PolygonLookup from '@ahamove/polygon-lookup';

const geojson = {
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

const lookup = new PolygonLookup(geojson);
const poly = lookup.search(1, 2);
console.log(poly.properties.id); // 'bar'
```

### Finding Multiple Polygons with `limit`

```typescript
// Single result (default)
const singlePoly = lookup.search(1, 2);

// Up to 3 results as FeatureCollection
const multiplePolys = lookup.search(1, 2, 3);
console.log(multiplePolys.features.length); // Up to 3

// All intersecting polygons
const allPolys = lookup.search(1, 2, -1);
```

### MultiPolygons and Holes

MultiPolygons are automatically expanded into individual polygons with shared properties. Polygons with holes are correctly handled—points inside holes return `undefined`.
