export type TrueNorthCodeType = 'job' | 'client' | 'asset';

export interface ParsedTrueNorthCode {
  type: TrueNorthCodeType;
  id: string;
}

export function generateTrueNorthCode(type: TrueNorthCodeType, id: string): string {
  return `TRUENORTH:${type}:${id}`;
}

export function parseTrueNorthCode(code: string): ParsedTrueNorthCode | null {
  if (!code || typeof code !== 'string') return null;
  
  const parts = code.split(':');
  if (parts.length !== 3) return null;
  if (parts[0] !== 'TRUENORTH' && parts[0] !== 'PROMAIN') return null;
  
  const type = parts[1] as TrueNorthCodeType;
  if (!['job', 'client', 'asset'].includes(type)) return null;
  
  const id = parts[2];
  if (!id) return null;
  
  return { type, id };
}

export interface ScanHistoryItem {
  code: string;
  timestamp: string;
  type: 'truenorth' | 'barcode' | 'unknown';
  parsedType?: TrueNorthCodeType;
  parsedId?: string;
}

const SCAN_HISTORY_KEY = 'truenorthScanHistory';
const MAX_HISTORY_ITEMS = 5;

export function getScanHistory(): ScanHistoryItem[] {
  try {
    const stored = localStorage.getItem(SCAN_HISTORY_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function addToScanHistory(code: string): ScanHistoryItem[] {
  const parsed = parseTrueNorthCode(code);
  
  const newItem: ScanHistoryItem = {
    code,
    timestamp: new Date().toISOString(),
    type: parsed ? 'truenorth' : /^\d+$/.test(code) ? 'barcode' : 'unknown',
    parsedType: parsed?.type,
    parsedId: parsed?.id,
  };
  
  let history = getScanHistory();
  history = history.filter(item => item.code !== code);
  history.unshift(newItem);
  history = history.slice(0, MAX_HISTORY_ITEMS);
  
  try {
    localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(history));
  } catch {
  }
  
  return history;
}

export function clearScanHistory(): void {
  try {
    localStorage.removeItem(SCAN_HISTORY_KEY);
  } catch {
  }
}
