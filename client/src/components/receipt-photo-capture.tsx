import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, Upload, X, Image as ImageIcon } from "lucide-react";

interface ReceiptPhotoCaptureProps {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
}

export function ReceiptPhotoCapture({ value, onChange, label = "Receipt Photo" }: ReceiptPhotoCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10MB");
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange(reader.result as string);
        setIsCapturing(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemove = () => {
    onChange("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const triggerCamera = () => {
    cameraInputRef.current?.click();
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        data-testid="input-camera-capture"
      />
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        data-testid="input-file-upload"
      />

      {value ? (
        <div className="relative">
          <div className="border rounded-lg overflow-hidden bg-gray-100">
            <img 
              src={value} 
              alt="Receipt" 
              className="w-full h-48 object-contain"
              data-testid="receipt-preview"
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleRemove}
            data-testid="button-remove-receipt"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <ImageIcon className="h-10 w-10 mx-auto text-gray-400 mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            Take a photo or upload an image of your receipt
          </p>
          <div className="flex justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={triggerCamera}
              className="flex items-center gap-2"
              data-testid="button-take-photo"
            >
              <Camera className="h-4 w-4" />
              Take Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={triggerFileUpload}
              className="flex items-center gap-2"
              data-testid="button-upload-file"
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
