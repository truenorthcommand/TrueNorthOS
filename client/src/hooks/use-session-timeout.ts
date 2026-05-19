import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

// Session timeout configuration
const IDLE_TIMEOUT = 20 * 60 * 1000; // 20 minutes in milliseconds
const WARNING_TIME = 2 * 60 * 1000; // Show warning 2 minutes before timeout
const CHECK_INTERVAL = 10 * 1000; // Check every 10 seconds
const ABSOLUTE_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours absolute session limit
const EXTEND_THROTTLE = 60 * 1000; // Throttle extend-session calls to once per 60 seconds

export function useSessionTimeout() {
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const { toast } = useToast();
  const lastExtendRef = useRef(0);
  const isAuthenticatedRef = useRef(false);

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
    isAuthenticatedRef.current = false;

    toast({
      title: "Session Expired",
      description: "You have been logged out due to inactivity.",
      variant: "destructive",
    });

    setLocation("/login");
  }, [setLocation, toast]);

  const extendSession = useCallback(async () => {
    // Throttle: only call extend-session once per EXTEND_THROTTLE period
    const now = Date.now();
    if (now - lastExtendRef.current < EXTEND_THROTTLE) {
      return;
    }
    lastExtendRef.current = now;

    try {
      const response = await fetch("/api/auth/extend-session", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        isAuthenticatedRef.current = true;
        setShowWarning(false);
      } else if (response.status === 401) {
        // Not authenticated - don't spam, just mark as not authenticated
        isAuthenticatedRef.current = false;
      }
    } catch (error) {
      console.error("Failed to extend session:", error);
    }
  }, []);

  const checkSessionTimeout = useCallback(async () => {
    // Don't check session timeout on the login page or if not authenticated
    if (location === "/login" || !isAuthenticatedRef.current) {
      return;
    }

    try {
      const response = await fetch("/api/auth/session-timeout", {
        credentials: "include",
      });

      if (response.status === 401) {
        // Not authenticated - user is not logged in
        // Do NOT call logout() here - just silently return
        // This prevents the infinite loop on the login page
        isAuthenticatedRef.current = false;
        return;
      }

      if (!response.ok) {
        // Some other error - don't trigger logout
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
  }, [logout, location]);

  useEffect(() => {
    // Don't run session timeout logic on the login page
    if (location === "/login") {
      setShowWarning(false);
      return;
    }

    let lastActivity = Date.now();
    let sessionStart = Date.now();
    let checkInterval: NodeJS.Timeout;

    // Mark as potentially authenticated when not on login page
    isAuthenticatedRef.current = true;

    // Track user activity (throttled)
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

      // Extend session on server (throttled internally)
      extendSession();
    };

    // Listen for user interactions
    const events = [
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    events.forEach(event => {
      window.addEventListener(event, resetActivity, { passive: true });
    });

    // Check session status periodically
    checkInterval = setInterval(() => {
      // Skip checks if not authenticated
      if (!isAuthenticatedRef.current) {
        return;
      }

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

    // Initial activity timestamp (throttled)
    resetActivity();

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetActivity);
      });
      clearInterval(checkInterval);
    };
  }, [logout, extendSession, toast, checkSessionTimeout, location]);

  return {
    showWarning,
    timeRemaining,
    extendSession,
  };
}
