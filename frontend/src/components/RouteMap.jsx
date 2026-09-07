import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Auto-fit map bounds when route coordinates change
function MapBoundsUpdater({ coordinates }) {
  const map = useMap();
  useEffect(() => {
    if (coordinates && coordinates.length > 0) {
      try {
        map.fitBounds(L.latLngBounds(coordinates), { padding: [50, 50], maxZoom: 13 });
      } catch (err) {
        console.warn('Could not fit bounds:', err);
      }
    }
  }, [coordinates, map]);
  return null;
}

// Custom map pins
const createCustomPin = (text, type = 'origin') =>
  L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div class="custom-pin ${type === 'origin' ? 'pin-origin' : 'pin-destination'}">${text}</div>`,
    iconSize:   [28, 28],
    iconAnchor: [14, 14]
  });

// Normalise coordinates from either {lat,lon} / {lat,lng} / {latitude,longitude} / [lat,lng] arrays
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

// Colour palette for up to 5 distinct routes (before recommendation)
const ROUTE_COLOURS = ['#38bdf8', '#a78bfa', '#fb923c', '#34d399', '#f472b6'];

export default function RouteMap({
  routes        = [],
  selectedRoute = null,
  recommendedId = null,     // null = no recommendation yet
  onRouteClick  = null,     // called with route object when polyline clicked
  center        = [26.1445, 92.5],
  zoom          = 7
}) {
  const activeRoute   = selectedRoute || (routes.find(r => r.route_id === recommendedId) || routes[0]);
  const activeCoords  = activeRoute ? normalizeCoordinates(activeRoute.coordinates) : [];
  const hasCoords     = activeCoords.length > 0;
  const originPoint   = hasCoords ? activeCoords[0] : null;
  const destPoint     = hasCoords ? activeCoords[activeCoords.length - 1] : null;

  return (
    <div className="marg-map-container" id="marg-leaflet-map-container">
      {/* Status overlay */}
      <div className="map-overlay-badge">
        <span className="status-dot" style={{ backgroundColor: hasCoords ? '#10b981' : '#f59e0b' }} />
        <span>
          {hasCoords
            ? `Displaying: ${activeRoute.route_id ? `[${activeRoute.route_id}] ` : ''}${activeRoute.route_name}`
            : 'Interactive Map Ready (Awaiting backend route coordinates)'}
        </span>
      </div>

      <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />

        {hasCoords && <MapBoundsUpdater coordinates={activeCoords} />}

        {/* Route polylines — each route has a distinct colour and click handler */}
        {routes.map((route, idx) => {
          const polyCoords = normalizeCoordinates(route.coordinates);
          if (polyCoords.length === 0) return null;

          const isSelected    = activeRoute && route.route_id === activeRoute.route_id;
          const isRecommended = recommendedId && route.route_id === recommendedId;

          // Colour logic:
          //   - Recommended → vivid cyan
          //   - Selected (not recommended) → amber
          //   - Others → palette colour (dimmed)
          let color   = ROUTE_COLOURS[idx % ROUTE_COLOURS.length];
          let opacity = 0.55;
          let weight  = 4;

          if (isRecommended) { color = '#38bdf8'; opacity = 0.95; weight = 6; }
          else if (isSelected) { color = '#f59e0b'; opacity = 0.90; weight = 6; }
          else if (recommendedId) { opacity = 0.35; weight = 3; } // fade alternatives after recommendation

          return (
            <Polyline
              key={route.route_id}
              positions={polyCoords}
              pathOptions={{
                color,
                weight,
                opacity,
                dashArray: (isRecommended || isSelected) ? null : '6, 10'
              }}
              eventHandlers={{
                click: () => onRouteClick && onRouteClick(route)
              }}
            >
              <Popup>
                <div style={{ color: '#0f172a', fontWeight: 'bold' }}>
                  {route.route_id ? `[${route.route_id}] ` : ''}{route.route_name}
                  {isRecommended && <span style={{ color: '#38bdf8' }}> ★ AI RECOMMENDED</span>}
                </div>
                <div style={{ color: '#475569', fontSize: '12px' }}>
                  Distance: {route.distance_km} km | Est. Time: {route.estimated_time_min} mins
                </div>
                <div style={{ color: '#475569', fontSize: '12px' }}>
                  Risk: {route.risk_level} | Accessibility: {route.accessibility_score}/100
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {/* Origin / destination pins */}
        {originPoint && (
          <Marker position={originPoint} icon={createCustomPin('A', 'origin')}>
            <Popup><strong>Origin Dispatch Point</strong></Popup>
          </Marker>
        )}
        {destPoint && (
          <Marker position={destPoint} icon={createCustomPin('B', 'destination')}>
            <Popup><strong>Destination Outpost</strong></Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
