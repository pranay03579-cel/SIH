import React from 'react';
import { IconCompass, IconAlertTriangle, IconRefreshCw } from './Icons';

export function EmptyState() {
  return (
    <div className="state-container state-empty">
      <div className="state-icon-wrapper">
        <IconCompass size={28} />
      </div>
      <h3 className="state-title">Awaiting Corridor Query</h3>
      <p className="state-description">
        Enter the origin hub, destination, and mission urgency level to evaluate and compare accessible route corridors.
      </p>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="state-container state-loading">
      <div className="loading-spinner" />
      <h3 className="state-title">Evaluating Route Corridors...</h3>
      <p className="state-description">
        Analyzing real-time terrain vulnerabilities, slope gradients, and accessibility clearance scores.
      </p>
    </div>
  );
}

export function ErrorState({ message = "Failed to calculate route corridors. Please verify connectivity or check corridor parameters.", onRetry }) {
  return (
    <div className="state-container state-error">
      <div className="state-icon-wrapper">
        <IconAlertTriangle size={28} />
      </div>
      <h3 className="state-title">Corridor Evaluation Error</h3>
      <p className="state-description">
        {message}
      </p>
      {onRetry && (
        <button type="button" className="retry-btn" onClick={onRetry}>
          <IconRefreshCw size={14} />
          <span>Retry Assessment</span>
        </button>
      )}
    </div>
  );
}
