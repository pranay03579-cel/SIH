import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Auto-fit map bounds helper
function MapBoundsUpdater({ bounds }) {
  const map = useMap();
  const lastKeyRef = useRef('');

  useEffect(() => {
    if (!bounds || bounds.length === 0) return;
    const key = bounds.map(b => b.join(',')).join('|');
    if (key !== lastKeyRef.current) {
      lastKeyRef.current = key;
      try {
        map.fitBounds(L.latLngBounds(bounds), {
          padding: [45, 45],
          maxZoom: 12,
          animate: true,
        });
      } catch (e) {
        console.warn('Map fit bounds failed:', e);
      }
    }
  }, [bounds, map]);

  return null;
}

const createPin = (text, type = 'origin') =>
  L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div class="custom-pin ${type === 'origin' ? 'pin-origin' : 'pin-destination'}">${text}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const createVehicleIcon = () =>
  L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div class="vehicle-pin" style="background-color: #2D5A43; border: 2px solid #FFFFFF; box-shadow: 0 2px 10px rgba(0,0,0,0.35); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;"><svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF" xmlns="http://www.w3.org/2000/svg"><path d="M2 5.5C2 4.67 2.67 4 3.5 4H14V16H2V5.5Z"/><path d="M14 8H18.2L21 11.5V16H14V8Z"/><path d="M16 10H18L19.5 12H16V10Z" fill="#2D5A43"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><circle cx="6" cy="18" r="1" fill="#2D5A43"/><circle cx="18" cy="18" r="1" fill="#2D5A43"/></svg></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

const createIncidentIcon = (type = 'LANDSLIDE') => {
  const isFlood = type === 'FLOODING' || type === 'CRITICAL FLOODING';
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div class="incident-pin ${isFlood ? 'flood-pin' : 'landslide-pin'}" style="background-color: ${isFlood ? '#b91c1c' : '#dc2626'}; border: 2px solid #FFFFFF; box-shadow: 0 0 14px ${isFlood ? 'rgba(185,28,28,0.7)' : 'rgba(220,38,38,0.6)'}; border-radius: 50%; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; animation: pulse-incident 1.5s infinite;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${isFlood ? '<path d="M12 2v6"/><path d="m4.93 10.93 4.24 4.24"/><path d="M2 18h20"/><path d="M20 18a8 8 0 0 0-16 0"/><path d="M8 22h8"/>' : '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'}</svg></div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
};

const createHoldingDepotIcon = (isVehicleHere = false) =>
  L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div class="holding-pin" style="background-color: ${isVehicleHere ? '#059669' : '#0284c7'}; border: 2px solid #FFFFFF; box-shadow: 0 0 14px ${isVehicleHere ? 'rgba(5,150,105,0.7)' : 'rgba(2,132,199,0.5)'}; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

