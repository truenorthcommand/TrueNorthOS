import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

const STORAGE_KEY = "lastCachePromptDate";

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function shouldShowPrompt(): boolean {
  const lastPromptDate = localStorage.getItem(STORAGE_KEY);
  const today = getTodayDate();
  return lastPromptDate !== today;
}

function markPromptShown(): void {
  localStorage.setItem(STORAGE_KEY, getTodayDate());
}

export function CachePromptModal() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    // Show modal immediately if it's a new day
    if (shouldShowPrompt()) {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    // Auto-dismiss if user navigates to settings
    if (location === "/settings" && open) {
      markPromptShown();
      setOpen(false);
    }
  }, [location, open]);

  const handleGoToSettings = () => {
    markPromptShown();
    setOpen(false);
    window.location.href = "/settings";
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            App Updated!
          </DialogTitle>
          <DialogDescription className="text-base space-y-3 pt-2">
            <p>
              Hey! 👋 TrueNorthOS has been updated with new features and improvements.
            </p>
            <p>
              <strong>Please clear your app cache to continue:</strong>
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Open Settings ⚙️</li>
              <li>Tap the "Clear Cache" button</li>
              <li>Refresh the page</li>
            </ol>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-4">
          <Button
            onClick={handleGoToSettings}
            className="w-full"
            size="lg"
          >
            Go to Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
