import React, { useState } from 'react';
import { IconCheck, IconShield } from './Icons';

const safe = (v, fallback = 0) => (v != null && isFinite(v) ? Number(v) : fallback);
const safeFixed = (v, dp = 1) => {
  const num = typeof v === 'number' ? v : parseFloat(v);
  return !isNaN(num) && isFinite(num) ? num.toFixed(dp) : '0.0';
};

function fmtTime(mins) {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function calcConfidence(winner, allRoutes) {
  if (!winner) return { level: 'AVAILABLE CORRIDOR', color: 'var(--text-secondary)', gap: null, secondBest: null };
  const others = (allRoutes || []).filter(r => r && r.route_id !== winner.route_id);
  if (others.length === 0) {
    return { level: 'AVAILABLE CORRIDOR', color: 'var(--text-secondary)', gap: null, secondBest: null };
  }
  const getEffectiveScore = (r) => (typeof r?.vehicle_aware_score === 'number' ? r.vehicle_aware_score : safe(r?.accessibility_score));

  const secondBest = others.reduce(
    (best, r) => getEffectiveScore(r) > getEffectiveScore(best) ? r : best,
    others[0]
  );
  if (!secondBest) {
    return { level: 'AVAILABLE CORRIDOR', color: 'var(--text-secondary)', gap: null, secondBest: null };
  }
  const gap = getEffectiveScore(winner) - getEffectiveScore(secondBest);

  if (gap >= 20) return { level: 'HIGH CONFIDENCE', color: 'var(--forest-green)', gap, secondBest };
  if (gap >= 8)  return { level: 'MODERATE CONFIDENCE', color: 'var(--risk-medium-text)', gap, secondBest };
  return             { level: 'CLOSE DECISION', color: 'var(--risk-high-text)', gap, secondBest };
}

function buildTradeSummary(winner, rival, vehicleType = 'CAR') {
  if (!winner || !rival) return null;
  const winnerHazard = safe(winner.combined_hazard_risk ?? winner.landslide_risk);
  const rivalHazard  = safe(rival.combined_hazard_risk ?? rival.landslide_risk);
  const activeVehicle = winner.vehicle_type || vehicleType || 'CAR';

  const isShorter = safe(winner.distance_km) <= safe(rival.distance_km);
  const isFaster  = safe(winner.estimated_time_min) <= safe(rival.estimated_time_min);
  const isSafer   = winnerHazard <= rivalHazard;

  const hasWinnerSuit = typeof winner.vehicle_suitability === 'number';
  const hasRivalSuit  = typeof rival.vehicle_suitability === 'number';
  const suitDiff = hasWinnerSuit && hasRivalSuit ? (winner.vehicle_suitability - rival.vehicle_suitability) : 0;

  if (suitDiff > 5 && !isShorter) {
    const dDiff = Math.round(Math.abs(safe(winner.distance_km) - safe(rival.distance_km)));
    return `${winner.route_id} provides higher terrain suitability (${winner.vehicle_suitability}/100 vs ${rival.vehicle_suitability}/100) for the selected ${activeVehicle}. While ${dDiff} km longer than ${rival.route_id}, vehicle-aware accessibility makes it the optimal choice.`;
  }

  if (isShorter && isFaster && isSafer) {
    if (suitDiff > 0) {
      return `${winner.route_id} leads on distance, travel time, multi-hazard safety, and vehicle suitability (${winner.vehicle_suitability}/100) for the selected ${activeVehicle}.`;
    }
    return `${winner.route_id} provides the superior combination of distance, travel time, and multi-hazard environmental safety — it leads on all primary logistics parameters.`;
  }
  if (isShorter && isFaster && !isSafer) {
    const rDiff = safeFixed(winnerHazard - rivalHazard, 1);
    return `${winner.route_id} provides faster transit and shorter distance, accepting a ${rDiff}% higher environmental risk under the selected mission urgency profile.`;
  }
  if (isSafer && !isShorter && !isFaster) {
    const dDiff = Math.round(Math.abs(safe(winner.distance_km) - safe(rival.distance_km)));
    return `${winner.route_id} is the safer corridor. Although ${dDiff} km longer than ${rival.route_id}, its lower environmental risk carries decisive weight in the accessibility formula.`;
  }
  return `${winner.route_id} achieves the highest MARG Combined Score for ${activeVehicle} under the selected urgency weighting model.`;
}

function buildWinReasons(winner, rival, vehicleType = 'CAR') {
  if (!winner || !rival) return [];
  const reasons = [];
  const activeVehicle = winner.vehicle_type || vehicleType || 'CAR';

  const dDist = safe(rival.distance_km) - safe(winner.distance_km);
  if (Math.abs(dDist) >= 1) {
    reasons.push(dDist > 0
      ? { positive: true, text: `${Math.round(dDist)} km shorter transit` }
      : { positive: false, text: `${Math.round(-dDist)} km longer transit` });
  }
  const dTime = safe(rival.estimated_time_min) - safe(winner.estimated_time_min);
  if (Math.abs(dTime) >= 1) {
    reasons.push(dTime > 0
      ? { positive: true, text: `${Math.round(dTime)} min faster estimated travel time` }
      : { positive: false, text: `${Math.round(-dTime)} min slower travel time` });
  }
  const winnerHazard = safe(winner.combined_hazard_risk ?? winner.landslide_risk);
  const rivalHazard  = safe(rival.combined_hazard_risk ?? rival.landslide_risk);
  const dHazard = rivalHazard - winnerHazard;
  if (Math.abs(dHazard) >= 0.5) {
    reasons.push(dHazard > 0
      ? { positive: true, text: `${safeFixed(Math.abs(dHazard), 1)}% lower environmental risk` }
      : { positive: false, text: `${safeFixed(Math.abs(dHazard), 1)}% higher environmental risk` });
  }

  // Vehicle suitability comparison
  if (typeof winner.vehicle_suitability === 'number' && typeof rival.vehicle_suitability === 'number') {
    const dSuit = winner.vehicle_suitability - rival.vehicle_suitability;
    if (Math.abs(dSuit) >= 0.5) {
      reasons.push(dSuit > 0
        ? { positive: true, text: `Vehicle Suitability +${safeFixed(dSuit, 1)} pts higher for ${activeVehicle}` }
        : { positive: false, text: `Vehicle Suitability ${safeFixed(dSuit, 1)} pts lower for ${activeVehicle}` });
    }
  }

  // Score comparison
  const winScore = typeof winner.vehicle_aware_score === 'number' ? winner.vehicle_aware_score : safe(winner.accessibility_score);
  const rivScore = typeof rival.vehicle_aware_score === 'number' ? rival.vehicle_aware_score : safe(rival.accessibility_score);
  const dScore = winScore - rivScore;
  if (Math.abs(dScore) >= 0.5) {
    const scoreLabel = typeof winner.vehicle_aware_score === 'number' ? 'MARG Combined Score' : 'Accessibility Assessment';
    reasons.push(dScore > 0
      ? { positive: true, text: `${scoreLabel} +${safeFixed(dScore, 1)} pts higher` }
      : { positive: false, text: `${scoreLabel} ${safeFixed(dScore, 1)} pts lower` });
  }
  return reasons;
}

export default function DecisionIntelligencePanel({
  recommendedRoute,
  allRoutes = [],
  urgency = 'MEDIUM',
  selectedRoute = null,
  vehicleType = 'CAR',
}) {
  const [showAlternatives, setShowAlternatives] = useState(false);

  if (!recommendedRoute) return null;

  const activeVehicle = recommendedRoute.vehicle_type || vehicleType || 'CAR';
  const confidence   = calcConfidence(recommendedRoute, allRoutes);
  const rival        = confidence.secondBest;
  const winReasons   = rival ? buildWinReasons(recommendedRoute, rival, activeVehicle) : [];
  const tradeSummary = rival ? buildTradeSummary(recommendedRoute, rival, activeVehicle) : null;
  const others       = allRoutes.filter(r => r.route_id !== recommendedRoute.route_id);

  return (
    <div className="decision-intel-container" id="decision-intelligence-panel">
      {/* Trade-offs Card */}
      {tradeSummary && (
        <div className="tradeoffs-card">
          <div className="tradeoffs-card-title">TRADE-OFFS &amp; OPERATIONAL RATIONALE</div>
          <p className="tradeoffs-card-body">{tradeSummary}</p>
          {confidence.gap != null && (
            <div className="tradeoffs-confidence-row">
              <span className="tradeoffs-confidence-badge" style={{ color: confidence.color }}>
                ● {confidence.level}
              </span>
              <span className="tradeoffs-gap-text">
                Score advantage: <strong>+{safeFixed(confidence.gap, 1)} pts</strong> vs nearest rival ({rival?.route_id})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Win reasons vs nearest rival */}
      {winReasons.length > 0 && (
        <div className="win-reasons-card">
          <h4 className="win-reasons-title">
            Key Advantages: [{recommendedRoute.route_id}] vs [{rival?.route_id}]
          </h4>
          <div className="win-reasons-grid">
            {winReasons.map((item, idx) => (
              <div key={idx} className={`win-reason-pill ${item.positive ? 'win-pos' : 'win-neg'}`}>
                <span>{item.positive ? <IconCheck size={12} /> : '—'}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alternative Corridors Breakdown */}
      {others.length > 0 && (
        <div className="alternatives-card">
          <button
            type="button"
            className="alternatives-toggle-btn"
            onClick={() => setShowAlternatives(s => !s)}
          >
            <span>{showAlternatives ? 'Hide' : 'View'} Analysis for Alternative Corridors ({others.length})</span>
          </button>

          {showAlternatives && (
            <div className="alternatives-list">
              {others.map((alt) => (
                <div key={alt.route_id} className="alternative-sub-card">
                  <div className="alt-sub-header">
                    <div>
                      <span className="alt-sub-id">[{alt.route_id}]</span>
                      <span className="alt-sub-name">{alt.route_name}</span>
                    </div>
                    <span className="alt-sub-score">
                      {typeof alt.vehicle_aware_score === 'number'
                        ? `MARG Score: ${alt.vehicle_aware_score} / 100`
                        : `Accessibility: ${alt.accessibility_score} / 100`}
                    </span>
                  </div>
                  <div className="alt-sub-metrics">
                    <span>Distance: <strong>{alt.distance_km} km</strong></span>
                    <span>Transit: <strong>{fmtTime(alt.estimated_time_min)}</strong></span>
                    <span>Env Risk: <strong>{alt.combined_hazard_risk != null ? `${alt.combined_hazard_risk}%` : `${alt.landslide_risk}%`}</strong></span>
                    {typeof alt.vehicle_suitability === 'number' && (
                      <span>Suitability: <strong>{alt.vehicle_suitability} / 100</strong></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

