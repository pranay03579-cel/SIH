import React from 'react';
import {
  IconActivity,
  IconShieldCheck,
  IconAlertTriangle,
  IconCircleCheck,
  IconZap,
} from '../components/Icons';
import { getMonitoringChannels, STATE_METADATA, SIMULATION_STATES } from './disruptionEngine';
import { SCENARIO_1_EVENT, SCENARIO_2_EVENT } from './dataPool';

export default function LiveStatusPanel({
  missionData,
  scenario = null,
  simState = SIMULATION_STATES.READY,
  progressPct = 0,
  retreatProgressPct = 0,
  currentMilestone = null,
  activeCorridorId = 'R1',
  analysisStep = 0,
}) {
  const meta = STATE_METADATA[simState] || STATE_METADATA.READY;
  const channels = getMonitoringChannels(simState, scenario);

  const isReady = simState === SIMULATION_STATES.READY;
  const isAnalyzing = simState === SIMULATION_STATES.ANALYZING;
  const isRerouted = simState === SIMULATION_STATES.REROUTING || simState === SIMULATION_STATES.REROUTED;
  const isNoSafeRoute = simState === SIMULATION_STATES.NO_SAFE_ROUTE;
  const isReturning = simState === SIMULATION_STATES.RETURNING_TO_SAFE_POINT;
  const isSafeHolding = simState === SIMULATION_STATES.SAFE_HOLDING;
  const isComplete = simState === SIMULATION_STATES.MISSION_COMPLETE;
  const isRunning =
    simState === SIMULATION_STATES.MONITORING ||
    simState === SIMULATION_STATES.REROUTED ||
    simState === SIMULATION_STATES.RETURNING_TO_SAFE_POINT;

  const isScenario2 = scenario?.id === 'scenario_2_flooding';
  const isNominal = scenario?.type === 'NOMINAL';
  const eventConfig = scenario?.eventConfig || (isScenario2 ? SCENARIO_2_EVENT : SCENARIO_1_EVENT);

  return (
    <div className="live-status-panel-container" id="live-status-panel">
      {/* Panel Top Header */}
      <div className="live-panel-header">
        <div className="live-panel-title-group">
          <span className="live-panel-icon">
            <IconActivity size={16} />
          </span>
          <h3 className="live-panel-title">LIVE STATUS</h3>
        </div>
        <span
          className="live-state-pill"
          style={{ color: meta.color, backgroundColor: meta.bg, borderColor: meta.border }}
        >
          ● {meta.badgeText}
        </span>
      </div>

      {/* ── 1. READY STATE: COMPACT CALIBRATED SUMMARY ── */}
      {isReady ? (
        <div className="ready-state-clean-wrapper">
          <div className="ready-system-status-box">
            <div className="ready-status-row">
              <span className="ready-status-dot" />
              <span className="ready-status-title">SYSTEM READY</span>
            </div>
            <p className="ready-status-desc">
              Simulation calibrated and ready for deployment.
            </p>
          </div>

          <div className="ready-mission-box">
            <div className="ready-route-flow">
              <span className="flow-node">GUWAHATI HUB</span>
              <span className="flow-arrow">→</span>
              <span className="flow-node">SILCHAR DEPOT</span>
            </div>
            <div className="ready-vehicle-row">
              <span className="ready-v-lbl">VEHICLE</span>
              <span className="ready-v-val">{missionData?.vehicle?.type || 'TRUCK (16T)'}</span>
            </div>
          </div>

          <div className="ready-monitoring-box">
            <div className="ready-mon-header">
              <span className="ready-mon-dot" />
              <span className="ready-mon-title">4 MONITORING CHANNELS CALIBRATED</span>
            </div>
            <div className="ready-mon-channels-text">
              Terrain • Weather • Road Conditions • Vehicle Position
            </div>
          </div>
        </div>
      ) : isSafeHolding ? (
        /* ── 2. SCENARIO 2 FINAL STATE: CLEAN CONSOLIDATED SAFE HOLDING VIEW ── */
        <div className="active-state-panel-wrapper final-state-wrapper">
          {/* Priority 1: Outcome Card */}
          <div className="safe-holding-arrival-card">
            <div className="arrival-header">
              <IconShieldCheck size={16} color="#059669" />
              <span className="arrival-title">VEHICLE SECURED AT SAFE POINT</span>
            </div>
            <p className="arrival-desc">
              Transport safely stationed at Jowai Emergency Holding Depot (Km 132). Hazard exposure neutralized: <strong>0.0%</strong>
            </p>
          </div>

          {/* Priority 2: MARG Decision Card */}
          <div className="live-decision-box danger-theme">
            <div className="decision-box-header">
              <span className="decision-box-title text-danger">
                <IconAlertTriangle size={13} style={{ marginRight: 4 }} />
                NO SAFE FORWARD CORRIDOR
              </span>
              <span className="decision-danger-badge">SAFETY DIRECTIVE</span>
            </div>

            <div className="decision-recommended-action-box">
              <span className="action-lbl">DIRECTIVE:</span>
              <span className="action-val">RETURN TO SAFE POINT</span>
            </div>

            <p className="decision-box-reason">
              Primary R1 and alternative R2 evaluated as impassable due to critical flood surge. Vehicle retreated to safe staging.
            </p>
          </div>

          {/* Priority 4: Live Telemetry Channels */}
          <div className="compact-channels-section">
            <h4 className="compact-channels-heading">LIVE TELEMETRY</h4>
            <div className="compact-channels-list">
              {channels.map((ch) => (
                <div key={ch.id} className={`compact-ch-row status-${ch.statusClass}`}>
                  <div className="ch-row-left">
                    <span className={`compact-ch-dot ${ch.statusClass}`} />
                    <span className="compact-ch-name">{ch.name}</span>
                  </div>
                  <span className={`compact-ch-status tag-${ch.statusClass}`}>{ch.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : isComplete ? (
        /* ── 3. SCENARIO 1 & 3 FINAL COMPLETE STATES ── */
        <div className="active-state-panel-wrapper final-state-wrapper">
          {/* Mission Complete Outcome Card */}
          <div className="nominal-completion-card">
            <div className="completion-card-header">
              <IconShieldCheck size={16} color="#059669" />
              <span className="completion-card-title">MISSION COMPLETED SAFELY</span>
              <span className="completion-status-tag">ARRIVED</span>
            </div>
            <div className="completion-outcome-box">
              <span className="outcome-box-lbl">DESTINATION REACHED:</span>
              <span className="outcome-box-val">
                {isNominal ? 'Silchar Distribution Depot (301.8 km)' : 'Silchar Depot (318.4 km) via [R2] Haflong Bypass'}
              </span>
            </div>
            <p className="completion-reason-text">
              {isNominal
                ? 'Continuous AI monitoring verified safe transit across all corridor sectors with zero critical disruption.'
                : 'Autonomous reroute safely bypassed landslide hazard zone with zero critical hazard exposure.'}
            </p>
          </div>

          {/* Live Telemetry Channels */}
          <div className="compact-channels-section">
            <h4 className="compact-channels-heading">LIVE TELEMETRY</h4>
            <div className="compact-channels-list">
              {channels.map((ch) => (
                <div key={ch.id} className={`compact-ch-row status-${ch.statusClass}`}>
                  <div className="ch-row-left">
                    <span className={`compact-ch-dot ${ch.statusClass}`} />
                    <span className="compact-ch-name">{ch.name}</span>
                  </div>
                  <span className={`compact-ch-status tag-${ch.statusClass}`}>{ch.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── 4. ACTIVE SIMULATION / PROGRESSIVE DISCLOSURE STATES ── */
        <div className="active-state-panel-wrapper">
          {/* Progress Block */}
          <div className="live-progress-card">
            <div className="progress-header-row">
              <span className="progress-lbl">
                {isReturning ? 'SAFETY RETREAT PROGRESS' : 'MISSION PROGRESS'}
              </span>
              <span className="progress-val" style={{ color: isReturning ? '#d97706' : 'var(--forest-green)' }}>
                {isReturning ? `${retreatProgressPct}%` : `${progressPct}%`}
              </span>
            </div>
            <div className="progress-track-bar">
              <div
                className="progress-fill-bar"
                style={{
                  width: `${Math.min(100, Math.max(0, (isReturning ? retreatProgressPct : progressPct)))}%`,
                  backgroundColor: isReturning ? '#d97706' : (isRerouted ? '#0d9488' : 'var(--forest-green)'),
                }}
              />
            </div>
            <div className="progress-status-caption">
              <span className="status-caption-dot" style={{ backgroundColor: meta.color }} />
              <span className="status-caption-text">{meta.statusSummary}</span>
            </div>
          </div>

          {/* Active Mission Mini Card */}
          <div className="live-active-mission-strip">
            <div className="active-mission-node">
              <span className="node-lbl">ROUTE</span>
              <span className="node-val">
                {isReturning ? 'Guwahati ↩ Jowai Depot' : 'Guwahati → Silchar'}
              </span>
            </div>
            <div className="active-mission-node">
              <span className="node-lbl">CORRIDOR</span>
              <span
                className="node-val"
                style={{
                  color: isRerouted ? '#0d9488' : (isReturning || isNoSafeRoute ? '#dc2626' : 'var(--text-primary)'),
                  fontWeight: 700,
                }}
              >
                {isReturning
                  ? 'RETREAT TO JOWAI'
                  : (isRerouted ? '[R2] Haflong Bypass' : `[${activeCorridorId}] Primary NH-27/6`)}
              </span>
            </div>
          </div>

          {/* CONDITIONAL: Route Impact Analysis Checklist */}
          {isAnalyzing && (
            <div className="live-analysis-box">
              <div className="analysis-box-header">
                <span className="analysis-box-title">
                  <IconZap size={13} style={{ marginRight: 4 }} />
                  MARG IMPACT ANALYSIS
                </span>
                <span className="analysis-box-stepper">Autonomous Evaluation</span>
              </div>

              <div className="analysis-steps-list">
                {(eventConfig?.analysis_steps || []).map((stepText, idx) => {
                  const isDone = analysisStep > idx;
                  const isCurrent = analysisStep === idx + 1;
                  return (
                    <div
                      key={idx}
                      className={`analysis-step-item ${isDone ? 'done' : (isCurrent ? 'current' : 'pending')}`}
                    >
                      <span className="step-icon">
                        {isDone ? (
                          <IconCircleCheck size={12} className="text-forest" />
                        ) : isCurrent ? (
                          <span className="step-pulse" />
                        ) : (
                          <span className="step-dot" />
                        )}
                      </span>
                      <span className="step-text">{stepText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CONDITIONAL: Scenario 1 Automatic Reroute Decision Card */}
          {!isNominal && !isScenario2 && isRerouted && !isComplete && (
            <div className="live-decision-box">
              <div className="decision-box-header">
                <span className="decision-box-title">
                  <IconShieldCheck size={14} style={{ marginRight: 4 }} />
                  SAFE ALTERNATIVE APPROVED
                </span>
                <span className="decision-approved-badge">APPROVED</span>
              </div>

              <div className="decision-routes-row">
                <div className="decision-col-compromised">
                  <span className="decision-col-lbl">ACTIVE CORRIDOR</span>
                  <span className="decision-col-val text-teal">[R2] Haflong Bypass</span>
                </div>
                <div className="decision-arrow-col">·</div>
                <div className="decision-col-new">
                  <span className="decision-col-lbl">ACTION</span>
                  <span className="decision-col-val text-teal">AUTOMATIC REROUTE</span>
                </div>
              </div>

              <p className="decision-box-reason">
                Vehicle safely diverted via R2 Haflong Bypass. Continuing with safe hazard index (36.2%).
              </p>
            </div>
          )}

          {/* CONDITIONAL: Scenario 2 Return to Safe Point Decision Card */}
          {isScenario2 && (isNoSafeRoute || isReturning) && (
            <div className="live-decision-box danger-theme">
              <div className="decision-box-header">
                <span className="decision-box-title text-danger">
                  <IconAlertTriangle size={13} style={{ marginRight: 4 }} />
                  NO SAFE FORWARD CORRIDOR
                </span>
                <span className="decision-danger-badge">SAFETY DIRECTIVE</span>
              </div>

              <div className="decision-recommended-action-box">
                <span className="action-lbl">MARG SAFETY DIRECTIVE:</span>
                <span className="action-val">RETURN TO SAFE POINT</span>
                <span className="action-target">Destination: Jowai Emergency Holding Depot (Km 132)</span>
              </div>

              <p className="decision-box-reason">
                Primary corridor R1 and alternative R2 impassable due to deep flooding. Vehicle directed to retreat to safe staging.
              </p>
            </div>
          )}

          {/* CONDITIONAL: Scenario 3 Active Milestone Card */}
          {isNominal && isRunning && (
            <div className="nominal-milestone-card">
              <div className="milestone-card-header">
                <span className="milestone-pulse-dot" />
                <span className="milestone-header-title">
                  {currentMilestone?.title || 'CORRIDOR TELEMETRY ACTIVE · SCANNING'}
                </span>
              </div>
              <p className="milestone-desc">
                {currentMilestone?.description || 'Real-time multi-hazard telemetry streams reporting nominal conditions.'}
              </p>
            </div>
          )}

          {/* Compact Live Telemetry Channels */}
          <div className="compact-channels-section">
            <h4 className="compact-channels-heading">LIVE TELEMETRY</h4>
            <div className="compact-channels-list">
              {channels.map((ch) => (
                <div key={ch.id} className={`compact-ch-row status-${ch.statusClass}`}>
                  <div className="ch-row-left">
                    <span className={`compact-ch-dot ${ch.statusClass}`} />
                    <span className="compact-ch-name">{ch.name}</span>
                  </div>
                  <span className={`compact-ch-status tag-${ch.statusClass}`}>{ch.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
