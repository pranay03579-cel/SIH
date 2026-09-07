import React from 'react';
import { IconSparkles, IconClock, IconAlertTriangle, IconShield } from './Icons';

export default function RouteCard({
  route,
  isSelected   = false,
  isRecommended = false,   // controlled by parent (recommendedId state), NOT route.recommended
  onSelect
}) {
  const {
    route_id,
    route_name,
    distance_km,
    estimated_time_min,
    landslide_risk,
    risk_level,
    accessibility_score,
    // Person 3 detailed breakdown (present when backend returns them)
    distance_score,
    time_score,
    risk_score,
    distance_weight,
    time_weight,
    risk_weight,
  } = route;

  const hasBreakdown = distance_score != null && time_score != null && risk_score != null;

  // Format minutes → "Xh Ym"
  const formatTime = (mins) => {
    if (!mins && mins !== 0) return '—';
    const hours     = Math.floor(mins / 60);
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
    if (score >= 80) return '#34d399';
    if (score >= 60) return '#38bdf8';
    if (score >= 40) return '#fbbf24';
    return '#f87171';
  };

  const pct = (w) => w != null ? `${Math.round(w * 100)}%` : '';

  return (
    <div
      className={`route-card ${isRecommended ? 'is-recommended' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect && onSelect(route)}
      role="button"
      tabIndex={0}
      aria-label={`Route: ${route_name}`}
      onKeyDown={(e) => e.key === 'Enter' && onSelect && onSelect(route)}
    >
      {/* AI Recommended badge — only shown when explicitly recommended */}
      {isRecommended && (
        <div className="recommended-ribbon">
          <IconSparkles size={12} />
          <span>AI RECOMMENDED CORRIDOR</span>
        </div>
      )}

      {/* Header */}
      <div className="route-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {route_id && <span className="route-id-badge">{route_id}</span>}
          <h3 className="route-name">{route_name}</h3>
        </div>
        <span className={`badge ${getRiskBadgeClass(risk_level)}`}>
          {risk_level} RISK
        </span>
      </div>

      {/* Distance & Time */}
      <div className="route-metrics-grid">
        <div className="metric-item">
          <span className="metric-label">Distance</span>
          <span className="metric-value">{distance_km} km</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Transit Time</span>
          <span className="metric-value" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconClock size={14} />
            {formatTime(estimated_time_min)}
          </span>
        </div>
      </div>

      {/* Accessibility Score bar */}
      <div className="score-container">
        <div className="score-header">
          <span>Accessibility Score</span>
          <span style={{ color: getScoreColor(accessibility_score), fontWeight: 700 }}>
            {accessibility_score} / 100
          </span>
        </div>
        <div className="score-bar-bg">
          <div
            className="score-bar-fill"
            style={{
              width: `${Math.min(100, Math.max(0, accessibility_score))}%`,
              backgroundColor: getScoreColor(accessibility_score)
            }}
          />
        </div>
      </div>

      {/* Person 3 score breakdown — shown only when detailed data is available */}
      {hasBreakdown && (
        <div className="score-breakdown">
          <div className="score-breakdown-title">Accessibility Analysis</div>
          <div className="score-breakdown-grid">
            <div className="breakdown-item">
              <span className="breakdown-label">Distance Score</span>
              <span className="breakdown-value">{distance_score}
                {distance_weight != null && <span className="breakdown-weight"> ×{pct(distance_weight)}</span>}
              </span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-label">Time Score</span>
              <span className="breakdown-value">{time_score}
                {time_weight != null && <span className="breakdown-weight"> ×{pct(time_weight)}</span>}
              </span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-label">Risk Score</span>
              <span className="breakdown-value">{risk_score}
                {risk_weight != null && <span className="breakdown-weight"> ×{pct(risk_weight)}</span>}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Landslide indicator row */}
      <div className="risk-badges-row">
        <div className="landslide-indicator">
          <IconAlertTriangle size={14} color="#f59e0b" />
          <span>Landslide Risk: <strong>{landslide_risk}</strong></span>
        </div>
        <div className="landslide-indicator">
          <IconShield size={14} color="#38bdf8" />
          <span>{isRecommended ? 'Optimal Clearance' : 'Alternative'}</span>
        </div>
      </div>
    </div>
  );
}
