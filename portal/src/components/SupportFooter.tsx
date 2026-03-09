'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function SupportFooter() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <footer className="border-t bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-4">
          <span className="text-sm text-gray-600">EFC Portal Destek</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Destek
            </button>
            <Link href="/contact" className="rounded-md bg-black px-3 py-1.5 text-sm text-white hover:opacity-90">
              Bize Ulasin
            </Link>
          </div>
        </div>
      </footer>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Destek Talebi Olustur</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
              >
                Kapat
              </button>
            </div>
            <p className="text-sm text-gray-700">
              Destek kaydi icin lutfen asagidaki iletisim bilgileri uzerinden bize ulasin.
            </p>
            <div className="mt-3 space-y-1 rounded-md border bg-gray-50 p-3 text-sm">
              <p>Tel: +90 507 790 80 02</p>
              <p>Email: firat@efcstructures.com</p>
              <p>EFC Structures San Tic</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
