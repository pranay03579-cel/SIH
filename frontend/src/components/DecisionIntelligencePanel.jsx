import React, { useState } from 'react';
import { IconCheck, IconShield } from './Icons';

const safe = (v, fallback = 0) => (v != null && isFinite(v) ? v : fallback);

function fmtTime(mins) {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function calcConfidence(winner, allRoutes) {
  const others = allRoutes.filter(r => r.route_id !== winner.route_id);
  if (others.length === 0) {
    return { level: 'AVAILABLE CORRIDOR', color: 'var(--text-secondary)', gap: null, secondBest: null };
  }
  const secondBest = others.reduce(
    (best, r) => safe(r.accessibility_score) > safe(best.accessibility_score) ? r : best,
    others[0]
  );
  const gap = safe(winner.accessibility_score) - safe(secondBest.accessibility_score);

  if (gap >= 20) return { level: 'HIGH CONFIDENCE', color: 'var(--forest-green)', gap, secondBest };
  if (gap >= 8)  return { level: 'MODERATE CONFIDENCE', color: 'var(--risk-medium-text)', gap, secondBest };
  return             { level: 'CLOSE DECISION', color: 'var(--risk-high-text)', gap, secondBest };
}

function buildTradeSummary(winner, rival) {
  if (!rival) return null;
  const isShorter = safe(winner.distance_km) <= safe(rival.distance_km);
  const isFaster  = safe(winner.estimated_time_min) <= safe(rival.estimated_time_min);
  const isSafer   = safe(winner.landslide_risk) <= safe(rival.landslide_risk);

  if (isShorter && isFaster && isSafer) {
    return `${winner.route_id} provides the superior combination of distance, travel time, and terrain stability — it leads on all primary logistics parameters.`;
  }
  if (isShorter && isFaster && !isSafer) {
    const rDiff = (safe(winner.landslide_risk) - safe(rival.landslide_risk)).toFixed(1);
    return `${winner.route_id} provides faster transit and shorter distance, accepting a ${rDiff}% higher landslide risk index under the selected mission urgency profile.`;
  }
  if (isSafer && !isShorter && !isFaster) {
    const dDiff = Math.round(Math.abs(safe(winner.distance_km) - safe(rival.distance_km)));
    return `${winner.route_id} is the safer corridor. Although ${dDiff} km longer than ${rival.route_id}, its lower terrain risk carries decisive weight in the accessibility formula.`;
  }
  return `${winner.route_id} achieves the highest accessibility score under the selected urgency weighting model.`;
}

function buildWinReasons(winner, rival) {
  if (!rival) return [];
  const reasons = [];
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
  const dRisk = safe(rival.landslide_risk) - safe(winner.landslide_risk);
  if (Math.abs(dRisk) >= 0.5) {
    reasons.push(dRisk > 0
      ? { positive: true, text: `${Math.abs(dRisk).toFixed(1)}% lower terrain landslide hazard` }
      : { positive: false, text: `${Math.abs(dRisk).toFixed(1)}% higher hazard exposure` });
  }
  const dScore = safe(winner.accessibility_score) - safe(rival.accessibility_score);
  if (Math.abs(dScore) >= 0.5) {
    reasons.push(dScore > 0
      ? { positive: true, text: `Accessibility score +${dScore.toFixed(1)} pts higher` }
      : { positive: false, text: `Accessibility score ${dScore.toFixed(1)} pts lower` });
  }
  return reasons;
}

export default function DecisionIntelligencePanel({
  recommendedRoute,
  allRoutes = [],
  urgency = 'MEDIUM',
  selectedRoute = null,
}) {
  const [showAlternatives, setShowAlternatives] = useState(false);

  if (!recommendedRoute) return null;

  const confidence   = calcConfidence(recommendedRoute, allRoutes);
  const isSingle     = allRoutes.length <= 1;
  const rival        = confidence.secondBest;
  const winReasons   = rival ? buildWinReasons(recommendedRoute, rival) : [];
  const tradeSummary = rival ? buildTradeSummary(recommendedRoute, rival) : null;
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
                Score advantage: <strong>+{confidence.gap.toFixed(1)} pts</strong> vs nearest rival ({rival?.route_id})
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
                    <span className="alt-sub-score">Score: {alt.accessibility_score} / 100</span>
                  </div>
                  <div className="alt-sub-metrics">
                    <span>Distance: <strong>{alt.distance_km} km</strong></span>
                    <span>Transit: <strong>{fmtTime(alt.estimated_time_min)}</strong></span>
                    <span>Risk: <strong>{alt.landslide_risk}% ({alt.risk_level})</strong></span>
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
