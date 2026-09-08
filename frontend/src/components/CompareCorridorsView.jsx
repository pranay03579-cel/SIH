import React, { useState } from 'react';
import { IconCheck, IconShield, IconScale } from './Icons';

function fmtTime(mins) {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function CompareCorridorsView({
  routes = [],
  recommendedId = null,
  selectedRoute = null,
  onSelectRoute,
  onViewDetails
}) {
  const [keyMetricsOnly, setKeyMetricsOnly] = useState(false);

  if (!routes || routes.length === 0) {
    return (
      <div className="empty-intel-card">
        <div className="empty-intel-icon">
          <IconScale size={36} color="var(--text-tertiary)" />
        </div>
        <h3>No Corridors to Compare</h3>
        <p>Please enter an origin and destination in the Route Planner to generate and compare transport corridors.</p>
      </div>
    );
  }

  const winner = routes.find(r => r.route_id === recommendedId) || routes[0];

  const allMetrics = [
    {
      id: 'distance',
      label: 'Distance',
      key: 'distance_km',
      fmt: (val) => (val != null ? `${val} km` : '—'),
      isBest: (val, all) => val === Math.min(...all.map(r => r.distance_km ?? Infinity)),
      isKey: true
    },
    {
      id: 'time',
      label: 'Travel Time',
      key: 'estimated_time_min',
      fmt: (val) => fmtTime(val),
      isBest: (val, all) => val === Math.min(...all.map(r => r.estimated_time_min ?? Infinity)),
      isKey: true
    },
    {
      id: 'risk',
      label: 'Landslide Risk',
      key: 'landslide_risk',
      fmt: (val, r) => `${val ?? '—'}% (${(r.risk_level || 'LOW').toUpperCase()})`,
      isBest: (val, all) => val === Math.min(...all.map(r => r.landslide_risk ?? Infinity)),
      isKey: true
    },
    {
      id: 'score',
      label: 'Accessibility Score',
      key: 'accessibility_score',
      fmt: (val) => `${val ?? '—'} / 100`,
      isBest: (val, all) => val === Math.max(...all.map(r => r.accessibility_score ?? -Infinity)),
      isKey: true
    },
    {
      id: 'dist_score',
      label: 'Distance Score Component',
      key: 'distance_score',
      fmt: (val) => (val != null ? `${val} pts` : '—'),
      isBest: (val, all) => val === Math.max(...all.map(r => r.distance_score ?? -Infinity)),
      isKey: false
    },
    {
      id: 'time_score',
      label: 'Time Score Component',
      key: 'time_score',
      fmt: (val) => (val != null ? `${val} pts` : '—'),
      isBest: (val, all) => val === Math.max(...all.map(r => r.time_score ?? -Infinity)),
      isKey: false
    },
    {
      id: 'risk_score',
      label: 'Safety Score Component',
      key: 'risk_score',
      fmt: (val) => (val != null ? `${val} pts` : '—'),
      isBest: (val, all) => val === Math.max(...all.map(r => r.risk_score ?? -Infinity)),
      isKey: false
    },
  ];

  const displayedMetrics = keyMetricsOnly ? allMetrics.filter(m => m.isKey) : allMetrics;

  return (
    <div className="compare-corridors-container">
      {/* Header */}
      <div className="section-header-row">
        <div>
          <div className="section-stepper-label">08 COMPARE CORRIDORS</div>
          <h2 className="section-heading-title">Corridor Trade-Off Matrix</h2>
          <p className="section-heading-sub">
            Side-by-side comparative analysis of transit efficiency versus hazard vulnerability.
          </p>
        </div>

        {/* Toggle */}
        <div className="compare-toggle-row">
          <label className="compare-toggle-label">
            <input
              type="checkbox"
              checked={keyMetricsOnly}
              onChange={(e) => setKeyMetricsOnly(e.target.checked)}
            />
            <span>Show key metrics only</span>
          </label>
        </div>
      </div>

      {routes.length === 1 && (
        <div className="single-corridor-notice">
          <span>Only 1 viable transport corridor was evaluated for this route. Matrix displays active baseline parameters.</span>
        </div>
      )}

      <div className="compare-content-layout">
        {/* Comparison Table */}
        <div className="compare-table-card">
          <div className="compare-table-scroll">
            <table className="compare-matrix-table">
              <thead>
                <tr>
                  <th className="compare-th-metric">Metric</th>
                  {routes.map((r, idx) => {
                    const isRec = r.route_id === recommendedId;
                    const isSel = selectedRoute?.route_id === r.route_id;
                    return (
                      <th
                        key={r.route_id}
                        className={`compare-th-route ${isRec ? 'is-recommended-col' : ''} ${isSel ? 'is-selected-col' : ''}`}
                        onClick={() => onSelectRoute && onSelectRoute(r)}
                      >
                        <div className="compare-col-header">
                          <div className="compare-col-id-row">
                            <span className="compare-col-id">{r.route_id}</span>
                            {isRec && (
                              <span className="compare-col-rec-star">
                                <IconCheck size={11} style={{ marginRight: 2 }} />
                                Recommended
                              </span>
                            )}
                          </div>
                          <div className="compare-col-name">{r.route_name || `Corridor ${idx + 1}`}</div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {displayedMetrics.map((m) => (
                  <tr key={m.id} className="compare-tr">
                    <td className="compare-td-label">{m.label}</td>
                    {routes.map((r) => {
                      const val = r[m.key];
                      const isBest = m.isBest(val, routes);
                      const isRec = r.route_id === recommendedId;
                      return (
                        <td
                          key={r.route_id}
                          className={`compare-td-val ${isRec ? 'is-recommended-col' : ''} ${isBest ? 'is-best-val' : ''}`}
                        >
                          <div className="compare-val-cell">
                            {isBest && <span className="compare-best-dot" title="Best across corridors" />}
                            <span>{m.fmt(val, r)}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Verdict Summary Card */}
        {winner && (
          <div className="compare-verdict-card">
            <div className="compare-verdict-header">
              <div className="compare-verdict-icon">
                <IconShield size={24} />
              </div>
              <h3 className="compare-verdict-title">
                {winner.route_id} provides the optimal balance of safety and transit efficiency.
              </h3>
            </div>

            <ul className="compare-verdict-bullets">
              <li>
                <span className="verdict-bullet-icon"><IconCheck size={14} /></span>
                <span>Highest accessibility index: <strong>{winner.accessibility_score} / 100</strong></span>
              </li>
              <li>
                <span className="verdict-bullet-icon"><IconCheck size={14} /></span>
                <span>Terrain risk profile: <strong>{winner.landslide_risk}% ({winner.risk_level})</strong></span>
              </li>
              <li>
                <span className="verdict-bullet-icon"><IconCheck size={14} /></span>
                <span>Estimated journey: <strong>{fmtTime(winner.estimated_time_min)} ({winner.distance_km} km)</strong></span>
              </li>
            </ul>

            <button
              type="button"
              className="compare-details-cta-btn"
              onClick={() => onViewDetails && onViewDetails(winner)}
            >
              <span>View Route Details</span>
              <span>→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
