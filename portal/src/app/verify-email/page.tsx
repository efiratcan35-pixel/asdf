'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [token, setToken] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') ?? '');
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!token) {
        setError('Dogrulama tokeni bulunamadi.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message ?? 'Email dogrulanamadi');
        if (!cancelled) setOk(true);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Email dogrulanamadi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
      <div className="w-full max-w-md rounded-xl bg-white border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Email Dogrulama</h1>
        {loading && <p className="mt-4 text-sm text-gray-600">Dogrulanıyor...</p>}
        {!loading && ok && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            Email dogrulandi. Giris sayfasina yonlendiriliyorsunuz...
          </div>
        )}
        {!loading && error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="mt-4">
          <Link className="text-sm underline" href="/login">
            Giris sayfasina don
          </Link>
        </div>
      </div>
      {ok && (
        <AutoRedirect onGo={() => router.push('/login')} />
      )}
    </div>
  );
}

function AutoRedirect({ onGo }: { onGo: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onGo, 1500);
    return () => window.clearTimeout(id);
  }, [onGo]);
  return null;
}
