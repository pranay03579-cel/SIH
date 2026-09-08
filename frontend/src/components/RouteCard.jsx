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

  return (
    <div
      className={`card-route-item ${isSelected ? 'selected' : ''} ${isRecommended ? 'recommended' : ''}`}
      onClick={() => onSelect && onSelect(route)}
      role="button"
      tabIndex={0}
      aria-label={`Corridor: ${route_name || route_id}`}
      onKeyDown={(e) => e.key === 'Enter' && onSelect && onSelect(route)}
    >
      {/* Recommended Top Ribbon */}
      {isRecommended && (
        <div className="card-recommended-banner">
          <IconCheck size={13} />
          <span>RECOMMENDED CORRIDOR</span>
        </div>
      )}

      {/* Header */}
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

        <span className={`card-risk-pill ${getRiskClass(risk_level)}`}>
          {(risk_level || 'LOW').toUpperCase()} RISK
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

      {/* Metrics Row */}
      <div className="card-metrics-grid">
        <div className="card-metric-col">
          <span className="card-metric-lbl">Distance</span>
          <span className="card-metric-val">{distance_km ?? '—'} km</span>
        </div>
        <div className="card-metric-col">
          <span className="card-metric-lbl">Travel Time</span>
          <span className="card-metric-val">{formatTime(estimated_time_min)}</span>
        </div>
        <div className="card-metric-col">
          <span className="card-metric-lbl">Landslide Risk</span>
          <span className="card-metric-val">{landslide_risk ?? '—'}%</span>
        </div>
      </div>

      {/* Accessibility Score Bar */}
      <div className="card-score-section">
        <div className="card-score-label-row">
          <span className="card-score-title">Accessibility Score</span>
          <span className="card-score-value">{accessibility_score ?? '—'} / 100</span>
        </div>
        <div className="card-score-track">
          <div
            className="card-score-progress"
            style={{
              width: `${Math.min(100, Math.max(0, accessibility_score ?? 0))}%`,
              backgroundColor: isRecommended ? 'var(--forest-green)' : (accessibility_score >= 80 ? 'var(--risk-low-text)' : accessibility_score >= 60 ? 'var(--risk-medium-text)' : 'var(--risk-high-text)'),
            }}
          />
        </div>
      </div>
    </div>
  );
}
