'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';

type RefRow = {
  personName: string;
  companyName: string;
  title: string;
  phone: string;
  email: string;
};

type MediaItem = {
  id: number;
  type: 'photo' | 'video';
  url: string;
  caption?: string | null;
};

async function ensureFacePhoto(file: File) {
  const isImage = file.type.startsWith('image/');
  if (!isImage) throw new Error('Profil fotografi bir gorsel dosyasi olmali.');

  const FaceDetectorCtor = (window as unknown as { FaceDetector?: new (opts?: unknown) => { detect: (img: ImageBitmap) => Promise<unknown[]> } }).FaceDetector;
  if (!FaceDetectorCtor) return { checked: false };

  const detector = new FaceDetectorCtor({ maxDetectedFaces: 1, fastMode: true });
  const bitmap = await createImageBitmap(file);
  const faces = await detector.detect(bitmap);
  if (!faces || faces.length === 0) {
    throw new Error('Yuklediginiz profil fotografisinda yuz algilanamadi. Lutfen yuzun net gorundugu bir foto secin.');
  }
  return { checked: true };
}

export default function SubcontractorDashboardPage() {
  const { token, user } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [about, setAbout] = useState('');
  const [profession, setProfession] = useState('');
  const [ownerPhotoUrl, setOwnerPhotoUrl] = useState('');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [refs, setRefs] = useState<RefRow[]>([{ personName: '', companyName: '', title: '', phone: '', email: '' }]);
  const [editingRefIndex, setEditingRefIndex] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [warnMsg, setWarnMsg] = useState<string | null>(null);

  const canEdit = useMemo(
    () => user?.role === 'contractor' && user?.contractorType === 'UNTAXED',
    [user?.contractorType, user?.role],
  );

  useEffect(() => {
    if (!token || !canEdit) return;
    let canceled = false;

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/auth/contractor-profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message ?? 'Profil getirilemedi');
        if (canceled) return;

        setCompanyName(data.companyName ?? '');
        setOwnerName(data.ownerName ?? '');
        setAbout(data.about ?? '');
        setProfession(data.servicesText ?? '');
        setOwnerPhotoUrl(data.ownerPhotoUrl ?? '');
        setMedia(
          Array.isArray(data.media)
            ? data.media.filter((m: MediaItem) => (m.caption ?? '') !== 'Profil fotografi')
            : [],
        );
        setRefs(
          Array.isArray(data.references) && data.references.length > 0
            ? data.references.map((r: RefRow) => ({
                personName: r.personName ?? '',
                companyName: r.companyName ?? '',
                title: r.title ?? '',
                phone: r.phone ?? '',
                email: r.email ?? '',
              }))
            : [{ personName: '', companyName: '', title: '', phone: '', email: '' }],
        );
        setEditingRefIndex(null);
      } catch (e: unknown) {
        if (!canceled) setError(e instanceof Error ? e.message : 'Profil getirilemedi');
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      canceled = true;
    };
  }, [token, canEdit]);

  async function uploadMediaFile(
    file: File,
    type: 'photo' | 'video',
    caption?: string,
    options?: { addToGallery?: boolean },
  ) {
    if (!token) return;

    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);
    if (caption) fd.append('caption', caption);

    const res = await fetch(`${API_BASE}/auth/contractor-media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message ?? 'Dosya yuklenemedi');
    if (options?.addToGallery !== false) {
      setMedia((prev) => [data, ...prev]);
    }
    return data as MediaItem;
  }

  async function onOwnerPhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setWarnMsg(null);
    try {
      const result = await ensureFacePhoto(file);
      if (!result.checked) {
        setWarnMsg(
          'Tarayici yuz dogrulama API desteklemiyor. Profil fotografisi yuklendi, yuz kontrolu atlandi.',
        );
      }
      const item = await uploadMediaFile(file, 'photo', 'Profil fotografi', {
        addToGallery: false,
      });
      if (item) setOwnerPhotoUrl(item.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Profil fotografisi yuklenemedi');
    } finally {
      e.target.value = '';
    }
  }

  async function onGalleryUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setError(null);
    try {
      for (const file of files) {
        const type = file.type.startsWith('video/') ? 'video' : 'photo';
        await uploadMediaFile(file, type);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Medya yuklenemedi');
    } finally {
      e.target.value = '';
    }
  }

  async function removeMedia(id: number) {
    if (!token) return;
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/contractor-media/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Medya silinemedi');
      setMedia((prev) => prev.filter((m) => m.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Medya silinemedi');
    }
  }

  function addRefRow() {
    setRefs((prev) => {
      setEditingRefIndex(prev.length);
      return [...prev, { personName: '', companyName: '', title: '', phone: '', email: '' }];
    });
  }

  function removeRefRow(index: number) {
    setRefs((prev) => prev.filter((_, i) => i !== index));
    setEditingRefIndex((prev) => (prev === index ? null : prev));
  }

  function updateRefRow(index: number, key: keyof RefRow, value: string) {
    setRefs((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  async function saveProfile() {
    if (!token || !canEdit) return;

    setSaving(true);
    setError(null);
    setOkMsg(null);

    try {
      const res = await fetch(`${API_BASE}/auth/contractor-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyName,
          ownerName,
          about,
          servicesText: profession,
          ownerPhotoUrl,
          references: refs,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Profil kaydedilemedi');
      setOkMsg('Profil bilgileri kaydedildi.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Profil kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return (
      <div className="min-h-screen bg-gray-100">
        <TopBar />
        <main className="mx-auto max-w-4xl p-6">
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-700">
            Bu sayfa yalnizca taseron (vergi levhasiz) uyeler icin aciktir.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <TopBar />
      <main className="mx-auto max-w-6xl p-6">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Taseron Paneli</h1>

          {loading && <div className="mt-3 text-sm text-gray-500">Profil yukleniyor...</div>}
          {error && <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {warnMsg && <div className="mt-3 rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">{warnMsg}</div>}
          {okMsg && <div className="mt-3 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{okMsg}</div>}

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Firma adi</label>
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Firma sahibi adi</label>
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Profil fotografi (yuz net gorunmeli)</label>
                <div className="mt-1">
                  <label className="inline-flex cursor-pointer rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
                    Dosya Sec
                    <input type="file" accept="image/*" onChange={onOwnerPhotoChange} className="hidden" />
                  </label>
                </div>
                {ownerPhotoUrl && (
                  <img src={`${API_BASE}${ownerPhotoUrl}`} alt="Profil" className="mt-3 h-36 w-36 rounded-md object-cover border" />
                )}
              </div>

              <div>
                <label className="text-sm font-medium">Kendinizi kisaca tanitin</label>
                <textarea className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={4} value={about} onChange={(e) => setAbout(e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium">Mesleginiz</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={profession} onChange={(e) => setProfession(e.target.value)} />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Yaptiginiz islerden foto/video</label>
                <div className="mt-1">
                  <label className="inline-flex cursor-pointer rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
                    Dosyalari Sec
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={onGalleryUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {media.map((m) => (
                    <div key={m.id} className="relative rounded border p-1">
                      <button
                        type="button"
                        onClick={() => removeMedia(m.id)}
                        className="absolute right-1 top-1 z-10 h-5 w-5 rounded-full bg-red-600 text-xs font-bold text-white"
                        title="Kaldir"
                      >
                        x
                      </button>
                      {m.type === 'video' ? (
                        <video src={`${API_BASE}${m.url}`} controls className="h-20 w-full object-cover" />
                      ) : (
                        <img src={`${API_BASE}${m.url}`} alt="Medya" className="h-20 w-full object-cover" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Referanslar</h2>
              <button type="button" onClick={addRefRow} className="rounded border px-3 py-1 text-xs">Satir ekle</button>
            </div>

            <div className="overflow-x-auto rounded border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-2 py-2">Referans ismi</th>
                    <th className="px-2 py-2">Firma</th>
                    <th className="px-2 py-2">Gorev</th>
                    <th className="px-2 py-2">Telefon</th>
                    <th className="px-2 py-2">Mail</th>
                    <th className="px-2 py-2 text-right">Islem</th>
                  </tr>
                </thead>
                <tbody>
                  {refs.map((row, idx) => {
                    const isEditing = editingRefIndex === idx;
                    const inputClass = `w-full rounded border px-2 py-1 ${isEditing ? '' : 'bg-gray-100'}`;
                    return (
                      <tr key={idx} className="border-t align-top">
                        <td className="px-2 py-2">
                          <input
                            className={inputClass}
                            placeholder="Referans ismi"
                            value={row.personName}
                            readOnly={!isEditing}
                            onChange={(e) => updateRefRow(idx, 'personName', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className={inputClass}
                            placeholder="Firma"
                            value={row.companyName}
                            readOnly={!isEditing}
                            onChange={(e) => updateRefRow(idx, 'companyName', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className={inputClass}
                            placeholder="Gorev"
                            value={row.title}
                            readOnly={!isEditing}
                            onChange={(e) => updateRefRow(idx, 'title', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className={inputClass}
                            placeholder="Telefon"
                            value={row.phone}
                            readOnly={!isEditing}
                            onChange={(e) => updateRefRow(idx, 'phone', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className={inputClass}
                            placeholder="Mail adresi"
                            value={row.email}
                            readOnly={!isEditing}
                            onChange={(e) => updateRefRow(idx, 'email', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className="rounded border px-2 py-1 text-xs"
                              onClick={() => setEditingRefIndex(isEditing ? null : idx)}
                            >
                              {isEditing ? 'Tamam' : 'Edit'}
                            </button>
                            <button
                              type="button"
                              className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                              onClick={() => removeRefRow(idx)}
                              disabled={refs.length <= 1}
                            >
                              Sil
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6">
            <button type="button" onClick={saveProfile} disabled={saving} className="rounded-md bg-black px-5 py-2 text-sm text-white disabled:opacity-60">
              {saving ? 'Kaydediliyor...' : 'Profili Kaydet'}
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
