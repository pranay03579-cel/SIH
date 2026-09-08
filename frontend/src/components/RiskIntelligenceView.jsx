import React from 'react';
import {
  IconAlertTriangle,
  IconShieldCheck,
  IconShieldAlert,
  IconDroplet,
  IconLayers,
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

  const landslideLevel = (route.landslide_risk_level || route.risk_level || 'LOW').toUpperCase();
  const landslidePct = typeof route.landslide_risk === 'number' ? route.landslide_risk : null;

  const hasWaterlogging = typeof route.waterlogging_risk === 'number';
  const waterloggingPct = hasWaterlogging ? route.waterlogging_risk : null;
  const waterloggingLevel = route.waterlogging_level
    ? route.waterlogging_level.toUpperCase()
    : (hasWaterlogging ? (waterloggingPct >= 60 ? 'HIGH' : waterloggingPct >= 30 ? 'MEDIUM' : 'LOW') : null);

  const combinedPct = typeof route.combined_hazard_risk === 'number'
    ? route.combined_hazard_risk
    : (landslidePct !== null ? landslidePct : null);
  const combinedLevel = combinedPct !== null
    ? (combinedPct >= 60 ? 'HIGH' : combinedPct >= 30 ? 'MEDIUM' : 'LOW')
    : landslideLevel;

  const factors = route?.waterlogging_factors;
  const hasFactors = factors && typeof factors === 'object' && Object.keys(factors).length > 0;

  const getRiskBg = (lvl) => {
    switch ((lvl || '').toUpperCase()) {
      case 'LOW': return 'var(--risk-low-bg)';
      case 'MEDIUM': return 'var(--risk-medium-bg)';
      case 'HIGH':
      case 'CRITICAL': return 'var(--risk-high-bg)';
      default: return 'var(--risk-low-bg)';
    }
  };

  const getRiskColor = (lvl) => {
    switch ((lvl || '').toUpperCase()) {
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
    const hazardStr = combinedPct !== null ? `${combinedPct}%` : 'unrated';
    let text = `Corridor [${route.route_id || 'R1'}] is evaluated at ${hazardStr} combined environmental hazard (${combinedLevel} HAZARD). `;
    text += `Landslide susceptibility is ${landslidePct !== null ? `${landslidePct}%` : 'Data unavailable'} (${landslideLevel}), and waterlogging susceptibility is ${hasWaterlogging ? `${waterloggingPct}% (${waterloggingLevel || '—'})` : 'Data unavailable'}. `;
    if (combinedLevel === 'LOW') {
      text += 'Low probability of slope failure or drainage accumulation along this corridor.';
    } else if (combinedLevel === 'MEDIUM') {
      text += 'Moderate environmental exposure detected. Standard operational transit monitoring is advised.';
    } else {
      text += 'Elevated environmental exposure detected. Active corridor caution or emergency alternative consideration is recommended.';
    }
    return text;
  };

  return (
    <div className="risk-intel-container" id="risk-intelligence-dashboard">
      {/* ── HEADER & CORRIDOR SELECTOR ── */}
      <div className="section-header-row">
        <div>
          <div className="section-stepper-label">07 RISK INTELLIGENCE</div>
          <h2 className="section-heading-title">Multi-Hazard Environmental Assessment</h2>
          <p className="section-heading-sub">
            Composite environmental risk evaluation considering terrain stability and precipitation pressure.
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

      {/* ── 3 PRIMARY RISK CARDS ── */}
      <div className="risk-cards-triplet-grid">
        {/* CARD 1: Landslide Risk */}
        <div className="minimal-risk-card">
          <div className="minimal-card-header">
            <div className="minimal-card-title-group">
              <div
                className="minimal-risk-icon-wrap"
                style={{ color: getRiskColor(landslideLevel), backgroundColor: getRiskBg(landslideLevel) }}
              >
                {landslideLevel === 'HIGH' ? <IconShieldAlert size={20} /> : <IconShieldCheck size={20} />}
              </div>
              <div>
                <h3 className="minimal-card-title">Landslide Risk</h3>
                <span className="minimal-card-source">Random Forest ML Risk Model</span>
              </div>
            </div>
            <span
              className="risk-level-hero-badge"
              style={{ backgroundColor: getRiskBg(landslideLevel), color: getRiskColor(landslideLevel) }}
            >
              <span className="status-indicator-dot" style={{ backgroundColor: getRiskColor(landslideLevel) }} />
              {landslideLevel}
            </span>
          </div>

          <div className="minimal-risk-metrics-row">
            <div className="minimal-metric-block">
              <span className="minimal-metric-label">Landslide Probability</span>
              <div className="minimal-metric-value-row">
                <span className="minimal-metric-num" style={{ color: getRiskColor(landslideLevel) }}>
                  {landslidePct}%
                </span>
              </div>
            </div>
            <div className="minimal-metric-block">
              <span className="minimal-metric-label">Vulnerability Level</span>
              <div className="minimal-metric-value-row">
                <span className="minimal-metric-num-neutral">{landslideLevel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: Waterlogging Risk */}
        <div className="minimal-risk-card">
          <div className="minimal-card-header">
            <div className="minimal-card-title-group">
              <div
                className="minimal-risk-icon-wrap"
                style={{ color: getRiskColor(waterloggingLevel), backgroundColor: getRiskBg(waterloggingLevel) }}
              >
                <IconDroplet size={20} />
              </div>
              <div>
                <h3 className="minimal-card-title">Waterlogging Risk</h3>
                <span className="minimal-card-source">Terrain &amp; Precipitation Susceptibility</span>
              </div>
            </div>
            {hasWaterlogging && waterloggingLevel ? (
              <span
                className="risk-level-hero-badge"
                style={{ backgroundColor: getRiskBg(waterloggingLevel), color: getRiskColor(waterloggingLevel) }}
              >
                <span className="status-indicator-dot" style={{ backgroundColor: getRiskColor(waterloggingLevel) }} />
                {waterloggingLevel}
              </span>
            ) : (
              <span className="risk-level-hero-badge" style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)' }}>
                Data unavailable
              </span>
            )}
          </div>

          <div className="minimal-risk-metrics-row">
            <div className="minimal-metric-block">
              <span className="minimal-metric-label">Waterlogging Index</span>
              <div className="minimal-metric-value-row">
                <span className="minimal-metric-num" style={{ color: hasWaterlogging && waterloggingLevel ? getRiskColor(waterloggingLevel) : 'var(--text-secondary)' }}>
                  {hasWaterlogging ? `${waterloggingPct}%` : 'Data unavailable'}
                </span>
              </div>
            </div>
            <div className="minimal-metric-block">
              <span className="minimal-metric-label">Susceptibility Level</span>
              <div className="minimal-metric-value-row">
                <span className="minimal-metric-num-neutral">{hasWaterlogging ? (waterloggingLevel || '—') : 'Data unavailable'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: Combined Multi-Hazard Risk */}
        <div className="minimal-risk-card combined-hazard-card">
          <div className="minimal-card-header">
            <div className="minimal-card-title-group">
              <div
                className="minimal-risk-icon-wrap"
                style={{ color: getRiskColor(combinedLevel), backgroundColor: getRiskBg(combinedLevel) }}
              >
                <IconLayers size={20} />
              </div>
              <div>
                <h3 className="minimal-card-title">Combined Hazard Risk</h3>
                <span className="minimal-card-source">Multi-Hazard Probabilistic Exposure</span>
              </div>
            </div>
            <span
              className="risk-level-hero-badge"
              style={{ backgroundColor: getRiskBg(combinedLevel), color: getRiskColor(combinedLevel) }}
            >
              <span className="status-indicator-dot" style={{ backgroundColor: getRiskColor(combinedLevel) }} />
              {combinedLevel}
            </span>
          </div>

          <div className="minimal-risk-metrics-row">
            <div className="minimal-metric-block">
              <span className="minimal-metric-label">Overall Environmental Exposure</span>
              <div className="minimal-metric-value-row">
                <span className="minimal-metric-num" style={{ color: getRiskColor(combinedLevel) }}>
                  {combinedPct}%
                </span>
              </div>
            </div>
            <div className="minimal-metric-block">
              <span className="minimal-metric-label">Hazard Profile</span>
              <div className="minimal-metric-value-row">
                <span className="minimal-metric-sub" style={{ fontSize: '0.78rem', lineHeight: '1.3' }}>
                  Combined environmental exposure considering both landslide and waterlogging susceptibility.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── WATERLOGGING SUSCEPTIBILITY FACTORS (PART 5) ── */}
      {hasFactors && (
        <div className="minimal-risk-card factors-card">
          <div className="minimal-card-header">
            <div className="minimal-card-title-group">
              <div className="minimal-risk-icon-wrap" style={{ color: 'var(--forest-green)', backgroundColor: 'var(--sage-light)' }}>
                <IconDroplet size={20} />
              </div>
              <div>
                <h3 className="minimal-card-title">Waterlogging Susceptibility Factors</h3>
                <span className="minimal-card-source">Environmental components contributing to waterlogging risk</span>
              </div>
            </div>
          </div>

          <div className="factors-progress-grid">
            <div className="factor-metric-row">
              <div className="factor-header-row">
                <span className="factor-title">Rainfall Pressure (24h)</span>
                <span className="factor-weight-tag">Weight 45%</span>
                <span className="factor-value">{factors.rainfall_pressure ?? 0}%</span>
              </div>
              <div className="factor-track">
                <div
                  className="factor-fill"
                  style={{ width: `${Math.min(100, Math.max(0, factors.rainfall_pressure ?? 0))}%`, backgroundColor: 'var(--pale-blue-dark)' }}
                />
              </div>
            </div>

            <div className="factor-metric-row">
              <div className="factor-header-row">
                <span className="factor-title">Flat Terrain Exposure</span>
                <span className="factor-weight-tag">Weight 30%</span>
                <span className="factor-value">{factors.flat_terrain ?? 0}%</span>
              </div>
              <div className="factor-track">
                <div
                  className="factor-fill"
                  style={{ width: `${Math.min(100, Math.max(0, factors.flat_terrain ?? 0))}%`, backgroundColor: 'var(--soft-peach-dark)' }}
                />
              </div>
            </div>

            <div className="factor-metric-row">
              <div className="factor-header-row">
                <span className="factor-title">Drainage Susceptibility</span>
                <span className="factor-weight-tag">Weight 15%</span>
                <span className="factor-value">{factors.drainage_susceptibility ?? 0}%</span>
              </div>
              <div className="factor-track">
                <div
                  className="factor-fill"
                  style={{ width: `${Math.min(100, Math.max(0, factors.drainage_susceptibility ?? 0))}%`, backgroundColor: 'var(--dusty-lavender-dark)' }}
                />
              </div>
            </div>

            <div className="factor-metric-row">
              <div className="factor-header-row">
                <span className="factor-title">Rainfall Saturation (7d)</span>
                <span className="factor-weight-tag">Weight 10%</span>
                <span className="factor-value">{factors.rainfall_saturation ?? 0}%</span>
              </div>
              <div className="factor-track">
                <div
                  className="factor-fill"
                  style={{ width: `${Math.min(100, Math.max(0, factors.rainfall_saturation ?? 0))}%`, backgroundColor: 'var(--forest-green)' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CARD: Corridor Transit & Slope ── */}
      <div className="minimal-risk-card">
        <div className="minimal-card-header">
          <div className="minimal-card-title-group">
            <div className="minimal-risk-icon-wrap" style={{ color: 'var(--forest-green)', backgroundColor: 'var(--sage-light)' }}>
              <IconInfo size={20} />
            </div>
            <div>
              <h3 className="minimal-card-title">Route Corridor Parameters</h3>
              <span className="minimal-card-source">GIS Geometry &amp; Topographic Baseline</span>
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
              <span className="minimal-metric-num-neutral">{typeof route.estimated_time_min === 'number' ? Math.round(route.estimated_time_min) : (route.estimated_time_min ?? '—')}</span>
              <span className="minimal-metric-sub">min</span>
            </div>
          </div>

          {hasRealSlope && (
            <div className="minimal-metric-block">
              <span className="minimal-metric-label">Mean Terrain Slope</span>
              <div className="minimal-metric-value-row">
                <span className="minimal-metric-num-neutral">{slopeVal}°</span>
                <span className="minimal-metric-sub">Incline</span>
              </div>
            </div>
          )}

          <div className="minimal-metric-block">
            <span className="minimal-metric-label">Selected Vehicle</span>
            <div className="minimal-metric-value-row">
              <span className="minimal-metric-num-neutral">{route.vehicle_type || 'CAR'}</span>
              <span className="minimal-metric-sub">Profile</span>
            </div>
          </div>

          <div className="minimal-metric-block">
            <span className="minimal-metric-label">Corridor Identifier</span>
            <div className="minimal-metric-value-row">
              <span className="minimal-metric-num-neutral">[{route.route_id}]</span>
              <span className="minimal-metric-sub">{route.route_name || 'Corridor'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CARD: Dynamic Risk Summary ── */}
      <div
        className="minimal-risk-summary-card"
        style={{
          backgroundColor: getRiskBg(combinedLevel),
          borderColor: combinedLevel === 'HIGH' ? '#DC2626' : combinedLevel === 'MEDIUM' ? '#D97706' : 'rgba(45, 90, 67, 0.2)'
        }}
      >
        <div className="minimal-summary-header">
          <span className="minimal-summary-tag" style={{ color: getRiskColor(combinedLevel) }}>
            ENVIRONMENTAL RISK SUMMARY
          </span>
          <span className="minimal-summary-status" style={{ color: getRiskColor(combinedLevel) }}>
            Status: <strong>{combinedLevel} HAZARD</strong>
          </span>
        </div>
        <p className="minimal-summary-text">{getRiskSummary()}</p>
      </div>
    </div>
  );
}

