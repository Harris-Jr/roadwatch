import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AppUser } from "./types";
import { clearStoredAuth, getStoredAuth, setStoredAuth, type StoredAuth } from "./api";

interface AuthContextValue {
  user: AppUser | null;
  token: string | null;
  ready: boolean; // false until we've checked localStorage, avoids a flash of "logged out"
  signIn: (auth: StoredAuth) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = getStoredAuth();
    if (stored) {
      setUser(stored.user);
      setToken(stored.token);
    }
    setReady(true);
  }, []);

  const signIn = (auth: StoredAuth) => {
    setStoredAuth(auth);
    setUser(auth.user);
    setToken(auth.token);
  };

  const signOut = () => {
    clearStoredAuth();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, ready, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
