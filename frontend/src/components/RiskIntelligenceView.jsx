import React from 'react';
import {
  IconAlertTriangle,
  IconShieldCheck,
  IconShieldAlert,
  IconInfo
} from './Icons';

export default function RiskIntelligenceView({
  selectedRoute,
  allRoutes = [],
  onSelectRoute
}) {
  const route = selectedRoute || (allRoutes.length > 0 ? allRoutes[0] : null);

  if (!route) {
    return (
      <div className="empty-intel-card">
        <div className="empty-intel-icon">
          <IconAlertTriangle size={36} color="var(--text-tertiary)" />
        </div>
        <h3>No Corridor Evaluated</h3>
        <p>Please evaluate corridors in the Route Planner to inspect live risk assessment.</p>
      </div>
    );
  }

  const riskLevel = (route.risk_level || 'LOW').toUpperCase();
  const riskPct = route.landslide_risk ?? 0;

  const getRiskBg = (lvl) => {
    switch (lvl) {
      case 'LOW': return 'var(--risk-low-bg)';
      case 'MEDIUM': return 'var(--risk-medium-bg)';
      case 'HIGH':
      case 'CRITICAL': return 'var(--risk-high-bg)';
      default: return 'var(--risk-low-bg)';
    }
  };

  const getRiskColor = (lvl) => {
    switch (lvl) {
      case 'LOW': return 'var(--risk-low-text)';
      case 'MEDIUM': return 'var(--risk-medium-text)';
      case 'HIGH':
      case 'CRITICAL': return 'var(--risk-high-text)';
      default: return 'var(--risk-low-text)';
    }
  };

  // Only display slope if real slope data is present on the route object
  const hasRealSlope = route.slope != null || route.slope_deg != null || route.max_slope != null;
  const slopeVal = route.slope ?? route.slope_deg ?? route.max_slope;

  // Simple, factual risk summary based strictly on backend values
  const getRiskSummary = () => {
    if (riskLevel === 'LOW') {
      return `This corridor is evaluated at ${riskPct}% landslide risk (${riskLevel} RISK). The ML model predicts low probability of slope failure or obstruction along this route.`;
    }
    if (riskLevel === 'MEDIUM') {
      return `This corridor is evaluated at ${riskPct}% landslide risk (${riskLevel} RISK). Moderate landslide risk detected along the route. Standard operational monitoring is advised.`;
    }
    return `This corridor is evaluated at ${riskPct}% landslide risk (${riskLevel} RISK). Elevated risk detected by the ML model. Caution or alternative route selection is recommended.`;
  };

  return (
    <div className="risk-intel-container" id="risk-intelligence-dashboard">
      {/* ── HEADER & CORRIDOR SELECTOR ── */}
      <div className="section-header-row">
        <div>
          <div className="section-stepper-label">07 RISK INTELLIGENCE</div>
          <h2 className="section-heading-title">Landslide Risk Assessment</h2>
          <p className="section-heading-sub">
            Machine-learning risk evaluation based on the active corridor.
          </p>
        </div>

        {/* Dynamic Route Switcher */}
        {allRoutes.length > 1 && (
          <div className="intel-route-selector">
            <span className="intel-selector-label">Select Corridor:</span>
            <div className="intel-selector-pills">
              {allRoutes.map((r) => (
                <button
                  key={r.route_id}
                  type="button"
                  className={`intel-pill-btn ${r.route_id === route.route_id ? 'active' : ''}`}
                  onClick={() => onSelectRoute && onSelectRoute(r)}
                  title={`Inspect Risk Intelligence for ${r.route_id}`}
                >
                  {r.route_id}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 2-3 MINIMAL CARDS BASED STRICTLY ON REAL BACKEND DATA ── */}

      {/* CARD 1: Overall ML Landslide Risk */}
      <div className="minimal-risk-card">
        <div className="minimal-card-header">
          <div className="minimal-card-title-group">
            <div
              className="minimal-risk-icon-wrap"
              style={{ color: getRiskColor(riskLevel), backgroundColor: getRiskBg(riskLevel) }}
            >
              {riskLevel === 'HIGH' ? <IconShieldAlert size={20} /> : <IconShieldCheck size={20} />}
            </div>
            <div>
              <h3 className="minimal-card-title">Overall Landslide Risk</h3>
              <span className="minimal-card-source">Random Forest ML Risk Model</span>
            </div>
          </div>
          <span
            className="risk-level-hero-badge"
            style={{ backgroundColor: getRiskBg(riskLevel), color: getRiskColor(riskLevel) }}
          >
            <span className="status-indicator-dot" style={{ backgroundColor: getRiskColor(riskLevel) }} />
            {riskLevel} RISK
          </span>
        </div>

        <div className="minimal-risk-metrics-row">
          <div className="minimal-metric-block">
            <span className="minimal-metric-label">Predicted Landslide Risk</span>
            <div className="minimal-metric-value-row">
              <span className="minimal-metric-num" style={{ color: getRiskColor(riskLevel) }}>
                {riskPct}%
              </span>
            </div>
          </div>

          <div className="minimal-metric-block">
            <span className="minimal-metric-label">Corridor Identifier</span>
            <div className="minimal-metric-value-row">
              <span className="minimal-metric-num-neutral">[{route.route_id}]</span>
              <span className="minimal-metric-sub">{route.route_name || 'Corridor'}</span>
            </div>
          </div>

          {route.risk_score != null && (
            <div className="minimal-metric-block">
              <span className="minimal-metric-label">Scoring Engine Risk Factor</span>
              <div className="minimal-metric-value-row">
                <span className="minimal-metric-num-neutral">{route.risk_score}</span>
                <span className="minimal-metric-sub">/ 100</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CARD 2: Corridor Metrics & Terrain (Only Real Backend Data) */}
      <div className="minimal-risk-card">
        <div className="minimal-card-header">
          <div className="minimal-card-title-group">
            <div className="minimal-risk-icon-wrap" style={{ color: 'var(--forest-green)', backgroundColor: 'var(--sage-light)' }}>
              <IconInfo size={20} />
            </div>
            <div>
              <h3 className="minimal-card-title">Route Corridor Metrics</h3>
              <span className="minimal-card-source">OSRM Routing &amp; Transit Engine</span>
            </div>
          </div>
        </div>

        <div className="minimal-risk-metrics-row">
          <div className="minimal-metric-block">
            <span className="minimal-metric-label">Total Distance</span>
            <div className="minimal-metric-value-row">
              <span className="minimal-metric-num-neutral">{route.distance_km}</span>
              <span className="minimal-metric-sub">km</span>
            </div>
          </div>

          <div className="minimal-metric-block">
            <span className="minimal-metric-label">Estimated Transit Time</span>
            <div className="minimal-metric-value-row">
              <span className="minimal-metric-num-neutral">{Math.round(route.estimated_time_min)}</span>
              <span className="minimal-metric-sub">min</span>
            </div>
          </div>

          {hasRealSlope && (
            <div className="minimal-metric-block">
              <span className="minimal-metric-label">Terrain Slope</span>
              <div className="minimal-metric-value-row">
                <span className="minimal-metric-num-neutral">{slopeVal}°</span>
                <span className="minimal-metric-sub">Incline</span>
              </div>
            </div>
          )}

          <div className="minimal-metric-block">
            <span className="minimal-metric-label">Route Origin → Destination</span>
            <div className="minimal-metric-value-row">
              <span className="minimal-metric-sub" style={{ fontWeight: 600 }}>
                {route.origin || 'Origin'} → {route.destination || 'Destination'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CARD 3: Simple Risk Summary */}
      <div
        className="minimal-risk-summary-card"
        style={{
          backgroundColor: getRiskBg(riskLevel),
          borderColor: riskLevel === 'HIGH' ? '#DC2626' : riskLevel === 'MEDIUM' ? '#D97706' : 'rgba(45, 90, 67, 0.2)'
        }}
      >
        <div className="minimal-summary-header">
          <span className="minimal-summary-tag" style={{ color: getRiskColor(riskLevel) }}>
            RISK SUMMARY
          </span>
          <span className="minimal-summary-status" style={{ color: getRiskColor(riskLevel) }}>
            Status: <strong>{riskLevel} RISK</strong>
          </span>
        </div>
        <p className="minimal-summary-text">{getRiskSummary()}</p>
      </div>
    </div>
  );
}
