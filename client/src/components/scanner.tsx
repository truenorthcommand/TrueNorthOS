import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
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

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.ITF,
];

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function Scanner({ onScanSuccess, onScanError, className }: ScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('environment');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerIdRef = useRef(`scanner-${Math.random().toString(36).substr(2, 9)}`);
  const isScanningRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const cleanupScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          await scannerRef.current.stop();
        }
      } catch {}
      try {
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    isScanningRef.current = false;
  }, []);

  const stopScanning = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    await cleanupScanner();
    if (isMounted) {
      setIsScanning(false);
    }
  }, [cleanupScanner, isMounted]);

  const startScanning = useCallback(async () => {
    if (isScanningRef.current) return;
    
    setError(null);
    setIsLoading(true);

    timeoutRef.current = setTimeout(() => {
      if (isMounted) {
        setIsLoading(false);
        setError('Camera initialization timed out. Please try again or use manual entry.');
        setShowManualInput(true);
        cleanupScanner();
      }
    }, 15000);

    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const elementId = scannerIdRef.current;
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error('Scanner element not ready. Please close and reopen the dialog.');
      }

      let devices;
      try {
        if (isIOS()) {
          await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: cameraFacing,
              width: { ideal: 1280 },
              height: { ideal: 720 }
            } 
          }).then(stream => {
            stream.getTracks().forEach(track => track.stop());
          });
        }
        
        devices = await Html5Qrcode.getCameras();
      } catch (camErr) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        const msg = camErr instanceof Error ? camErr.message : String(camErr);
        console.error('Camera access error:', msg);
        
        if (msg.includes('Permission') || msg.includes('denied') || msg.includes('NotAllowed')) {
          throw new Error('Camera permission denied. Please allow camera access in Safari settings: Settings > Safari > Camera > Allow');
        }
        if (msg.includes('NotFound') || msg.includes('not found')) {
          throw new Error('No camera found. Please ensure camera permissions are enabled.');
        }
        if (msg.includes('NotReadable') || msg.includes('in use')) {
          throw new Error('Camera is in use by another app. Please close other apps using the camera.');
        }
        throw new Error('Could not access camera. Please check your browser settings and try again.');
      }

      if (!devices || devices.length === 0) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        throw new Error('No camera detected. Please check camera permissions in Settings > Safari > Camera');
      }

      setHasMultipleCameras(devices.length > 1);

      await cleanupScanner();

      scannerRef.current = new Html5Qrcode(elementId, {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
      });

      isScanningRef.current = true;

      const config = {
        fps: isIOS() ? 5 : 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
      };

      await scannerRef.current.start(
        { facingMode: cameraFacing },
        config,
        (decodedText: string) => {
          onScanSuccess(decodedText);
        },
        undefined
      );

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      if (isMounted) {
        setIsScanning(true);
        setIsLoading(false);
        setRetryCount(0);
      }
    } catch (err) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to start camera';
      console.error('Scanner error:', errorMessage);
      if (isMounted) {
        setError(errorMessage);
        setShowManualInput(true);
        setIsLoading(false);
      }
      onScanError?.(errorMessage);
      await cleanupScanner();
    }
  }, [cameraFacing, onScanSuccess, onScanError, cleanupScanner, isMounted]);

  const retryScanning = useCallback(async () => {
    setRetryCount(prev => prev + 1);
    setError(null);
    await startScanning();
  }, [startScanning]);

  const switchCamera = useCallback(async () => {
    const newFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(newFacing);
    
    if (isScanning) {
      await stopScanning();
      setTimeout(() => {
        startScanning();
      }, 300);
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

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      cleanupScanner();
    };
  }, [cleanupScanner]);

  return (
    <div className={className}>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div 
            id={scannerIdRef.current}
            className="relative w-full aspect-square bg-black min-h-[280px]"
            style={{ WebkitTransform: 'translateZ(0)' }}
          >
            {!isScanning && !isLoading && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90">
                <Camera className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-sm mb-2">Camera preview</p>
                <p className="text-muted-foreground text-xs px-4 text-center">
                  Tap "Start Scanning" to activate camera
                </p>
                {isIOS() && (
                  <p className="text-muted-foreground text-xs px-4 text-center mt-2 italic">
                    Safari will ask for camera permission
                  </p>
                )}
              </div>
            )}
            
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90 z-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Starting camera...</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {isIOS() ? 'Please allow camera access when prompted' : 'This may take a moment'}
                </p>
              </div>
            )}

            {error && !isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90 z-10 p-4">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-sm font-medium text-destructive text-center mb-2">Camera Error</p>
                <p className="text-xs text-muted-foreground text-center mb-4">{error}</p>
                {retryCount < 3 && (
                  <Button variant="outline" size="sm" onClick={retryScanning}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                )}
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
                      autoCapitalize="off"
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
