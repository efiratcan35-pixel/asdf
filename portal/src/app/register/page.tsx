'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

type UserRole = 'investor' | 'contractor';
type ContractorType = 'TAXED' | 'UNTAXED';
type MembershipType = 'INVESTOR' | 'CONTRACTOR_TAXED' | 'SUBCONTRACTOR_UNTAXED';

export default function RegisterPage() {
  const router = useRouter();

  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [membershipType, setMembershipType] = useState<MembershipType>('SUBCONTRACTOR_UNTAXED');

  const [email, setEmail] = useState('');
  const [accountPhone, setAccountPhone] = useState('');
  const [password, setPassword] = useState('');

  const [investorCompanyName, setInvestorCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [investorPhone, setInvestorPhone] = useState('');
  const [officialCompanyEmail, setOfficialCompanyEmail] = useState('');
  const [investmentSummary, setInvestmentSummary] = useState('');

  const [contractorCompanyName, setContractorCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhotoUrl, setOwnerPhotoUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const helperText = useMemo(() => {
    if (membershipType === 'INVESTOR') {
      return 'Yatirimci profili olusturulur.';
    }
    if (membershipType === 'CONTRACTOR_TAXED') {
      return 'Vergi levhali yuklenici profili olusturuluyor.';
    }
    return 'Vergi levhasiz taseron profili olusturuluyor.';
  }, [membershipType]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOkMsg(null);
    setLoading(true);

    try {
      const role: UserRole = membershipType === 'INVESTOR' ? 'investor' : 'contractor';
      const contractorType: ContractorType =
        membershipType === 'CONTRACTOR_TAXED' ? 'TAXED' : 'UNTAXED';

      if (membershipType === 'INVESTOR') {
        if (!officialCompanyEmail.trim()) {
          setErr('Yatirimci icin Official sirket email gerekli.');
          return;
        }
        if (!investmentSummary.trim()) {
          setErr('Yatirimci icin Yatirim ozeti gerekli.');
          return;
        }
      }

      const body: Record<string, unknown> = {
        password,
        role,
      };
      if (authMethod === 'email') {
        body.email = email;
      } else {
        body.phone = accountPhone;
      }

      if (membershipType === 'INVESTOR') {
        body.investorCompanyName = investorCompanyName || undefined;
        body.contactName = contactName || undefined;
        body.investorPhone = investorPhone || undefined;
        body.officialCompanyEmail = officialCompanyEmail || undefined;
        body.investmentSummary = investmentSummary || undefined;
      } else {
        body.contractorType = contractorType;
        body.contractorCompanyName = contractorCompanyName || undefined;
        body.ownerName = ownerName || undefined;
        body.ownerPhotoUrl = ownerPhotoUrl || undefined;
      }

      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(data?.message ?? 'Kayit basarisiz');
        return;
      }

      setOkMsg('Kayit tamam. Simdi giris yapabilirsin.');

      setTimeout(() => router.push('/login'), 1200);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Baglanti hatasi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <TopBar />
      <div className="w-full max-w-2xl rounded-xl bg-white shadow p-6">
        <div className="text-2xl font-semibold">Uye Ol</div>
        <div className="text-sm text-gray-500 mt-1">{helperText}</div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-sm font-medium">Kayit yontemi</label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={authMethod}
                onChange={(e) => setAuthMethod(e.target.value as 'email' | 'phone')}
              >
                <option value="email">Mail ile</option>
                <option value="phone">Telefon ile</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Uyelik tipi</label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={membershipType}
                onChange={(e) => setMembershipType(e.target.value as MembershipType)}
              >
                <option value="INVESTOR">1) Yatirimci</option>
                <option value="CONTRACTOR_TAXED">2) Yuklenici - Vergi levhali</option>
                <option value="SUBCONTRACTOR_UNTAXED">3) Taseron - Vergi levhasiz</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              {authMethod === 'email' ? (
                <>
                  <label className="text-sm font-medium">Email</label>
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </>
              ) : (
                <>
                  <label className="text-sm font-medium">Telefon numarasi</label>
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    value={accountPhone}
                    onChange={(e) => setAccountPhone(e.target.value)}
                    autoComplete="tel"
                    required
                  />
                </>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Sifre</label>
              <input
                type="password"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </div>
          </div>

          {membershipType === 'INVESTOR' && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="font-semibold text-sm">Yatirimci Bilgileri</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Sirket adi (opsiyonel)</label>
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    value={investorCompanyName}
                    onChange={(e) => setInvestorCompanyName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Irtibat kisi (opsiyonel)</label>
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Telefon (opsiyonel)</label>
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    value={investorPhone}
                    onChange={(e) => setInvestorPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Official sirket email (zorunlu)</label>
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    value={officialCompanyEmail}
                    onChange={(e) => setOfficialCompanyEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Yatirim ozeti (zorunlu)</label>
                <textarea
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  rows={4}
                  value={investmentSummary}
                  onChange={(e) => setInvestmentSummary(e.target.value)}
                  required
                  placeholder="Orn: 60x30 depo yatirimi, lokasyon: ..., hedef termin: ..."
                />
              </div>
            </div>
          )}

          {membershipType !== 'INVESTOR' && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="font-semibold text-sm">
                {membershipType === 'CONTRACTOR_TAXED'
                  ? 'Yuklenici (Vergi levhali) Bilgileri'
                  : 'Taseron (Vergi levhasiz) Bilgileri'}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Firma adi (opsiyonel)</label>
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    value={contractorCompanyName}
                    onChange={(e) => setContractorCompanyName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Firma sahibi adi (opsiyonel)</label>
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Sahip foto URL (opsiyonel)</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={ownerPhotoUrl}
                  onChange={(e) => setOwnerPhotoUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          )}

          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}
          {okMsg && (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {okMsg}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-md bg-black text-white px-3 py-2 text-sm disabled:opacity-60"
            type="submit"
          >
            {loading ? 'Kaydediliyor...' : 'Uye Ol'}
          </button>
        </form>

        <div className="mt-4 text-sm text-gray-600">
          Zaten hesabin var mi?{' '}
          <Link href="/login" className="font-semibold text-black underline">
            Giris yap
          </Link>
        </div>
      </div>
    </div>
  );
}
