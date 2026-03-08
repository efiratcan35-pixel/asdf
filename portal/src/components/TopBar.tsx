'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { token, user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [offerUnreadCount, setOfferUnreadCount] = useState(0);

  const isAuthPage = pathname === '/login' || pathname === '/register';
  const dashboardHref =
    user?.role === 'investor'
      ? '/dashboard/investor'
      : user?.role === 'contractor' && user.contractorType === 'TAXED'
        ? '/dashboard/contractor'
        : user?.role === 'contractor' && user.contractorType === 'UNTAXED'
          ? '/dashboard/subcontractor'
          : '/dashboard';

  useEffect(() => {
    if (!user || !token) {
      return;
    }

    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const [msgRes, offerRes] = await Promise.all([
          fetch(`${API_BASE}/messages/unread-count`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          user?.role === 'investor'
            ? fetch(`${API_BASE}/projects/offers/notifications/summary`, {
                headers: { Authorization: `Bearer ${token}` },
              })
            : Promise.resolve(null as Response | null),
        ]);

        const msgData = await msgRes.json().catch(() => ({}));
        if (msgRes.ok && !cancelled) setUnreadCount(Number(msgData?.unreadCount ?? 0));

        if (offerRes) {
          const offerData = await offerRes.json().catch(() => ({}));
          if (offerRes.ok && !cancelled) setOfferUnreadCount(Number(offerData?.unreadCount ?? 0));
        } else if (!cancelled) {
          setOfferUnreadCount(0);
        }
      } catch {
        // ignore polling errors
      }
    };

    void fetchUnread();
    const t = setInterval(fetchUnread, 12000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user, token, pathname]);

  return (
    <div className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3">
        <Link href="/" className="font-semibold">
          EFC Portal
        </Link>

        <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto sm:gap-2">
          {!user && !isAuthPage && (
            <>
              <Link
                href="/login"
                className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50 sm:px-3 sm:py-1.5 sm:text-sm"
              >
                Giriş Yap
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-black px-2 py-1 text-xs text-white hover:opacity-90 sm:px-3 sm:py-1.5 sm:text-sm"
              >
                Üye Ol
              </Link>
            </>
          )}

          {!user && isAuthPage && (
            <Link
              href="/"
              className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50 sm:px-3 sm:py-1.5 sm:text-sm"
            >
              Configurator’a dön
            </Link>
          )}

          {user && (
            <>
              <span className="hidden sm:inline text-xs text-gray-600">
                {user.email} • {user.role}
              </span>
              <Link href={dashboardHref} className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50 sm:px-3 sm:py-1.5 sm:text-sm">
                {user.role === 'investor' ? 'Profil' : 'Dashboard'}
              </Link>
              {user.role === 'investor' && (
                <Link href="/dashboard/investor/projects" className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50 sm:px-3 sm:py-1.5 sm:text-sm">
                  Projelerim
                </Link>
              )}
              {user.role === 'investor' && (
                <button
                  type="button"
                  title="Teklif bildirimleri"
                  aria-label="Teklif bildirimleri"
                  onClick={async () => {
                    router.push('/dashboard/investor/projects');
                    if (!token) return;
                    await fetch(`${API_BASE}/projects/offers/notifications/mark-read`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                    }).catch(() => null);
                    setOfferUnreadCount(0);
                  }}
                  className={`relative rounded-md border px-2 py-1 text-xs hover:bg-gray-50 sm:px-3 sm:py-1.5 sm:text-sm ${
                    offerUnreadCount > 0 ? 'border-green-600 bg-green-600 text-white hover:bg-green-700' : ''
                  }`}
                >
                  Bildirimler
                  {offerUnreadCount > 0 && (
                    <span className="absolute -right-2 -top-2 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                      {offerUnreadCount}
                    </span>
                  )}
                </button>
              )}
              {user.role === 'investor' && (
                <Link href="/market-suppliers" className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50 sm:px-3 sm:py-1.5 sm:text-sm">
                  <span className="sm:hidden">Firmalar</span>
                  <span className="hidden sm:inline">Piyasadaki Firmalar / Ekipler</span>
                </Link>
              )}
              {user.role === 'contractor' && (
                <Link href="/market-jobs" className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50 sm:px-3 sm:py-1.5 sm:text-sm">
                  <span className="sm:hidden">Isler</span>
                  <span className="hidden sm:inline">Piyasadaki Isler</span>
                </Link>
              )}
              <Link
                href="/messages"
                className={`rounded-md border px-2 py-1 text-xs hover:bg-gray-50 sm:px-3 sm:py-1.5 sm:text-sm ${
                  unreadCount > 0 ? 'border-green-600 bg-green-600 text-white hover:bg-green-700' : ''
                }`}
              >
                <span className="sm:hidden">Mesaj</span>
                <span className="hidden sm:inline">Mesajlarim {unreadCount > 0 ? `(${unreadCount} yeni)` : ''}</span>
                <span className="ml-1 sm:hidden">{unreadCount > 0 ? `(${unreadCount})` : ''}</span>
              </Link>
              {user.role === 'contractor' && (
                <Link href="/my-offers" className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50 sm:px-3 sm:py-1.5 sm:text-sm">
                  Tekliflerim
                </Link>
              )}
              <Link
                href="/user-settings"
                title="Kullanici Islemleri"
                aria-label="Kullanici Islemleri"
                className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50 sm:px-3 sm:py-1.5 sm:text-sm"
              >
                ⚙
              </Link>
              <button
                onClick={() => {
                  logout();
                  router.push('/');
                }}
                className="rounded-md bg-black px-2 py-1 text-xs text-white hover:opacity-90 sm:px-3 sm:py-1.5 sm:text-sm"
              >
                Çıkış
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

