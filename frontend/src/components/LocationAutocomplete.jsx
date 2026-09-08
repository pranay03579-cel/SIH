import React, { useState, useEffect, useRef } from 'react';

/**
 * LocationAutocomplete
 * Google Maps-style location search with open geocoding, debouncing, 
 * keyboard navigation, and Northeast India prioritized results.
 */
export default function LocationAutocomplete({
  id,
  value,
  onChange,
  onSelectLocation,
  placeholder = 'Search location or landmark...',
  icon = 'map-pin',
  disabled = false,
  required = false
}) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [errorMsg, setErrorMsg] = useState(null);

  const wrapperRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Sync internal query when external value prop changes
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions with debouncing
  const fetchSuggestions = (searchText) => {
    if (!searchText || searchText.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      setErrorMsg(null);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/locations/search?q=${encodeURIComponent(searchText.trim())}`);
        if (!res.ok) {
          throw new Error('Network response not ok');
        }
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (err) {
        console.warn('Geocoding search failed, manual entry still available:', err);
        setErrorMsg('Unable to search locations. You can still enter manually.');
        setSuggestions([]);
        setIsOpen(true);
      } finally {
        setIsLoading(false);
      }
    }, 280);
  };

  const handleInputChange = (e) => {
    const newVal = e.target.value;
    setQuery(newVal);
    onChange(newVal);
    fetchSuggestions(newVal);
  };

  const handleSelect = (item) => {
    const formattedName = item.display_name || item.name;
    setQuery(formattedName);
    setIsOpen(false);
    setSelectedIndex(-1);
    
    // Call parent handler with full location object
    if (onSelectLocation) {
      onSelectLocation({
        name: item.name,
        displayName: formattedName,
        latitude: item.lat,
        longitude: item.lon,
        state: item.state,
        isNortheast: item.is_northeast
      });
    } else {
      onChange(formattedName);
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[selectedIndex]);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  return (
    <div className="location-autocomplete-wrapper" ref={wrapperRef}>
      <div className="location-input-container">
        <span className="location-input-icon">
          {icon === 'origin' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
          ) : icon === 'destination' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
        </span>

        <input
          id={id}
          type="text"
          className="form-input autocomplete-input"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          required={required}
          autoComplete="off"
        />

        {isLoading && (
          <span className="autocomplete-spinner" title="Searching locations...">
            <span className="spinner-dot" />
          </span>
        )}

        {query && !disabled && (
          <button
            type="button"
            className="autocomplete-clear-btn"
            onClick={() => {
              setQuery('');
              onChange('');
              setSuggestions([]);
              setIsOpen(false);
              if (onSelectLocation) onSelectLocation(null);
            }}
            title="Clear location"
          >
            ×
          </button>
        )}
      </div>

      {isOpen && (
        <div className="autocomplete-dropdown">
          {isLoading && suggestions.length === 0 && (
            <div className="autocomplete-status-item">
              <span className="mini-spinner" />
              <span>Searching locations...</span>
            </div>
          )}

          {!isLoading && errorMsg && (
            <div className="autocomplete-status-item error-text">
              <span>{errorMsg}</span>
            </div>
          )}

          {!isLoading && !errorMsg && suggestions.length === 0 && (
            <div className="autocomplete-status-item empty-text">
              <span>No locations found. Try a more specific search.</span>
            </div>
          )}

          {suggestions.length > 0 && (
            <ul className="autocomplete-list" role="listbox">
              {suggestions.map((item, idx) => (
                <li
                  key={`${item.name}-${item.lat}-${item.lon}-${idx}`}
                  role="option"
                  aria-selected={idx === selectedIndex}
                  className={`autocomplete-item ${idx === selectedIndex ? 'selected' : ''}`}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => handleSelect(item)}
                >
                  <div className="autocomplete-item-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div className="autocomplete-item-content">
                    <div className="autocomplete-item-title">
                      {item.name}
                      {item.is_northeast && (
                        <span className="ne-badge">NE</span>
                      )}
                    </div>
                    <div className="autocomplete-item-subtitle">
                      {item.display_name}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
