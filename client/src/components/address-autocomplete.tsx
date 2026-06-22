/// <reference types="@types/google.maps" />
import { useState, useEffect, useRef, useCallback } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useGoogleMapsApi } from './google-maps-provider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Search, AlertTriangle, CheckCircle2, XCircle, PenLine } from 'lucide-react';
import { isValidUKPostcode, formatPostcode, isPartialPostcode } from '@/lib/validate-postcode';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedAddress {
  street: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  formatted_address: string;
  partial_postcode?: boolean;
}

interface AddressAutocompleteProps {
  onAddressChange: (address: ParsedAddress | null) => void;
  initialAddress?: Partial<ParsedAddress>;
  required?: boolean;
  label?: string;
  disabled?: boolean;
  className?: string;
  showFields?: boolean;
  compact?: boolean;
}

// ─── Pac Container Styles ─────────────────────────────────────────────────────

const PAC_STYLES = `
.pac-container {
  z-index: 9999 !important;
  border-radius: 0.5rem;
  border: 1px solid hsl(var(--border));
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  font-family: inherit;
  margin-top: 4px;
  background: hsl(var(--popover));
  color: hsl(var(--popover-foreground));
  min-width: 400px;
  max-width: 600px;
}
.pac-container .pac-item {
  padding: 8px 12px;
  cursor: pointer;
  border-top: 1px solid hsl(var(--border));
  font-size: 0.875rem;
  line-height: 1.25rem;
  white-space: normal;
  word-wrap: break-word;
  min-height: auto;
}
.pac-container .pac-item:first-child {
  border-top: none;
}
.pac-container .pac-item:hover {
  background: hsl(var(--accent));
}
.pac-container .pac-item .pac-icon {
  display: none;
}
.pac-container .pac-item .pac-item-query {
  font-weight: 500;
  color: hsl(var(--foreground));
  display: block;
  width: 100%;
}
.pac-container .pac-item .pac-matched {
  font-weight: 600;
}
.pac-container::after {
  display: none !important;
}
`;

