import React from 'react';
import { IconAlertTriangle, IconShieldCheck, IconActivity, IconCheck, IconZap } from '../components/Icons';
import { STATE_METADATA, SIMULATION_STATES } from './disruptionEngine';

export default function DisruptionAlertPanel({
  simState = SIMULATION_STATES.READY,
  scenario = null,
  activeCorridorId = 'R1',
}) {
  const isIncident =
    simState === SIMULATION_STATES.DISRUPTION_DETECTED ||
    simState === SIMULATION_STATES.ANALYZING;

  const isRerouted =
    simState === SIMULATION_STATES.REROUTING ||
    simState === SIMULATION_STATES.REROUTED;

  const isNoSafeRoute = simState === SIMULATION_STATES.NO_SAFE_ROUTE;
  const isReturning = simState === SIMULATION_STATES.RETURNING_TO_SAFE_POINT;
  const isSafeHolding = simState === SIMULATION_STATES.SAFE_HOLDING;
  const isComplete = simState === SIMULATION_STATES.MISSION_COMPLETE;
  const isScenario2 = scenario?.id === 'scenario_2_flooding';
  const isNominal = scenario?.type === 'NOMINAL';

  const meta = STATE_METADATA[simState] || STATE_METADATA.READY;

  // Custom alert description text
  let alertDescription = meta.description;
  if (isNominal) {
    if (isComplete) {
      alertDescription = 'Vehicle arrived safely at Silchar Distribution Depot. Zero hazard disruptions encountered throughout the 301.8 km logistics corridor.';
    } else if (simState === SIMULATION_STATES.MONITORING) {
      alertDescription = 'Continuous multi-hazard telemetry scanning active on NH-27 / NH-6. Slope stability and meteorological feeds within safe operating thresholds.';
    }
  } else if (isIncident) {
    alertDescription = isScenario2
      ? 'Critical flash flooding detected ahead in Sonapur Valley (Km 185). Water level exceeds safe operating limit. Immediate route analysis initiated.'
      : 'Terrain disruption detected ahead of vehicle at Lad Rymbai (Km 142). Immediate route analysis initiated.';
  } else if (isNoSafeRoute || isReturning) {
    alertDescription = 'MARG Autonomous Decision Engine confirmed ZERO safe forward corridors. Vehicle instructed to retreat to Jowai Emergency Staging Depot.';
  } else if (isSafeHolding) {
    alertDescription = 'Vehicle staged safely at Jowai Emergency Holding Depot. Hazard exposure neutralized. Mission safely paused.';
  }

  return (
    <div
      className={`live-disruption-banner ${isIncident || isNoSafeRoute ? 'has-incident' : (isRerouted || isSafeHolding || (isNominal && isComplete) ? 'rerouted' : (isComplete ? 'complete' : 'nominal'))}`}
      style={{
        backgroundColor: meta.bg,
        borderColor: meta.border,
      }}
    >
      <div className="disruption-banner-left">
        <div
          className="disruption-status-icon-wrap"
          style={{
            color: meta.color,
            backgroundColor: '#FFFFFF',
            boxShadow: isIncident || isNoSafeRoute ? '0 0 10px rgba(220,38,38,0.25)' : '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {isIncident || isNoSafeRoute ? (
            <IconAlertTriangle size={18} />
          ) : (isRerouted || isSafeHolding || isComplete ? (
            <IconCheck size={18} />
          ) : (
            <IconShieldCheck size={18} />
          ))}
        </div>

        <div className="disruption-banner-text-group">
          <div className="disruption-banner-headline-row">
            <span className="disruption-badge" style={{ color: meta.color }}>
              ● {meta.badgeText}
            </span>
            {isNominal && !isComplete && (
              <span className="disruption-tag-success">
                CORRIDOR [R1] NOMINAL · NO DISRUPTIONS DETECTED
              </span>
            )}
            {isNominal && isComplete && (
              <span className="disruption-tag-success">
                DESTINATION REACHED · SILCHAR DEPOT
              </span>
            )}
            {isIncident && (
              <span className="disruption-tag-danger">
                TYPE: {scenario?.type || 'LANDSLIDE'} · SEVERITY: {scenario?.hazardLevel || 'HIGH'}
              </span>
            )}
            {!isNominal && isRerouted && (
              <span className="disruption-tag-success">
                CORRIDOR [R2] ACTIVE · SAFE BYPASS
              </span>
            )}
            {isNoSafeRoute && (
              <span className="disruption-tag-danger">
                ALL CORRIDORS UNSAFE · SAFETY RETREAT
              </span>
            )}
            {isReturning && (
              <span className="disruption-tag-warning">
                TACTICAL RETREAT IN PROGRESS · JOWAI DEPOT
              </span>
            )}
            {isSafeHolding && (
              <span className="disruption-tag-success">
                VEHICLE SECURED · ZERO HAZARD EXPOSURE
              </span>
            )}
          </div>

          <p className="disruption-banner-desc">{alertDescription}</p>
        </div>
      </div>

      <div className="disruption-banner-right">
        <div className="disruption-stat-item">
          <span className="stat-item-lbl">Active Corridor</span>
          <span
            className="stat-item-val"
            style={{
              color: isSafeHolding || (isNominal && isComplete)
                ? '#059669'
                : (isRerouted ? '#0d9488' : (isNoSafeRoute || isReturning ? '#dc2626' : 'var(--text-primary)')),
            }}
          >
            {isSafeHolding
              ? 'SAFE HOLDING DEPOT'
              : (isReturning
                ? 'RETREAT TO JOWAI'
                : (isRerouted ? '[R2] Haflong Bypass' : '[R1] NH-27 / NH-6'))}
          </span>
        </div>
        <div className="disruption-stat-item">
          <span className="stat-item-lbl">Hazard Exposure</span>
          <span className="stat-item-val" style={{ color: meta.color }}>
            {isSafeHolding || (isNominal && isComplete)
              ? 'SAFE (0.0%)'
              : (isIncident || isNoSafeRoute
                ? (isScenario2 ? 'CRITICAL (96.4%)' : 'CRITICAL (92.0%)')
                : (isReturning
                  ? 'ELEVATED (62.0%)'
                  : (isNominal ? 'LOW (12.4%)' : (isRerouted ? 'LOW (36.2%)' : 'MODERATE (45.8%)'))))}
          </span>
        </div>
      </div>
    </div>
  );
}
