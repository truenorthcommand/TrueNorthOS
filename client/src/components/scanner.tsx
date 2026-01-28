import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Camera,
  CameraOff,
  SwitchCamera,
  Loader2,
  AlertCircle,
  Keyboard,
  X,
  RefreshCw,
} from "lucide-react";

interface ScannerProps {
  onScanSuccess: (code: string) => void;
  onScanError?: (error: string) => void;
  className?: string;
}

type CameraFacing = 'environment' | 'user';

export function Scanner({ onScanSuccess, onScanError, className }: ScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('environment');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<any>(null);
  const scannerContainerId = useRef(`qr-scanner-${Math.random().toString(36).substr(2, 9)}`);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    navigator.mediaDevices?.enumerateDevices?.()
      .then(devices => {
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        if (mountedRef.current) {
          setHasMultipleCameras(videoDevices.length > 1);
        }
      })
      .catch(() => {});

    return () => {
      mountedRef.current = false;
      cleanupScanner();
    };
  }, []);

  const cleanupScanner = useCallback(() => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState?.();
        if (state === 2) {
          scannerRef.current.stop().catch(() => {});
        }
      } catch {}
      try {
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const stopScanning = useCallback(() => {
    cleanupScanner();
    if (mountedRef.current) {
      setIsScanning(false);
    }
  }, [cleanupScanner]);

  const startScanning = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      cleanupScanner();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const container = document.getElementById(scannerContainerId.current);
      if (!container) {
        throw new Error('Scanner container not ready');
      }

      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      
      const FORMATS = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
      ];

      scannerRef.current = new Html5Qrcode(scannerContainerId.current, {
        formatsToSupport: FORMATS,
        verbose: false,
      });

      await scannerRef.current.start(
        { facingMode: cameraFacing },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText: string) => {
          if (mountedRef.current) {
            onScanSuccess(decodedText);
          }
        },
        undefined
      );

      if (mountedRef.current) {
        setIsScanning(true);
        setIsLoading(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Scanner error:', msg);
      
      let errorMessage = 'Could not start camera scanner.';
      if (msg.includes('Permission') || msg.includes('denied') || msg.includes('NotAllowed')) {
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else if (msg.includes('NotFound') || msg.includes('not found') || msg.includes('Requested device not found')) {
        errorMessage = 'No camera found on this device.';
      } else if (msg.includes('NotReadable') || msg.includes('in use')) {
        errorMessage = 'Camera is in use by another app.';
      } else if (msg.includes('container')) {
        errorMessage = 'Scanner failed to initialize. Please refresh the page.';
      }
      
      if (mountedRef.current) {
        setError(errorMessage);
        setShowManualInput(true);
        setIsLoading(false);
      }
      onScanError?.(errorMessage);
      cleanupScanner();
    }
  }, [cameraFacing, onScanSuccess, onScanError, cleanupScanner]);

  const switchCamera = useCallback(async () => {
    const newFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(newFacing);
    
    if (isScanning) {
      stopScanning();
      setTimeout(() => startScanning(), 500);
    }
  }, [cameraFacing, isScanning, stopScanning, startScanning]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScanSuccess(manualCode.trim());
      setManualCode('');
      setShowManualInput(false);
    }
  };

  const retryScanning = () => {
    setError(null);
    startScanning();
  };

  return (
    <div className={className}>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative w-full aspect-square bg-black min-h-[280px] overflow-hidden">
            <div
              id={scannerContainerId.current}
              className="absolute inset-0 w-full h-full"
              style={{ 
                display: isScanning || isLoading ? 'block' : 'none',
              }}
            />
            
            {!isScanning && !isLoading && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90">
                <Camera className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-sm mb-2">Camera preview</p>
                <p className="text-muted-foreground text-xs px-4 text-center">
                  Tap "Start Scanning" to activate camera
                </p>
              </div>
            )}
            
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90 z-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Starting camera...</p>
                <p className="text-xs text-muted-foreground mt-2">Please allow camera access when prompted</p>
              </div>
            )}

            {error && !isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90 z-10 p-4">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-sm font-medium text-destructive text-center mb-2">Camera Error</p>
                <p className="text-xs text-muted-foreground text-center mb-4">{error}</p>
                <Button variant="outline" size="sm" onClick={retryScanning}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            )}

            {isScanning && (
              <div className="absolute inset-0 pointer-events-none z-10">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px]">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg"></div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 space-y-4">
            <div className="flex gap-2">
              {!isScanning ? (
                <Button
                  className="flex-1"
                  onClick={startScanning}
                  disabled={isLoading}
                  data-testid="button-start-scan"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="mr-2 h-4 w-4" />
                  )}
                  {isLoading ? 'Starting...' : 'Start Scanning'}
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  variant="secondary"
                  onClick={stopScanning}
                  data-testid="button-stop-scan"
                >
                  <CameraOff className="mr-2 h-4 w-4" />
                  Stop Scanning
                </Button>
              )}
              
              {hasMultipleCameras && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={switchCamera}
                  disabled={isLoading}
                  data-testid="button-switch-camera"
                  title="Switch camera"
                >
                  <SwitchCamera className="h-4 w-4" />
                </Button>
              )}
              
              <Button
                variant={showManualInput ? "default" : "outline"}
                size="icon"
                onClick={() => setShowManualInput(!showManualInput)}
                data-testid="button-manual-entry"
                title="Manual code entry"
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            </div>

            {showManualInput && (
              <form onSubmit={handleManualSubmit} className="space-y-3 p-3 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="manual-code" className="text-sm font-medium">Manual Entry</Label>
                  <p className="text-xs text-muted-foreground">Type or paste a code below</p>
                  <div className="flex gap-2">
                    <Input
                      id="manual-code"
                      placeholder="Enter code here..."
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      data-testid="input-manual-code"
                      autoFocus
                      autoComplete="off"
                    />
                    <Button type="submit" disabled={!manualCode.trim()} data-testid="button-submit-manual">
                      Go
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setShowManualInput(false);
                        setManualCode('');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {!showManualInput && (
              <p className="text-xs text-center text-muted-foreground">
                Position the QR code or barcode within the frame
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
