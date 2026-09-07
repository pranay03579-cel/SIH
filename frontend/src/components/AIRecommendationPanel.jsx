import React, { useState } from 'react';

// ── Urgency label helpers ─────────────────────────────────────────────────
const URGENCY_META = {
  LOW:      { label: 'Low Urgency',      color: 'var(--risk-low)',      bgColor: 'var(--risk-low-bg)',      borderColor: 'var(--risk-low-border)' },
  MEDIUM:   { label: 'Medium Urgency',   color: 'var(--risk-medium)',   bgColor: 'var(--risk-medium-bg)',   borderColor: 'var(--risk-medium-border)' },
  HIGH:     { label: 'High Urgency',     color: 'var(--risk-high)',     bgColor: 'var(--risk-high-bg)',     borderColor: 'var(--risk-high-border)' },
  CRITICAL: { label: 'Critical Urgency', color: 'var(--risk-critical)', bgColor: 'var(--risk-critical-bg)', borderColor: 'var(--risk-critical-border)' },
};

const PCT = (w) => (w != null ? `${Math.round(w * 100)}%` : '—');

function fmtTime(mins) {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Top 3 selection rationale bullets ────────────────────────────────────
function buildTopReasons(winner, allRoutes) {
  const bullets = [];
  const others = allRoutes.filter(r => r.route_id !== winner.route_id);

  bullets.push({
    text: `Highest accessibility score: <strong>${winner.accessibility_score} / 100</strong>`,
    type: 'score',
  });

  if (others.length > 0) {
    const minOtherRisk = Math.min(...others.map(r => r.landslide_risk ?? Infinity));
    if ((winner.landslide_risk ?? 0) <= minOtherRisk) {
      bullets.push({
        text: `Lowest terrain exposure: <strong>${winner.landslide_risk}%</strong>`,
        type: 'risk',
      });
    }
    const minOtherTime = Math.min(...others.map(r => r.estimated_time_min ?? Infinity));
    if ((winner.estimated_time_min ?? 0) <= minOtherTime) {
      bullets.push({ text: `Fastest transit: <strong>${fmtTime(winner.estimated_time_min)}</strong>`, type: 'time' });
    } else {
      const minOtherDist = Math.min(...others.map(r => r.distance_km ?? Infinity));
      if ((winner.distance_km ?? Infinity) <= minOtherDist) {
        bullets.push({ text: `Shortest corridor: <strong>${winner.distance_km} km</strong>`, type: 'distance' });
      }
    }
  }

  return bullets.slice(0, 3);
}

// ── Score bar ─────────────────────────────────────────────────────────────
function ScoreBar({ label, score, weight, color }) {
  const pct = Math.min(100, Math.max(0, score ?? 0));
  return (
    <div className="ai-panel-score-row">
      <div className="ai-panel-score-meta">
        <span className="ai-panel-score-label">{label}</span>
        <span className="ai-panel-score-nums" style={{ color }}>
          {score ?? '—'}<span className="ai-panel-score-weight"> × {PCT(weight)}</span>
        </span>
      </div>
      <div className="ai-panel-bar-bg">
        <div className="ai-panel-bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────
export default function AIRecommendationPanel({ recommendedRoute: r, allRoutes, urgency = 'MEDIUM' }) {
  const [showCalc, setShowCalc] = useState(false);
  if (!r) return null;

  const uMeta = URGENCY_META[urgency] || URGENCY_META.MEDIUM;
  const bullets = buildTopReasons(r, allRoutes);
  const hasBreakdown = r.distance_score != null && r.time_score != null && r.risk_score != null;

  return (
    <div className="ai-rec-panel" id="ai-recommendation-panel">

      {/* Header */}
      <div className="ai-rec-panel-header">
        <div className="ai-rec-panel-title">
          SYSTEM RECOMMENDATION — {r.route_id}
        </div>
        <span
          className="ai-rec-urgency-badge"
          style={{
            color: uMeta.color,
            borderColor: uMeta.borderColor,
            backgroundColor: uMeta.bgColor,
          }}
        >
          {uMeta.label}
        </span>
      </div>

      {/* Route name */}
      <div className="ai-rec-route-name-row">{r.route_name}</div>

      {/* Hero metrics — 4 key operational values */}
      <div className="ai-rec-hero-metrics">
        <div className="ai-rec-hero-item">
          <span className="ai-rec-hero-value" style={{ color: 'var(--green-text)' }}>{r.accessibility_score}</span>
          <span className="ai-rec-hero-label">Score / 100</span>
        </div>
        <div className="ai-rec-hero-item">
          <span className="ai-rec-hero-value">{r.distance_km ?? '—'}</span>
          <span className="ai-rec-hero-label">Distance km</span>
        </div>
        <div className="ai-rec-hero-item">
          <span className="ai-rec-hero-value">{fmtTime(r.estimated_time_min)}</span>
          <span className="ai-rec-hero-label">Transit Time</span>
        </div>
        <div className="ai-rec-hero-item">
          <span
            className="ai-rec-hero-value"
            style={{
              color: (r.risk_level || '').toUpperCase() === 'LOW' ? 'var(--risk-low)'
                : (r.risk_level || '').toUpperCase() === 'MEDIUM' ? 'var(--risk-medium)'
                : (r.risk_level || '').toUpperCase() === 'HIGH' ? 'var(--risk-high)'
                : 'var(--risk-critical)',
              fontSize: '0.9rem',
            }}
          >
            {(r.risk_level || 'LOW').toUpperCase()}
          </span>
          <span className="ai-rec-hero-label">Terrain Risk</span>
        </div>
      </div>

      {/* Selection rationale */}
      {bullets.length > 0 && (
        <ul className="ai-rec-rationale-list">
          {bullets.map((b, i) => (
            <li key={i} className={`ai-rec-rationale-item ai-rec-item-${b.type}`}>
              <span className="ai-rec-item-icon">—</span>
              <span dangerouslySetInnerHTML={{ __html: b.text }} />
            </li>
          ))}
        </ul>
      )}

      {/* Expandable: scoring methodology */}
      {hasBreakdown && (
        <button type="button" className="ai-rec-expand-btn" onClick={() => setShowCalc(c => !c)}>
          {showCalc ? '▲ Hide scoring detail' : '▼ View scoring breakdown'}
        </button>
      )}

      {hasBreakdown && showCalc && (
        <div className="ai-rec-breakdown">
          <div className="ai-rec-breakdown-title">Weighted Score Components</div>
          <ScoreBar label="Distance"     score={r.distance_score} weight={r.distance_weight} color="var(--blue-light)" />
          <ScoreBar label="Transit Time" score={r.time_score}    weight={r.time_weight}     color="var(--risk-medium)" />
          <ScoreBar label="Terrain Risk" score={r.risk_score}    weight={r.risk_weight}     color="var(--risk-low)" />
        </div>
      )}

      {/* Methodology disclosure */}
      <div className="ai-rec-disclosure">
        Selected by MARG Accessibility Scoring Engine using urgency-weighted min-max normalisation across terrain, distance, and transit metrics.
      </div>
    </div>
  );
}