function injectPacStyles() {
  if (document.getElementById('pac-custom-styles')) return;
  const style = document.createElement('style');
  style.id = 'pac-custom-styles';
  style.textContent = PAC_STYLES;
  document.head.appendChild(style);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddressAutocomplete({
  onAddressChange,
  initialAddress,
  required = true,
  label = 'Address',
  disabled = false,
  className,
  showFields = true,
  compact = false,
}: AddressAutocompleteProps) {
  // Google Maps hooks - uses global provider
  const { isLoaded, error: mapsError } = useGoogleMapsApi();
  const placesLib = useMapsLibrary('places');

  // State
  const [status, setStatus] = useState<'loading' | 'error' | 'ready' | 'selected'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // Address fields
  const [street, setStreet] = useState(initialAddress?.street || '');
  const [city, setCity] = useState(initialAddress?.city || '');
  const [county, setCounty] = useState(initialAddress?.county || '');
  const [postcode, setPostcode] = useState(initialAddress?.postcode || '');
  const [country, setCountry] = useState(initialAddress?.country || 'United Kingdom');
  const [latitude, setLatitude] = useState<number | null>(initialAddress?.latitude || null);
  const [longitude, setLongitude] = useState<number | null>(initialAddress?.longitude || null);
  const [formattedAddress, setFormattedAddress] = useState(initialAddress?.formatted_address || '');

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const listenerRef = useRef<google.maps.MapsEventListener | null>(null);

  // ─── Postcode Validation ──────────────────────────────────────────────────

  type PostcodeStatus = 'empty' | 'valid' | 'partial' | 'invalid';

  const getPostcodeStatus = useCallback((value: string): PostcodeStatus => {
    const trimmed = value.trim();
    if (!trimmed) return 'empty';
    if (isValidUKPostcode(trimmed)) return 'valid';
    if (isPartialPostcode(trimmed)) return 'partial';
    return 'invalid';
  }, []);

  const postcodeStatus = getPostcodeStatus(postcode);

  // ─── Notify Parent ────────────────────────────────────────────────────────

  const notifyParent = useCallback(
    (fields: {
      street: string;
      city: string;
      county: string;
      postcode: string;
      country: string;
      latitude: number | null;
      longitude: number | null;
      formatted_address: string;
    }) => {
      const pcStatus = getPostcodeStatus(fields.postcode);
      if (pcStatus === 'valid') {
        onAddressChange({
          street: fields.street,
          city: fields.city,
          county: fields.county,
          postcode: formatPostcode(fields.postcode),
          country: fields.country,
          latitude: fields.latitude,
          longitude: fields.longitude,
          formatted_address: fields.formatted_address,
          partial_postcode: false,
        });
      } else {
        onAddressChange(null);
      }
    },
    [onAddressChange, getPostcodeStatus]
  );

  // ─── Handle Maps Error ────────────────────────────────────────────────────

  useEffect(() => {
    if (mapsError) {
      setStatus('error');
      setErrorMessage(mapsError);
      setManualMode(true);
    }
  }, [mapsError]);

  // ─── Initialize Google Places Autocomplete ────────────────────────────────

  useEffect(() => {
    if (manualMode) return;
    if (!placesLib) {
      setStatus('loading');
      return;
    }
    if (!searchInputRef.current) return;
    if (autocompleteRef.current) return;

    injectPacStyles();
    setStatus('ready');

    const autocomplete = new placesLib.Autocomplete(searchInputRef.current, {
      componentRestrictions: { country: 'gb' },
      types: ['address'],
      fields: ['address_components', 'formatted_address', 'geometry'],
    });

    autocompleteRef.current = autocomplete;

    listenerRef.current = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.address_components) return;

      // Parse address components
      let streetNumber = '';
      let route = '';
      let parsedCity = '';
      let parsedCounty = '';
      let parsedPostcode = '';
      let parsedCountry = 'United Kingdom';

      for (const component of place.address_components) {
        const types = component.types;
        if (types.includes('street_number')) {
          streetNumber = component.long_name;
        } else if (types.includes('route')) {
          route = component.long_name;
        } else if (types.includes('postal_town')) {
          parsedCity = component.long_name;
        } else if (types.includes('locality') && !parsedCity) {
          parsedCity = component.long_name;
        } else if (types.includes('administrative_area_level_2')) {
          parsedCounty = component.long_name;
        } else if (types.includes('postal_code')) {
          parsedPostcode = component.long_name;
        } else if (types.includes('country')) {
          parsedCountry = component.long_name;
        }
      }

      const parsedStreet = streetNumber
        ? `${streetNumber} ${route}`
        : route;

      const lat = place.geometry?.location?.lat() ?? null;
      const lng = place.geometry?.location?.lng() ?? null;
      const formatted = place.formatted_address || '';

      // Update state
      setStreet(parsedStreet);
      setCity(parsedCity);
      setCounty(parsedCounty);
      setPostcode(parsedPostcode ? formatPostcode(parsedPostcode) : '');
      setCountry(parsedCountry);
      setLatitude(lat);
      setLongitude(lng);
      setFormattedAddress(formatted);
      setSearchValue(formatted);
      setStatus('selected');

      // Notify parent
      notifyParent({
        street: parsedStreet,
        city: parsedCity,
        county: parsedCounty,
        postcode: parsedPostcode ? formatPostcode(parsedPostcode) : '',
        country: parsedCountry,
        latitude: lat,
        longitude: lng,
        formatted_address: formatted,
      });
    });

    return () => {
      if (listenerRef.current) {
        google.maps.event.removeListener(listenerRef.current);
        listenerRef.current = null;
      }
      autocompleteRef.current = null;
    };
  }, [placesLib, manualMode, notifyParent]);

  // ─── Handle postcode changes ──────────────────────────────────────────────

  const handlePostcodeChange = useCallback(
    (value: string) => {
      setPostcode(value);
      notifyParent({
        street,
        city,
        county,
        postcode: value,
        country,
        latitude,
        longitude,
        formatted_address: formattedAddress,
      });
    },
    [street, city, county, country, latitude, longitude, formattedAddress, notifyParent]
  );

  // Handle postcode blur - format if valid
  const handlePostcodeBlur = useCallback(() => {
    if (isValidUKPostcode(postcode)) {
      const formatted = formatPostcode(postcode);
      setPostcode(formatted);
      notifyParent({
        street,
        city,
        county,
        postcode: formatted,
        country,
        latitude,
        longitude,
        formatted_address: formattedAddress,
      });
    }
  }, [postcode, street, city, county, country, latitude, longitude, formattedAddress, notifyParent]);

  // ─── Handle manual field changes ──────────────────────────────────────────

  const handleFieldChange = useCallback(
    (field: 'street' | 'city' | 'county', value: string) => {
      const setters = { street: setStreet, city: setCity, county: setCounty };
      setters[field](value);

      const fields = { street, city, county };
      fields[field] = value;

      notifyParent({
        ...fields,
        postcode,
        country,
        latitude,
        longitude,
        formatted_address: `${fields.street}, ${fields.city}, ${fields.county}, ${postcode}`,
      });
    },
    [street, city, county, postcode, country, latitude, longitude, notifyParent]
  );

  // ─── Toggle manual mode ───────────────────────────────────────────────────

  const toggleManualMode = useCallback(() => {
    setManualMode((prev) => !prev);
    if (manualMode) {
      // Switching back to autocomplete - reset autocomplete ref so it re-initializes
      autocompleteRef.current = null;
      setStatus('loading');
    }
  }, [manualMode]);

  // ─── Postcode indicator ───────────────────────────────────────────────────

  const PostcodeIndicator = () => {
    switch (postcodeStatus) {
      case 'valid':
        return (
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs">Valid</span>
          </div>
        );
      case 'partial':
        return (
          <div className="flex items-center gap-1 text-orange-500">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs">Partial – please add full postcode</span>
          </div>
        );
      case 'invalid':
        return (
          <div className="flex items-center gap-1 text-red-500">
            <XCircle className="h-4 w-4" />
            <span className="text-xs">Invalid UK postcode format</span>
          </div>
        );
      default:
        return null;
    }
  };

  const postcodeBorderClass = {
    empty: 'border-input',
    valid: 'border-green-500 focus-visible:ring-green-500/20',
    partial: 'border-orange-400 focus-visible:ring-orange-400/20',
    invalid: 'border-red-500 focus-visible:ring-red-500/20',
  }[postcodeStatus];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={cn('space-y-3', className)}>
      {/* Search Input */}
      {!manualMode && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            {label}
          </Label>
          <div className="relative">
            <Input
              ref={searchInputRef}
              type="text"
              placeholder={
                status === 'loading'
                  ? 'Loading address lookup...'
                  : 'Start typing an address...'
              }
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              disabled={disabled || status === 'loading'}
              className="pl-9"
            />
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            {status === 'loading' && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              </div>
            )}
            {status === 'selected' && (
              <Badge
                variant="secondary"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
              >
                Selected
              </Badge>
            )}
          </div>
          {status === 'error' && errorMessage && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {errorMessage} — using manual entry
            </p>
          )}
        </div>
      )}

      {/* Address Fields */}
      {showFields && !compact && (status === 'selected' || manualMode) && (
        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Street</Label>
            <Input
              value={street}
              onChange={(e) => handleFieldChange('street', e.target.value)}
              disabled={disabled || (!manualMode && status === 'selected')}
              placeholder="Street address"
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">City</Label>
              <Input
                value={city}
                onChange={(e) => handleFieldChange('city', e.target.value)}
                disabled={disabled || (!manualMode && status === 'selected')}
                placeholder="City / Town"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">County</Label>
              <Input
                value={county}
                onChange={(e) => handleFieldChange('county', e.target.value)}
                disabled={disabled || (!manualMode && status === 'selected')}
                placeholder="County"
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Postcode Field - Always Visible */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">
          Postcode {required && <span className="text-red-500">*</span>}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            value={postcode}
            onChange={(e) => handlePostcodeChange(e.target.value.toUpperCase())}
            onBlur={handlePostcodeBlur}
            disabled={disabled}
            placeholder="e.g. SW1A 2AA"
            className={cn('max-w-[180px] font-mono', postcodeBorderClass)}
            required={required}
          />
          <PostcodeIndicator />
        </div>
      </div>

      {/* Manual Toggle */}
      <div>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
          onClick={toggleManualMode}
          disabled={disabled}
        >
          <PenLine className="h-3 w-3 mr-1" />
          {manualMode ? 'Search instead' : 'Enter address manually'}
        </Button>
      </div>
    </div>
  );
}

export default AddressAutocomplete;