export default function LiveDemoMap({
  primaryWaypoints = [],
  alternativeWaypoints = [],
  safeHoldingPoint = null,
  vehiclePos = null,
  incidentCoords = null,
  incidentType = 'LANDSLIDE',
  incidentName = '',
  simState = 'READY',
  activeCorridorId = 'R1',
  scenario = null,
}) {
  const origin = primaryWaypoints[0];
  const destination = primaryWaypoints[primaryWaypoints.length - 1];

  const allBounds = [
    ...(primaryWaypoints || []),
    ...(alternativeWaypoints || []),
    ...(incidentCoords ? [incidentCoords] : []),
    ...(safeHoldingPoint?.coords ? [safeHoldingPoint.coords] : []),
  ];

  const isRerouted = activeCorridorId === 'R2' || simState === 'REROUTING' || simState === 'REROUTED';
  const isReturning = simState === 'RETURNING_TO_SAFE_POINT';
  const isSafeHolding = simState === 'SAFE_HOLDING';
  const isNoSafeRoute = simState === 'NO_SAFE_ROUTE';
  const isIncidentActive = incidentCoords !== null;
  const isScenario2 = scenario?.id === 'scenario_2_flooding';

  // Split primary corridor based on active incident location
  const r1IncidentIndex = isScenario2 ? 8 : 7;
  const r1NominalWaypoints = primaryWaypoints.slice(0, r1IncidentIndex + 1);
  const r1CompromisedWaypoints = primaryWaypoints.slice(r1IncidentIndex);

  return (
    <div className="live-demo-map-container" id="live-demo-map">
      <MapContainer
        center={[25.5, 92.2]}
        zoom={8}
        style={{ width: '100%', height: '100%', borderRadius: '8px' }}
        scrollWheelZoom={true}
        keyboard={false}
        attributionControl={true}
        zoomControl={true}
        closePopupOnClick={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={18}
        />

        <MapBoundsUpdater bounds={allBounds.length > 0 ? allBounds : primaryWaypoints} />

        {/* Primary Corridor R1: Nominal segment */}
        {primaryWaypoints.length > 1 && (
          <Polyline
            positions={isIncidentActive ? r1NominalWaypoints : primaryWaypoints}
            pathOptions={{
              color: isRerouted ? '#94a3b8' : (isReturning || isSafeHolding ? '#0284c7' : '#2D5A43'),
              weight: isRerouted ? 3 : 5,
              opacity: isRerouted ? 0.6 : 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* Primary Corridor R1: Compromised segment ahead of incident */}
        {isIncidentActive && r1CompromisedWaypoints.length > 1 && (
          <Polyline
            positions={r1CompromisedWaypoints}
            pathOptions={{
              color: '#dc2626',
              weight: 4,
              dashArray: '6, 6',
              opacity: 0.85,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* Alternative Diversion Corridor R2 (Haflong Secure Bypass) */}
        {alternativeWaypoints && alternativeWaypoints.length > 1 && (
          <Polyline
            positions={alternativeWaypoints}
            pathOptions={{
              color: isScenario2 ? (isIncidentActive ? '#dc2626' : '#64748b') : (isRerouted ? '#0d9488' : '#64748b'),
              weight: isRerouted ? 5 : 3,
              dashArray: isRerouted ? null : '6, 6',
              opacity: isScenario2 && isIncidentActive ? 0.4 : (isRerouted ? 1.0 : 0.5),
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* Origin Pin [A] */}
        {origin && (
          <Marker position={origin} icon={createPin('A', 'origin')}>
            <Popup>
              <strong>Origin Hub: Guwahati</strong>
              <br />
              Logistics Staging Terminal (Km 0)
            </Popup>
          </Marker>
        )}

        {/* Destination Pin [B] */}
        {destination && (
          <Marker
            position={destination}
            icon={createPin('B', simState === 'MISSION_COMPLETE' ? 'destination-complete' : 'destination')}
          >
            <Popup>
              <strong style={{ color: simState === 'MISSION_COMPLETE' ? '#059669' : 'inherit' }}>
                {simState === 'MISSION_COMPLETE' ? 'DESTINATION REACHED · SILCHAR' : 'Destination Hub: Silchar'}
              </strong>
              <br />
              {simState === 'MISSION_COMPLETE'
                ? 'Transit Completed Safely · 0 Disruption Incidents'
                : 'Regional Distribution Depot (Km 301.8)'}
            </Popup>
          </Marker>
        )}

        {/* Vehicle Marker */}
        {vehiclePos && (
          <Marker position={vehiclePos} icon={createVehicleIcon()}>
            <Popup>
              <strong>Transport Vehicle: TRUCK (16T)</strong>
              <br />
              Status: {simState === 'MISSION_COMPLETE'
                ? 'ARRIVED AT DESTINATION (SILCHAR)'
                : (isSafeHolding
                  ? 'VEHICLE SECURED'
                  : (isReturning
                    ? 'RETURNING TO SAFE POINT'
                    : (isNoSafeRoute ? 'STOPPED FOR SAFETY' : 'ACTIVE TRANSIT')))}
              <br />
              Corridor: [{activeCorridorId}]
              <br />
              Location: {vehiclePos[0]?.toFixed(4)}, {vehiclePos[1]?.toFixed(4)}
            </Popup>
          </Marker>
        )}

        {/* Landslide / Flooding Incident Marker */}
        {incidentCoords && (
          <Marker position={incidentCoords} icon={createIncidentIcon(incidentType)}>
            <Popup>
              <strong style={{ color: '#dc2626' }}>{incidentType} OBSTRUCTION</strong>
              <br />
              {incidentName || 'Hazard detected ahead'}
              <br />
              Severity: {scenario?.hazardLevel || 'CRITICAL'} · Road Impassable
            </Popup>
          </Marker>
        )}

        {/* Safe Holding Point Marker (for Scenario 2) */}
        {isScenario2 && safeHoldingPoint && (
          <Marker position={safeHoldingPoint.coords} icon={createHoldingDepotIcon(isSafeHolding)}>
            <Popup>
              <strong style={{ color: isSafeHolding ? '#059669' : '#0284c7' }}>
                {safeHoldingPoint.name}
              </strong>
              <br />
              Status: {isSafeHolding ? 'VEHICLE SECURED & STAGED' : 'Predefined Safe Holding Point'}
              <br />
              Amenities: {safeHoldingPoint.amenities}
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Map Interactive Telemetry Overlay Card */}
      <div className="live-map-telemetry-badge">
        <div className="telemetry-badge-title">
          <span className="telemetry-pulse-dot" />
          <span>GIS CORRIDOR TELEMETRY · [{isSafeHolding ? 'SAFE HOLDING' : (isReturning ? 'RETREAT ACTIVE' : `${activeCorridorId} ACTIVE`)}]</span>
        </div>
        <div className="telemetry-badge-legend">
          <div className="legend-item">
            <span
              className="legend-line"
              style={{ backgroundColor: isRerouted ? '#94a3b8' : (isReturning || isSafeHolding ? '#0284c7' : '#2D5A43') }}
            />
            <span>Corridor [R1] {isIncidentActive ? '(Compromised Ahead)' : 'Nominal'}</span>
          </div>

          <div className="legend-item">
            <span
              className={`legend-line ${isRerouted ? '' : 'dashed'}`}
              style={{ backgroundColor: isScenario2 ? (isIncidentActive ? '#dc2626' : '#64748b') : (isRerouted ? '#0d9488' : '#64748b') }}
            />
            <span>
              Corridor [R2] {isScenario2 ? (isIncidentActive ? '(Flooded / Unsafe)' : '(Alternative Candidate)') : (isRerouted ? '(Active Diversion)' : '(Alternative Candidate)')}
            </span>
          </div>

          {isScenario2 && (
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: isSafeHolding ? '#059669' : '#0284c7' }} />
              <span>Safe Holding Depot {isSafeHolding ? '(Vehicle Staged)' : '(Designated Retreat)'}</span>
            </div>
          )}

          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#2D5A43' }} />
            <span>Vehicle Position</span>
          </div>

          {incidentCoords && (
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#dc2626' }} />
              <span>{isScenario2 ? 'Flood Inundation Zone (Km 185)' : 'Landslide Zone (Km 142)'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
