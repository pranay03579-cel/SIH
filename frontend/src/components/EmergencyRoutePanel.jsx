import React from 'react';
import RouteCard, { ROUTE_PALETTE } from './RouteCard';
import { IconShield } from './Icons';

export default function EmergencyRoutePanel({
  emergencyRoutes = [],
  emergencyRecommendedId = null,
  selectedRoute = null,
  onSelectRoute,
  blockedRouteId = null,
  destination = '',
}) {
  if (!emergencyRoutes || emergencyRoutes.length === 0) return null;

  return (
    <div className="emergency-results-card">
      {/* Emergency Header */}
      <div className="emergency-card-header">
        <div className="emergency-title-row">
          <div className="emergency-shield-icon">
            <IconShield size={20} />
          </div>
          <div>
            <h3 className="emergency-main-title">SAFE ALTERNATIVE FOUND</h3>
            <p className="emergency-main-subtitle">
              MARG recalculated the journey from the vehicle's current position and generated a route avoiding the reported landslide zone.
            </p>
          </div>
        </div>

        <div className="emergency-meta-tags-row">
          {blockedRouteId && (
            <span className="emergency-blocked-pill">
              Corridor [{blockedRouteId}] Blocked
            </span>
          )}
          {destination && (
            <span className="emergency-dest-pill">
              Destination: <strong>{destination}</strong>
            </span>
          )}
          <span className="emergency-count-pill">
            {emergencyRoutes.length} Safe Corridor{emergencyRoutes.length !== 1 ? 's' : ''} Identified
          </span>
        </div>
      </div>

      {/* Emergency Route Cards */}
      <div className="emergency-cards-list">
        {emergencyRoutes.map((route, idx) => {
          const isRecommended = route.route_id === emergencyRecommendedId;
          const isSelected = selectedRoute?.route_id === route.route_id;
          const paletteIdx = (idx + 2) % ROUTE_PALETTE.length;

          return (
            <div
              key={route.route_id}
              className={`emergency-card-wrapper ${isRecommended ? 'is-recommended' : ''}`}
            >
              <RouteCard
                route={route}
                index={paletteIdx}
                isSelected={isSelected}
                isRecommended={isRecommended}
                comparisonTags={[{ label: 'Safe Diversion', type: 'risk' }]}
                onSelect={onSelectRoute}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
