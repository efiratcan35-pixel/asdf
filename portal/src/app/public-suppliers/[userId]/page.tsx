'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import TopBar from '@/components/TopBar';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';

type PublicSupplierDetail = {
  userId: number;
  email: string;
  contractorType: 'TAXED' | 'UNTAXED';
  companyName: string;
  ownerName: string;
  ownerPhotoUrl: string;
  about: string;
  servicesText: string;
  references: Array<{
    id: number;
    personName: string;
    companyName: string;
    title: string;
    phone: string;
    email: string;
  }>;
  media: Array<{
    id: number;
    type: 'photo' | 'video';
    url: string;
    caption: string;
  }>;
};

function toApiUrl(path: string) {
  return path.startsWith('http://') || path.startsWith('https://') ? path : `${API_BASE}${path}`;
}

export default function PublicSupplierDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = Number(params?.userId);
  const [item, setItem] = useState<PublicSupplierDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(userId)) return;
    let cancelled = false;

    const run = async () => {
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/auth/public-market-contractors/${userId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message ?? 'Firma detayi getirilemedi');
        if (!cancelled) setItem(data as PublicSupplierDetail);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Firma detayi getirilemedi');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="min-h-screen bg-gray-100">
      <TopBar />
      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        <section className="rounded-xl border bg-white p-4 sm:p-6">
          <div className="mb-3">
            <Link href="/" className="text-sm underline">
              Ana sayfaya don
            </Link>
          </div>
          {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {item && (
            <>
              <h1 className="text-xl font-semibold">{item.companyName || item.ownerName || item.email}</h1>
              <div className="mt-1 text-sm text-gray-600">{item.email}</div>
              <div className="mt-1 text-sm text-gray-700">
                {item.contractorType === 'TAXED' ? 'Vergi levhali' : 'Vergi levhasiz'}
              </div>
              {item.servicesText && <div className="mt-2 text-sm">Meslek/Is: {item.servicesText}</div>}
              {item.about && <div className="mt-1 text-sm text-gray-700">{item.about}</div>}

              {item.ownerPhotoUrl && (
                <img
                  src={toApiUrl(item.ownerPhotoUrl)}
                  alt="Firma"
                  className="mt-3 h-28 w-28 rounded border object-cover"
                />
              )}

              {item.media.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {item.media.slice(0, 9).map((m) => (
                    <img
                      key={m.id}
                      src={toApiUrl(m.url)}
                      alt={m.caption || 'Firma medyasi'}
                      className="h-32 w-full rounded border object-cover"
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

