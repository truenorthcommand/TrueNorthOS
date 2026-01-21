import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export interface BackButtonProps {
  fallbackPath?: string;
  label?: string;
  className?: string;
}

export function BackButton({ fallbackPath = "/", label, className }: BackButtonProps) {
  const [, setLocation] = useLocation();
  
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation(fallbackPath);
    }
  };

  return (
    <Button 
      variant="outline" 
      size={label ? "sm" : "icon"}
      onClick={handleBack}
      data-testid="button-back"
      className={className}
    >
      <ArrowLeft className="h-4 w-4" />
      {label && <span className="ml-2">{label}</span>}
    </Button>
  );
}
