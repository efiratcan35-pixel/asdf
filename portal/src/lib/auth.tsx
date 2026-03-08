'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000';

export type UserRole = 'admin' | 'investor' | 'contractor';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ContractorType = 'TAXED' | 'UNTAXED';

export type AuthUser = {
  sub: number; // jwt payload
  email: string;
  role: UserRole;
  status?: UserStatus;
  contractorType?: ContractorType;
  iat?: number;
  exp?: number;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  login: (
    identifier: string,
    password: string,
    method?: 'email' | 'phone',
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
  register: (payload: {
    email?: string;
    phone?: string;
    password: string;
    role: UserRole;
    // investor
    investorCompanyName?: string;
    contactName?: string;
    investorPhone?: string;
    officialCompanyEmail?: string;
    investmentSummary?: string;
    // contractor
    contractorType?: 'TAXED' | 'UNTAXED';
    contractorCompanyName?: string;
    ownerName?: string;
    ownerPhotoUrl?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getStoredToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = getStoredToken();
    setToken(t);
    setLoading(false);
  }, []);

  const refreshMe = async () => {
    const t = token || getStoredToken();
    if (!t) {
      setUser(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const me = (await res.json()) as AuthUser;
      setUser(me);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    // token değişince "me" yenile
    if (!token) {
      setUser(null);
      return;
    }
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login: AuthContextValue['login'] = async (identifier, password, method = 'email') => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, method }),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        const msg = (data && (data.message || data.error)) || 'Login failed';
        return { ok: false, error: String(msg) };
      }

      const accessToken = (data as any)?.access_token;
      if (!accessToken) return { ok: false, error: 'Token gelmedi' };

      localStorage.setItem('access_token', accessToken);
      setToken(accessToken);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Network error' };
    }
  };

  const register: AuthContextValue['register'] = async (payload) => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        const msg = (data && (data.message || data.error)) || 'Register failed';
        return { ok: false, error: String(msg) };
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Network error' };
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    setToken(null);
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({ token, user, loading, login, logout, register, refreshMe }),
    [token, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
