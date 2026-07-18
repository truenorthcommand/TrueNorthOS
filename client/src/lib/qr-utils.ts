export type PMSCodeType = 'job' | 'client' | 'asset';

export interface ParsedPMSCode {
  type: PMSCodeType;
  id: string;
}

export function generatePMSCode(type: PMSCodeType, id: string): string {
  return `REACTPMS:${type}:${id}`;
}

export function parsePMSCode(code: string): ParsedPMSCode | null {
  if (!code || typeof code !== 'string') return null;
  
  const parts = code.split(':');
  if (parts.length !== 3) return null;
  if (parts[0] !== 'REACTPMS' && parts[0] !== 'PROMAIN') return null;
  
  const type = parts[1] as PMSCodeType;
  if (!['job', 'client', 'asset'].includes(type)) return null;
  
  return {
    type,
    id: parts[2]
  };
}

// Helper to generate QR code data URL (requires qrcode library)
export async function generateQRCodeDataURL(text: string): Promise<string> {
  try {
    const QRCode = (await import('qrcode')).default;
    return await QRCode.toDataURL(text, {
      width: 300,
      margin: 2,
      color: {
        dark: '#144f63',
        light: '#ffffff'
      }
    });
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw error;
  }
}

// Helper to get the full URL for a QR code
export function getQRCodeURL(type: PMSCodeType, id: string): string {
  const code = generatePMSCode(type, id);
  const baseURL = window.location.origin;
  return `${baseURL}/scan?code=${encodeURIComponent(code)}`;
}
