/**
 * Geographic utility functions for coordinate normalization and Leaflet rendering.
 */

export const normalizeCoordinates = (coords) => {
  if (!coords || !Array.isArray(coords)) return [];
  return coords
    .map(c => {
      if (Array.isArray(c) && c.length >= 2) return [Number(c[0]), Number(c[1])];
      if (c && typeof c === 'object') {
        const lat = c.lat ?? c.latitude;
        const lng = c.lon ?? c.lng ?? c.longitude;
        if (lat != null && lng != null) return [Number(lat), Number(lng)];
      }
      return null;
    })
    .filter(Boolean);
};

/**
 * Computes a lateral perpendicular offset polyline in meters.
 * Allows overlapping and parallel corridors to remain visually distinguishable side-by-side.
 * Includes smooth tapering at start and end points so all routes converge on the origin & destination pins.
 */
export const computeOffsetPolyline = (coords, offsetMeters = 0, sign = 1) => {
  if (!coords || coords.length < 2 || offsetMeters === 0) {
    return coords || [];
  }

  const mPerDegLat = 111139.0;
  const n = coords.length;
  const offsetCoords = [];
  const taperLen = Math.min(10, Math.floor(n / 4));

  for (let i = 0; i < n; i++) {
    const [lat, lon] = coords[i];
    const rad = (lat * Math.PI) / 180.0;
    const mPerDegLon = 111139.0 * Math.cos(rad);

    let scale = 1.0;
    if (taperLen > 0) {
      if (i < taperLen) {
        scale = i / taperLen;
      } else if (i >= n - taperLen) {
        scale = (n - 1 - i) / taperLen;
      }
    }

    const curOffset = offsetMeters * scale * sign;
    if (Math.abs(curOffset) < 0.01) {
      offsetCoords.push([lat, lon]);
      continue;
    }

    let dlat, dlon;
    if (i === 0) {
      dlat = coords[1][0] - coords[0][0];
      dlon = coords[1][1] - coords[0][1];
    } else if (i === n - 1) {
      dlat = coords[n - 1][0] - coords[n - 2][0];
      dlon = coords[n - 1][1] - coords[n - 2][1];
    } else {
      dlat = coords[i + 1][0] - coords[i - 1][0];
      dlon = coords[i + 1][1] - coords[i - 1][1];
    }

    const dxM = dlon * mPerDegLon;
    const dyM = dlat * mPerDegLat;
    const lenM = Math.hypot(dxM, dyM);

    if (lenM < 1e-6) {
      offsetCoords.push([lat, lon]);
      continue;
    }

    // Normal vector perpendicular to tangent vector (dxM, dyM)
    const nxM = -dyM / lenM;
    const nyM = dxM / lenM;

    const offsetLat = lat + (nyM * curOffset) / mPerDegLat;
    const offsetLon = lon + (nxM * curOffset) / mPerDegLon;

    offsetCoords.push([
      Math.round(offsetLat * 1e6) / 1e6,
      Math.round(offsetLon * 1e6) / 1e6,
    ]);
  }

  return offsetCoords;
};
