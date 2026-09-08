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

function buildKeyReasons(winner, allRoutes) {
  const reasons = [];
  const others = allRoutes.filter(r => r.route_id !== winner.route_id);

  reasons.push(`Superior composite accessibility rating: <strong>${winner.accessibility_score} / 100</strong>`);

  if (others.length > 0) {
    const minOtherRisk = Math.min(...others.map(r => r.landslide_risk ?? Infinity));
    if ((winner.landslide_risk ?? 0) <= minOtherRisk) {
      reasons.push(`Lowest hazard vulnerability along corridor: <strong>${winner.landslide_risk}% (${winner.risk_level})</strong>`);
    }
    const minOtherTime = Math.min(...others.map(r => r.estimated_time_min ?? Infinity));
    if ((winner.estimated_time_min ?? 0) <= minOtherTime) {
      reasons.push(`Fastest estimated transit: <strong>${fmtTime(winner.estimated_time_min)}</strong>`);
    } else {
      reasons.push(`Travel time of <strong>${fmtTime(winner.estimated_time_min)}</strong> fits mission urgency`);
    }
  } else {
    reasons.push(`Safe road corridor verified for dispatch`);
  }

  return reasons;
}

export default function AIRecommendationPanel({ recommendedRoute: r, allRoutes = [], urgency = 'MEDIUM' }) {
  const [showCalc, setShowCalc] = useState(false);
  if (!r) return null;

  const reasons = buildKeyReasons(r, allRoutes);
  const hasBreakdown = r.distance_score != null && r.time_score != null && r.risk_score != null;

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
              RECOMMENDED CORRIDOR
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
              <span className="rec-stat-lbl">Terrain Risk</span>
              <span className="rec-stat-val">{r.landslide_risk ?? '—'}% ({r.risk_level})</span>
            </div>
          </div>
        </div>

        {/* Circular score badge */}
        <div className="rec-score-circle-wrapper">
          <div className="rec-score-circle">
            <span className="rec-score-number">{r.accessibility_score}</span>
            <span className="rec-score-unit">/ 100</span>
          </div>
          <span className="rec-score-caption">Accessibility Index</span>
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
                <span>Terrain Safety ({PCT(r.risk_weight)})</span>
                <span>{r.risk_score} pts</span>
              </div>
              <div className="rec-breakdown-track">
                <div className="rec-breakdown-fill" style={{ width: `${r.risk_score}%`, backgroundColor: 'var(--forest-green)' }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
