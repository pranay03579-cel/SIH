import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ROUTE_PALETTE } from './RouteCard';
import { normalizeCoordinates, computeOffsetPolyline } from '../utils/geoUtils';

// Auto-fit map bounds when route corridor changes
function MapBoundsUpdater({ routes = [], emergencyRoutes = [], activeRouteId }) {
  const map = useMap();
  const lastQueryKeyRef = useRef('');

  useEffect(() => {
    const allRoutes = [...(routes || []), ...(emergencyRoutes || [])];
    if (allRoutes.length === 0) return;

    const queryKey = allRoutes
      .map(r => `${r.route_id}-${(r.coordinates || []).length}`)
      .join('|');

    if (queryKey !== lastQueryKeyRef.current) {
      lastQueryKeyRef.current = queryKey;
      const allCoords = [];
      allRoutes.forEach(r => {
        const norm = normalizeCoordinates(r.coordinates);
        if (norm.length > 0) allCoords.push(...norm);
      });

      if (allCoords.length > 0) {
        try {
          map.fitBounds(L.latLngBounds(allCoords), {
            padding: [50, 50],
            maxZoom: 13,
            animate: true,
          });
        } catch (err) {
          console.warn('Could not fit map bounds:', err);
        }
      }
    }
  }, [routes, emergencyRoutes, map]);

  return null;
}

const createCustomPin = (text, type = 'origin') =>
  L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div class="custom-pin ${type === 'origin' ? 'pin-origin' : 'pin-destination'}">${text}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

// Vehicle marker icon (solid filled white SVG)
const createVehicleIcon = () =>
  L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div class="vehicle-pin"><svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF" xmlns="http://www.w3.org/2000/svg" style="display:block;opacity:1;"><path d="M2 5.5C2 4.67 2.67 4 3.5 4H14V16H2V5.5Z"/><path d="M14 8H18.2L21 11.5V16H14V8Z"/><path d="M16 10H18L19.5 12H16V10Z" fill="#2D5A43"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><circle cx="6" cy="18" r="1" fill="#2D5A43"/><circle cx="18" cy="18" r="1" fill="#2D5A43"/></svg></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

// Landslide / incident marker icon (clean professional SVG)
const createLandslideIcon = () =>
  L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div class="landslide-pin"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

