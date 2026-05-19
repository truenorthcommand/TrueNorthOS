import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle } from "lucide-react";
import { useSessionTimeout } from "@/hooks/use-session-timeout";

export function SessionTimeoutWarning() {
  const { showWarning, timeRemaining, extendSession } = useSessionTimeout();

  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  return (
    <AlertDialog open={showWarning}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            Session About to Expire
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <div className="flex items-center justify-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <Clock className="w-8 h-8 text-amber-600" />
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-900 font-mono">
                  {minutes}:{seconds.toString().padStart(2, '0')}
                </div>
                <div className="text-xs text-amber-700 mt-1">remaining</div>
              </div>
            </div>
            <p className="text-slate-700">
              Your session will expire due to inactivity. Click <strong>"Stay Logged In"</strong> to continue working.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button onClick={extendSession} className="w-full bg-blue-600 hover:bg-blue-700">
            Stay Logged In
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
