import React from 'react';

export default function Header({ backendConnected = false }) {
  return (
    <header className="marg-header">
      <div className="marg-header-brand">
        <div className="marg-logo">
          <span className="marg-logo-wordmark">MARG</span>
          <span className="marg-logo-tag">SIH 2024</span>
        </div>
        <div className="marg-header-separator" />
        <div className="marg-tagline">
          Emergency Corridor Assessment &amp; Logistics Intelligence
        </div>
      </div>

      <div
        className="marg-system-status"
        title={backendConnected ? 'Backend connected' : 'Backend standby'}
      >
        <span
          className="status-dot"
          style={{ backgroundColor: backendConnected ? '#22c55e' : '#64748b' }}
        />
        <span>{backendConnected ? 'SYSTEM ONLINE' : 'STANDBY'}</span>
      </div>
    </header>
  );
}
