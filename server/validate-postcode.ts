/**
 * UK Postcode validation utilities (server-side)
 */

export function isValidUKPostcode(postcode: string | null | undefined): boolean {
  if (!postcode) return false;
  const regex = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i;
  return regex.test(postcode.trim());
}

export function formatPostcode(postcode: string): string {
  const clean = postcode.replace(/\s/g, '').toUpperCase();
  if (clean.length >= 5) {
    return clean.slice(0, -3) + ' ' + clean.slice(-3);
  }
  return clean;
}

export function isPartialPostcode(postcode: string | null | undefined): boolean {
  if (!postcode) return false;
  return /^[A-Z]{1,2}[0-9][A-Z0-9]?$/i.test(postcode.trim());
}
