import React from 'react';
import { IconTree, IconMapPin, IconUser } from './Icons';

export default function Header({ backendConnected = false }) {
  return (
    <header className="marg-top-header">
      <div className="header-left">
        <div className="header-logo-group">
          <span className="header-logo-icon">
            <IconTree size={18} />
          </span>
          <span className="header-logo-text">MARG</span>
        </div>
        <div className="header-divider-line" />
        <span className="header-tagline">
          Smart Logistics Accessibility Intelligence
        </span>
      </div>

      <div className="header-right">
        {/* Region selector pill */}
        <div className="header-region-pill">
          <IconMapPin size={14} />
          <span>Northeast India</span>
        </div>

        {/* Backend Online Status */}
        <div
          className={`header-status-pill ${backendConnected ? 'status-online' : 'status-standby'}`}
          title={backendConnected ? 'Backend API connected' : 'Backend standing by'}
        >
          <span className="status-indicator-dot" />
          <span>{backendConnected ? 'ONLINE' : 'STANDBY'}</span>
        </div>

        {/* User avatar */}
        <div className="header-user-avatar" title="Operations Officer">
          <IconUser size={16} />
        </div>
      </div>
    </header>
  );
}
