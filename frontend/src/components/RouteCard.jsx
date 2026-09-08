import React from 'react';
import { IconAlertTriangle, IconCheck, IconRuler, IconZap, IconShield, IconSparkles } from './Icons';

// Route color palette for card↔map correspondence
export const ROUTE_PALETTE = [
  { main: '#2563eb', bg: 'rgba(37, 99, 235, 0.08)', border: '#93c5fd' },   // Blue
  { main: '#d97706', bg: 'rgba(217, 119, 6, 0.08)', border: '#fcd34d' },   // Amber
  { main: '#7c3aed', bg: 'rgba(124, 58, 237, 0.08)', border: '#c4b5fd' },  // Purple
  { main: '#0d9488', bg: 'rgba(13, 148, 136, 0.08)', border: '#99f6e4' },  // Teal
  { main: '#be185d', bg: 'rgba(190, 24, 93, 0.08)', border: '#fbcfe8' },   // Rose
];

export default function RouteCard({
  route,
  index = 0,
  isSelected = false,
  isRecommended = false,
  comparisonTags = [],
  onSelect,
}) {
  const {
    route_id,
    route_name,
    distance_km,
    estimated_time_min,
    landslide_risk,
    risk_level,
    landslide_risk_level,
    waterlogging_risk,
    waterlogging_level,
    combined_hazard_risk,
    accessibility_score,
    vehicle_type,
    vehicle_suitability,
    vehicle_compatible,
    vehicle_reason,
    vehicle_aware_score,
  } = (route || {});

  const colorTheme = ROUTE_PALETTE[Math.max(0, index || 0) % ROUTE_PALETTE.length] || ROUTE_PALETTE[0];
  const effectiveLandslideLevel = (landslide_risk_level || risk_level || 'LOW').toUpperCase();
  const effectiveWaterloggingLevel = waterlogging_level
    ? waterlogging_level.toUpperCase()
    : (waterlogging_risk != null ? (waterlogging_risk >= 60 ? 'HIGH' : waterlogging_risk >= 30 ? 'MEDIUM' : 'LOW') : null);
  const effectiveHazardRisk = combined_hazard_risk != null ? combined_hazard_risk : landslide_risk;

  const getOverallLevel = () => {
    if (combined_hazard_risk != null) {
      if (combined_hazard_risk >= 60) return 'HIGH';
      if (combined_hazard_risk >= 30) return 'MEDIUM';
      return 'LOW';
    }
    return effectiveLandslideLevel;
  };

  const overallLevel = getOverallLevel();

  const formatTime = (mins) => {
    if (typeof mins !== 'number' || isNaN(mins)) return '—';
    const hours = Math.floor(mins / 60);
    const remainder = Math.round(mins % 60);
    if (hours === 0) return `${remainder}m`;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  };

  const getRiskClass = (lvl) => {
    switch ((lvl || '').toUpperCase()) {
      case 'LOW': return 'risk-pill-low';
      case 'MEDIUM': return 'risk-pill-medium';
      case 'HIGH':
      case 'CRITICAL': return 'risk-pill-high';
      default: return 'risk-pill-low';
    }
  };

  const renderTagIcon = (type) => {
    switch (type) {
      case 'distance': return <IconRuler size={11} />;
      case 'time': return <IconZap size={11} />;
      case 'risk': return <IconShield size={11} />;
      case 'score': return <IconSparkles size={11} />;
      default: return null;
    }
  };

  const hasWaterlogging = waterlogging_risk != null;
  const hasVehicleSuitability = typeof vehicle_suitability === 'number' && !isNaN(vehicle_suitability);
  const hasVehicleAwareScore = typeof vehicle_aware_score === 'number' && !isNaN(vehicle_aware_score);
  const hasAccessibilityScore = typeof accessibility_score === 'number' && !isNaN(accessibility_score);

  const displayMargScore = hasVehicleAwareScore ? vehicle_aware_score : (hasAccessibilityScore ? accessibility_score : '—');
  const activeVehicle = vehicle_type || 'Vehicle';

  const getCompatibilityText = () => {
    if (vehicle_compatible === true) return 'SUITABLE';
    if (vehicle_compatible === false) return 'LIMITED SUITABILITY';
    return 'Data unavailable';
  };

  const getCompatibilityPillClass = () => {
    if (vehicle_compatible === true) return 'pill-suitable';
    if (vehicle_compatible === false) return 'pill-limited';
    return 'pill-unavailable';
  };

  return (
    <div
      className={`card-route-item ${isSelected ? 'selected' : ''} ${isRecommended ? 'recommended' : ''}`}
      onClick={() => onSelect && onSelect(route)}
      role="button"
      tabIndex={0}
      aria-label={`Corridor: ${route_name || route_id}`}
      onKeyDown={(e) => e.key === 'Enter' && onSelect && onSelect(route)}
    >
      {/* ── SECTION 1: Route Header ── */}
      {isRecommended && (
        <div className="card-recommended-banner">
          <IconCheck size={13} />
          <span>RECOMMENDED CORRIDOR</span>
        </div>
      )}

      <div className="card-route-header">
        <div className="card-route-title-group">
          <span
            className="card-route-id-badge"
            style={{
              color: isRecommended ? 'var(--forest-green)' : colorTheme.main,
              backgroundColor: isRecommended ? 'var(--sage-light)' : colorTheme.bg,
              borderColor: isRecommended ? 'var(--sage-accent)' : colorTheme.border,
            }}
          >
            {route_id || `R${index + 1}`}
          </span>
          <h3 className="card-route-name">{route_name || `Corridor ${index + 1}`}</h3>
        </div>

        <span className={`card-risk-pill ${getRiskClass(overallLevel)}`}>
          {overallLevel} HAZARD
        </span>
      </div>

      {/* Comparison Tags */}
      {comparisonTags && comparisonTags.length > 0 && (
        <div className="card-tags-row">
          {comparisonTags.map((tag) => (
            <span key={tag.label} className={`card-tag card-tag-${tag.type}`}>
              {renderTagIcon(tag.type)}
              <span>{tag.label}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── SECTION 2: Core Route Metrics (Distance, Travel Time, Environmental Risk) ── */}
      <div className="card-metrics-grid">
        <div className="card-metric-col">
          <span className="card-metric-lbl">Distance</span>
          <span className="card-metric-val">{distance_km != null ? `${distance_km} km` : '—'}</span>
        </div>
        <div className="card-metric-col">
          <span className="card-metric-lbl">Travel Time</span>
          <span className="card-metric-val">{formatTime(estimated_time_min)}</span>
        </div>
        <div className="card-metric-col">
          <span className="card-metric-lbl">Environmental Risk</span>
          <span className="card-metric-val">
            {effectiveHazardRisk != null ? `${effectiveHazardRisk}%` : '—'}
            <span className="card-metric-sub-level"> ({overallLevel})</span>
          </span>
        </div>
      </div>

      {/* ── SECTION 3: Unified Route Assessment — The Only Score Section ── */}
      <div className="card-3score-box">
        <div className="card-3score-header">
          <span className="card-3score-heading">ROUTE ASSESSMENT</span>
        </div>

        <div className="card-3score-grid">
          {/* Score 1: Accessibility Assessment */}
          <div className="score-col">
            <span className="score-lbl">ACCESSIBILITY</span>
            <span className="score-num">
              {hasAccessibilityScore ? `${accessibility_score}` : '—'}
              <span className="score-denom"> / 100</span>
            </span>
            <span className="score-sub">Overall Route</span>
          </div>

          <div className="score-divider" />

          {/* Score 2: Vehicle Suitability */}
          <div className="score-col">
            <span className="score-lbl">VEHICLE</span>
            <span className="score-num">
              {hasVehicleSuitability ? `${vehicle_suitability}` : '—'}
              {hasVehicleSuitability && <span className="score-denom"> / 100</span>}
            </span>
            <span className="score-sub">{activeVehicle} Fit</span>
          </div>

          <div className="score-divider" />

          {/* Score 3: MARG Combined Score (Emphasized Final Score) */}
          <div className="score-col score-col-final">
            <span className="score-lbl score-lbl-final">MARG COMBINED</span>
            <span className="score-num score-num-final">
              {displayMargScore}
              {displayMargScore !== '—' && <span className="score-denom"> / 100</span>}
            </span>
            <span className="score-sub score-sub-final">Final Score</span>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: Compact Environmental Details ── */}
      <div className="card-env-breakdown-row">
        <div className="env-breakdown-item">
          <span className="env-breakdown-name">Landslide:</span>
          <span className="env-breakdown-val">
            {effectiveLandslideLevel} · {landslide_risk != null ? `${landslide_risk}%` : '—'}
          </span>
        </div>
        <span className="env-breakdown-sep">|</span>
        <div className="env-breakdown-item">
          <span className="env-breakdown-name">Waterlogging:</span>
          <span className="env-breakdown-val">
            {hasWaterlogging
              ? `${effectiveWaterloggingLevel || 'LOW'} · ${waterlogging_risk}%`
              : 'Data unavailable'}
          </span>
        </div>
      </div>

      {/* ── SECTION 5: Compact Vehicle Context ── */}
      <div className="card-vehicle-compact-box">
        <div className="card-vehicle-compact-header">
          <span className="card-vehicle-compact-title">
            VEHICLE: <strong>{activeVehicle.toUpperCase()}</strong>
          </span>
          <span className={`card-vehicle-pill ${getCompatibilityPillClass()}`}>
            {getCompatibilityText()}
          </span>
        </div>
        {vehicle_reason && (
          <div className="card-vehicle-compact-reason">
            {vehicle_reason}
          </div>
        )}
      </div>
    </div>
  );
}
