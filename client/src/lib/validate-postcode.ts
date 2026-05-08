/**
 * UK Postcode validation utilities
 */

// Full UK postcode regex (covers all valid formats)
export function isValidUKPostcode(postcode: string): boolean {
  const regex = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;
  return regex.test(postcode.trim());
}

// Format postcode with correct spacing: "sw1a2aa" → "SW1A 2AA"
export function formatPostcode(postcode: string): string {
  const clean = postcode.replace(/\s/g, '').toUpperCase();
  if (clean.length >= 5) {
    return clean.slice(0, -3) + ' ' + clean.slice(-3);
  }
  return clean;
}

// Check if only outward code (partial): "SW1A" without "2AA"
export function isPartialPostcode(postcode: string): boolean {
  return /^[A-Z]{1,2}[0-9][A-Z0-9]?$/i.test(postcode.trim());
}

// Extract outward code: "SW1A 2AA" → "SW1A"
export function getOutwardCode(postcode: string): string {
  const clean = postcode.replace(/\s/g, '').toUpperCase();
  if (clean.length >= 5) {
    return clean.slice(0, -3);
  }
  return clean;
}
