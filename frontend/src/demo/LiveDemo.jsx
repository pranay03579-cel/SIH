import React, { useState } from 'react';
import {
  IconTree,
  IconActivity,
  IconTruck,
  IconShieldCheck,
  IconAlertTriangle,
  IconArrowLeft
} from '../components/Icons';
import LiveDemoMap from './LiveDemoMap';
import LiveStatusPanel from './LiveStatusPanel';
import DisruptionAlertPanel from './DisruptionAlertPanel';
import DemoScenarioSelector from './DemoScenarioSelector';
import {
  DEMO_SCENARIOS,
  INITIAL_MISSION_DATA,
  PRIMARY_CORRIDOR_WAYPOINTS,
  FULL_R2_WAYPOINTS,
  ALTERNATIVE_DIVERSION_BRANCH,
  SAFE_HOLDING_POINT,
} from './dataPool';
import { STATE_METADATA, SIMULATION_STATES } from './disruptionEngine';
import { useLiveSimulationEngine } from './vehicleSimulator';

export default function LiveDemo() {
  const [selectedScenario, setSelectedScenario] = useState(DEMO_SCENARIOS[0]);
  const [missionData, setMissionData] = useState(INITIAL_MISSION_DATA);

  // Live simulation engine hook
  const {
    simState,
    progressPct,
    retreatProgressPct,
    currentMilestone,
    vehiclePos,
    activeCorridorId,
    activeWaypoints,
    incidentActive,
    analysisStep,
    isPaused,
    controls,
  } = useLiveSimulationEngine(selectedScenario);

  const handleSelectScenario = (sc) => {
    setSelectedScenario(sc);
    controls.reset();
  };

  const meta = STATE_METADATA[simState] || STATE_METADATA.READY;
  const isIncidentVisible =
    incidentActive ||
    simState === SIMULATION_STATES.DISRUPTION_DETECTED ||
    simState === SIMULATION_STATES.ANALYZING ||
    simState === SIMULATION_STATES.REROUTING ||
    simState === SIMULATION_STATES.REROUTED ||
    simState === SIMULATION_STATES.NO_SAFE_ROUTE ||
    simState === SIMULATION_STATES.RETURNING_TO_SAFE_POINT ||
    simState === SIMULATION_STATES.SAFE_HOLDING;

  const isReturningOrHolding =
    simState === SIMULATION_STATES.RETURNING_TO_SAFE_POINT ||
    simState === SIMULATION_STATES.SAFE_HOLDING;

  return (
    <div className="live-demo-page-wrapper" id="marg-live-demo-app">
      {/* ── TOP HEADER ── */}
      <header className="live-demo-top-header">
        <div className="live-header-left">
          <div className="live-logo-group">
            <span className="live-logo-icon">
              <IconTree size={20} />
            </span>
            <span className="live-logo-text">MARG</span>
            <span className="live-logo-live-pill">LIVE</span>
          </div>
          <div className="live-header-divider" />
          <div className="live-title-block">
            <h1 className="live-main-title">REAL-TIME ROUTE DISRUPTION INTELLIGENCE</h1>
            <span className="live-sub-title">Autonomous Multi-Hazard Telemetry &amp; Rerouting Command Center</span>
          </div>
        </div>

        <div className="live-header-right">
          {/* Transparency Disclaimer Pill */}
          <div className="transparency-disclaimer-pill">
            <span className="disclaimer-dot" />
            <span className="disclaimer-text">
              PROTOTYPE SIMULATION — Future Real-Time Data Integration
            </span>
          </div>

          <button
            type="button"
            className="live-back-to-main-btn"
            onClick={() => {
              if (window.opener) {
                window.close();
              } else {
                window.location.href = '/';
              }
            }}
            title="Return to Main MARG Route Planner"
          >
            <IconArrowLeft size={14} />
            <span>Main Application</span>
          </button>
        </div>
      </header>

      {/* ── DEMO SCENARIOS SELECTION ROW (FULL WIDTH) ── */}
      <section className="live-scenarios-top-section">
        <DemoScenarioSelector
          scenarios={DEMO_SCENARIOS}
          selectedScenarioId={selectedScenario.id}
          onSelectScenario={handleSelectScenario}
          simState={simState}
          isPaused={isPaused}
          onStartSimulation={controls.start}
          onPauseSimulation={controls.pause}
          onResumeSimulation={controls.resume}
          onResetSimulation={controls.reset}
        />
      </section>

      {/* ── MAIN COMMAND CENTER TWO-COLUMN LAYOUT ── */}
      <main className="live-command-layout">
        {/* Left / Main Simulation & Map Column */}
        <div className="live-main-sim-column">
          {/* Active Disruption Banner */}
          <DisruptionAlertPanel
            simState={simState}
            scenario={selectedScenario}
            activeCorridorId={activeCorridorId}
          />

          {/* Large Live Interactive Map */}
          <div className="live-map-wrapper">
            <LiveDemoMap
              primaryWaypoints={PRIMARY_CORRIDOR_WAYPOINTS}
              alternativeWaypoints={ALTERNATIVE_DIVERSION_BRANCH}
              safeHoldingPoint={SAFE_HOLDING_POINT}
              vehiclePos={vehiclePos}
              incidentCoords={isIncidentVisible ? selectedScenario.incidentCoords : null}
              incidentType={selectedScenario.type}
              incidentName={selectedScenario.incidentName}
              simState={simState}
              activeCorridorId={activeCorridorId}
              scenario={selectedScenario}
            />
          </div>
        </div>

        {/* Right Live Monitoring & Status Panel */}
        <aside className="live-sidebar-column">
          <LiveStatusPanel
            missionData={missionData}
            scenario={selectedScenario}
            simState={simState}
            progressPct={progressPct}
            retreatProgressPct={retreatProgressPct}
            currentMilestone={currentMilestone}
            activeCorridorId={activeCorridorId}
            analysisStep={analysisStep}
            isPaused={isPaused}
            onPauseSimulation={controls.pause}
            onResumeSimulation={controls.resume}
            onResetSimulation={controls.reset}
          />
        </aside>
      </main>
    </div>
  );
}

