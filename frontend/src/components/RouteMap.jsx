import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ROUTE_PALETTE } from './RouteCard';

// Auto-fit map bounds when route corridor changes
function MapBoundsUpdater({ routes, activeRouteId }) {
  const map = useMap();
  const lastQueryKeyRef = useRef('');

  useEffect(() => {
    if (!routes || routes.length === 0) return;
    const firstRoute = routes[0];
    const queryKey = `${firstRoute.origin || ''}-${firstRoute.destination || ''}-${routes.length}`;
    if (queryKey !== lastQueryKeyRef.current) {
      lastQueryKeyRef.current = queryKey;
      const allCoords = [];
      routes.forEach(r => {
        const norm = normalizeCoordinates(r.coordinates);
        if (norm.length > 0) allCoords.push(...norm);
      });
      if (allCoords.length > 0) {
        try {
          map.fitBounds(L.latLngBounds(allCoords), { padding: [40, 40], maxZoom: 13, animate: true });
        } catch (err) {
          console.warn('Could not fit map bounds:', err);
        }
      }
    }
  }, [routes, map]);

  return null;
}

// Normalise coordinates from various shapes
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

const createCustomPin = (text, type = 'origin') =>
  L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div class="custom-pin ${type === 'origin' ? 'pin-origin' : 'pin-destination'}">${text}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

export default function RouteMap({
  routes = [],
  selectedRoute = null,
  recommendedId = null,
  onRouteClick = null,
  center = [26.1445, 92.5],
  zoom = 7,
}) {
  const activeRoute = selectedRoute || (routes.find(r => r.route_id === recommendedId) || routes[0]);
  const activeCoords = activeRoute ? normalizeCoordinates(activeRoute.coordinates) : [];

  const firstNormCoords = routes.length > 0 ? normalizeCoordinates(routes[0].coordinates) : [];
  const originPoint = firstNormCoords.length > 0 ? firstNormCoords[0] : (activeCoords[0] ?? null);
  const destPoint = firstNormCoords.length > 0 ? firstNormCoords[firstNormCoords.length - 1] : (activeCoords[activeCoords.length - 1] ?? null);

  const nonSelectedRoutes = routes.map((r, idx) => ({ r, idx })).filter(item => !activeRoute || item.r.route_id !== activeRoute.route_id);
  const selectedItem = routes.map((r, idx) => ({ r, idx })).find(item => activeRoute && item.r.route_id === activeRoute.route_id);

  const renderPolyline = (route, idx, isSelected) => {
    const polyCoords = normalizeCoordinates(route.coordinates);
    if (polyCoords.length === 0) return null;

    const isRecommended = !!recommendedId && route.route_id === recommendedId;
    const color = ROUTE_PALETTE[idx % ROUTE_PALETTE.length].main;
    // Non-selected alternatives: clearly visible (0.72) but visually subordinate to selected (1.0)
    const opacity = isSelected ? 1.0 : (routes.length === 1 ? 0.95 : 0.72);
    const weight  = isSelected ? (isRecommended ? 8 : 7) : 4;

    return (
      <Polyline
        key={route.route_id}
        positions={polyCoords}
        pathOptions={{ color, weight, opacity, lineJoin: 'round', lineCap: 'round' }}
        eventHandlers={{ click: () => onRouteClick && onRouteClick(route) }}
      >
        <Popup>
          <div style={{ color: '#0f172a', minWidth: '170px', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: 4 }}>
              {route.route_id ? `[${route.route_id}] ` : ''}{route.route_name}
            </div>
            {isRecommended && (
              <div style={{ color: '#16a34a', fontSize: '11px', fontWeight: 700, marginBottom: 6 }}>
                ✓ SYSTEM RECOMMENDATION
              </div>
            )}
            <div style={{ color: '#475569', fontSize: '12px', lineHeight: 1.5 }}>
              <div><strong>Distance:</strong> {route.distance_km} km</div>
              <div><strong>Transit Time:</strong> {route.estimated_time_min} min</div>
              <div><strong>Terrain Risk:</strong> {route.landslide_risk}% ({route.risk_level})</div>
              <div><strong>Accessibility Score:</strong> {route.accessibility_score} / 100</div>
            </div>
            {!isSelected && onRouteClick && (
              <button
                type="button"
                onClick={() => onRouteClick(route)}
                style={{
                  marginTop: 8,
                  width: '100%',
                  padding: '4px 8px',
                  backgroundColor: color,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Focus This Corridor
              </button>
            )}
          </div>
        </Popup>
      </Polyline>
    );
  };

  const hasRoutes = routes.length > 0;
  const statusText = recommendedId && activeRoute && activeRoute.route_id === recommendedId
    ? `Recommended: [${activeRoute.route_id}] ${activeRoute.route_name || 'Corridor'}`
    : activeRoute
      ? `Active: ${activeRoute.route_id ? `[${activeRoute.route_id}] ` : ''}${activeRoute.route_name || 'Corridor'}`
      : 'Interactive Map — Awaiting Query';

  return (
    <div className="marg-map-container" id="marg-leaflet-map-container">

      {/* Status overlay */}
      <div className="map-overlay-badge">
        <span
          className="status-dot"
          style={{
            backgroundColor: recommendedId
              ? '#22c55e'
              : activeRoute
                ? ROUTE_PALETTE[(routes.findIndex(r => r.route_id === activeRoute?.route_id) || 0) % ROUTE_PALETTE.length].main
                : '#64748b',
          }}
        />
        <span>{statusText}</span>
      </div>

      {/* Map legend */}
      {hasRoutes && (
        <div className="map-legend">
          <div className="map-legend-title">MAP LEGEND</div>
          {routes.map((route, idx) => {
            const isRec = route.route_id === recommendedId;
            const color = ROUTE_PALETTE[idx % ROUTE_PALETTE.length].main;
            return (
              <div key={route.route_id} className="map-legend-item">
                <div className="map-legend-line" style={{ backgroundColor: color, height: isRec ? 4 : 3 }} />
                <span>
                  {route.route_id}{isRec ? <span style={{ color: 'var(--risk-low)', fontWeight: 700, marginLeft: 4 }}>✓</span> : ''}
                </span>
              </div>
            );
          })}
          <div className="map-legend-item">
            <div className="map-legend-dot" style={{ backgroundColor: '#1d4ed8' }}>A</div>
            <span>Origin Hub</span>
          </div>
          <div className="map-legend-item">
            <div className="map-legend-dot" style={{ backgroundColor: '#16a34a' }}>B</div>
            <span>Destination</span>
          </div>
        </div>
      )}

      <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />

        <MapBoundsUpdater routes={routes} activeRouteId={activeRoute?.route_id} />

        {/* Background (non-selected) polylines */}
        {nonSelectedRoutes.map(item => renderPolyline(item.r, item.idx, false))}

        {/* Selected polyline on top */}
        {selectedItem && renderPolyline(selectedItem.r, selectedItem.idx, true)}

        {/* Origin / destination pins */}
        {originPoint && (
          <Marker position={originPoint} icon={createCustomPin('A', 'origin')}>
            <Popup><strong>Origin:</strong> {activeRoute?.origin || 'Dispatch Hub'}</Popup>
          </Marker>
        )}
        {destPoint && (
          <Marker position={destPoint} icon={createCustomPin('B', 'destination')}>
            <Popup><strong>Destination:</strong> {activeRoute?.destination || 'Forward Post'}</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
