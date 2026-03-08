'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';

export default function InvestorProfilePage() {
  const { token, user } = useAuth();
  const canUse = useMemo(() => user?.role === 'investor', [user?.role]);

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [officialCompanyEmail, setOfficialCompanyEmail] = useState('');
  const [investmentSummary, setInvestmentSummary] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !canUse) return;
    let canceled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/auth/investor-profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message ?? 'Profil getirilemedi');
        if (canceled) return;
        setCompanyName(String(data?.companyName ?? ''));
        setContactName(String(data?.contactName ?? ''));
        setPhone(String(data?.phone ?? ''));
        setOfficialCompanyEmail(String(data?.officialCompanyEmail ?? ''));
        setInvestmentSummary(String(data?.investmentSummary ?? ''));
      } catch (e: unknown) {
        if (!canceled) setError(e instanceof Error ? e.message : 'Profil getirilemedi');
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    run();
    return () => {
      canceled = true;
    };
  }, [token, canUse]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`${API_BASE}/auth/investor-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyName,
          contactName,
          phone,
          officialCompanyEmail,
          investmentSummary,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Profil kaydedilemedi');
      setOkMsg('Profil bilgileri guncellendi.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Profil kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  if (!canUse) {
    return (
      <div className="min-h-screen bg-gray-100">
        <TopBar />
        <main className="mx-auto max-w-5xl p-6">
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-700">
            Bu sayfa yalnizca investor uyeler icin aciktir.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <TopBar />
      <main className="mx-auto max-w-5xl p-6 space-y-4">
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">Investor Profil</h1>
            <Link href="/dashboard/investor/projects" className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
              Projelerim
            </Link>
          </div>

          {loading && <div className="mt-3 text-sm text-gray-500">Yukleniyor...</div>}
          {error && <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {okMsg && <div className="mt-3 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{okMsg}</div>}

          <form onSubmit={onSave} className="mt-5 space-y-3">
            <div>
              <label className="text-sm font-medium">Sirket adi</label>
              <input className="mt-1 w-full rounded border px-3 py-2 text-sm" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Irtibat kisisi</label>
              <input className="mt-1 w-full rounded border px-3 py-2 text-sm" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Telefon</label>
              <input className="mt-1 w-full rounded border px-3 py-2 text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Official sirket email</label>
              <input className="mt-1 w-full rounded border px-3 py-2 text-sm" value={officialCompanyEmail} onChange={(e) => setOfficialCompanyEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Faaliyet alani / Yatirim ozeti</label>
              <textarea className="mt-1 w-full rounded border px-3 py-2 text-sm" rows={4} value={investmentSummary} onChange={(e) => setInvestmentSummary(e.target.value)} />
            </div>
            <button type="submit" disabled={saving} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60">
              {saving ? 'Kaydediliyor...' : 'Profili Kaydet'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
