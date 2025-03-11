function getBoundingBox(poly) {
  const firstPt = poly[0];
  const bbox = {
    minX: firstPt[0],
    minY: firstPt[1],
    maxX: firstPt[0],
    maxY: firstPt[1]
  };

  for (let ind = 1; ind < poly.length; ind++) {
    const pt = poly[ind];

    const x = pt[0];
    if (x < bbox.minX) {
      bbox.minX = x;
    } else if (x > bbox.maxX) {
      bbox.maxX = x;
    }

    const y = pt[1];
    if (y < bbox.minY) {
      bbox.minY = y;
    } else if (y > bbox.maxY) {
      bbox.maxY = y;
    }
  }

  return bbox;
}

export { getBoundingBox };
