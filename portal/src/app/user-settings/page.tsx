'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';

export default function UserSettingsPage() {
  const router = useRouter();
  const { token, user, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [hidden, setHidden] = useState(false);
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [nextEmail, setNextEmail] = useState('');
  const [nextPhone, setNextPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const canUse = useMemo(() => Boolean(user && token), [user, token]);

  useEffect(() => {
    if (!token) return;
    let canceled = false;
    const run = async () => {
      setLoading(true);
      try {
        const [hiddenRes, profileRes] = await Promise.all([
          fetch(`${API_BASE}/auth/account/hidden`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/auth/account/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const hiddenData = await hiddenRes.json().catch(() => ({}));
        const profileData = await profileRes.json().catch(() => ({}));
        if (!canceled) {
          if (hiddenRes.ok) setHidden(Boolean(hiddenData?.hidden));
          if (profileRes.ok) {
            const email = String(profileData?.email ?? '');
            const phone = String(profileData?.phone ?? '');
            setProfileEmail(email);
            setProfilePhone(phone);
            setNextEmail(email);
            setNextPhone(phone);
          }
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    run();
    return () => {
      canceled = true;
    };
  }, [token]);

  async function onUpdatePassword(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`${API_BASE}/auth/account/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Parola guncellenemedi');
      setCurrentPassword('');
      setNewPassword('');
      setOkMsg('Parola guncellendi.');
    } catch (e2: unknown) {
      setError(e2 instanceof Error ? e2.message : 'Parola guncellenemedi');
    } finally {
      setSaving(false);
    }
  }

  async function onToggleHidden() {
    if (!token) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const next = !hidden;
      const res = await fetch(`${API_BASE}/auth/account/hide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ hidden: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Hesap gizleme guncellenemedi');
      setHidden(next);
      setOkMsg(next ? 'Hesap gizlendi.' : 'Hesap gizlilik kaldirildi.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Hesap gizleme guncellenemedi');
    } finally {
      setSaving(false);
    }
  }

  async function onUpdateEmail(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`${API_BASE}/auth/account/email`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: nextEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Email guncellenemedi');
      const updated = String(data?.email ?? nextEmail).trim().toLowerCase();
      setProfileEmail(updated);
      setNextEmail(updated);
      setOkMsg('Email guncellendi.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Email guncellenemedi');
    } finally {
      setSaving(false);
    }
  }

  async function onUpdatePhone(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`${API_BASE}/auth/account/phone`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone: nextPhone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Telefon guncellenemedi');
      const updated = String(data?.phone ?? nextPhone);
      setProfilePhone(updated);
      setNextPhone(updated);
      setOkMsg('Telefon guncellendi.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Telefon guncellenemedi');
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteAccount() {
    if (!token) return;
    if (!window.confirm('Hesabinizi silmek istediginize emin misiniz? Bu islem geri alinamaz.')) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`${API_BASE}/auth/account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Hesap silinemedi');
      logout();
      router.push('/');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Hesap silinemedi');
      setSaving(false);
    }
  }

  if (!canUse) {
    return (
      <div className="min-h-screen bg-gray-100">
        <TopBar />
        <main className="mx-auto max-w-4xl p-6">
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-700">
            Bu sayfayi kullanmak icin giris yapin.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <TopBar />
      <main className="mx-auto max-w-4xl p-6 space-y-4">
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Kullanici Islemleri</h1>
          {loading && <div className="mt-2 text-sm text-gray-500">Yukleniyor...</div>}
          {error && <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {okMsg && <div className="mt-3 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{okMsg}</div>}

          <div className="mt-5 rounded-lg border p-4">
            <h2 className="font-semibold">Email Adresi</h2>
            <p className="mt-1 text-sm text-gray-700">{profileEmail || '-'}</p>
            <form onSubmit={onUpdateEmail} className="mt-3 space-y-2">
              <input
                type="email"
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="Yeni email adresi"
                value={nextEmail}
                onChange={(e) => setNextEmail(e.target.value)}
              />
              <button type="submit" disabled={saving} className="rounded border px-4 py-2 text-sm disabled:opacity-60">
                Email Adresimi Degistir
              </button>
            </form>
          </div>

          <div className="mt-4 rounded-lg border p-4">
            <h2 className="font-semibold">Telefon Numarasi</h2>
            <p className="mt-1 text-sm text-gray-700">{profilePhone || '-'}</p>
            <form onSubmit={onUpdatePhone} className="mt-3 space-y-2">
              <input
                type="text"
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="Yeni telefon numarasi"
                value={nextPhone}
                onChange={(e) => setNextPhone(e.target.value)}
              />
              <button type="submit" disabled={saving} className="rounded border px-4 py-2 text-sm disabled:opacity-60">
                Telefon Numarami Degistir
              </button>
            </form>
          </div>

          <form onSubmit={onUpdatePassword} className="mt-5 space-y-2 rounded-lg border p-4">
            <h2 className="font-semibold">Parolayi Guncelle</h2>
            <input
              type="password"
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="Mevcut parola"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <input
              type="password"
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="Yeni parola"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button type="submit" disabled={saving} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60">
              Parolayi Guncelle
            </button>
          </form>

          <div className="mt-4 rounded-lg border p-4">
            <h2 className="font-semibold">Hesabimi Gizle</h2>
            <p className="mt-1 text-sm text-gray-600">
              Gizli hesaplar piyasadaki listelerde gorunmez.
            </p>
            <button
              type="button"
              onClick={onToggleHidden}
              disabled={saving}
              className="mt-3 rounded border px-4 py-2 text-sm disabled:opacity-60"
            >
              {hidden ? 'Gizliligi Kaldir' : 'Hesabimi Gizle'}
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-red-200 p-4">
            <h2 className="font-semibold text-red-700">Hesabimi Sil</h2>
            <p className="mt-1 text-sm text-gray-600">
              Hesabiniz pasif hale getirilir ve sistemden cikis yapilir.
            </p>
            <button
              type="button"
              onClick={onDeleteAccount}
              disabled={saving}
              className="mt-3 rounded bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              Hesabimi Sil
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
