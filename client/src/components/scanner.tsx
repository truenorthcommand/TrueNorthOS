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

export function Scanner({ onScanSuccess, onScanError, className }: ScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('environment');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerIdRef = useRef(`scanner-${Date.now()}`);

  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setIsScanning(false);
  }, []);

  const startScanning = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const devices = await Html5Qrcode.getCameras();
      setHasMultipleCameras(devices.length > 1);

      if (devices.length === 0) {
        throw new Error('No cameras found on this device');
      }

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerIdRef.current, {
          formatsToSupport: SUPPORTED_FORMATS,
          verbose: false,
        });
      }

      const qrCodeSuccessCallback = (decodedText: string) => {
        onScanSuccess(decodedText);
      };

      await scannerRef.current.start(
        { facingMode: cameraFacing },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        qrCodeSuccessCallback,
        undefined
      );

      setIsScanning(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start camera';
      setError(errorMessage);
      onScanError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [cameraFacing, onScanSuccess, onScanError]);

  const switchCamera = useCallback(async () => {
    const newFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(newFacing);
    
    if (isScanning) {
      await stopScanning();
      setTimeout(() => {
        startScanning();
      }, 100);
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
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        scanner.stop().catch(() => {}).finally(() => {
          scanner.clear();
        });
      }
    };
  }, []);

  useEffect(() => {
    if (isScanning && cameraFacing) {
      stopScanning().then(() => {
        setTimeout(() => startScanning(), 100);
      });
    }
  }, [cameraFacing]);

  return (
    <div className={className}>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div 
            id={scannerIdRef.current}
            ref={containerRef}
            className="relative w-full aspect-square bg-black"
          >
            {!isScanning && !isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90">
                <Camera className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-sm mb-4">Camera preview</p>
              </div>
            )}
            
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90 z-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Starting camera...</p>
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

          {error && (
            <div className="p-4 bg-destructive/10 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Camera Error</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          )}

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
                  Start Scanning
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
                >
                  <SwitchCamera className="h-4 w-4" />
                </Button>
              )}
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowManualInput(!showManualInput)}
                data-testid="button-manual-entry"
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            </div>

            {showManualInput && (
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="manual-code">Manual Entry</Label>
                  <div className="flex gap-2">
                    <Input
                      id="manual-code"
                      placeholder="Enter code manually..."
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      data-testid="input-manual-code"
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

            <p className="text-xs text-center text-muted-foreground">
              Position the QR code or barcode within the frame
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
