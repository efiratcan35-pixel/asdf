'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';

type MarketInvestor = {
  userId: number;
  email: string;
  companyName: string;
  contactName: string;
  phone: string;
  officialCompanyEmail: string;
  investmentSummary: string;
  marketAccessStatus: 'PENDING' | 'ACCEPT' | 'REJECT';
};

export default function MarketInvestorsPage() {
  const { token, user } = useAuth();
  const canUse = useMemo(() => Boolean(user), [user]);
  const [items, setItems] = useState<MarketInvestor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !canUse) return;
    let canceled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/auth/market-investors`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ([]));
        if (!res.ok) throw new Error(data?.message ?? 'Investor listesi getirilemedi');
        if (!canceled) setItems(Array.isArray(data) ? (data as MarketInvestor[]) : []);
      } catch (e: unknown) {
        if (!canceled) setError(e instanceof Error ? e.message : 'Investor listesi getirilemedi');
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    void run();
    return () => {
      canceled = true;
    };
  }, [token, canUse]);

  if (!canUse) {
    return (
      <div className="min-h-screen bg-gray-100">
        <TopBar />
        <main className="mx-auto max-w-7xl p-6">
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-700">
            Bu sayfa giris yapan kullanicilar icin aciktir.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <TopBar />
      <main className="mx-auto max-w-7xl p-3 sm:p-6">
        <section className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm overflow-hidden">
          <h1 className="text-2xl font-semibold">Investorler</h1>
          <p className="mt-1 text-sm text-gray-600">Portaldaki tum yatirimci firmalar ve ekipler.</p>

          {loading && <div className="mt-3 text-sm text-gray-500">Yukleniyor...</div>}
          {error && (
            <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {items.map((item) => (
              <article key={item.userId} className="rounded-lg border p-3 overflow-hidden">
                <div className="min-w-0">
                  <Link href={`/market-investors/${item.userId}`} className="font-medium underline break-words">
                    {item.companyName || item.contactName || item.email}
                  </Link>
                  <div className="text-xs text-gray-600 break-all">{item.email}</div>
                </div>
                {item.contactName && (
                  <div className="mt-2 text-sm">
                    Yetkili: {item.contactName}
                  </div>
                )}
                {item.investmentSummary && (
                  <div className="mt-1 text-sm text-gray-700 break-words">{item.investmentSummary}</div>
                )}
                <div className="mt-3">
                  <Link href={`/market-investors/${item.userId}`} className="rounded border px-3 py-1 text-xs">
                    Detayi Gor
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
