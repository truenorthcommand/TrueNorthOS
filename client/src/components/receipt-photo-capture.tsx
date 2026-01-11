import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";

interface ReceiptPhotoCaptureProps {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const JPEG_QUALITY = 0.7;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function ReceiptPhotoCapture({ value, onChange, label = "Receipt Photo" }: ReceiptPhotoCaptureProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        alert("File size must be less than 5MB");
        return;
      }
      
      setIsProcessing(true);
      try {
        const compressedDataUrl = await compressImage(file);
        onChange(compressedDataUrl);
      } catch (error) {
        console.error("Failed to process image:", error);
        alert("Failed to process image. Please try again.");
      } finally {
        setIsProcessing(false);
      }
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

      {isProcessing ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <Loader2 className="h-10 w-10 mx-auto text-gray-400 mb-3 animate-spin" />
          <p className="text-sm text-muted-foreground">Processing image...</p>
        </div>
      ) : value ? (
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
