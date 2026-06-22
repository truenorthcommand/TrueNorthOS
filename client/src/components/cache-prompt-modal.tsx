import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [dontShowAgain, setDontShowAgain] = useState(false);
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
      handleDismiss();
    }
  }, [location, open]);

  const handleDismiss = () => {
    if (dontShowAgain) {
      markPromptShown();
    }
    setOpen(false);
  };

  const handleGoToSettings = () => {
    markPromptShown();
    setOpen(false);
    window.location.href = "/settings";
  };

  const handleRemindLater = () => {
    // Don't mark as shown, will show again next login
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
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
              For the best experience, please clear your app cache:
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Open Settings ⚙️</li>
              <li>Tap the "Clear Cache" button</li>
              <li>Refresh the page</li>
            </ol>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-col gap-3">
          <Button
            onClick={handleGoToSettings}
            className="w-full"
            size="lg"
          >
            Go to Settings
          </Button>
          <Button
            onClick={handleRemindLater}
            variant="outline"
            className="w-full"
          >
            Remind Me Later
          </Button>
          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="dont-show"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <label
              htmlFor="dont-show"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Don't show again today
            </label>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
