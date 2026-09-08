import React from 'react';
import { IconCompass, IconAlertTriangle, IconRefreshCw, IconCheck } from './Icons';

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
  const [activeStep, setActiveStep] = React.useState(0);

  const steps = [
    "Resolving Locations & Generating Route Corridors",
    "Analyzing Rainfall & Terrain Conditions",
    "Analyzing Landslide Risk Using Machine Learning",
    "Calculating Route Accessibility & Intelligence Scores",
    "Ranking Corridors & Formulating Recommendations"
  ];

  React.useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 1200);
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="state-container state-loading">
      <div className="loading-spinner" />
      <h3 className="state-title">Evaluating Route Corridors...</h3>
      <p className="state-description">
        Analyzing multi-factor environmental hazards, slope gradients, and accessibility clearance.
      </p>

      <div className="loading-steps-list">
        {steps.map((step, idx) => {
          const isDone = idx < activeStep;
          const isCurrent = idx === activeStep;
          return (
            <div
              key={idx}
              className={`loading-step-item ${isDone ? "step-done" : isCurrent ? "step-current" : "step-pending"}`}
            >
              <span className="step-icon">
                {isDone ? (
                  <IconCheck size={14} color="var(--forest-green)" strokeWidth={2.5} />
                ) : isCurrent ? (
                  <span className="step-dot-active" />
                ) : (
                  <span className="step-dot-pending" />
                )}
              </span>
              <span className="step-text">{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ErrorState({ message = "We couldn't retrieve route data right now.", onRetry }) {
  const [showDetails, setShowDetails] = React.useState(false);

  // Sanitize user-facing message to not expose raw API URLs
  const cleanMessage = React.useMemo(() => {
    if (!message) return "We couldn't retrieve route data right now.";
    if (message.includes("http") || message.includes("403") || message.includes("503") || message.includes("500")) {
      return "Unable to evaluate corridors. The service encountered a connectivity issue while querying map data.";
    }
    return message;
  }, [message]);

  return (
    <div className="state-container state-error">
      <div className="state-icon-wrapper">
        <IconAlertTriangle size={26} />
      </div>
      <h3 className="state-title">Unable to Evaluate Corridors</h3>
      <p className="state-description">
        {cleanMessage}
      </p>

      {onRetry && (
        <button type="button" className="retry-btn" onClick={onRetry}>
          <IconRefreshCw size={14} />
          <span>Try Again</span>
        </button>
      )}

      {message && message !== cleanMessage && (
        <div className="error-debug-toggle-wrapper">
          <button
            type="button"
            className="error-debug-toggle-btn"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? "Hide Technical Details" : "View Technical Details"}
          </button>
          {showDetails && (
            <pre className="error-debug-details">{message}</pre>
          )}
        </div>
      )}
    </div>
  );
}
