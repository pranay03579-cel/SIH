import React from 'react';
import { IconAlertTriangle } from './Icons';

// Route color palette — shared with RouteMap for card↔map color correspondence
// Each index maps to both the card left-border accent and the map polyline color
export const ROUTE_PALETTE = [
  { main: '#2563eb', bg: 'rgba(37, 99, 235, 0.08)', border: '#1d4ed8' },   // Route 1: Institutional blue
  { main: '#d97706', bg: 'rgba(217, 119, 6, 0.08)', border: '#b45309' },   // Route 2: Amber/orange — clearly visible on dark map
  { main: '#7c3aed', bg: 'rgba(124, 58, 237, 0.08)', border: '#6d28d9' },  // Route 3: Professional purple
  { main: '#0d9488', bg: 'rgba(13, 148, 136, 0.08)', border: '#0f766e' },  // Route 4: Deep teal
  { main: '#be185d', bg: 'rgba(190, 24, 93, 0.08)', border: '#9d174d' },   // Route 5: Deep rose
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
    accessibility_score,
  } = route;

  const colorTheme = ROUTE_PALETTE[index % ROUTE_PALETTE.length];

  const formatTime = (mins) => {
    if (!mins && mins !== 0) return '—';
    const hours = Math.floor(mins / 60);
    const remainder = Math.round(mins % 60);
    if (hours === 0) return `${remainder}m`;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  };

  const getRiskBadgeClass = (level) => {
    switch ((level || '').toUpperCase()) {
      case 'LOW':      return 'badge-risk-low';
      case 'MEDIUM':   return 'badge-risk-medium';
      case 'HIGH':     return 'badge-risk-high';
      case 'CRITICAL': return 'badge-risk-critical';
      default:         return 'badge-risk-low';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--risk-low)';
    if (score >= 60) return 'var(--risk-medium)';
    if (score >= 40) return 'var(--risk-high)';
    return 'var(--risk-critical)';
  };

  return (
    <div
      className={`route-card ${isSelected ? 'selected' : ''} ${isRecommended ? 'is-recommended' : ''}`}
      style={{
        borderLeftColor: isRecommended ? 'var(--green)' : colorTheme.main,
      }}
      onClick={() => onSelect && onSelect(route)}
      role="button"
      tabIndex={0}
      aria-label={`Route: ${route_name || route_id}`}
      onKeyDown={(e) => e.key === 'Enter' && onSelect && onSelect(route)}
    >
      {/* System recommendation label */}
      {isRecommended && (
        <div className="recommended-ribbon">
          ✓ SYSTEM RECOMMENDATION
        </div>
      )}

      {/* Card header */}
      <div className="route-card-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span
              className="route-id-badge"
              style={{
                color: colorTheme.main,
                backgroundColor: colorTheme.bg,
                borderColor: colorTheme.border,
              }}
            >
              <span className="route-color-dot" style={{ backgroundColor: colorTheme.main }} />
              {route_id || `R${index + 1}`}
            </span>
          </div>
          <h3 className="route-name">{route_name || `Corridor ${index + 1}`}</h3>
        </div>
        <span className={`badge ${getRiskBadgeClass(risk_level)}`}>
          {risk_level || 'LOW'}
        </span>
      </div>

      {/* Operational advantages */}
      {comparisonTags && comparisonTags.length > 0 && (
        <div className="comparison-tags-row">
          {comparisonTags.map((tag) => (
            <span key={tag.label} className={`comp-tag comp-tag-${tag.type}`}>
              {tag.label}
            </span>
          ))}
        </div>
      )}

      {/* Primary metrics */}
      <div className="route-metrics-grid">
        <div className="metric-item">
          <span className="metric-label">Distance</span>
          <span className="metric-value">{distance_km ?? '—'} km</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Transit Time</span>
          <span className="metric-value">{formatTime(estimated_time_min)}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Terrain Risk</span>
          <span className="metric-value" style={{ color: getScoreColor(100 - (landslide_risk ?? 50)), fontSize: '0.88rem' }}>
            {(risk_level || 'LOW').toUpperCase()}
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Accessibility Score</span>
          <span className="metric-value" style={{ color: getScoreColor(accessibility_score) }}>
            {accessibility_score ?? '—'}
          </span>
        </div>
      </div>

      {/* Score bar */}
      <div className="score-container">
        <div className="score-header">
          <span>Accessibility Score</span>
          <span style={{ color: getScoreColor(accessibility_score), fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            {accessibility_score ?? '—'} / 100
          </span>
        </div>
        <div className="score-bar-bg">
          <div
            className="score-bar-fill"
            style={{
              width: `${Math.min(100, Math.max(0, accessibility_score ?? 0))}%`,
              backgroundColor: getScoreColor(accessibility_score),
            }}
          />
        </div>
      </div>

      {/* Landslide risk */}
      <div className="risk-badges-row">
        <div className="landslide-indicator">
          <IconAlertTriangle size={13} color="var(--risk-medium)" />
          <span>Landslide Exposure: <strong>{landslide_risk ?? '—'}%</strong></span>
        </div>
      </div>
    </div>
  );
}
