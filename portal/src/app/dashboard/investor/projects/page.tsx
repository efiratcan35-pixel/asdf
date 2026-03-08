'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/lib/auth';
import ConfiguratorCanvas, { type BuildingType } from '@/components/ConfiguratorCanvas';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';

type ProjectPhoto = {
  id: number;
  url: string;
  caption?: string | null;
};

type ProjectItem = {
  id: number;
  name: string | null;
  investorNote?: string | null;
  locationText?: string | null;
  budgetTry?: number | null;
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
  photos?: ProjectPhoto[];
  createdAt: string;
  offerCount?: number;
};

type ProjectOffer = {
  id: number;
  projectId: number;
  contractorUserId: number;
  contractorEmail: string;
  workItem: string;
  priceText: string;
  createdAt: string;
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

type EditDraft = {
  name: string;
  buildingType: BuildingType;
  lengthM: number;
  widthM: number;
  heightM: number;
  hallCount: number;
  baySpacingM: number;
  doorCount: number;
  hasCraneBeam: boolean;
  hasLoadingRamp: boolean;
  rampCount: number;
  locationText: string;
  investorNote: string;
  budgetTry: string;
};

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

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

export default function InvestorDashboardPage() {
  const searchParams = useSearchParams();
  const { token, user } = useAuth();

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editConstraintMsg, setEditConstraintMsg] = useState<string | null>(null);
  const [openOffersProjectId, setOpenOffersProjectId] = useState<number | null>(null);
  const [offersByProject, setOffersByProject] = useState<Record<number, ProjectOffer[]>>({});
  const [chatOffer, setChatOffer] = useState<ProjectOffer | null>(null);
  const [chatProject, setChatProject] = useState<ProjectItem | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatLastLoginAt, setChatLastLoginAt] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [buildingType, setBuildingType] = useState<BuildingType>('STEEL_FULL');
  const [lengthM, setLengthM] = useState(60);
  const [widthM, setWidthM] = useState(30);
  const [heightM, setHeightM] = useState(10);
  const [hallCount, setHallCount] = useState(2);
  const [baySpacingM, setBaySpacingM] = useState(6);
  const [doorCount, setDoorCount] = useState(2);
  const [hasCraneBeam, setHasCraneBeam] = useState(false);
  const [hasLoadingRamp, setHasLoadingRamp] = useState(false);
  const [rampCount, setRampCount] = useState(1);

  const [locationText, setLocationText] = useState('');
  const [investorNote, setInvestorNote] = useState('');
  const [budgetTry, setBudgetTry] = useState('');
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [createConstraintMsg, setCreateConstraintMsg] = useState<string | null>(null);

  const canUsePanel = useMemo(() => user?.role === 'investor', [user?.role]);
  const showCreateForm = searchParams.get('new') === '1';

  function resetForm() {
    setName('');
    setBuildingType('STEEL_FULL');
    setLengthM(60);
    setWidthM(30);
    setHeightM(10);
    setHallCount(2);
    setBaySpacingM(6);
    setDoorCount(2);
    setHasCraneBeam(false);
    setHasLoadingRamp(false);
    setRampCount(1);
    setLocationText('');
    setInvestorNote('');
    setBudgetTry('');
    setNewPhotos([]);
    setCreateConstraintMsg(null);
  }

  function startEdit(project: ProjectItem) {
    setEditingProjectId(project.id);
    setEditConstraintMsg(null);
    setEditDraft({
      name: project.name ?? '',
      buildingType: project.buildingType,
      lengthM: project.lengthM,
      widthM: project.widthM,
      heightM: project.heightM,
      hallCount: project.hallCount,
      baySpacingM: project.baySpacingM,
      doorCount: project.doorCount,
      hasCraneBeam: Boolean(project.hasCraneBeam),
      hasLoadingRamp: Boolean(project.hasLoadingRamp),
      rampCount: project.rampCount && project.rampCount > 0 ? project.rampCount : 1,
      locationText: project.locationText ?? '',
      investorNote: project.investorNote ?? '',
      budgetTry: project.budgetTry ? String(project.budgetTry) : '',
    });
  }

  useEffect(() => {
    if (!token || !canUsePanel) return;

    let canceled = false;
    const fetchProjects = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ([]));
        if (!res.ok) throw new Error(data?.message ?? 'Projeler yuklenemedi');
        if (!canceled) setProjects(Array.isArray(data) ? data : []);
      } catch (e: unknown) {
        if (!canceled) setError(e instanceof Error ? e.message : 'Projeler yuklenemedi');
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    fetchProjects();
    return () => {
      canceled = true;
    };
  }, [token, canUsePanel]);

  async function uploadProjectPhotos(projectId: number, files: File[]) {
    if (!token || files.length === 0) return;

    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/projects/${projectId}/photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Proje fotografi yuklenemedi');

      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, photos: [data as ProjectPhoto, ...(p.photos ?? [])] } : p,
        ),
      );
    }
  }

  async function onCreateProject(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    const createHallWidth = widthM / Math.max(1, hallCount);
    if (createHallWidth > 50) {
      setCreateConstraintMsg("Maksimum Hol Genisligi 50 m'yi asamaz");
      return;
    }

    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const payload = {
        name: name.trim() || null,
        buildingType,
        lengthM,
        widthM,
        heightM,
        hallCount,
        baySpacingM,
        doorCount,
        hasCraneBeam,
        hasLoadingRamp,
        rampCount: hasLoadingRamp ? rampCount : 0,
        investorNote: investorNote.trim() || null,
        locationText: locationText.trim() || null,
        budgetTry: budgetTry.trim() ? Number(budgetTry) : null,
      };

      const autoNo = projects.length + 1;
      const res = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...payload, name: payload.name || `Proje ${autoNo}` }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Proje kaydedilemedi');

      const created = data as ProjectItem;
      setProjects((prev) => [created, ...prev]);
      await uploadProjectPhotos(created.id, newPhotos);
      setOkMsg('Proje kaydedildi.');
      resetForm();
    } catch (e2: unknown) {
      setError(e2 instanceof Error ? e2.message : 'Proje kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  function onCreateWidthChange(nextRaw: number) {
    const next = clamp(nextRaw, 10, 200);
    const maxAllowed = Math.min(200, hallCount * 50);
    if (next > maxAllowed) {
      setCreateConstraintMsg("Maksimum Hol Genisligi 50 m'yi asamaz");
      return;
    }
    setCreateConstraintMsg(null);
    setWidthM(next);
  }

  function onCreateHallCountChange(nextRaw: number) {
    const next = clamp(nextRaw, 1, 20);
    if (widthM / Math.max(1, next) > 50) {
      setCreateConstraintMsg("Maksimum Hol Genisligi 50 m'yi asamaz");
      return;
    }
    setCreateConstraintMsg(null);
    setHallCount(next);
  }

  async function onUpdateProjectFromCard(e: FormEvent) {
    e.preventDefault();
    if (!token || !editingProjectId || !editDraft) return;

    const editHallWidth = editDraft.widthM / Math.max(1, editDraft.hallCount);
    if (editHallWidth > 50) {
      setEditConstraintMsg("Maksimum Hol Genisligi 50 m'yi asamaz");
      return;
    }

    setEditSaving(true);
    setError(null);
    setOkMsg(null);

    try {
      const payload = {
        name: editDraft.name.trim() || null,
        buildingType: editDraft.buildingType,
        lengthM: editDraft.lengthM,
        widthM: editDraft.widthM,
        heightM: editDraft.heightM,
        hallCount: editDraft.hallCount,
        baySpacingM: editDraft.baySpacingM,
        doorCount: editDraft.doorCount,
        hasCraneBeam: editDraft.hasCraneBeam,
        hasLoadingRamp: editDraft.hasLoadingRamp,
        rampCount: editDraft.hasLoadingRamp ? editDraft.rampCount : 0,
        investorNote: editDraft.investorNote.trim() || null,
        locationText: editDraft.locationText.trim() || null,
        budgetTry: editDraft.budgetTry.trim() ? Number(editDraft.budgetTry) : null,
      };

      const res = await fetch(`${API_BASE}/projects/${editingProjectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Proje guncellenemedi');

      const updated = data as ProjectItem;
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      setEditingProjectId(null);
      setEditDraft(null);
      setEditConstraintMsg(null);
      setOkMsg('Proje guncellendi.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Proje guncellenemedi');
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteProject(projectId: number) {
    if (!token) return;
    setError(null);
    setOkMsg(null);

    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Proje silinemedi');

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (editingProjectId === projectId) {
        setEditingProjectId(null);
        setEditDraft(null);
      }
      setOkMsg('Proje silindi.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Proje silinemedi');
    }
  }

  async function onAddPhotos(projectId: number, files: FileList | null) {
    if (!files) return;
    try {
      await uploadProjectPhotos(projectId, Array.from(files));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fotograf yuklenemedi');
    }
  }

  async function removePhoto(photoId: number) {
    if (!token) return;
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/projects/photos/${photoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Fotograf silinemedi');

      setProjects((prev) =>
        prev.map((p) => ({
          ...p,
          photos: (p.photos ?? []).filter((ph) => ph.id !== photoId),
        })),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fotograf silinemedi');
    }
  }

  async function openProjectOffers(projectId: number) {
    if (!token) return;
    if (openOffersProjectId === projectId) {
      setOpenOffersProjectId(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/offers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(data?.message ?? 'Teklifler getirilemedi');
      setOffersByProject((prev) => ({ ...prev, [projectId]: Array.isArray(data) ? (data as ProjectOffer[]) : [] }));
      setOpenOffersProjectId(projectId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Teklifler getirilemedi');
    }
  }

  async function openOfferChat(project: ProjectItem, offer: ProjectOffer) {
    if (!token) return;
    setChatProject(project);
    setChatOffer(offer);
    setChatText('');
    setChatError(null);
    setChatLastLoginAt(null);
    setChatLoading(true);
    try {
      const res = await fetch(`${API_BASE}/messages/project/${project.id}/user/${offer.contractorUserId}`, {
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

    fetch(`${API_BASE}/messages/user-meta/${offer.contractorUserId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => setChatLastLoginAt(data?.lastLoginAt ?? null))
      .catch(() => null);
  }

  async function sendChatMessage() {
    if (!token || !chatProject || !chatOffer || !chatText.trim()) return;
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
          toUserId: chatOffer.contractorUserId,
          text: chatText.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Mesaj gonderilemedi');
      setChatText('');
      await openOfferChat(chatProject, chatOffer);
    } catch (e: unknown) {
      setChatError(e instanceof Error ? e.message : 'Mesaj gonderilemedi');
    }
  }

  if (!canUsePanel) {
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
      <main className="mx-auto max-w-7xl p-6 space-y-6">
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">Projelerim</h1>
            <Link href="/dashboard/investor/projects/new" className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
              Yeni Proje Ekle
            </Link>
          </div>
          <p className="mt-1 text-sm text-gray-600">Tum projelerin asagida liste halinde gorunur.</p>

          {error && (
            <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {okMsg && (
            <div className="mt-3 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {okMsg}
            </div>
          )}

          {showCreateForm && (
          <form onSubmit={onCreateProject} className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="space-y-3">
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="Proje adi (bos birakirsan Proje N)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <select
                className="w-full rounded border px-3 py-2 text-sm"
                value={buildingType}
                onChange={(e) => setBuildingType(e.target.value as BuildingType)}
              >
                <option value="STEEL_FULL">Tam celik</option>
                <option value="RC_COL_STEEL_ROOF">Beton kolon + celik cati</option>
                <option value="RC_FULL_PRECAST">Tam prekast</option>
              </select>

              <label className="block text-sm">
                Uzunluk: {formatNum(lengthM)} m
                <input
                  type="range"
                  className="w-full"
                  min={10}
                  max={200}
                  step={1}
                  value={lengthM}
                  onChange={(e) => setLengthM(clamp(Number(e.target.value), 10, 200))}
                />
              </label>
              <label className="block text-sm">
                Genislik: {formatNum(widthM)} m
                <input
                  type="range"
                  className="w-full"
                  min={10}
                  max={Math.min(200, hallCount * 50)}
                  step={1}
                  value={widthM}
                  onChange={(e) => onCreateWidthChange(Number(e.target.value))}
                />
              </label>
              <label className="block text-sm">
                Yukseklik: {formatNum(heightM)} m
                <input
                  type="range"
                  className="w-full"
                  min={4}
                  max={20}
                  step={1}
                  value={heightM}
                  onChange={(e) => setHeightM(clamp(Number(e.target.value), 4, 20))}
                />
              </label>
            </div>

            <div className="space-y-3">
              <label className="block text-sm">
                Hol sayisi: {hallCount}
                <input
                  type="range"
                  className="w-full"
                  min={1}
                  max={20}
                  step={1}
                  value={hallCount}
                  onChange={(e) => onCreateHallCountChange(Number(e.target.value))}
                />
              </label>
              <div className="text-xs text-gray-600">
                Hol genisligi (En / Hol): {formatNum(widthM / Math.max(1, hallCount))} m
              </div>
              {createConstraintMsg && (
                <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  {createConstraintMsg}
                </div>
              )}
              <label className="block text-sm">
                Aks araligi: {formatNum(baySpacingM)} m
                <input
                  type="range"
                  className="w-full"
                  min={4}
                  max={10}
                  step={0.5}
                  value={baySpacingM}
                  onChange={(e) => setBaySpacingM(clamp(Number(e.target.value), 4, 10))}
                />
              </label>
              <label className="block text-sm">
                Kapi adedi: {doorCount}
                <input
                  type="range"
                  className="w-full"
                  min={1}
                  max={10}
                  step={1}
                  value={doorCount}
                  onChange={(e) => setDoorCount(clamp(Number(e.target.value), 1, 10))}
                />
              </label>

              <input
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="Lokasyon / yer bilgisi"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
              />
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="Butce (TRY)"
                value={budgetTry}
                onChange={(e) => setBudgetTry(e.target.value)}
              />
              <textarea
                className="w-full rounded border px-3 py-2 text-sm"
                rows={3}
                placeholder="Yatirimci notu"
                value={investorNote}
                onChange={(e) => setInvestorNote(e.target.value)}
              />

              <div className="space-y-1">
                <label className="text-sm font-medium">Yer fotograflari</label>
                <label className="inline-flex cursor-pointer rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
                  Dosyalari Sec
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setNewPhotos(Array.from(e.target.files ?? []))}
                    className="hidden"
                  />
                </label>
                <div className="text-xs text-gray-500">Secilen: {newPhotos.length} dosya</div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasCraneBeam}
                  onChange={(e) => setHasCraneBeam(e.target.checked)}
                />
                Kren kirisi
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasLoadingRamp}
                  onChange={(e) => setHasLoadingRamp(e.target.checked)}
                />
                Yukleme rampasi
              </label>
              {hasLoadingRamp && (
                <label className="block text-sm">
                  Rampa adedi: {rampCount}
                  <input
                    type="range"
                    className="w-full"
                    min={1}
                    max={8}
                    step={1}
                    value={rampCount}
                    onChange={(e) => setRampCount(clamp(Number(e.target.value), 1, 8))}
                  />
                </label>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  {saving ? 'Kaydediliyor...' : 'Projeyi Kaydet'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="rounded border">
                <div className="border-b px-3 py-2 text-sm font-medium">3D Configurator Onizleme</div>
                <div className="h-72 overflow-hidden">
                  <ConfiguratorCanvas
                    buildingType={buildingType}
                    lengthM={lengthM}
                    widthM={widthM}
                    heightM={heightM}
                    baySpacingM={baySpacingM}
                    hallCount={hallCount}
                    hasCraneBeam={hasCraneBeam}
                  />
                </div>
              </div>
            </div>
          </form>
          )}
        </section>

        <section className="space-y-4">
          {loading && <div className="text-sm text-gray-500">Projeler yukleniyor...</div>}
          {projects.map((p) => (
            <article key={p.id} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{p.name ?? `Proje ${p.id}`}</h2>
                  <div className="mt-1 text-sm text-gray-600">Butce: {formatTry(p.budgetTry ?? null)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="cursor-pointer rounded border px-3 py-1 text-xs"
                    onClick={() => startEdit(p)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-300 px-3 py-1 text-xs text-red-700"
                    onClick={() => deleteProject(p.id)}
                  >
                    Sil
                  </button>
                </div>
              </div>

              <div className="mt-2 text-sm text-gray-600">
                {formatNum(p.lengthM)} x {formatNum(p.widthM)} x {formatNum(p.heightM)} m • {p.buildingType}
              </div>
              <div className="mt-1 text-xs text-gray-500">Gelen teklif sayisi: {p.offerCount ?? 0}</div>
              {p.locationText && <div className="mt-1 text-sm">Yer: {p.locationText}</div>}
              {p.investorNote && <div className="mt-1 text-sm">Not: {p.investorNote}</div>}

              <div className="mt-2">
                <button
                  type="button"
                  className="rounded border px-3 py-1 text-xs"
                  onClick={() => void openProjectOffers(p.id)}
                >
                  {openOffersProjectId === p.id ? 'Gelen Teklifleri Kapat' : `Gelen Teklifler (${p.offerCount ?? 0})`}
                </button>
              </div>

              {openOffersProjectId === p.id && (
                <div className="mt-3 rounded border p-3">
                  <div className="text-sm font-medium">Gelen teklifler</div>
                  <div className="mt-2 space-y-2">
                    {(offersByProject[p.id] ?? []).map((o) => (
                      <div key={o.id} className="rounded border bg-gray-50 p-2 text-sm">
                        <div className="font-medium">{o.workItem}</div>
                        <div>Firma: {o.contractorEmail}</div>
                        <div>Fiyat: {o.priceText}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <Link
                            href={`/market-suppliers/${o.contractorUserId}`}
                            className="rounded border px-2 py-1 text-xs"
                          >
                            Firmanin Sayfasina Git
                          </Link>
                          <button
                            type="button"
                            onClick={() => void openOfferChat(p, o)}
                            className="rounded border px-2 py-1 text-xs"
                          >
                            Firmaya Mesaj Gonder
                          </button>
                        </div>
                      </div>
                    ))}
                    {(offersByProject[p.id] ?? []).length === 0 && (
                      <div className="text-xs text-gray-500">Bu projeye henuz teklif gelmedi.</div>
                    )}
                  </div>
                </div>
              )}

              {editingProjectId === p.id && editDraft && (
                <form onSubmit={onUpdateProjectFromCard} className="mt-4 rounded border p-3 space-y-3">
                  <div className="text-sm font-medium">Projeyi Duzenle</div>
                  {editConstraintMsg && (
                    <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                      {editConstraintMsg}
                    </div>
                  )}
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="Proje adi"
                    value={editDraft.name}
                    onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                  />
                  <select
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={editDraft.buildingType}
                    onChange={(e) =>
                      setEditDraft((prev) =>
                        prev ? { ...prev, buildingType: e.target.value as BuildingType } : prev,
                      )
                    }
                  >
                    <option value="STEEL_FULL">Tam celik</option>
                    <option value="RC_COL_STEEL_ROOF">Beton kolon + celik cati</option>
                    <option value="RC_FULL_PRECAST">Tam prekast</option>
                  </select>
                  <div className="grid gap-2 md:grid-cols-3">
                    <label className="text-sm">
                      Uzunluk: {formatNum(editDraft.lengthM)} m
                      <input
                        type="range"
                        className="w-full"
                        min={10}
                        max={200}
                        step={1}
                        value={editDraft.lengthM}
                        onChange={(e) =>
                          setEditDraft((prev) =>
                            prev ? { ...prev, lengthM: clamp(Number(e.target.value), 10, 200) } : prev,
                          )
                        }
                      />
                    </label>
                    <label className="text-sm">
                      Genislik: {formatNum(editDraft.widthM)} m
                      <input
                        type="range"
                        className="w-full"
                        min={10}
                        max={200}
                        step={1}
                        value={editDraft.widthM}
                        onChange={(e) => {
                          const next = clamp(Number(e.target.value), 10, 200);
                          setEditDraft((prev) => {
                            if (!prev) return prev;
                            const maxAllowed = Math.min(200, prev.hallCount * 50);
                            if (next > maxAllowed) {
                              setEditConstraintMsg("Maksimum Hol Genisligi 50 m'yi asamaz");
                              window.alert(
                                "Hol Genisligini 50 m'den fazla yapmaya calisiyorsunuz. Max Hol Genisligi 50 m olabilir",
                              );
                              return prev;
                            }
                            setEditConstraintMsg(null);
                            return { ...prev, widthM: next };
                          });
                        }}
                      />
                    </label>
                    <label className="text-sm">
                      Yukseklik: {formatNum(editDraft.heightM)} m
                      <input
                        type="range"
                        className="w-full"
                        min={4}
                        max={20}
                        step={1}
                        value={editDraft.heightM}
                        onChange={(e) =>
                          setEditDraft((prev) =>
                            prev ? { ...prev, heightM: clamp(Number(e.target.value), 4, 20) } : prev,
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <label className="text-sm">
                      Hol sayisi: {editDraft.hallCount}
                      <input
                        type="range"
                        className="w-full"
                        min={1}
                        max={20}
                        step={1}
                        value={editDraft.hallCount}
                        onChange={(e) => {
                          const next = clamp(Number(e.target.value), 1, 20);
                          setEditDraft((prev) => {
                            if (!prev) return prev;
                            if (prev.widthM / Math.max(1, next) > 50) {
                              setEditConstraintMsg("Maksimum Hol Genisligi 50 m'yi asamaz");
                              window.alert(
                                "Hol Genisligini 50 m'den fazla yapmaya calisiyorsunuz. Max Hol Genisligi 50 m olabilir",
                              );
                              return prev;
                            }
                            setEditConstraintMsg(null);
                            return { ...prev, hallCount: next };
                          });
                        }}
                      />
                    </label>
                    <label className="text-sm">
                      Aks araligi: {formatNum(editDraft.baySpacingM)} m
                      <input
                        type="range"
                        className="w-full"
                        min={4}
                        max={10}
                        step={0.5}
                        value={editDraft.baySpacingM}
                        onChange={(e) =>
                          setEditDraft((prev) =>
                            prev ? { ...prev, baySpacingM: clamp(Number(e.target.value), 4, 10) } : prev,
                          )
                        }
                      />
                    </label>
                    <label className="text-sm">
                      Kapi adedi: {editDraft.doorCount}
                      <input
                        type="range"
                        className="w-full"
                        min={1}
                        max={10}
                        step={1}
                        value={editDraft.doorCount}
                        onChange={(e) =>
                          setEditDraft((prev) =>
                            prev ? { ...prev, doorCount: clamp(Number(e.target.value), 1, 10) } : prev,
                          )
                        }
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editDraft.hasCraneBeam}
                      onChange={(e) =>
                        setEditDraft((prev) =>
                          prev ? { ...prev, hasCraneBeam: e.target.checked } : prev,
                        )
                      }
                    />
                    Kren kirisi
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editDraft.hasLoadingRamp}
                      onChange={(e) =>
                        setEditDraft((prev) =>
                          prev ? { ...prev, hasLoadingRamp: e.target.checked } : prev,
                        )
                      }
                    />
                    Yukleme rampasi
                  </label>
                  {editDraft.hasLoadingRamp && (
                    <label className="text-sm">
                      Rampa adedi: {editDraft.rampCount}
                      <input
                        type="range"
                        className="w-full"
                        min={1}
                        max={8}
                        step={1}
                        value={editDraft.rampCount}
                        onChange={(e) =>
                          setEditDraft((prev) =>
                            prev ? { ...prev, rampCount: clamp(Number(e.target.value), 1, 8) } : prev,
                          )
                        }
                      />
                    </label>
                  )}
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="Lokasyon / yer bilgisi"
                    value={editDraft.locationText}
                    onChange={(e) =>
                      setEditDraft((prev) => (prev ? { ...prev, locationText: e.target.value } : prev))
                    }
                  />
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="Butce (TRY)"
                    value={editDraft.budgetTry}
                    onChange={(e) =>
                      setEditDraft((prev) => (prev ? { ...prev, budgetTry: e.target.value } : prev))
                    }
                  />
                  <textarea
                    className="w-full rounded border px-3 py-2 text-sm"
                    rows={3}
                    placeholder="Yatirimci notu"
                    value={editDraft.investorNote}
                    onChange={(e) =>
                      setEditDraft((prev) => (prev ? { ...prev, investorNote: e.target.value } : prev))
                    }
                  />
                  <div className="text-xs text-gray-600">
                    Hol genisligi (En / Hol): {formatNum(editDraft.widthM / Math.max(1, editDraft.hallCount))} m
                  </div>
                  <div className="h-64 overflow-hidden rounded border">
                    <ConfiguratorCanvas
                      buildingType={editDraft.buildingType}
                      lengthM={editDraft.lengthM}
                      widthM={editDraft.widthM}
                      heightM={editDraft.heightM}
                      baySpacingM={editDraft.baySpacingM}
                      hallCount={editDraft.hallCount}
                      hasCraneBeam={editDraft.hasCraneBeam}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={editSaving}
                      className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
                    >
                      {editSaving ? 'Guncelleniyor...' : 'Kaydet'}
                    </button>
                    <button
                      type="button"
                      className="rounded border px-4 py-2 text-sm"
                      onClick={() => {
                        setEditingProjectId(null);
                        setEditDraft(null);
                        setEditConstraintMsg(null);
                      }}
                    >
                      Vazgec
                    </button>
                  </div>
                </form>
              )}

              <div className="mt-3">
                <label className="text-sm font-medium">Yer fotografi yukle</label>
                <div className="mt-1">
                  <label className="inline-flex cursor-pointer rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
                    Dosyalari Sec
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => onAddPhotos(p.id, e.target.files)}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-5">
                  {(p.photos ?? []).map((ph) => (
                    <div key={ph.id} className="relative rounded border p-1">
                      <button
                        type="button"
                        className="absolute right-1 top-1 z-10 h-5 w-5 rounded-full bg-red-600 text-xs font-bold text-white"
                        onClick={() => removePhoto(ph.id)}
                        title="Kaldir"
                      >
                        x
                      </button>
                      <img src={`${API_BASE}${ph.url}`} alt="Yer" className="h-24 w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>

        {chatOffer && chatProject && (
          <aside className="fixed right-4 top-24 z-50 w-[360px] rounded-lg border bg-white p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Firma ile sohbet</div>
                <div className="text-xs text-gray-600">
                  {chatOffer.contractorEmail} • {chatProject.name ?? `Proje ${chatProject.id}`}
                </div>
                <div className="text-[11px] text-gray-500">
                  Son giris: {chatLastLoginAt ? formatDateTime(chatLastLoginAt) : '-'}
                </div>
              </div>
              <button
                type="button"
                className="rounded border px-2 py-0.5 text-xs"
                onClick={() => {
                  setChatOffer(null);
                  setChatProject(null);
                }}
              >
                X
              </button>
            </div>

            {chatError && (
              <div className="mb-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {chatError}
              </div>
            )}

            <div className="h-64 overflow-y-auto rounded border p-2">
              {chatLoading ? (
                <div className="text-xs text-gray-500">Yukleniyor...</div>
              ) : (
                <div className="space-y-2">
                  {chatMessages.map((m) => {
                    const mine = m.fromUserId === user?.sub;
                    const isReadByOther = Boolean(
                      mine && chatOffer?.contractorUserId && (m.readBy ?? []).includes(chatOffer.contractorUserId),
                    );
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
      </main>
    </div>
  );
}

