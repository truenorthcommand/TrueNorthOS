import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

// Session timeout configuration
const IDLE_TIMEOUT = 20 * 60 * 1000; // 20 minutes in milliseconds
const WARNING_TIME = 2 * 60 * 1000; // Show warning 2 minutes before timeout
const CHECK_INTERVAL = 10 * 1000; // Check every 10 seconds
const ABSOLUTE_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours absolute session limit

export function useSessionTimeout() {
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    }

    // Clear local storage
    localStorage.removeItem('truenorth_user');

    toast({
      title: "Session Expired",
      description: "You have been logged out due to inactivity.",
      variant: "destructive",
    });

    setLocation("/login");
  }, [setLocation, toast]);

  const extendSession = useCallback(async () => {
    try {
      await fetch("/api/auth/extend-session", {
        method: "POST",
        credentials: "include",
      });
      setShowWarning(false);
    } catch (error) {
      console.error("Failed to extend session:", error);
    }
  }, []);

  const checkSessionTimeout = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session-timeout", {
        credentials: "include",
      });

      if (!response.ok) {
        // Session invalid or expired
        logout();
        return;
      }

      const data = await response.json();

      if (data.expired) {
        logout();
        return;
      }

      if (data.timeRemaining !== undefined) {
        setTimeRemaining(data.timeRemaining);

        // Show warning if within warning period
        if (data.timeRemaining <= WARNING_TIME && data.timeRemaining > 0) {
          setShowWarning(true);
        } else {
          setShowWarning(false);
        }
      }
    } catch (error) {
      console.error("Session check error:", error);
    }
  }, [logout]);

  useEffect(() => {
    let lastActivity = Date.now();
    let sessionStart = Date.now();
    let checkInterval: NodeJS.Timeout;

    // Track user activity
    const resetActivity = () => {
      const now = Date.now();
      lastActivity = now;

      // Check if absolute timeout exceeded
      if (now - sessionStart >= ABSOLUTE_TIMEOUT) {
        toast({
          title: "Session Expired",
          description: "Maximum session duration (8 hours) exceeded.",
          variant: "destructive",
        });
        logout();
        return;
      }

      // Extend session on server
      extendSession();
    };

    // Listen for user interactions
    const events = [
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'mousemove',
    ];

    events.forEach(event => {
      window.addEventListener(event, resetActivity, { passive: true });
    });

    // Check session status periodically
    checkInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivity;
      const sessionDuration = now - sessionStart;
      const remaining = IDLE_TIMEOUT - timeSinceActivity;

      setTimeRemaining(remaining);

      // Check absolute timeout
      if (sessionDuration >= ABSOLUTE_TIMEOUT) {
        clearInterval(checkInterval);
        toast({
          title: "Session Expired",
          description: "Maximum session duration (8 hours) exceeded.",
          variant: "destructive",
        });
        logout();
        return;
      }

      // Show warning 2 minutes before timeout
      if (remaining <= WARNING_TIME && remaining > 0) {
        setShowWarning(true);
      } else if (remaining > WARNING_TIME) {
        setShowWarning(false);
      }

      // Logout if idle timeout exceeded
      if (remaining <= 0) {
        clearInterval(checkInterval);
        logout();
      }

      // Also check server-side session status
      checkSessionTimeout();
    }, CHECK_INTERVAL);

    // Initial activity timestamp
    resetActivity();

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetActivity);
      });
      clearInterval(checkInterval);
    };
  }, [logout, extendSession, toast, checkSessionTimeout]);

  return {
    showWarning,
    timeRemaining,
    extendSession,
  };
}
