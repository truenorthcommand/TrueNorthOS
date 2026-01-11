import { useState, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Scan,
  Upload,
  FileText,
  Receipt,
  Award,
  FileSignature,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Copy,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type DocumentType = 'invoice' | 'certificate' | 'contract' | 'receipt' | 'other';

interface ExtractedData {
  [key: string]: any;
}

export default function DocumentScanner() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [documentType, setDocumentType] = useState<DocumentType>('invoice');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [scanComplete, setScanComplete] = useState(false);

  const documentTypes = [
    { value: 'invoice', label: 'Supplier Invoice', icon: Receipt, description: 'Extract vendor, amounts, VAT' },
    { value: 'certificate', label: 'Trade Certificate', icon: Award, description: 'Gas Safe, NICEIC, Part P' },
    { value: 'contract', label: 'Service Contract', icon: FileSignature, description: 'Terms, dates, parties' },
    { value: 'receipt', label: 'Purchase Receipt', icon: Receipt, description: 'Shop receipts, items' },
    { value: 'other', label: 'Other Document', icon: FileText, description: 'General extraction' },
  ];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file (JPG, PNG, etc.)",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 10MB",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
      setExtractedData(null);
      setScanComplete(false);
      setScanError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    if (!imagePreview) {
      toast({
        title: "No image",
        description: "Please upload an image first",
        variant: "destructive"
      });
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setExtractedData(null);

    try {
      const response = await fetch('/api/ai/scan-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          image: imagePreview,
          documentType
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to scan document');
      }

      const data = await response.json();
      setExtractedData(data.extractedData);
      setScanComplete(true);
      
      toast({
        title: "Scan complete",
        description: "Document data extracted successfully"
      });
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Failed to scan document');
      toast({
        title: "Scan failed",
        description: error instanceof Error ? error.message : 'Failed to scan document',
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setExtractedData(null);
    setScanComplete(false);
    setScanError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Value copied to clipboard"
    });
  };

  const formatValue = (key: string, value: any): string => {
    if (value === null || value === undefined) return 'Not found';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'None';
      return value.map(item => {
        if (typeof item === 'object') {
          return Object.values(item).filter(v => v).join(' - ');
        }
        return String(item);
      }).join(', ');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'number') {
      if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('total') || 
          key.toLowerCase().includes('price') || key.toLowerCase().includes('subtotal') ||
          key.toLowerCase().includes('vat')) {
        return `£${value.toFixed(2)}`;
      }
    }
    return String(value);
  };

  const formatLabel = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/_/g, ' ');
  };

  const renderExtractedData = () => {
    if (!extractedData) return null;

    const entries = Object.entries(extractedData).filter(([_, value]) => value !== null);

    return (
      <div className="space-y-3">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{formatLabel(key)}</p>
              <p className="text-sm mt-0.5 break-words">
                {formatValue(key, value)}
              </p>
            </div>
            {value && typeof value !== 'object' && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => copyToClipboard(String(value))}
              >
                <Copy className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/ai-advisors">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scan className="h-6 w-6 text-primary" />
            Document Scanner
          </h1>
          <p className="text-muted-foreground">AI-powered data extraction from documents</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload Document</CardTitle>
            <CardDescription>
              Take a photo or upload an image of your document
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Document Type Selector */}
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
                <SelectTrigger data-testid="select-document-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {documentTypes.find(t => t.value === documentType)?.description}
              </p>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Document Image</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-document-file"
              />
              
              {!imagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                  data-testid="upload-area"
                >
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">Click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
                  <p className="text-xs text-muted-foreground mt-2">JPG, PNG up to 10MB</p>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Document preview"
                    className="w-full rounded-lg border"
                    data-testid="image-preview"
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={clearImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Scan Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleScan}
              disabled={!imagePreview || isScanning}
              data-testid="button-scan-document"
            >
              {isScanning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Scan Document
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Extracted Data
              {scanComplete && (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Complete
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              AI-extracted information from your document
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!imagePreview && !extractedData && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Upload a document to extract data</p>
              </div>
            )}

            {isScanning && (
              <div className="text-center py-12">
                <Loader2 className="h-10 w-10 mx-auto mb-3 animate-spin text-primary" />
                <p className="text-sm font-medium">Analyzing document...</p>
                <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
              </div>
            )}

            {scanError && (
              <div className="text-center py-8">
                <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
                <p className="text-sm font-medium text-destructive">Scan failed</p>
                <p className="text-xs text-muted-foreground mt-1">{scanError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={handleScan}
                >
                  Try Again
                </Button>
              </div>
            )}

            {!isScanning && !scanError && extractedData && (
              <div className="space-y-4">
                {renderExtractedData()}
                
                <Separator />
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      const text = Object.entries(extractedData)
                        .filter(([_, v]) => v !== null)
                        .map(([k, v]) => `${formatLabel(k)}: ${formatValue(k, v)}`)
                        .join('\n');
                      copyToClipboard(text);
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy All
                  </Button>
                </div>
              </div>
            )}

            {imagePreview && !isScanning && !scanError && !extractedData && (
              <div className="text-center py-12 text-muted-foreground">
                <Scan className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Click "Scan Document" to extract data</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Supported Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {documentTypes.filter(t => t.value !== 'other').map(type => (
              <div key={type.value} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                <type.icon className="h-6 w-6 text-primary mb-2" />
                <h4 className="font-medium text-sm">{type.label}</h4>
                <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
