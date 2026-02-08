import React, { createContext, useContext, useState, useEffect } from "react";
import { User, Role } from "./types";

interface LoginResult {
  success: boolean;
  requiresTwoFactor?: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string, totpToken?: string) => Promise<LoginResult>;
  logout: () => void;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: 'include' })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error("Not authenticated");
      })
      .then(userData => {
        setUser(userData);
        localStorage.setItem("truenorth_user", JSON.stringify(userData));
      })
      .catch(() => {
        localStorage.removeItem("truenorth_user");
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const refreshUser = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: 'include' });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        localStorage.setItem("truenorth_user", JSON.stringify(userData));
      }
    } catch {
      // Ignore errors on refresh
    }
  };

  const login = async (username: string, password: string, totpToken?: string): Promise<LoginResult> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ username, password, totpToken }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Login failed" };
      }

      if (data.requiresTwoFactor) {
        return { success: false, requiresTwoFactor: true };
      }

      setUser(data);
      localStorage.setItem("truenorth_user", JSON.stringify(data));
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "Login failed. Please try again." };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: 'include' });
    } catch (e) {}
    setUser(null);
    localStorage.removeItem("truenorth_user");
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
