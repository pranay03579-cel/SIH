import React from 'react';
import {
  IconAlertTriangle,
  IconShieldCheck,
  IconPlay,
  IconPause,
  IconRefreshCw,
} from '../components/Icons';

export default function DemoScenarioSelector({
  scenarios = [],
  selectedScenarioId = '',
  onSelectScenario,
  simState = 'READY',
  isPaused = false,
  onStartSimulation,
  onPauseSimulation,
  onResumeSimulation,
  onResetSimulation,
}) {
  const isReady = simState === 'READY';
  const isRunning =
    simState === 'MONITORING' ||
    simState === 'REROUTED' ||
    simState === 'RETURNING_TO_SAFE_POINT';
  const isCompleteOrHolding =
    simState === 'MISSION_COMPLETE' ||
    simState === 'SAFE_HOLDING';

  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];

  const getScenarioData = (sc) => {
    switch (sc.type) {
      case 'LANDSLIDE':
        return {
          icon: <IconAlertTriangle size={14} />,
          badgeClass: 'type-landslide',
          title: 'LANDSLIDE',
          condition: 'Safe alternative available',
          outcome: '→ Automatic Reroute',
        };
      case 'FLOODING':
        return {
          icon: <IconAlertTriangle size={14} />,
          badgeClass: 'type-flooding',
          title: 'CRITICAL FLOODING',
          condition: 'No safe alternative',
          outcome: '→ Return to Safe Point',
        };
      case 'NOMINAL':
      default:
        return {
          icon: <IconShieldCheck size={14} />,
          badgeClass: 'type-nominal',
          title: 'NORMAL JOURNEY',
          condition: 'No disruption',
          outcome: '→ Mission Complete',
        };
    }
  };

  return (
    <div className="demo-scenarios-panel" id="demo-scenario-selector">
      <div className="scenarios-panel-top">
        <span className="scenarios-panel-heading">DEMO SCENARIOS</span>
        <span className="scenarios-panel-subheading">
          Select a disruption condition to preview MARG autonomous response
        </span>
      </div>

      <div className="scenarios-compact-grid">
        {scenarios.map((sc) => {
          const isSelected = sc.id === selectedScenarioId;
          const data = getScenarioData(sc);
          return (
            <div
              key={sc.id}
              className={`scenario-compact-card ${isSelected ? 'active-selected' : ''}`}
              onClick={() => onSelectScenario && onSelectScenario(sc)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelectScenario && onSelectScenario(sc)}
            >
              <div className="card-header-line">
                <span className={`scenario-badge-pill ${data.badgeClass}`}>
                  {data.icon}
                  <span>{data.title}</span>
                </span>
                {isSelected && <span className="selection-dot-indicator">SELECTED</span>}
              </div>

              <div className="card-body-line">
                <span className="scenario-condition-text">{data.condition}</span>
                <span className="scenario-outcome-text">{data.outcome}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── SINGLE PRIMARY ACTION STRIP ── */}
      <div className="scenario-primary-action-bar">
        {isReady && (
          <div className="action-bar-ready-layout">
            <div className="selected-scenario-summary">
              <span className="summary-lbl">Selected Scenario:</span>
              <span className="summary-val">{selectedScenario?.title || 'Landslide Disruption'}</span>
              <span className="summary-hint">
                — MARG will monitor routes continuously and autonomously respond.
              </span>
            </div>

            <button
              type="button"
              className="primary-start-sim-btn"
              onClick={onStartSimulation}
              id="primary-start-live-sim-btn"
            >
              <IconPlay size={16} />
              <span>START LIVE SIMULATION</span>
            </button>
          </div>
        )}

        {(isRunning || simState === 'DISRUPTION_DETECTED' || simState === 'ANALYZING' || simState === 'REROUTING' || simState === 'NO_SAFE_ROUTE') && (
          <div className="action-bar-active-layout">
            <div className="active-status-tag">
              <span className="pulse-indicator-dot" />
              <span className="active-status-text">
                SIMULATION IN PROGRESS · <strong>{simState}</strong>
              </span>
            </div>

            <div className="active-controls-group">
              {isRunning && (
                <>
                  {isPaused ? (
                    <button
                      type="button"
                      className="sim-ctl-btn btn-amber"
                      onClick={onResumeSimulation}
                    >
                      <IconPlay size={13} />
                      <span>Resume Transit</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="sim-ctl-btn btn-amber"
                      onClick={onPauseSimulation}
                    >
                      <IconPause size={13} />
                      <span>Pause</span>
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                className="sim-ctl-btn btn-neutral"
                onClick={onResetSimulation}
                id="reset-sim-active-btn"
              >
                <IconRefreshCw size={12} />
                <span>Reset Simulation</span>
              </button>
            </div>
          </div>
        )}

        {isCompleteOrHolding && (
          <div className="action-bar-complete-layout">
            <div className="complete-status-tag">
              <span className="success-indicator-dot" />
              <span className="complete-status-text">
                SIMULATION CONCLUDED · <strong>{simState}</strong>
              </span>
            </div>

            <button
              type="button"
              className="sim-ctl-btn btn-neutral"
              onClick={onResetSimulation}
              id="reset-sim-complete-btn"
            >
              <IconRefreshCw size={12} />
              <span>Reset Simulation</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

