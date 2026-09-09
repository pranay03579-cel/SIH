import React from 'react';
import {
  IconTruck,
  IconPlay,
  IconPause,
  IconRefreshCw,
  IconAlertTriangle,
  IconShieldCheck,
  IconActivity
} from './Icons';

const STATUS_LABEL = {
  idle:       { text: 'READY',   color: '#6b716d', bg: '#f1f5f9' },
  running:    { text: 'MOVING',  color: '#2e6b4d', bg: '#ebf3ea' },
  paused:     { text: 'PAUSED',  color: '#b45309', bg: '#fef3c7' },
  landslide:  { text: 'STOPPED', color: '#dc2626', bg: '#fee2e2' },
};

export default function DemoControlButton({
  hasRoutes,
  selectedRoute,
  simState,
  progressPct,
  vehiclePos,
  landslidePos,
  controls,
  onRequestReroute,
  rerouteLoading,
  rerouteError,
  hasEmergencyRoutes,
  originalDestination,
}) {
  const { start, pause, resume, reset, simulateLandslide } = controls;
  const isActive = simState !== 'idle';
  const status = STATUS_LABEL[simState] || STATUS_LABEL.idle;

  if (!hasRoutes) return null;

  return (
    <>
      {/* Simulation Floating Control & Monitoring Card */}
      {isActive && (
        <div className="sim-monitor-card" role="region" aria-label="Journey Simulation Monitor">
          {/* Card Header */}
          <div className="sim-card-header">
            <div className="sim-title-group">
              <span className="sim-icon-svg">
                <IconTruck size={16} />
              </span>
              <span className="sim-title">JOURNEY SIMULATION</span>
            </div>
            <span
              className="sim-status-pill"
              style={{ color: status.color, backgroundColor: status.bg }}
            >
              ● {status.text}
            </span>
          </div>

          {/* Active Corridor Name */}
          <div className="sim-corridor-row">
            <span className="sim-corridor-id">{selectedRoute?.route_id || 'R1'}</span>
            <span className="sim-corridor-name">{selectedRoute?.route_name || 'Active Corridor'}</span>
          </div>

          {/* Progress Bar */}
          <div className="sim-progress-box">
            <div className="sim-progress-label-row">
              <span>Simulation Progress</span>
              <span className="sim-progress-num">{progressPct}%</span>
            </div>
            <div className="sim-progress-track">
              <div className="sim-progress-bar" style={{ width: `${progressPct}%` }} />
              <div
                className="sim-progress-vehicle-marker"
                style={{ left: `calc(${progressPct}% - 6px)` }}
              >
                <div className="sim-progress-dot" />
              </div>
            </div>
          </div>

          {/* Status Note */}
          <div className={`sim-status-note ${simState === 'landslide' ? 'note-danger' : ''}`}>
            {simState === 'running'   && '● Vehicle in transit — corridor nominal'}
            {simState === 'paused'    && '⏸ Simulation paused by operator'}
            {simState === 'landslide' && 'VEHICLE STOPPED — OBSTRUCTION DETECTED AHEAD'}
          </div>

          {/* Landslide Incident Alert Card */}
          {simState === 'landslide' && (
            <div className="sim-incident-alert-box">
              <div className="sim-incident-header">
                <span className="sim-incident-icon">
                  <IconAlertTriangle size={15} />
                </span>
                <span className="sim-incident-title">INCIDENT DETECTED</span>
              </div>
              <p className="sim-incident-desc">
                A landslide has been reported ahead along corridor <strong>{selectedRoute?.route_id}</strong>.<br />
                Vehicle movement has been stopped safely.
              </p>

              {vehiclePos && (
                <div className="sim-incident-pos">
                  GPS Origin: <code>{vehiclePos[0]?.toFixed(4)}, {vehiclePos[1]?.toFixed(4)}</code>
                </div>
              )}

              {/* Generate Emergency Routes CTA */}
              {!hasEmergencyRoutes && (
                <div className="sim-reroute-action">
                  {rerouteError && (
                    <div className="sim-reroute-error-msg">
                      {rerouteError}
                    </div>
                  )}
                  <button
                    type="button"
                    className={`sim-reroute-btn ${rerouteLoading ? 'loading' : ''}`}
                    onClick={onRequestReroute}
                    disabled={rerouteLoading || !vehiclePos || !landslidePos}
                    id="emergency-reroute-btn"
                  >
                    {rerouteLoading ? (
                      <>
                        <span className="sim-spinner" />
                        <span>RECALCULATING CORRIDORS...</span>
                      </>
                    ) : (
                      <>
                        <IconAlertTriangle size={16} />
                        <span>Generate Emergency Routes</span>
                      </>
                    )}
                  </button>
                  {rerouteLoading && (
                    <div className="sim-reroute-subtext">
                      Analyzing safe diversion corridors avoiding incident zone...
                    </div>
                  )}
                </div>
              )}

              {hasEmergencyRoutes && (
                <div className="sim-reroute-success-note">
                  <IconShieldCheck size={14} />
                  <span>Safe alternative corridors generated &amp; scored</span>
                </div>
              )}
            </div>
          )}

          {/* Control Buttons Row */}
          <div className="sim-controls-row">
            {simState === 'running' && (
              <button type="button" className="sim-btn sim-btn-amber" onClick={pause}>
                <IconPause size={13} />
                <span>Pause</span>
              </button>
            )}
            {simState === 'paused' && (
              <button type="button" className="sim-btn sim-btn-green" onClick={resume}>
                <IconPlay size={13} />
                <span>Resume</span>
              </button>
            )}
            {simState !== 'landslide' && (
              <button
                type="button"
                className="sim-btn sim-btn-danger"
                onClick={simulateLandslide}
                disabled={simState !== 'running' && simState !== 'paused'}
                title="Simulate landslide obstruction ahead of vehicle"
              >
                <IconAlertTriangle size={13} />
                <span>Trigger Incident</span>
              </button>
            )}
            <button type="button" className="sim-btn sim-btn-neutral" onClick={reset}>
              <IconRefreshCw size={13} />
              <span>Reset</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Demo Trigger Button (Bottom-Right) */}
      <button
        type="button"
        className={`floating-demo-fab ${isActive ? 'active' : ''}`}
        onClick={() => {
          window.open('/live-demo', '_blank');
        }}
        id="demo-simulation-fab"
        title="Open MARG LIVE Disruption Simulation in new tab"
      >
        <span className="fab-icon-svg">
          <IconTruck size={22} />
        </span>
        <span className="fab-label">Start Journey Simulation</span>
      </button>
    </>
  );
}

