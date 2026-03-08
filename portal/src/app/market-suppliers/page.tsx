'use client';

import { useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';

type MarketContractor = {
  userId: number;
  email: string;
  contractorType: 'TAXED' | 'UNTAXED';
  companyName: string;
  ownerName: string;
  ownerPhotoUrl: string;
  about: string;
  servicesText: string;
  referenceCount: number;
  latestMedia: { id: number; url: string; type: 'photo' | 'video'; caption?: string | null } | null;
};

type ChatMessage = {
  id: number;
  projectId: number | null;
  fromUserId: number;
  toUserId: number;
  text: string;
  createdAt: string;
  readBy?: number[];
};

function formatDateTime(v: string) {
  const d = new Date(v);
  return d.toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MarketSuppliersPage() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<MarketContractor[]>([]);
  const [chatSupplier, setChatSupplier] = useState<MarketContractor | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatLastLoginAt, setChatLastLoginAt] = useState<string | null>(null);

  const canUse = useMemo(() => user?.role === 'investor', [user?.role]);

  useEffect(() => {
    if (!token || !canUse) return;
    let canceled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/auth/market-contractors`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ([]));
        if (!res.ok) throw new Error(data?.message ?? 'Tedarikci listesi getirilemedi');
        if (!canceled) setSuppliers(Array.isArray(data) ? (data as MarketContractor[]) : []);
      } catch (e: unknown) {
        if (!canceled) setError(e instanceof Error ? e.message : 'Tedarikci listesi getirilemedi');
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    run();
    return () => {
      canceled = true;
    };
  }, [token, canUse]);

  async function loadChat(supplierUserId: number) {
    if (!token) return;
    setChatLoading(true);
    setChatError(null);
    try {
      const res = await fetch(`${API_BASE}/messages/user/${supplierUserId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(data?.message ?? 'Mesajlar getirilemedi');
      setChatMessages(Array.isArray(data) ? (data as ChatMessage[]) : []);
    } catch (e: unknown) {
      setChatError(e instanceof Error ? e.message : 'Mesajlar getirilemedi');
    } finally {
      setChatLoading(false);
    }
  }

  function openChat(supplier: MarketContractor) {
    setChatSupplier(supplier);
    setChatText('');
    setChatError(null);
    setChatLastLoginAt(null);
    void loadChat(supplier.userId);
    if (token) {
      fetch(`${API_BASE}/messages/user-meta/${supplier.userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json().catch(() => ({})))
        .then((data) => setChatLastLoginAt(data?.lastLoginAt ?? null))
        .catch(() => null);
    }
  }

  async function onSendChat() {
    if (!token || !chatSupplier || !chatText.trim()) return;
    setChatError(null);
    try {
      const res = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: null,
          toUserId: chatSupplier.userId,
          text: chatText.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Mesaj gonderilemedi');
      setChatText('');
      await loadChat(chatSupplier.userId);
    } catch (e: unknown) {
      setChatError(e instanceof Error ? e.message : 'Mesaj gonderilemedi');
    }
  }

  if (!canUse) {
    return (
      <div className="min-h-screen bg-gray-100">
        <TopBar />
        <main className="mx-auto max-w-7xl p-6">
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
      <main className="mx-auto max-w-7xl p-3 sm:p-6">
        <section className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm overflow-hidden">
          <h1 className="text-2xl font-semibold">Piyasadaki Firmalar</h1>
          <p className="mt-1 text-sm text-gray-600">
            Kayitli vergi levhali ve vergi levhasiz tum tedarikciler.
          </p>
          {loading && <div className="mt-3 text-sm text-gray-500">Yukleniyor...</div>}
          {error && (
            <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {suppliers.map((s) => (
              <article key={s.userId} className="rounded-lg border p-3 overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/market-suppliers/${s.userId}`} className="font-medium underline break-words">
                      {s.companyName || s.ownerName || s.email}
                    </Link>
                    <div className="text-xs text-gray-600 break-all">{s.email}</div>
                  </div>
                  <span className="shrink-0 rounded border px-2 py-0.5 text-xs">
                    {s.contractorType === 'TAXED' ? 'Vergi levhali' : 'Vergi levhasiz'}
                  </span>
                </div>
                {s.servicesText && <div className="mt-2 text-sm">Meslek/Is: {s.servicesText}</div>}
                {s.about && <div className="mt-1 text-sm text-gray-700 break-words">{s.about}</div>}
                <div className="mt-2 text-xs text-gray-600">Referans sayisi: {s.referenceCount}</div>
                {s.ownerPhotoUrl && (
                  <Link href={`/market-suppliers/${s.userId}`}>
                    <img
                      src={`${API_BASE}${s.ownerPhotoUrl}`}
                      alt="Tedarikci"
                      className="mt-2 h-24 w-24 rounded object-cover border"
                    />
                  </Link>
                )}
                <div className="mt-3">
                  <button
                    type="button"
                    className="rounded border px-3 py-1 text-xs"
                    onClick={() => openChat(s)}
                  >
                    Firmaya Mesaj At
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {chatSupplier && (
          <aside className="fixed right-3 top-20 z-50 w-[calc(100vw-1.5rem)] max-w-[360px] rounded-lg border bg-white p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Firma ile sohbet</div>
                <div className="text-xs text-gray-600">{chatSupplier.companyName || chatSupplier.ownerName || chatSupplier.email}</div>
                <div className="text-[11px] text-gray-500">
                  Son giris: {chatLastLoginAt ? formatDateTime(chatLastLoginAt) : '-'}
                </div>
              </div>
              <button type="button" className="rounded border px-2 py-0.5 text-xs" onClick={() => setChatSupplier(null)}>
                X
              </button>
            </div>

            {chatError && <div className="mb-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{chatError}</div>}

            <div className="h-64 overflow-y-auto rounded border p-2">
              {chatLoading ? (
                <div className="text-xs text-gray-500">Yukleniyor...</div>
              ) : (
                <div className="space-y-2">
                  {chatMessages.map((m) => {
                    const mine = m.fromUserId === user?.sub;
                    const isReadByOther = Boolean(mine && (m.readBy ?? []).includes(chatSupplier.userId));
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded px-2 py-1 text-xs ${mine ? 'bg-black text-white' : 'bg-gray-100'}`}>
                          <div>{m.text}</div>
                          <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? 'text-gray-200' : 'text-gray-500'}`}>
                            <span>{formatDateTime(m.createdAt)}</span>
                            {mine && <span className={isReadByOther ? 'text-sky-400' : 'text-gray-300'}>{isReadByOther ? '✓✓' : '✓'}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-2 flex gap-2">
              <input
                className="flex-1 rounded border px-2 py-1 text-xs"
                placeholder="Mesaj yazin..."
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void onSendChat();
                  }
                }}
              />
              <button type="button" onClick={() => void onSendChat()} className="rounded bg-black px-3 py-1 text-xs text-white">
                Gonder
              </button>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
