'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';

type ContractorDetail = {
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
    createdAt: string;
  }>;
};

export default function MarketSupplierDetailPage() {
  const { token, user } = useAuth();
  const params = useParams<{ userId: string }>();
  const userId = Number(params?.userId);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContractorDetail | null>(null);

  const canUse = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    if (!token || !canUse || !Number.isInteger(userId)) return;
    let canceled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/auth/market-contractors/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message ?? 'Firma detayi getirilemedi');
        if (!canceled) setDetail(data as ContractorDetail);
      } catch (e: unknown) {
        if (!canceled) setError(e instanceof Error ? e.message : 'Firma detayi getirilemedi');
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    run();
    return () => {
      canceled = true;
    };
  }, [token, canUse, userId]);

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
      <main className="mx-auto max-w-7xl p-6">
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          {loading && <div className="text-sm text-gray-500">Yukleniyor...</div>}
          {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          {detail && (
            <>
              <h1 className="text-2xl font-semibold">
                {detail.companyName || detail.ownerName || detail.email}
              </h1>
              <div className="mt-1 text-sm text-gray-600">
                {detail.email} • {detail.contractorType === 'TAXED' ? 'Vergi levhali' : 'Vergi levhasiz'}
              </div>

              {detail.ownerPhotoUrl && (
                <img
                  src={`${API_BASE}${detail.ownerPhotoUrl}`}
                  alt="Profil"
                  className="mt-4 h-36 w-36 rounded object-cover border"
                />
              )}

              {detail.servicesText && (
                <div className="mt-4">
                  <h2 className="font-semibold">Meslek / Is Alani</h2>
                  <p className="text-sm text-gray-700">{detail.servicesText}</p>
                </div>
              )}

              {detail.about && (
                <div className="mt-4">
                  <h2 className="font-semibold">Firma Hakkinda</h2>
                  <p className="text-sm text-gray-700">{detail.about}</p>
                </div>
              )}

              <div className="mt-6">
                <h2 className="font-semibold">Referanslar</h2>
                <div className="mt-2 overflow-x-auto rounded border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left">
                      <tr>
                        <th className="px-2 py-2">Referans ismi</th>
                        <th className="px-2 py-2">Firma</th>
                        <th className="px-2 py-2">Gorev</th>
                        <th className="px-2 py-2">Telefon</th>
                        <th className="px-2 py-2">Mail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.references.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="px-2 py-2">{r.personName}</td>
                          <td className="px-2 py-2">{r.companyName || '-'}</td>
                          <td className="px-2 py-2">{r.title || '-'}</td>
                          <td className="px-2 py-2">{r.phone || '-'}</td>
                          <td className="px-2 py-2">{r.email || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6">
                <h2 className="font-semibold">Medya</h2>
                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                  {detail.media.map((m) => (
                    <div key={m.id} className="rounded border p-1">
                      {m.type === 'video' ? (
                        <video src={`${API_BASE}${m.url}`} controls className="h-28 w-full object-cover" />
                      ) : (
                        <img src={`${API_BASE}${m.url}`} alt="Medya" className="h-28 w-full object-cover" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
