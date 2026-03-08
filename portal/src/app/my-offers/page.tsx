'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';

type MyOffer = {
  id: number;
  projectId: number;
  projectName: string | null;
  workItem: string;
  priceText: string;
  createdAt: string;
};

function formatDateTime(v: string) {
  return new Date(v).toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MyOffersPage() {
  const { token, user } = useAuth();
  const canUse = useMemo(() => user?.role === 'contractor', [user?.role]);
  const [items, setItems] = useState<MyOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !canUse) return;
    let canceled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/projects/offers/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ([]));
        if (!res.ok) throw new Error(data?.message ?? 'Teklifler getirilemedi');
        if (!canceled) setItems(Array.isArray(data) ? (data as MyOffer[]) : []);
      } catch (e: unknown) {
        if (!canceled) setError(e instanceof Error ? e.message : 'Teklifler getirilemedi');
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    run();
    return () => {
      canceled = true;
    };
  }, [token, canUse]);

  if (!canUse) {
    return (
      <div className="min-h-screen bg-gray-100">
        <TopBar />
        <main className="mx-auto max-w-6xl p-6">
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-700">
            Bu sayfa yalnizca taseron/yuklenici uyeler icin aciktir.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <TopBar />
      <main className="mx-auto max-w-6xl p-6 space-y-4">
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Tekliflerim</h1>
          <p className="mt-1 text-sm text-gray-600">Verdigin tum teklifler burada listelenir.</p>
        </section>

        {loading && <div className="text-sm text-gray-500">Yukleniyor...</div>}
        {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <section className="space-y-3">
          {items.map((o) => (
            <article key={o.id} className="rounded-lg border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{o.projectName ?? `Proje ${o.projectId}`}</div>
                  <div className="text-xs text-gray-500">{formatDateTime(o.createdAt)}</div>
                </div>
                <Link href={`/market-jobs/${o.projectId}`} className="rounded border px-3 py-1 text-xs">
                  Proje Detayi
                </Link>
              </div>
              <div className="mt-2 text-sm">Is kalemi: {o.workItem}</div>
              <div className="mt-1 text-sm">Fiyat: {o.priceText}</div>
            </article>
          ))}
          {!loading && items.length === 0 && (
            <div className="rounded border bg-white p-4 text-sm text-gray-600">Henuz teklif vermedin.</div>
          )}
        </section>
      </main>
    </div>
  );
}
