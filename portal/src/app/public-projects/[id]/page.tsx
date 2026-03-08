'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import TopBar from '@/components/TopBar';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';

type PublicProject = {
  id: number;
  name: string | null;
  buildingType: string;
  lengthM: number;
  widthM: number;
  heightM: number;
  hallCount: number;
  baySpacingM: number;
  doorCount: number;
  investorNote?: string | null;
  locationText?: string | null;
  budgetTry?: number | null;
  photos?: { id: number; url: string; caption?: string | null }[];
};

function toApiUrl(path: string) {
  return path.startsWith('http://') || path.startsWith('https://') ? path : `${API_BASE}${path}`;
}

export default function PublicProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const [item, setItem] = useState<PublicProject | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(id)) return;
    let cancelled = false;

    const run = async () => {
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/public/projects/market/${id}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message ?? 'Proje detayi getirilemedi');
        if (!cancelled) setItem(data as PublicProject);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Proje detayi getirilemedi');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-gray-100">
      <TopBar />
      <main className="mx-auto max-w-4xl p-4 sm:p-6">
        <section className="rounded-xl border bg-white p-4 sm:p-6">
          <div className="mb-3">
            <Link href="/" className="text-sm underline">
              Ana sayfaya don
            </Link>
          </div>
          {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {item && (
            <>
              <h1 className="text-xl font-semibold">{item.name ?? `Proje ${item.id}`}</h1>
              <div className="mt-2 text-sm text-gray-700">
                {item.lengthM} x {item.widthM} x {item.heightM} m • {item.buildingType}
              </div>
              <div className="mt-1 text-sm text-gray-700">
                Hol: {item.hallCount} • Aks: {item.baySpacingM} m • Kapi: {item.doorCount}
              </div>
              {item.locationText && <div className="mt-1 text-sm">Lokasyon: {item.locationText}</div>}
              {item.investorNote && <div className="mt-1 text-sm">Not: {item.investorNote}</div>}

              {(item.photos ?? []).length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {(item.photos ?? []).map((ph) => (
                    <img
                      key={ph.id}
                      src={toApiUrl(ph.url)}
                      alt={ph.caption ?? 'Proje fotografi'}
                      className="h-36 w-full rounded border object-cover"
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

