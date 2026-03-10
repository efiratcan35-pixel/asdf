'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/lib/auth';
import ConfiguratorCanvas, { type BuildingType } from '@/components/ConfiguratorCanvas';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';

type MarketProject = {
  id: number;
  name: string | null;
  buildingType: BuildingType;
  lengthM: number;
  widthM: number;
  heightM: number;
  hallCount: number;
  baySpacingM: number;
  doorCount: number;
  hasCraneBeam?: boolean;
  hasLoadingRamp?: boolean;
  rampCount?: number;
  investorNote?: string | null;
  locationText?: string | null;
  budgetTry?: number | null;
  investor?: {
    id: number;
    email: string;
  };
  createdAt: string;
  offerCount?: number;
  photos?: { id: number; url: string; caption?: string | null }[];
};

type ChatMessage = {
  id: number;
  projectId: number;
  fromUserId: number;
  toUserId: number;
  text: string;
  createdAt: string;
  readBy?: number[];
  updatedAt?: string;
};

const CONTEXT_MENU_WIDTH = 140;
const CONTEXT_MENU_HEIGHT = 96;
const CONTEXT_MENU_MARGIN = 12;

function formatNum(v: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(v);
}

function formatTry(v: number | null | undefined) {
  if (v === null || typeof v === 'undefined') return '-';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(v);
}

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

function photoSrc(url: string) {
  return url.startsWith('http://') || url.startsWith('https://') ? url : `${API_BASE}${url}`;
}

