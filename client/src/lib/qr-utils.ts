export type ProMainCodeType = 'job' | 'client' | 'asset';

export interface ParsedProMainCode {
  type: ProMainCodeType;
  id: string;
}

export function generateProMainCode(type: ProMainCodeType, id: string): string {
  return `PROMAIN:${type}:${id}`;
}

export function parseProMainCode(code: string): ParsedProMainCode | null {
  if (!code || typeof code !== 'string') return null;
  
  const parts = code.split(':');
  if (parts.length !== 3) return null;
  if (parts[0] !== 'PROMAIN') return null;
  
  const type = parts[1] as ProMainCodeType;
  if (!['job', 'client', 'asset'].includes(type)) return null;
  
  const id = parts[2];
  if (!id) return null;
  
  return { type, id };
}

export interface ScanHistoryItem {
  code: string;
  timestamp: string;
  type: 'promain' | 'barcode' | 'unknown';
  parsedType?: ProMainCodeType;
  parsedId?: string;
}

const SCAN_HISTORY_KEY = 'promainScanHistory';
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
  const parsed = parseProMainCode(code);
  
  const newItem: ScanHistoryItem = {
    code,
    timestamp: new Date().toISOString(),
    type: parsed ? 'promain' : /^\d+$/.test(code) ? 'barcode' : 'unknown',
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
    // localStorage may be unavailable
  }
  
  return history;
}

export function clearScanHistory(): void {
  try {
    localStorage.removeItem(SCAN_HISTORY_KEY);
  } catch {
    // localStorage may be unavailable
  }
}
