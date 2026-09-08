import React, { useState } from 'react';
import { IconCheck, IconShield } from './Icons';

const PCT = (w) => (w != null ? `${Math.round(w * 100)}%` : '—');

function fmtTime(mins) {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function buildKeyReasons(winner, allRoutes = [], vehicleType = 'CAR') {
  if (!winner) return [];
  const reasons = [];
  const others = (allRoutes || []).filter(r => r && r.route_id !== winner.route_id);
  const activeVehicle = winner.vehicle_type || vehicleType || 'CAR';

  if (winner.vehicle_aware_score != null) {
    reasons.push(`Superior MARG Combined Score: <strong>${winner.vehicle_aware_score} / 100</strong> for <strong>${activeVehicle}</strong>`);
  } else if (winner.accessibility_score != null) {
    reasons.push(`Superior Accessibility Assessment: <strong>${winner.accessibility_score} / 100</strong>`);
  }

  if (winner.vehicle_reason) {
    reasons.push(`Vehicle terrain compatibility: <strong>${winner.vehicle_reason}</strong>`);
  } else if (typeof winner.vehicle_suitability === 'number') {
    reasons.push(`Vehicle Suitability: <strong>${winner.vehicle_suitability} / 100</strong> (${winner.vehicle_compatible === false ? 'Limited' : 'Suitable'}) for ${activeVehicle}`);
  }

  if (others.length > 0) {
    const winnerHazard = typeof winner.combined_hazard_risk === 'number'
      ? winner.combined_hazard_risk
      : (typeof winner.landslide_risk === 'number' ? winner.landslide_risk : null);

    const otherHazards = others
      .map(r => typeof r.combined_hazard_risk === 'number' ? r.combined_hazard_risk : (typeof r.landslide_risk === 'number' ? r.landslide_risk : null))
      .filter(h => h !== null);

    if (winnerHazard !== null && otherHazards.length > 0) {
      const minOtherHazard = Math.min(...otherHazards);
      if (winnerHazard <= minOtherHazard) {
        reasons.push(`Lowest Environmental Risk among evaluated corridors: <strong>${winnerHazard}%</strong>`);
      }
    }

    if (typeof winner.waterlogging_risk === 'number') {
      const otherWL = others.map(r => r.waterlogging_risk).filter(v => typeof v === 'number');
      if (otherWL.length > 0) {
        const minOtherWL = Math.min(...otherWL);
        if (winner.waterlogging_risk <= minOtherWL) {
          reasons.push(`Lower Waterlogging Risk (<strong>${winner.waterlogging_risk}%</strong>) during current rainfall conditions`);
        }
      }
    }

    if (typeof winner.landslide_risk === 'number') {
      const otherLS = others.map(r => r.landslide_risk).filter(v => typeof v === 'number');
      if (otherLS.length > 0) {
        const minOtherLS = Math.min(...otherLS);
        if (winner.landslide_risk <= minOtherLS) {
          reasons.push(`Lower Landslide Risk (<strong>${winner.landslide_risk}%</strong>) along corridor terrain`);
        }
      }
    }

    if (typeof winner.estimated_time_min === 'number') {
      const otherTimes = others.map(r => r.estimated_time_min).filter(v => typeof v === 'number');
      if (otherTimes.length > 0) {
        const minOtherTime = Math.min(...otherTimes);
        if (winner.estimated_time_min <= minOtherTime) {
          reasons.push(`Fastest estimated transit: <strong>${fmtTime(winner.estimated_time_min)}</strong>`);
        } else {
          reasons.push(`Travel time of <strong>${fmtTime(winner.estimated_time_min)}</strong> fits mission urgency`);
        }
      }
    }
  }

  if (reasons.length === 0) {
    reasons.push(`Safe road corridor verified for dispatch with balanced environmental exposure`);
  }

  return reasons;
}

export default function AIRecommendationPanel({
  recommendedRoute: r,
  allRoutes = [],
  urgency = 'MEDIUM',
  vehicleType = 'CAR'
}) {
  const [showCalc, setShowCalc] = useState(false);
  if (!r) return null;

  const activeVehicle = r.vehicle_type || vehicleType || 'CAR';
  const reasons = buildKeyReasons(r, allRoutes, activeVehicle);
  const hasBreakdown = r.distance_score != null && r.time_score != null && r.risk_score != null;
  const effectiveHazard = typeof r.combined_hazard_risk === 'number'
    ? r.combined_hazard_risk
    : (typeof r.landslide_risk === 'number' ? r.landslide_risk : null);
  const hasVehicleAware = typeof r.vehicle_aware_score === 'number';
  const hasSuitability = typeof r.vehicle_suitability === 'number';

  return (
    <div className="recommendation-card-container" id="ai-recommendation-panel">
      {/* Stepper Tag */}
      <div className="rec-stepper-row">
        <span className="rec-stepper-badge">06 WHY THIS ROUTE?</span>
      </div>

      {/* Main recommendation banner */}
      <div className="rec-banner-card">
        <div className="rec-banner-left">
          <div className="rec-badge-row">
            <span className="rec-star-badge">
              <IconCheck size={12} style={{ marginRight: 4 }} />
              RECOMMENDED FOR {activeVehicle}
            </span>
            <span className="rec-urgency-tag">Urgency: {urgency}</span>
          </div>
          <h2 className="rec-corridor-name">[{r.route_id}] {r.route_name}</h2>
          <div className="rec-key-stats-row">
            <div className="rec-stat-col">
              <span className="rec-stat-lbl">Distance</span>
              <span className="rec-stat-val">{r.distance_km ?? '—'} km</span>
            </div>
            <div className="rec-stat-col">
              <span className="rec-stat-lbl">Transit Time</span>
              <span className="rec-stat-val">{fmtTime(r.estimated_time_min)}</span>
            </div>
            <div className="rec-stat-col">
              <span className="rec-stat-lbl">Environmental Risk</span>
              <span className="rec-stat-val">{effectiveHazard ?? '—'}%</span>
            </div>
            {hasSuitability && (
              <div className="rec-stat-col">
                <span className="rec-stat-lbl">Vehicle Suitability</span>
                <span className="rec-stat-val" style={{ color: r.vehicle_compatible === false ? 'var(--risk-medium-text)' : 'var(--forest-green)' }}>
                  {r.vehicle_suitability} / 100
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Circular score badge */}
        <div className="rec-score-circle-wrapper">
          <div className="rec-score-circle">
            <span className="rec-score-number">{hasVehicleAware ? r.vehicle_aware_score : (r.accessibility_score ?? '—')}</span>
            <span className="rec-score-unit">/ 100</span>
          </div>
          <span className="rec-score-caption">
            {hasVehicleAware ? 'MARG Combined Score' : 'Accessibility Assessment'}
          </span>
        </div>
      </div>

      {/* Why MARG selected this route checklist */}
      <div className="rec-reasons-card">
        <h3 className="rec-card-heading">Why MARG Selected This Corridor</h3>
        <ul className="rec-reasons-list">
          {reasons.map((text, idx) => (
            <li key={idx} className="rec-reason-item">
              <span className="rec-reason-icon"><IconCheck size={14} /></span>
              <span dangerouslySetInnerHTML={{ __html: text }} />
            </li>
          ))}
        </ul>

        {/* Toggle scoring calculation */}
        {hasBreakdown && (
          <button
            type="button"
            className="rec-toggle-btn"
            onClick={() => setShowCalc(c => !c)}
          >
            <span>{showCalc ? 'Hide Score Breakdown' : 'View Score Breakdown'}</span>
          </button>
        )}

        {hasBreakdown && showCalc && (
          <div className="rec-breakdown-box">
            <div className="rec-breakdown-row">
              <div className="rec-breakdown-meta">
                <span>Distance Efficiency ({PCT(r.distance_weight)})</span>
                <span>{r.distance_score} pts</span>
              </div>
              <div className="rec-breakdown-track">
                <div className="rec-breakdown-fill" style={{ width: `${r.distance_score}%`, backgroundColor: 'var(--pale-blue-dark)' }} />
              </div>
            </div>
            <div className="rec-breakdown-row">
              <div className="rec-breakdown-meta">
                <span>Transit Time ({PCT(r.time_weight)})</span>
                <span>{r.time_score} pts</span>
              </div>
              <div className="rec-breakdown-track">
                <div className="rec-breakdown-fill" style={{ width: `${r.time_score}%`, backgroundColor: 'var(--soft-peach-dark)' }} />
              </div>
            </div>
            <div className="rec-breakdown-row">
              <div className="rec-breakdown-meta">
                <span>Environmental Safety ({PCT(r.risk_weight)})</span>
                <span>{r.risk_score} pts</span>
              </div>
              <div className="rec-breakdown-track">
                <div className="rec-breakdown-fill" style={{ width: `${r.risk_score}%`, backgroundColor: 'var(--forest-green)' }} />
              </div>
            </div>
            {hasSuitability && (
              <div className="rec-breakdown-row">
                <div className="rec-breakdown-meta">
                  <span>Vehicle Suitability Component</span>
                  <span>{r.vehicle_suitability} pts</span>
                </div>
                <div className="rec-breakdown-track">
                  <div
                    className="rec-breakdown-fill"
                    style={{
                      width: `${r.vehicle_suitability}%`,
                      backgroundColor: r.vehicle_compatible === false ? 'var(--risk-medium-text)' : 'var(--forest-green)'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