export default function MarketJobsPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<MarketProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open3DIds, setOpen3DIds] = useState<Set<number>>(new Set());

  const [chatProject, setChatProject] = useState<MarketProject | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatLastLoginAt, setChatLastLoginAt] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ messageId: number; x: number; y: number } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  const [offerProject, setOfferProject] = useState<MarketProject | null>(null);
  const [offerWorkItem, setOfferWorkItem] = useState('');
  const [offerPriceTry, setOfferPriceTry] = useState('');
  const [offerSaving, setOfferSaving] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; caption?: string | null } | null>(null);

  const canSee = useMemo(() => Boolean(user), [user]);
  const canActAsContractor = useMemo(
    () => user?.role === 'contractor' || Boolean(user?.isDualMember),
    [user?.isDualMember, user?.role],
  );

  useEffect(() => {
    if (!token || !canSee) return;

    let canceled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/projects/market`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ([]));
        if (!res.ok) throw new Error(data?.message ?? 'Piyasadaki isler getirilemedi');
        if (!canceled) setItems(Array.isArray(data) ? data : []);
      } catch (e: unknown) {
        if (!canceled) setError(e instanceof Error ? e.message : 'Piyasadaki isler getirilemedi');
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    run();
    return () => {
      canceled = true;
    };
  }, [token, canSee]);

  useEffect(() => {
    if (!menu) return;
    const handleClose = () => setMenu(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [menu]);

  function openMessageMenu(messageId: number, x: number, y: number) {
    if (typeof window === 'undefined') {
      setMenu({ messageId, x, y });
      return;
    }
    const maxX = Math.max(CONTEXT_MENU_MARGIN, window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_MARGIN);
    const maxY = Math.max(CONTEXT_MENU_MARGIN, window.innerHeight - CONTEXT_MENU_HEIGHT - CONTEXT_MENU_MARGIN);
    setMenu({
      messageId,
      x: Math.min(Math.max(CONTEXT_MENU_MARGIN, x), maxX),
      y: Math.min(Math.max(CONTEXT_MENU_MARGIN, y), maxY),
    });
  }

  function toggle3D(projectId: number) {
    setOpen3DIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  async function openInvestorChat(project: MarketProject) {
    if (!token || !project.investor?.id) return;
    setChatProject(project);
    setChatText('');
    setChatError(null);
    setChatLastLoginAt(null);
    setChatLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/messages/project/${project.id}/user/${project.investor.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(data?.message ?? 'Mesajlar getirilemedi');
      setChatMessages(Array.isArray(data) ? (data as ChatMessage[]) : []);
    } catch (e: unknown) {
      setChatError(e instanceof Error ? e.message : 'Mesajlar getirilemedi');
    } finally {
      setChatLoading(false);
    }
    fetch(`${API_BASE}/messages/user-meta/${project.investor.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => setChatLastLoginAt(data?.lastLoginAt ?? null))
      .catch(() => null);
  }

  async function sendChatMessage() {
    if (!token || !chatProject || !chatProject.investor?.id || !chatText.trim()) return;
    setChatError(null);
    try {
      const res = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: chatProject.id,
          toUserId: chatProject.investor.id,
          text: chatText.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Mesaj gonderilemedi');
      setChatText('');
      await openInvestorChat(chatProject);
    } catch (e: unknown) {
      setChatError(e instanceof Error ? e.message : 'Mesaj gonderilemedi');
    }
  }

  async function onDeleteMessage(messageId: number) {
    if (!token || !chatProject) return;
    const ok = window.confirm('Bu mesaj silinsin mi?');
    if (!ok) return;
    try {
      const res = await fetch(`${API_BASE}/messages/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Mesaj silinemedi');
      setMenu(null);
      await openInvestorChat(chatProject);
    } catch (e: unknown) {
      setChatError(e instanceof Error ? e.message : 'Mesaj silinemedi');
    }
  }

  async function onSaveMessageEdit() {
    if (!token || !chatProject || !editingMessageId || !editingText.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/messages/${editingMessageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: editingText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Mesaj duzenlenemedi');
      setEditingMessageId(null);
      setEditingText('');
      setMenu(null);
      await openInvestorChat(chatProject);
    } catch (e: unknown) {
      setChatError(e instanceof Error ? e.message : 'Mesaj duzenlenemedi');
    }
  }

  function openOfferModal(project: MarketProject) {
    setOfferProject(project);
    setOfferWorkItem('');
    setOfferPriceTry('');
    setOfferError(null);
  }

  async function submitOffer() {
    if (!token || !offerProject) return;
    setOfferSaving(true);
    setOfferError(null);
    try {
      const res = await fetch(`${API_BASE}/projects/${offerProject.id}/offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workItem: offerWorkItem,
          priceText: offerPriceTry,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Teklif kaydedilemedi');

      setItems((prev) =>
        prev.map((p) => (p.id === offerProject.id ? { ...p, offerCount: (p.offerCount ?? 0) + 1 } : p)),
      );
      setOfferProject(null);
    } catch (e: unknown) {
      setOfferError(e instanceof Error ? e.message : 'Teklif kaydedilemedi');
    } finally {
      setOfferSaving(false);
    }
  }

  if (!canSee) {
    return (
      <div className="min-h-screen bg-gray-100">
        <TopBar />
        <main className="mx-auto max-w-6xl p-6">
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-700">
            Bu sayfa giris yapan kullanicilar icin aciktir.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {menu && (
        <div
          className="fixed z-[90] w-[140px] max-w-[calc(100vw-24px)] rounded-md border bg-white p-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            type="button"
            className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-50"
            onClick={() => {
              const msg = chatMessages.find((m) => m.id === menu.messageId);
              if (!msg) return;
              setEditingMessageId(msg.id);
              setEditingText(msg.text);
              setMenu(null);
            }}
          >
            Duzenle
          </button>
          <button
            type="button"
            className="block w-full rounded px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
            onClick={() => void onDeleteMessage(menu.messageId)}
          >
            Sil
          </button>
        </div>
      )}
      <TopBar />
      <main className="mx-auto max-w-7xl p-3 sm:p-6 space-y-4">
        <section className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Piyasadaki Isler</h1>
          <p className="mt-1 text-sm text-gray-600">Investorlarin girdigi projeler burada listelenir.</p>
        </section>

        {loading && <div className="text-sm text-gray-500">Yukleniyor...</div>}
        {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <section className="grid gap-4 md:grid-cols-2">
          {items.map((p) => {
            const is3DOpen = open3DIds.has(p.id);
            return (
              <article key={p.id} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{p.name ?? `Proje ${p.id}`}</h2>
                    <div className="mt-1 text-sm text-gray-600">
                      Yatirimci: {p.investor?.email ?? '-'} • Butce: {formatTry(p.budgetTry)}
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-sm text-gray-600">
                  {formatNum(p.lengthM)} x {formatNum(p.widthM)} x {formatNum(p.heightM)} m • {p.buildingType}
                </div>
                <div className="mt-1 text-xs text-gray-500">Bu projeye gelen teklif sayisi: {p.offerCount ?? 0}</div>

                {(p.photos ?? []).length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(p.photos ?? []).slice(0, 4).map((ph) => (
                      <button
                        key={ph.id}
                        type="button"
                        className="overflow-hidden rounded border bg-gray-100"
                        onClick={() => setPreviewPhoto({ url: photoSrc(ph.url), caption: ph.caption })}
                      >
                        <img
                          src={photoSrc(ph.url)}
                          alt={ph.caption ?? 'Proje fotografi'}
                          className="h-24 w-full object-contain"
                        />
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="rounded border px-3 py-1 text-xs" onClick={() => toggle3D(p.id)}>
                    {is3DOpen ? '3D Configurator Kapat' : '3D Configurator Ac'}
                  </button>
                  <Link href={`/market-jobs/${p.id}`} className="rounded border px-3 py-1 text-xs">
                    Proje Detayi
                  </Link>
                  {canActAsContractor && (
                    <>
                      <button type="button" className="rounded border px-3 py-1 text-xs" onClick={() => openInvestorChat(p)}>
                        Yatirimciya Mesaj At
                      </button>
                      <button type="button" className="rounded border px-3 py-1 text-xs" onClick={() => openOfferModal(p)}>
                        Teklif Ver
                      </button>
                    </>
                  )}
                </div>

                {is3DOpen && (
                  <div className="mt-3 h-56 overflow-hidden rounded border">
                    <ConfiguratorCanvas
                      buildingType={p.buildingType}
                      lengthM={p.lengthM}
                      widthM={p.widthM}
                      heightM={p.heightM}
                      baySpacingM={p.baySpacingM}
                      hallCount={p.hallCount}
                      hasCraneBeam={Boolean(p.hasCraneBeam)}
                    />
                  </div>
                )}
              </article>
            );
          })}
        </section>

        {chatProject && canActAsContractor && (
          <aside className="fixed right-2 top-20 z-50 w-[calc(100vw-1rem)] max-w-[360px] rounded-lg border bg-white p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Yatirimci ile sohbet</div>
                <div className="text-xs text-gray-600">
                  {chatProject.investor?.email ?? '-'} • {chatProject.name ?? `Proje ${chatProject.id}`}
                </div>
                <div className="text-[11px] text-gray-500">
                  Son giris: {chatLastLoginAt ? formatDateTime(chatLastLoginAt) : '-'}
                </div>
              </div>
              <button
                type="button"
                className="rounded border px-2 py-0.5 text-xs"
                onClick={() => setChatProject(null)}
              >
                X
              </button>
            </div>

            {chatError && (
              <div className="mb-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {chatError}
              </div>
            )}

            <div className="h-56 sm:h-64 overflow-y-auto rounded border p-2">
              {chatLoading ? (
                <div className="text-xs text-gray-500">Yukleniyor...</div>
              ) : (
                <div className="space-y-2">
                  {chatMessages.map((m) => {
                    const mine = m.fromUserId === user?.sub;
                    const isReadByOther = Boolean(
                      mine && chatProject?.investor?.id && (m.readBy ?? []).includes(chatProject.investor.id),
                    );
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] rounded px-2 py-1 text-xs ${mine ? 'bg-black text-white' : 'bg-gray-100'}`}
                          onContextMenu={(e) => {
                            if (!mine) return;
                            e.preventDefault();
                            openMessageMenu(m.id, e.clientX, e.clientY);
                          }}
                        >
                          {editingMessageId === m.id ? (
                            <div className="space-y-2 rounded bg-white p-2">
                              <textarea
                                className="w-full rounded border bg-white px-2 py-1 text-sm text-black"
                                rows={3}
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  className="rounded border bg-white px-2 py-1 text-xs text-black hover:bg-gray-50"
                                  onClick={() => {
                                    setEditingMessageId(null);
                                    setEditingText('');
                                  }}
                                >
                                  Iptal
                                </button>
                                <button
                                  type="button"
                                  className="rounded border bg-black px-2 py-1 text-xs text-white hover:opacity-90"
                                  onClick={() => void onSaveMessageEdit()}
                                >
                                  Kaydet
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>{m.text}</div>
                          )}
                          <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? 'text-gray-200' : 'text-gray-500'}`}>
                            <span>{formatDateTime(m.createdAt)}</span>
                            {Boolean(m.updatedAt) && <span>(duzenlendi)</span>}
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
                    void sendChatMessage();
                  }
                }}
              />
              <button type="button" onClick={() => void sendChatMessage()} className="rounded bg-black px-3 py-1 text-xs text-white">
                Gonder
              </button>
            </div>
          </aside>
        )}

        {offerProject && canActAsContractor && (
          <aside className="fixed left-1/2 top-20 z-50 w-[calc(100vw-1rem)] max-w-[420px] -translate-x-1/2 rounded-lg border bg-white p-3 sm:p-4 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Teklif Ver</div>
                <div className="text-xs text-gray-600">{offerProject.name ?? `Proje ${offerProject.id}`}</div>
              </div>
              <button type="button" className="rounded border px-2 py-0.5 text-xs" onClick={() => setOfferProject(null)}>
                X
              </button>
            </div>

            {offerError && (
              <div className="mb-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{offerError}</div>
            )}

            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium">Teklif edilen uygulama</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={offerWorkItem}
                  onChange={(e) => setOfferWorkItem(e.target.value)}
                  placeholder="Orn: Cati panel montaji"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Fiyat</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={offerPriceTry}
                  onChange={(e) => setOfferPriceTry(e.target.value)}
                  placeholder="Orn: 250000 + KDV dahil"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded bg-black px-3 py-1.5 text-xs text-white disabled:opacity-60"
                disabled={offerSaving}
                onClick={() => void submitOffer()}
              >
                {offerSaving ? 'Kaydediliyor...' : 'Teklifi Gonder'}
              </button>
              <button type="button" className="rounded border px-3 py-1.5 text-xs" onClick={() => setOfferProject(null)}>
                Iptal
              </button>
            </div>
          </aside>
        )}
        {previewPhoto && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
            onClick={() => setPreviewPhoto(null)}
          >
            <div className="max-h-[90vh] max-w-[90vw]">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.caption ?? 'Proje fotografi'}
                className="max-h-[85vh] max-w-[90vw] rounded border border-white bg-white object-contain"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
