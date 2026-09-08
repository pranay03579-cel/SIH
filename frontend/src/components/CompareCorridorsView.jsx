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
      isBest: (val, all) => {
        if (typeof val !== 'number') return false;
        const valid = all.map(r => r?.distance_km).filter(v => typeof v === 'number');
        return valid.length > 0 && val === Math.min(...valid);
      },
      isKey: true
    },
    {
      id: 'time',
      label: 'Travel Time',
      key: 'estimated_time_min',
      fmt: (val) => fmtTime(val),
      isBest: (val, all) => {
        if (typeof val !== 'number') return false;
        const valid = all.map(r => r?.estimated_time_min).filter(v => typeof v === 'number');
        return valid.length > 0 && val === Math.min(...valid);
      },
      isKey: true
    },
    {
      id: 'score',
      label: 'Accessibility Assessment',
      key: 'accessibility_score',
      fmt: (val) => (val != null ? `${val} / 100` : '—'),
      isBest: (val, all) => {
        if (typeof val !== 'number') return false;
        const valid = all.map(r => r?.accessibility_score).filter(v => typeof v === 'number');
        return valid.length > 0 && val === Math.max(...valid);
      },
      isKey: true
    },
    {
      id: 'vehicle_type',
      label: 'Vehicle Type',
      key: 'vehicle_type',
      fmt: (val, r) => r?.vehicle_type || '—',
      isBest: () => false,
      isKey: true
    },
    {
      id: 'vehicle_suitability',
      label: 'Vehicle Suitability',
      key: 'vehicle_suitability',
      fmt: (val) => (typeof val === 'number' ? `${val} / 100` : 'Data unavailable'),
      isBest: (val, all) => {
        if (typeof val !== 'number') return false;
        const valid = all.map(r => r?.vehicle_suitability).filter(v => typeof v === 'number');
        return valid.length > 0 && val === Math.max(...valid);
      },
      isKey: true
    },
    {
      id: 'vehicle_compatible',
      label: 'Vehicle Compatibility',
      key: 'vehicle_compatible',
      fmt: (val, r) => (r?.vehicle_compatible === true ? 'Suitable' : (r?.vehicle_compatible === false ? 'Limited' : 'Data unavailable')),
      isBest: (val, all, r) => r?.vehicle_compatible === true,
      isKey: true
    },
    {
      id: 'vehicle_aware_score',
      label: 'MARG Combined Score',
      key: 'vehicle_aware_score',
      fmt: (val) => (typeof val === 'number' ? `${val} / 100` : 'Data unavailable'),
      isBest: (val, all) => {
        if (typeof val !== 'number') return false;
        const valid = all.map(r => r?.vehicle_aware_score).filter(v => typeof v === 'number');
        return valid.length > 0 && val === Math.max(...valid);
      },
      isKey: true
    },
    {
      id: 'combined_hazard',
      label: 'Environmental Risk',
      key: 'combined_hazard_risk',
      fmt: (val, r) => {
        const hazardVal = val != null ? val : r?.landslide_risk;
        const lvl = (val != null ? (val >= 60 ? 'HIGH' : val >= 30 ? 'MEDIUM' : 'LOW') : (r?.landslide_risk_level || r?.risk_level || 'LOW')).toUpperCase();
        return `${hazardVal ?? '—'}% (${lvl})`;
      },
      isBest: (val, all, r) => {
        const hVal = typeof val === 'number' ? val : (typeof r?.landslide_risk === 'number' ? r.landslide_risk : null);
        if (hVal === null) return false;
        const allHazards = all.map(route => typeof route?.combined_hazard_risk === 'number' ? route.combined_hazard_risk : (typeof route?.landslide_risk === 'number' ? route.landslide_risk : null)).filter(v => v !== null);
        return allHazards.length > 0 && hVal === Math.min(...allHazards);
      },
      isKey: true
    },
    {
      id: 'landslide_risk',
      label: 'Landslide Risk',
      key: 'landslide_risk',
      fmt: (val, r) => `${val ?? '—'}% (${(r?.landslide_risk_level || r?.risk_level || 'LOW').toUpperCase()})`,
      isBest: (val, all) => {
        if (typeof val !== 'number') return false;
        const valid = all.map(r => r?.landslide_risk).filter(v => typeof v === 'number');
        return valid.length > 0 && val === Math.min(...valid);
      },
      isKey: false
    },
    {
      id: 'waterlogging_risk',
      label: 'Waterlogging Risk',
      key: 'waterlogging_risk',
      fmt: (val, r) => {
        if (val == null) return 'Data unavailable';
        const lvl = r?.waterlogging_level || (val >= 60 ? 'HIGH' : val >= 30 ? 'MEDIUM' : 'LOW');
        return `${val}% (${lvl.toUpperCase()})`;
      },
      isBest: (val, all) => {
        if (typeof val !== 'number') return false;
        const allWl = all.map(r => r?.waterlogging_risk).filter(v => typeof v === 'number');
        return allWl.length > 0 && val === Math.min(...allWl);
      },
      isKey: false
    },
    {
      id: 'dist_score',
      label: 'Distance Score Component',
      key: 'distance_score',
      fmt: (val) => (val != null ? `${val} pts` : '—'),
      isBest: (val, all) => {
        if (typeof val !== 'number') return false;
        const valid = all.map(r => r?.distance_score).filter(v => typeof v === 'number');
        return valid.length > 0 && val === Math.max(...valid);
      },
      isKey: false
    },
    {
      id: 'time_score',
      label: 'Time Score Component',
      key: 'time_score',
      fmt: (val) => (val != null ? `${val} pts` : '—'),
      isBest: (val, all) => {
        if (typeof val !== 'number') return false;
        const valid = all.map(r => r?.time_score).filter(v => typeof v === 'number');
        return valid.length > 0 && val === Math.max(...valid);
      },
      isKey: false
    },
    {
      id: 'risk_score',
      label: 'Environmental Safety Component',
      key: 'risk_score',
      fmt: (val) => (val != null ? `${val} pts` : '—'),
      isBest: (val, all) => {
        if (typeof val !== 'number') return false;
        const valid = all.map(r => r?.risk_score).filter(v => typeof v === 'number');
        return valid.length > 0 && val === Math.max(...valid);
      },
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
                      const isBest = m.isBest(val, routes, r);
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
                <span>
                  {typeof winner.vehicle_aware_score === 'number'
                    ? <>Top MARG Combined Score: <strong>{winner.vehicle_aware_score} / 100</strong></>
                    : <>Accessibility Assessment: <strong>{winner.accessibility_score} / 100</strong></>}
                </span>
              </li>
              {typeof winner.vehicle_suitability === 'number' && (
                <li>
                  <span className="verdict-bullet-icon"><IconCheck size={14} /></span>
                  <span>Vehicle Suitability for {winner.vehicle_type || 'selected vehicle'}: <strong>{winner.vehicle_suitability} / 100</strong></span>
                </li>
              )}
              <li>
                <span className="verdict-bullet-icon"><IconCheck size={14} /></span>
                <span>Environmental Risk: <strong>{winner.combined_hazard_risk != null ? `${winner.combined_hazard_risk}%` : `${winner.landslide_risk}%`}</strong></span>
              </li>
              <li>
                <span className="verdict-bullet-icon"><IconCheck size={14} /></span>
                <span>Estimated Journey: <strong>{fmtTime(winner.estimated_time_min)} ({winner.distance_km} km)</strong></span>
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
