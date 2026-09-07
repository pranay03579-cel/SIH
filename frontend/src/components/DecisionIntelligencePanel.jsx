import React, { useState } from 'react';

// ============================================================
// HELPERS
// ============================================================

const safe = (v, fallback = 0) => (v != null && isFinite(v) ? v : fallback);

function fmtTime(mins) {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ============================================================
// DECISION CONFIDENCE — compact badge only
// ============================================================
function calcConfidence(winner, allRoutes) {
  const others = allRoutes.filter(r => r.route_id !== winner.route_id);
  if (others.length === 0) {
    return { level: 'AVAILABLE CORRIDOR', color: '#94a3b8', gap: null, secondBest: null };
  }
  const secondBest = others.reduce(
    (best, r) => safe(r.accessibility_score) > safe(best.accessibility_score) ? r : best,
    others[0]
  );
  const gap = safe(winner.accessibility_score) - safe(secondBest.accessibility_score);

  if (gap >= 20) return { level: 'HIGH CONFIDENCE',     color: '#34d399', gap, secondBest };
  if (gap >= 8)  return { level: 'MODERATE CONFIDENCE', color: '#fbbf24', gap, secondBest };
  return             { level: 'CLOSE DECISION',         color: '#fb923c', gap, secondBest };
}

// ============================================================
// MAIN TRADE-OFF SUMMARY (one sentence)
// ============================================================
function buildTradeSummary(winner, rival) {
  if (!rival) return null;
  const isShorter = safe(winner.distance_km)       <= safe(rival.distance_km);
  const isFaster  = safe(winner.estimated_time_min) <= safe(rival.estimated_time_min);
  const isSafer   = safe(winner.landslide_risk)     <= safe(rival.landslide_risk);

  if (isShorter && isFaster && isSafer) {
    return `${winner.route_id} provides the strongest overall combination of distance, speed, and terrain safety — it leads on all key metrics.`;
  }
  if (isShorter && isFaster && !isSafer) {
    const rDiff = (safe(winner.landslide_risk) - safe(rival.landslide_risk)).toFixed(1);
    return `${winner.route_id} wins on speed and distance, accepting a ${rDiff}% higher landslide exposure. Under this urgency profile, the time-distance advantage outweighs the additional terrain risk.`;
  }
  if (isSafer && !isShorter && !isFaster) {
    const dDiff = Math.round(Math.abs(safe(winner.distance_km) - safe(rival.distance_km)));
    return `${winner.route_id} is the safer corridor. Although ${dDiff} km longer than ${rival.route_id}, its lower terrain risk carries more weight under the selected urgency profile.`;
  }
  if (isSafer && isShorter) {
    return `${winner.route_id} is both shorter and safer than ${rival.route_id}, making it the clear recommendation despite a marginal time difference.`;
  }
  return `${winner.route_id} achieves the highest accessibility score under the selected urgency weighting. See alternative comparison for a full metric breakdown.`;
}

// ============================================================
// WHY THIS ROUTE WON (bullet points vs nearest rival)
// ============================================================
function buildWinReasons(winner, rival) {
  if (!rival) return [];
  const reasons = [];
  const dDist = safe(rival.distance_km) - safe(winner.distance_km);
  if (Math.abs(dDist) >= 1) {
    reasons.push(dDist > 0
      ? { positive: true,  text: `${Math.round(dDist)} km shorter than ${rival.route_id}` }
      : { positive: false, text: `${Math.round(-dDist)} km longer than ${rival.route_id}` });
  }
  const dTime = safe(rival.estimated_time_min) - safe(winner.estimated_time_min);
  if (Math.abs(dTime) >= 1) {
    reasons.push(dTime > 0
      ? { positive: true,  text: `${Math.round(dTime)} min faster transit` }
      : { positive: false, text: `${Math.round(-dTime)} min slower transit` });
  }
  const dRisk = safe(rival.landslide_risk) - safe(winner.landslide_risk);
  if (Math.abs(dRisk) >= 0.5) {
    reasons.push(dRisk > 0
      ? { positive: true,  text: `${Math.abs(dRisk).toFixed(1)}% lower landslide risk` }
      : { positive: false, text: `${Math.abs(dRisk).toFixed(1)}% higher landslide risk` });
  }
  const dScore = safe(winner.accessibility_score) - safe(rival.accessibility_score);
  if (Math.abs(dScore) >= 0.5) {
    reasons.push(dScore > 0
      ? { positive: true,  text: `Accessibility score +${dScore.toFixed(1)} pts higher` }
      : { positive: false, text: `Accessibility score ${dScore.toFixed(1)} pts lower` });
  }
  return reasons;
}

// ============================================================
// COMPARISON TABLE (in collapsed section)
// ============================================================
function ComparisonTable({ winner, allRoutes }) {
  const cols = allRoutes.slice(0, 4);
  const metrics = [
    { key: 'distance_km',       label: 'Distance',      fmt: v => `${v} km`,     bestFn: vals => Math.min(...vals) },
    { key: 'estimated_time_min',label: 'Travel Time',   fmt: v => fmtTime(v),    bestFn: vals => Math.min(...vals) },
    { key: 'landslide_risk',    label: 'Landslide Risk',fmt: v => `${v}%`,       bestFn: vals => Math.min(...vals) },
    { key: 'accessibility_score',label: 'Score',        fmt: v => `${v} / 100`,  bestFn: vals => Math.max(...vals) },
  ];
  return (
    <div className="di-table-wrapper">
      <table className="di-table">
        <thead>
          <tr>
            <th className="di-th di-th-metric">Metric</th>
            {cols.map(r => (
              <th key={r.route_id} className={`di-th ${r.route_id === winner.route_id ? 'di-th-winner' : ''}`}>
                {r.route_id === winner.route_id ? <span className="di-winner-col-label">🤖 {r.route_id}</span> : r.route_id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map(m => {
            const vals = cols.map(r => safe(r[m.key]));
            const bestVal = m.bestFn(vals);
            return (
              <tr key={m.key} className="di-tr">
                <td className="di-td-label">{m.label}</td>
                {cols.map(r => {
                  const val = safe(r[m.key]);
                  const isBest = val === bestVal;
                  return (
                    <td key={r.route_id} className={`di-td ${isBest ? 'di-td-best' : ''} ${r.route_id === winner.route_id ? 'di-td-winner-col' : ''}`}>
                      {isBest && <span className="di-best-dot" />}
                      {m.fmt(r[m.key] ?? '—')}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// WHY NOT ALTERNATIVES (in collapsed section)
// ============================================================
function AlternativeCards({ winner, allRoutes }) {
  const others = allRoutes.filter(r => r.route_id !== winner.route_id);
  if (others.length === 0) return null;
  return (
    <div className="di-alts-list">
      {others.map(rival => {
        const items = [];
        const dDist = safe(rival.distance_km) - safe(winner.distance_km);
        if (Math.abs(dDist) >= 1) items.push(dDist > 0 ? { p: false, t: `${Math.round(dDist)} km longer` } : { p: true, t: `${Math.round(-dDist)} km shorter` });
        const dTime = safe(rival.estimated_time_min) - safe(winner.estimated_time_min);
        if (Math.abs(dTime) >= 1) items.push(dTime > 0 ? { p: false, t: `${Math.round(dTime)} min slower` } : { p: true, t: `${Math.round(-dTime)} min faster` });
        const dRisk = safe(rival.landslide_risk) - safe(winner.landslide_risk);
        if (Math.abs(dRisk) >= 0.5) items.push(dRisk < 0 ? { p: true, t: `${Math.abs(dRisk).toFixed(1)}% safer` } : { p: false, t: `${Math.abs(dRisk).toFixed(1)}% higher risk` });
        const dScore = safe(rival.accessibility_score) - safe(winner.accessibility_score);
        if (Math.abs(dScore) >= 0.5) items.push(dScore < 0 ? { p: false, t: `Score ${Math.abs(dScore).toFixed(1)} pts lower` } : { p: true, t: `Score ${Math.abs(dScore).toFixed(1)} pts higher` });

        const pos = items.filter(i => i.p).map(i => i.t);
        const neg = items.filter(i => !i.p).map(i => i.t);
        let reasoning = '';
        if (pos.length && neg.length) reasoning = `${rival.route_id} offers ${pos.join(' and ')}, but loses on ${neg.join(' and ')}.`;
        else if (neg.length) reasoning = `${rival.route_id} trails on all key metrics under this urgency profile.`;
        else reasoning = `${rival.route_id} is competitive but scores lower in the urgency-weighted model.`;

        return (
          <div key={rival.route_id} className="di-alt-card">
            <div className="di-alt-header">
              <span className="di-alt-id">{rival.route_id}</span>
              <span className="di-alt-name">{rival.route_name || `Corridor ${rival.route_id}`}</span>
              <span className="di-alt-score">Score: {rival.accessibility_score ?? '—'}</span>
            </div>
            <div className="di-alt-items">
              {items.map((item, i) => (
                <span key={i} className={`di-alt-item ${item.p ? 'di-alt-pos' : 'di-alt-neg'}`}>
                  {item.p ? '+' : '−'} {item.t}
                </span>
              ))}
            </div>
            <div className="di-alt-reasoning">{reasoning}</div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
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
  const showInspecting = selectedRoute && selectedRoute.route_id !== recommendedRoute.route_id;

  return (
    <div className="di-panel" id="decision-intelligence-panel">

      {/* ── Inspecting banner ─────────────────────────────── */}
      {showInspecting && (
        <div className="di-inspect-banner">
          <span className="di-inspect-dot" />
          <span>
            Inspecting <strong>{selectedRoute.route_id}</strong> — AI recommendation remains{' '}
            <strong>{recommendedRoute.route_id}</strong>
          </span>
        </div>
      )}

      {/* ── Single-route fallback ──────────────────────────── */}
      {isSingle ? (
        <div className="di-single-note">
          <span className="di-single-icon">🗺️</span>
          <div>
            <div className="di-single-title">One Viable Corridor Evaluated</div>
            <div className="di-single-body">
              MARG evaluated the available corridor using terrain risk, travel distance, travel time,
              and urgency-aware accessibility scoring. Accessibility score:{' '}
              <strong>{recommendedRoute.accessibility_score} / 100</strong> · Risk:{' '}
              <strong>{recommendedRoute.landslide_risk}%</strong> · Distance:{' '}
              <strong>{recommendedRoute.distance_km} km</strong> · Transit:{' '}
              <strong>{fmtTime(recommendedRoute.estimated_time_min)}</strong>.
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ── 1. Decision Confidence (compact) ───────────── */}
          <div className="di-confidence-row">
            <span
              className="di-confidence-badge"
              style={{ color: confidence.color, borderColor: confidence.color, backgroundColor: `${confidence.color}15` }}
            >
              {confidence.level}
            </span>
            {confidence.gap != null && (
              <span className="di-confidence-gap-inline">
                Score gap <strong>+{confidence.gap.toFixed(1)} pts</strong> vs {rival?.route_id}
              </span>
            )}
          </div>

          {/* ── 2. Main Trade-Off Summary ──────────────────── */}
          {tradeSummary && (
            <div className="di-summary-box">{tradeSummary}</div>
          )}

          {/* ── 3. Why This Route Won ──────────────────────── */}
          {winReasons.length > 0 && (
            <div className="di-section">
              <div className="di-section-title">
                Why {recommendedRoute.route_id} Won
                <span className="di-vs-label"> vs. {rival?.route_id}</span>
              </div>
              <div className="di-win-reasons">
                {winReasons.map((r, i) => (
                  <div key={i} className={`di-win-item ${r.positive ? 'di-win-pos' : 'di-win-neg'}`}>
                    <span className="di-win-icon">{r.positive ? '✓' : '✗'}</span>
                    <span>{r.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 4. Compare Alternatives (collapsed by default) */}
          <div className="di-section">
            <button
              type="button"
              className="di-expand-alternatives-btn"
              onClick={() => setShowAlternatives(s => !s)}
              aria-expanded={showAlternatives}
            >
              <span>{showAlternatives ? '▲' : '▼'}</span>
              <span>{showAlternatives ? 'Hide' : 'Compare'} Alternative Corridors</span>
            </button>

            {showAlternatives && (
              <>
                <div className="di-table-note">
                  <span className="di-best-dot-inline" /> = best value for that metric
                </div>
                <ComparisonTable winner={recommendedRoute} allRoutes={allRoutes} />
                <div className="di-alts-heading">Why Not the Alternatives?</div>
                <AlternativeCards winner={recommendedRoute} allRoutes={allRoutes} />
              </>
            )}
          </div>
        </>
      )}

      {/* ── Methodology disclosure ────────────────────────── */}
      <div className="di-disclosure">
        Computed by the MARG Accessibility Scoring Engine (urgency-weighted min-max normalisation). No generative AI used in route selection.
      </div>

    </div>
  );
}
