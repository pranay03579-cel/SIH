import React, { useState } from 'react';
import LocationAutocomplete from './LocationAutocomplete';

export default function SearchSection({ onSearch, isLoading = false }) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originLocation, setOriginLocation] = useState(null);
  const [destinationLocation, setDestinationLocation] = useState(null);
  const [urgency, setUrgency] = useState('MEDIUM');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim()) return;
    if (onSearch) {
      onSearch({
        origin: origin.trim(),
        destination: destination.trim(),
        urgency,
        originLocation,
        destinationLocation
      });
    }
  };

  const handleQuickSelect = (orig, dest) => {
    setOrigin(orig);
    setDestination(dest);
    setOriginLocation(null);
    setDestinationLocation(null);
  };

  return (
    <div className="planner-card-container">
      {/* Stepper Header */}
      <div className="planner-stepper-row">
        <span className="planner-stepper-badge">02 ROUTE PLANNER</span>
      </div>

      <h2 className="planner-title">Where are you going?</h2>
      <p className="planner-subtitle">
        Enter your origin hub and destination post to evaluate viable transport corridors across Northeast India.
      </p>

      {/* Preset Corridor Suggestions */}
      <div className="planner-presets-row">
        <span className="presets-label">Suggested Corridors:</span>
        <button
          type="button"
          className="preset-pill-btn"
          onClick={() => handleQuickSelect('Guwahati, Assam', 'Tezpur, Assam')}
        >
          Guwahati → Tezpur
        </button>
        <button
          type="button"
          className="preset-pill-btn"
          onClick={() => handleQuickSelect('Guwahati, Assam', 'Silchar, Assam')}
        >
          Guwahati → Silchar
        </button>
        <button
          type="button"
          className="preset-pill-btn"
          onClick={() => handleQuickSelect('Guwahati, Assam', 'Shillong, Meghalaya')}
        >
          Guwahati → Shillong
        </button>
      </div>

      <form className="planner-form" onSubmit={handleSubmit}>
        {/* Origin Autocomplete */}
        <div className="planner-input-group">
          <label className="planner-input-label" htmlFor="origin-input">
            Origin Hub
          </label>
          <LocationAutocomplete
            id="origin-input"
            value={origin}
            icon="origin"
            placeholder="Search origin hub (e.g., Guwahati, Assam)"
            onChange={(val) => {
              setOrigin(val);
              setOriginLocation(null);
            }}
            onSelectLocation={(loc) => {
              if (loc) {
                setOrigin(loc.displayName || loc.name);
                setOriginLocation(loc);
              } else {
                setOrigin('');
                setOriginLocation(null);
              }
            }}
            disabled={isLoading}
            required
          />
        </div>

        {/* Destination Autocomplete */}
        <div className="planner-input-group">
          <label className="planner-input-label" htmlFor="destination-input">
            Destination / Forward Post
          </label>
          <LocationAutocomplete
            id="destination-input"
            value={destination}
            icon="destination"
            placeholder="Search destination (e.g., Tezpur, Assam)"
            onChange={(val) => {
              setDestination(val);
              setDestinationLocation(null);
            }}
            onSelectLocation={(loc) => {
              if (loc) {
                setDestination(loc.displayName || loc.name);
                setDestinationLocation(loc);
              } else {
                setDestination('');
                setDestinationLocation(null);
              }
            }}
            disabled={isLoading}
            required
          />
        </div>

        {/* Urgency Selector */}
        <div className="planner-input-group">
          <label className="planner-input-label" htmlFor="urgency-select">
            Mission Urgency Profile
          </label>
          <div className="planner-input-wrapper">
            <select
              id="urgency-select"
              className="planner-select-input"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              disabled={isLoading}
            >
              <option value="LOW">LOW — Standard Transit (Prioritise Safety)</option>
              <option value="MEDIUM">MEDIUM — Normal Supply Line (Balanced)</option>
              <option value="HIGH">HIGH — Rapid Response (Time Sensitive)</option>
              <option value="CRITICAL">CRITICAL — Emergency Relief (Maximum Speed)</option>
            </select>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="submit"
          className="planner-submit-btn"
          id="search-submit-btn"
          disabled={isLoading || !origin.trim() || !destination.trim()}
        >
          {isLoading ? (
            <>
              <div className="planner-btn-spinner" />
              <span>Evaluating Corridors...</span>
            </>
          ) : (
            <>
              <span>Evaluate Corridors</span>
              <span className="planner-btn-arrow">→</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

