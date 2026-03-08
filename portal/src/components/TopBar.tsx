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
        const res = await fetch(`${API_BASE}/messages/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (!cancelled) setUnreadCount(Number(data?.unreadCount ?? 0));
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
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold">
          EFC Portal
        </Link>

        <div className="flex items-center gap-2">
          {!user && !isAuthPage && (
            <>
              <Link
                href="/login"
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Giriş Yap
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-black px-3 py-1.5 text-sm text-white hover:opacity-90"
              >
                Üye Ol
              </Link>
            </>
          )}

          {!user && isAuthPage && (
            <Link
              href="/"
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Configurator’a dön
            </Link>
          )}

          {user && (
            <>
              <span className="hidden sm:inline text-xs text-gray-600">
                {user.email} • {user.role}
              </span>
              <Link href={dashboardHref} className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
                {user.role === 'investor' ? 'Profil' : 'Dashboard'}
              </Link>
              {user.role === 'investor' && (
                <Link href="/dashboard/investor/projects" className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
                  Projelerim
                </Link>
              )}
              {user.role === 'investor' && (
                <Link href="/market-suppliers" className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
                  Piyasadaki Firmalar / Ekipler
                </Link>
              )}
              {user.role === 'contractor' && (
                <Link href="/market-jobs" className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
                  Piyasadaki Isler
                </Link>
              )}
              <Link
                href="/messages"
                className={`rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 ${
                  unreadCount > 0 ? 'border-green-600 bg-green-600 text-white hover:bg-green-700' : ''
                }`}
              >
                Mesajlarim {unreadCount > 0 ? `(${unreadCount} yeni)` : ''}
              </Link>
              {user.role === 'contractor' && (
                <Link href="/my-offers" className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
                  Tekliflerim
                </Link>
              )}
              <Link
                href="/user-settings"
                title="Kullanici Islemleri"
                aria-label="Kullanici Islemleri"
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                ⚙
              </Link>
              <button
                onClick={() => {
                  logout();
                  router.push('/');
                }}
                className="rounded-md bg-black px-3 py-1.5 text-sm text-white hover:opacity-90"
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
