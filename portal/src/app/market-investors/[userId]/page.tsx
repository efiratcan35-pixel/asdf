'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/lib/auth';
import type { BuildingType } from '@/components/ConfiguratorCanvas';

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

type MarketProject = {
  id: number;
  name: string | null;
  buildingType: BuildingType;
  lengthM: number;
  widthM: number;
  heightM: number;
  investor?: {
    id: number;
    email: string;
  };
};

function formatNum(v: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(v);
}

export default function MarketInvestorDetailPage() {
  const { token, user } = useAuth();
  const params = useParams<{ userId: string }>();
  const userId = Number(params?.userId);
  const canUse = useMemo(() => Boolean(user), [user]);

  const [detail, setDetail] = useState<MarketInvestor | null>(null);
  const [projects, setProjects] = useState<MarketProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !canUse || !Number.isInteger(userId)) return;
    let canceled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [detailRes, projectsRes] = await Promise.all([
          fetch(`${API_BASE}/auth/market-investors/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/projects/market`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const detailData = await detailRes.json().catch(() => ({}));
        const projectsData = await projectsRes.json().catch(() => ([]));
        if (!detailRes.ok) throw new Error(detailData?.message ?? 'Investor detayi getirilemedi');
        if (!projectsRes.ok) throw new Error('Investor projeleri getirilemedi');

        if (!canceled) {
          setDetail(detailData as MarketInvestor);
          setProjects(
            (Array.isArray(projectsData) ? (projectsData as MarketProject[]) : []).filter(
              (p) => p.investor?.id === userId,
            ),
          );
        }
      } catch (e: unknown) {
        if (!canceled) setError(e instanceof Error ? e.message : 'Investor detayi getirilemedi');
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    void run();
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
              <h1 className="text-2xl font-semibold">{detail.companyName || detail.contactName || detail.email}</h1>
              <div className="mt-1 text-sm text-gray-600">{detail.email}</div>

              <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
                {detail.contactName && <div>Yetkili: {detail.contactName}</div>}
                {detail.phone && <div>Telefon: {detail.phone}</div>}
                {detail.officialCompanyEmail && <div>Sirket maili: {detail.officialCompanyEmail}</div>}
                <div>Durum: {detail.marketAccessStatus}</div>
              </div>

              {detail.investmentSummary && (
                <div className="mt-4 rounded border bg-gray-50 p-3 text-sm text-gray-700">
                  <span className="font-medium">Yatirim ozeti:</span> {detail.investmentSummary}
                </div>
              )}

              <div className="mt-6">
                <h2 className="font-semibold">Projeleri</h2>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  {projects.length === 0 ? (
                    <div className="rounded border p-3 text-sm text-gray-500">Bu investor icin gorunen proje yok.</div>
                  ) : (
                    projects.map((p) => (
                      <article key={p.id} className="rounded-lg border p-3">
                        <div className="font-medium">{p.name ?? `Proje ${p.id}`}</div>
                        <div className="mt-1 text-sm text-gray-600">
                          {formatNum(p.lengthM)} x {formatNum(p.widthM)} x {formatNum(p.heightM)} m
                        </div>
                        <div className="mt-1 text-xs text-gray-500">{p.buildingType}</div>
                        <div className="mt-3">
                          <Link href={`/market-jobs/${p.id}`} className="rounded border px-3 py-1 text-xs">
                            Proje Detayi
                          </Link>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
