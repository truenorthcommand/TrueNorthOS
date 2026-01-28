import { useEffect, useRef, useState, useCallback, Component, ReactNode } from "react";
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

class ScannerErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Scanner error boundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function ScannerInner({ onScanSuccess, onScanError, className }: ScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('environment');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  const scannerRef = useRef<any>(null);
  const scannerIdRef = useRef(`scanner-${Math.random().toString(36).substr(2, 9)}`);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        setIsReady(true);
      }
    }, 100);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      cleanupScanner();
    };
  }, []);

  const cleanupScanner = useCallback(() => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState?.();
        if (state === 2) {
          scannerRef.current.stop?.().catch(() => {});
        }
        scannerRef.current.clear?.();
      } catch {}
      scannerRef.current = null;
    }
  }, []);

  const stopScanning = useCallback(async () => {
    cleanupScanner();
    if (mountedRef.current) {
      setIsScanning(false);
    }
  }, [cleanupScanner]);

  const startScanning = useCallback(async () => {
    if (!isReady) {
      setError('Scanner not ready. Please try again.');
      return;
    }

    setError(null);
    setIsLoading(true);

    const timeoutId = setTimeout(() => {
      if (mountedRef.current) {
        setIsLoading(false);
        setError('Camera took too long to start. Please try again or use manual entry.');
        setShowManualInput(true);
      }
    }, 15000);

    try {
      await new Promise(resolve => setTimeout(resolve, 300));

      const elementId = scannerIdRef.current;
      const element = document.getElementById(elementId);
      
      if (!element) {
        clearTimeout(timeoutId);
        throw new Error('Scanner container not found. Please refresh the page.');
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
      ];

      let devices;
      try {
        devices = await Html5Qrcode.getCameras();
      } catch (camErr) {
        clearTimeout(timeoutId);
        const msg = camErr instanceof Error ? camErr.message : String(camErr);
        if (msg.includes('Permission') || msg.includes('denied') || msg.includes('NotAllowed')) {
          throw new Error('Camera permission denied. Please allow camera access and try again.');
        }
        throw new Error('Could not access camera. Check browser permissions.');
      }

      if (!devices || devices.length === 0) {
        clearTimeout(timeoutId);
        throw new Error('No camera found. Use manual entry below.');
      }

      if (mountedRef.current) {
        setHasMultipleCameras(devices.length > 1);
      }

      cleanupScanner();

      scannerRef.current = new Html5Qrcode(elementId, {
        formatsToSupport: FORMATS,
        verbose: false,
      });

      await scannerRef.current.start(
        { facingMode: cameraFacing },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          onScanSuccess(decodedText);
        },
        undefined
      );

      clearTimeout(timeoutId);
      if (mountedRef.current) {
        setIsScanning(true);
        setIsLoading(false);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const errorMessage = err instanceof Error ? err.message : 'Failed to start camera';
      console.error('Scanner error:', errorMessage);
      if (mountedRef.current) {
        setError(errorMessage);
        setShowManualInput(true);
        setIsLoading(false);
      }
      onScanError?.(errorMessage);
      cleanupScanner();
    }
  }, [cameraFacing, onScanSuccess, onScanError, cleanupScanner, isReady]);

  const switchCamera = useCallback(async () => {
    const newFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(newFacing);
    
    if (isScanning) {
      await stopScanning();
      setTimeout(() => startScanning(), 300);
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

  if (!isReady) {
    return (
      <div className={className}>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="w-full aspect-square bg-muted flex items-center justify-center min-h-[280px]">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading scanner...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={className}>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div 
            id={scannerIdRef.current}
            className="relative w-full aspect-square bg-black min-h-[280px]"
          >
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
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px]">
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

export function Scanner(props: ScannerProps) {
  return (
    <ScannerErrorBoundary
      fallback={
        <div className={props.className}>
          <Card className="overflow-hidden">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="font-medium text-destructive mb-2">Scanner Error</p>
              <p className="text-sm text-muted-foreground mb-4">
                The camera scanner encountered an error. Please refresh the page or use manual entry.
              </p>
              <ManualEntryFallback onScanSuccess={props.onScanSuccess} />
            </CardContent>
          </Card>
        </div>
      }
    >
      <ScannerInner {...props} />
    </ScannerErrorBoundary>
  );
}

function ManualEntryFallback({ onScanSuccess }: { onScanSuccess: (code: string) => void }) {
  const [code, setCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      onScanSuccess(code.trim());
      setCode('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Label htmlFor="fallback-code" className="text-sm font-medium">Enter Code Manually</Label>
      <div className="flex gap-2">
        <Input
          id="fallback-code"
          placeholder="Enter code here..."
          value={code}
          onChange={(e) => setCode(e.target.value)}
          data-testid="input-fallback-code"
        />
        <Button type="submit" disabled={!code.trim()}>
          Go
        </Button>
      </div>
    </form>
  );
}