export default function RouteMap({
  routes = [],
  selectedRoute = null,
  recommendedId = null,
  onRouteClick = null,
  center = [26.1445, 92.5],
  zoom = 7,
  // Simulation props
  vehiclePos = null,       // [lat, lon] | null
  landslidePos = null,     // [lat, lon] | null
  simState = 'idle',       // 'idle' | 'running' | 'paused' | 'landslide'
  // Emergency rerouting props
  emergencyRoutes = [],
  emergencyRecommendedId = null,
  onEmergencyRouteClick = null,
}) {
  const activeRoute = selectedRoute || (routes.find(r => r.route_id === recommendedId) || routes[0]);
  const activeCoords = activeRoute ? normalizeCoordinates(activeRoute.coordinates) : [];

  const firstNormCoords = routes.length > 0 ? normalizeCoordinates(routes[0].coordinates) : [];
  const originPoint = firstNormCoords.length > 0 ? firstNormCoords[0] : (activeCoords[0] ?? null);
  const destPoint = firstNormCoords.length > 0 ? firstNormCoords[firstNormCoords.length - 1] : (activeCoords[activeCoords.length - 1] ?? null);

  // Split routes for strict layer ordering:
  // Layer 1: Inactive alternative routes
  // Layer 2: Inactive recommended route
  // Layer 3: Currently active/selected route
  const nonSelectedAltRoutes = routes
    .map((r, idx) => ({ r, idx }))
    .filter(item => item.r.route_id !== activeRoute?.route_id && item.r.route_id !== recommendedId);

  const nonSelectedRecRoute = routes
    .map((r, idx) => ({ r, idx }))
    .find(item => item.r.route_id === recommendedId && item.r.route_id !== activeRoute?.route_id);

  const selectedItem = activeRoute
    ? { r: activeRoute, idx: routes.findIndex(r => r.route_id === activeRoute.route_id) }
    : null;

  // Offset configuration to keep parallel/shared national highway sections clearly visible side-by-side
  const getRouteOffset = (idx, total) => {
    if (total <= 1) return { meters: 0, sign: 1 };
    if (idx === 0) return { meters: 0, sign: 1 };     // R1 stays on baseline
    if (idx === 1) return { meters: 45, sign: 1 };    // R2 shifted +45m
    if (idx === 2) return { meters: 45, sign: -1 };   // R3 shifted -45m
    return { meters: 80, sign: 1 };
  };

  const renderRoutePolylines = (route, idx, isSelected) => {
    const rawCoords = normalizeCoordinates(route.coordinates);
    if (rawCoords.length === 0) return null;

    const { meters, sign } = getRouteOffset(idx, routes.length);
    const polyCoords = computeOffsetPolyline(rawCoords, meters, sign);

    const isRecommended = recommendedId && route.route_id === recommendedId;
    const isBlockedRoute = simState === 'landslide' && selectedRoute?.route_id === route.route_id;

    // Palette hierarchy: Recommended is Forest Green, alternatives are Amber, Purple, Teal, etc.
    let color = isBlockedRoute
      ? '#DC2626'
      : isRecommended
      ? '#2D5A43'
      : (idx === 1 ? '#D97706' : ROUTE_PALETTE[idx % ROUTE_PALETTE.length].main);

    const coreWeight = isSelected ? 8 : (isRecommended ? 6 : 5);
    const outlineWeight = isSelected ? 12 : (isRecommended ? 10 : 8);
    const coreOpacity = isSelected ? 1.0 : (isRecommended ? 0.98 : 0.92);

    return (
      <React.Fragment key={`group-${route.route_id}`}>
        {/* Layer 1: Crisp White Dual-Polyline Outline for background separation */}
        <Polyline
          key={`outline-${route.route_id}`}
          positions={polyCoords}
          pathOptions={{
            color: '#FFFFFF',
            weight: outlineWeight,
            opacity: isSelected ? 0.95 : 0.85,
            lineJoin: 'round',
            lineCap: 'round',
          }}
          interactive={false}
        />

        {/* Layer 2: Core Colored Corridor Polyline */}
        <Polyline
          key={`core-${route.route_id}`}
          positions={polyCoords}
          pathOptions={{
            color,
            weight: coreWeight,
            opacity: coreOpacity,
            lineJoin: 'round',
            lineCap: 'round',
            dashArray: isBlockedRoute ? '10, 6' : undefined,
          }}
          eventHandlers={{ click: () => onRouteClick && onRouteClick(route) }}
        >
          <Popup>
            <div style={{ color: '#1f2421', minWidth: '175px', fontFamily: 'Inter, sans-serif' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: 4 }}>
                {route.route_id ? `[${route.route_id}] ` : ''}{route.route_name}
              </div>
              {isRecommended && (
                <div style={{ color: '#2D5A43', fontSize: '11px', fontWeight: 700, marginBottom: 6 }}>
                  RECOMMENDED CORRIDOR
                </div>
              )}
              {isBlockedRoute && (
                <div style={{ color: '#dc2626', fontSize: '11px', fontWeight: 700, marginBottom: 6 }}>
                  CORRIDOR BLOCKED — INCIDENT
                </div>
              )}
              <div style={{ color: '#6b716d', fontSize: '12px', lineHeight: 1.5 }}>
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
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Focus Corridor
                </button>
              )}
            </div>
          </Popup>
        </Polyline>
      </React.Fragment>
    );
  };

  const hasRoutes = routes.length > 0;
  const statusText = simState !== 'idle'
    ? (simState === 'landslide'
        ? `INCIDENT DETECTED — ${selectedRoute?.route_id || ''}`
        : `SIMULATION ACTIVE — ${selectedRoute?.route_id || ''}`)
    : recommendedId && activeRoute && activeRoute.route_id === recommendedId
      ? `Recommended: [${activeRoute.route_id}] ${activeRoute.route_name || 'Corridor'}`
      : activeRoute
        ? `Active: ${activeRoute.route_id ? `[${activeRoute.route_id}] ` : ''}${activeRoute.route_name || 'Corridor'}`
        : 'GIS Logistics Canvas';

  return (
    <div className="marg-map-container" id="marg-leaflet-map-container">
      {/* Status overlay badge */}
      <div className="map-overlay-badge" style={simState === 'landslide' ? { borderColor: '#dc2626', color: '#dc2626' } : {}}>
        <span
          className="map-status-dot"
          style={{
            backgroundColor: simState === 'landslide'
              ? '#dc2626'
              : simState !== 'idle'
                ? '#22c55e'
                : recommendedId
                  ? '#2D5A43'
                  : '#6b716d',
          }}
        />
        <span>{statusText}</span>
      </div>

      {/* Dynamic Map legend */}
      {hasRoutes && (
        <div className="map-legend-box">
          <div className="map-legend-title">CORRIDORS</div>
          {routes.map((route, idx) => {
            const isRec = route.route_id === recommendedId;
            const isSel = activeRoute?.route_id === route.route_id;
            const color = isRec
              ? '#2D5A43'
              : (idx === 1 ? '#D97706' : ROUTE_PALETTE[idx % ROUTE_PALETTE.length].main);

            return (
              <div
                key={route.route_id}
                className={`map-legend-item ${isSel ? 'is-legend-active' : ''}`}
                onClick={() => onRouteClick && onRouteClick(route)}
                title="Click to focus corridor on map"
                style={{ cursor: 'pointer' }}
              >
                <div
                  className="map-legend-line"
                  style={{
                    backgroundColor: color,
                    height: isSel ? 5 : (isRec ? 4 : 3),
                    boxShadow: isSel ? `0 0 6px ${color}` : 'none',
                  }}
                />
                <span>
                  <strong>{route.route_id}</strong>
                  {isRec ? (
                    <span className="legend-rec-tag">Recommended</span>
                  ) : (
                    <span className="legend-alt-tag">Alternative</span>
                  )}
                </span>
              </div>
            );
          })}

          {vehiclePos && (
            <div className="map-legend-item">
              <span className="map-legend-dot" style={{ backgroundColor: '#1E5128', color: '#fff', fontSize: '9px' }}>V</span>
              <span>Vehicle</span>
            </div>
          )}
          {landslidePos && (
            <div className="map-legend-item">
              <span className="map-legend-dot" style={{ backgroundColor: '#DC2626', color: '#fff', fontSize: '9px' }}>!</span>
              <span style={{ color: '#dc2626', fontWeight: 600 }}>Incident</span>
            </div>
          )}
          <div className="map-legend-item">
            <div className="map-legend-dot" style={{ backgroundColor: '#2563eb' }}>A</div>
            <span>Origin Hub</span>
          </div>
          <div className="map-legend-item">
            <div className="map-legend-dot" style={{ backgroundColor: '#16a34a' }}>B</div>
            <span>Destination</span>
          </div>
        </div>
      )}

      <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
        {/* Keyless OpenStreetMap Tile Layer with Zero Watermarks */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          subdomains={['a', 'b', 'c']}
          maxZoom={19}
        />

        <MapBoundsUpdater
          routes={routes}
          emergencyRoutes={emergencyRoutes}
          activeRouteId={activeRoute?.route_id}
        />

        {/* 1. Inactive Alternative Routes (Layer 1) */}
        {nonSelectedAltRoutes.map(item => renderRoutePolylines(item.r, item.idx, false))}

        {/* 2. Inactive Recommended Route (Layer 2) */}
        {nonSelectedRecRoute && renderRoutePolylines(nonSelectedRecRoute.r, nonSelectedRecRoute.idx, false)}

        {/* 3. Currently Selected/Active Route (Layer 3 - on top) */}
        {selectedItem && renderRoutePolylines(selectedItem.r, selectedItem.idx, true)}

        {/* 4. Emergency Routes (Layer 4) */}
        {emergencyRoutes.map((route, idx) => {
          const rawCoords = normalizeCoordinates(route.coordinates);
          if (rawCoords.length === 0) return null;

          const isEmergencyRec = route.route_id === emergencyRecommendedId;
          const isSelected = selectedRoute?.route_id === route.route_id;
          const color = isEmergencyRec ? '#7C3AED' : '#0D9488';
          const { meters, sign } = getRouteOffset(idx + 1, emergencyRoutes.length + 1);
          const polyCoords = computeOffsetPolyline(rawCoords, meters, sign);

          return (
            <React.Fragment key={`emergency-group-${route.route_id}`}>
              <Polyline
                key={`emergency-outline-${route.route_id}`}
                positions={polyCoords}
                pathOptions={{
                  color: '#FFFFFF',
                  weight: isSelected ? 12 : (isEmergencyRec ? 10 : 8),
                  opacity: 0.9,
                  lineJoin: 'round',
                  lineCap: 'round',
                }}
                interactive={false}
              />
              <Polyline
                key={`emergency-core-${route.route_id}`}
                positions={polyCoords}
                pathOptions={{
                  color,
                  weight: isSelected ? 8 : (isEmergencyRec ? 7 : 5),
                  opacity: isSelected ? 1.0 : (isEmergencyRec ? 0.98 : 0.88),
                  lineJoin: 'round',
                  lineCap: 'round',
                }}
                eventHandlers={{ click: () => onEmergencyRouteClick && onEmergencyRouteClick(route) }}
              >
                <Popup>
                  <div style={{ color: '#1f2421', minWidth: '175px', fontFamily: 'Inter, sans-serif' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: 4, color: '#7c3aed' }}>
                      Emergency Diversion: [{route.route_id}] {route.route_name}
                    </div>
                    {isEmergencyRec && (
                      <div style={{ color: '#2D5A43', fontSize: '11px', fontWeight: 700, marginBottom: 6 }}>
                        RECOMMENDED EMERGENCY DIVERSION
                      </div>
                    )}
                    <div style={{ color: '#6b716d', fontSize: '12px', lineHeight: 1.5 }}>
                      <div><strong>Distance:</strong> {route.distance_km} km</div>
                      <div><strong>Transit Time:</strong> {route.estimated_time_min} min</div>
                      <div><strong>Terrain Risk:</strong> {route.landslide_risk}% ({route.risk_level})</div>
                      <div><strong>Accessibility Score:</strong> {route.accessibility_score} / 100</div>
                    </div>
                  </div>
                </Popup>
              </Polyline>
            </React.Fragment>
          );
        })}

        {/* 5. Origin / Destination Pins */}
        {originPoint && (
          <Marker position={originPoint} icon={createCustomPin('A', 'origin')}>
            <Popup><strong>Origin Hub:</strong> {activeRoute?.origin || 'Dispatch Hub'}</Popup>
          </Marker>
        )}
        {destPoint && (
          <Marker position={destPoint} icon={createCustomPin('B', 'destination')}>
            <Popup><strong>Destination Post:</strong> {activeRoute?.destination || 'Forward Post'}</Popup>
          </Marker>
        )}

        {/* 6. Vehicle Marker (On top) */}
        {vehiclePos && (
          <Marker position={vehiclePos} icon={createVehicleIcon()} zIndexOffset={1000}>
            <Popup>
              <div style={{ color: '#1f2421', fontFamily: 'Inter, sans-serif', fontSize: '12px' }}>
                <strong>Vehicle En Route</strong><br />
                {simState === 'landslide'
                  ? <span style={{ color: '#dc2626', fontWeight: 700 }}>STOPPED — Landslide reported ahead</span>
                  : <span>Travelling to {activeRoute?.destination || 'destination'}</span>
                }
              </div>
            </Popup>
          </Marker>
        )}

        {/* 7. Landslide Incident Marker (Highest z-index) */}
        {landslidePos && (
          <Marker position={landslidePos} icon={createLandslideIcon()} zIndexOffset={2000}>
            <Popup>
              <div style={{ color: '#1f2421', fontFamily: 'Inter, sans-serif', fontSize: '12px' }}>
                <strong style={{ color: '#dc2626' }}>LANDSLIDE INCIDENT DETECTED</strong><br />
                <span>Road corridor blocked ahead.</span><br />
                <span style={{ color: '#6b716d', fontSize: '11px' }}>Dynamic emergency rerouting activated.</span>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
