import React from 'react';
import { IconActivity } from './Icons';

export default function Header({ backendConnected = false }) {
  return (
    <header className="marg-header">
      <div className="marg-header-brand">
        <div className="marg-logo">
          <span>MARG</span>
          <span className="marg-logo-tag">SIH 2024</span>
        </div>
        <div className="marg-tagline">
          Smart Route Accessibility &amp; Logistics Intelligence
        </div>
      </div>

      <div className="marg-system-status" title={backendConnected ? "Backend Connected" : "Backend Standby - Ready to connect"}>
        <span 
          className="status-dot" 
          style={{ 
            backgroundColor: backendConnected ? '#10b981' : '#38bdf8',
            boxShadow: backendConnected ? '0 0 8px #10b981' : '0 0 8px #38bdf8' 
          }}
        />
        <span>{backendConnected ? "SYSTEM ONLINE" : "STANDBY (READY)"}</span>
      </div>
    </header>
  );
}
