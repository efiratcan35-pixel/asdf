'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3002';

type ConversationItem = {
  projectId: number | null;
  otherUserId: number;
  otherUser: { id: number; email: string; role: string } | null;
  otherUserLastLoginAt?: string | null;
  project: { id: number; name: string | null } | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

type ChatMessage = {
  id: number;
  projectId: number | null;
  fromUserId: number;
  toUserId: number;
  text: string;
  createdAt: string;
  readBy?: number[];
  updatedAt?: string;
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

export default function MessagesPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [selected, setSelected] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desiredProjectId, setDesiredProjectId] = useState<number | null>(null);
  const [desiredOtherUserId, setDesiredOtherUserId] = useState<number | null>(null);
  const [prefillConsumed, setPrefillConsumed] = useState(false);
  const [menu, setMenu] = useState<{ messageId: number; x: number; y: number } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  const canUse = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const pidRaw = params.get('projectId');
    const oidRaw = params.get('otherUserId');
    const pid = pidRaw ? Number(pidRaw) : NaN;
    const oid = oidRaw ? Number(oidRaw) : NaN;
    setDesiredProjectId(Number.isInteger(pid) && pid > 0 ? pid : null);
    setDesiredOtherUserId(Number.isInteger(oid) && oid > 0 ? oid : null);
  }, []);

  async function loadConversations() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/messages/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(data?.message ?? 'Mesajlar getirilemedi');
      const list = Array.isArray(data) ? (data as ConversationItem[]) : [];
      setItems(list);
      if (
        !prefillConsumed &&
        desiredProjectId !== null &&
        desiredOtherUserId !== null &&
        Number.isInteger(desiredProjectId) &&
        Number.isInteger(desiredOtherUserId) &&
        desiredProjectId > 0 &&
        desiredOtherUserId > 0
      ) {
        const matched = list.find(
          (it) => it.projectId === desiredProjectId && it.otherUserId === desiredOtherUserId,
        );
        if (matched) {
          setSelected(matched);
        } else {
          setSelected({
            projectId: desiredProjectId,
            otherUserId: desiredOtherUserId,
            otherUser: null,
            otherUserLastLoginAt: null,
            project: { id: desiredProjectId, name: null },
            lastMessage: '',
            lastMessageAt: new Date().toISOString(),
            unreadCount: 0,
          });
        }
        setPrefillConsumed(true);
      } else if (!selected && list.length > 0) {
        setSelected(list[0]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Mesajlar getirilemedi');
    } finally {
      setLoading(false);
    }
  }

  async function loadChat(item: ConversationItem) {
    if (!token) return;
    setChatLoading(true);
    setError(null);
    try {
      const endpoint =
        item.projectId === null
          ? `${API_BASE}/messages/user/${item.otherUserId}`
          : `${API_BASE}/messages/project/${item.projectId}/user/${item.otherUserId}`;
      const res = await fetch(
        endpoint,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(data?.message ?? 'Sohbet getirilemedi');
      setMessages(Array.isArray(data) ? (data as ChatMessage[]) : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sohbet getirilemedi');
    } finally {
      setChatLoading(false);
    }
  }

  useEffect(() => {
    if (!token || !canUse) return;
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canUse, desiredProjectId, desiredOtherUserId, prefillConsumed]);

  useEffect(() => {
    if (!menu) return;
    const handleClose = () => setMenu(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [menu]);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    const run = async () => {
      await loadChat(selected);
      if (!token) return;
      await fetch(`${API_BASE}/messages/mark-read-conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: selected.projectId,
          otherUserId: selected.otherUserId,
        }),
      }).catch(() => null);
      await loadConversations();
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.projectId, selected?.otherUserId, token]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!token || !selected || !text.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: selected.projectId,
          toUserId: selected.otherUserId,
          text: text.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Mesaj gonderilemedi');
      setText('');
      await loadChat(selected);
      await loadConversations();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Mesaj gonderilemedi');
    }
  }

  async function onDeleteConversation(item: ConversationItem) {
    if (!token) return;
    const ok = window.confirm('Bu mesaj gecmisi silinsin mi?');
    if (!ok) return;
    const deleteForBoth = window.confirm('Mesaj gecmisi karsi taraf icin de silinsin mi?');

    try {
      const res = await fetch(`${API_BASE}/messages/conversation`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: item.projectId,
          otherUserId: item.otherUserId,
          deleteForBoth,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Mesaj gecmisi silinemedi');

      if (
        selected?.projectId === item.projectId &&
        selected?.otherUserId === item.otherUserId
      ) {
        setSelected(null);
        setMessages([]);
      }
      await loadConversations();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Mesaj gecmisi silinemedi');
    }
  }

  async function onDeleteMessage(messageId: number) {
    if (!token || !selected) return;
    const ok = window.confirm('Bu mesaj silinsin mi?');
    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE}/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? 'Mesaj silinemedi');
      setMenu(null);
      await loadChat(selected);
      await loadConversations();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Mesaj silinemedi');
    }
  }

  async function onSaveMessageEdit() {
    if (!token || !selected || !editingMessageId || !editingText.trim()) return;
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
      await loadChat(selected);
      await loadConversations();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Mesaj duzenlenemedi');
    }
  }

  if (!canUse) {
    return (
      <div className="min-h-screen bg-gray-100">
        <TopBar />
        <main className="mx-auto max-w-6xl p-6">
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-700">
            Mesajlarim sayfasi icin giris yapmaniz gerekir.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {menu && (
        <div
          className="fixed z-[90] min-w-[120px] rounded-md border bg-white p-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            type="button"
            className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-50"
            onClick={() => {
              const msg = messages.find((m) => m.id === menu.messageId);
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
      <main className="mx-auto max-w-7xl p-6">
        <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
          <section className="rounded-xl border bg-white p-4">
            <h1 className="text-lg font-semibold">Mesajlarim</h1>
            {loading && <div className="mt-2 text-sm text-gray-500">Yukleniyor...</div>}
            <div className="mt-3 space-y-2">
              {items.map((it) => (
                <div
                  key={`${it.projectId}-${it.otherUserId}`}
                  className={`w-full rounded border p-2 text-left text-sm ${
                    selected?.projectId === it.projectId && selected?.otherUserId === it.otherUserId
                      ? 'border-black'
                      : it.unreadCount > 0
                        ? 'border-green-300 bg-green-50'
                        : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelected(it)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">{it.project?.name ?? 'Genel Sohbet'}</div>
                        {it.unreadCount > 0 && (
                          <span className="rounded bg-green-600 px-1.5 py-0.5 text-[11px] text-white">
                            ({it.unreadCount})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600">{it.otherUser?.email ?? '-'}</div>
                      <div className="mt-1 line-clamp-1 text-xs text-gray-500">{it.lastMessage}</div>
                      <div className="mt-1 text-[11px] text-gray-500">{formatDateTime(it.lastMessageAt)}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteConversation(it)}
                      className="shrink-0 rounded border border-red-300 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4">
            {error && <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {!selected ? (
              <div className="text-sm text-gray-600">Soldan bir konusma secin.</div>
            ) : (
              <>
                <div className="border-b pb-2">
                  <div className="font-medium">{selected.project?.name ?? 'Genel Sohbet'}</div>
                  <div className="text-xs text-gray-600">{selected.otherUser?.email ?? '-'}</div>
                  <div className="text-[11px] text-gray-500">
                    Son giris: {selected.otherUserLastLoginAt ? formatDateTime(selected.otherUserLastLoginAt) : '-'}
                  </div>
                </div>
                <div className="mt-3 h-[420px] overflow-y-auto rounded border p-3">
                  {chatLoading ? (
                    <div className="text-sm text-gray-500">Mesajlar yukleniyor...</div>
                  ) : (
                    <div className="space-y-2">
                      {messages.map((m) => {
                        const mine = m.fromUserId === user?.sub;
                        const isReadByOther = Boolean(
                          mine && selected && (m.readBy ?? []).includes(selected.otherUserId),
                        );
                        return (
                          <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-[80%] rounded px-3 py-2 text-sm ${mine ? 'bg-black text-white' : 'bg-gray-100'}`}
                              onContextMenu={(e) => {
                                if (!mine) return;
                                e.preventDefault();
                                setMenu({ messageId: m.id, x: e.clientX, y: e.clientY });
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
                                {mine && (
                                  <span className={isReadByOther ? 'text-sky-400' : 'text-gray-300'}>
                                    {isReadByOther ? '✓✓' : '✓'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <form onSubmit={onSend} className="mt-3 flex gap-2">
                  <input
                    className="flex-1 rounded border px-3 py-2 text-sm"
                    placeholder="Mesaj yazin..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <button type="submit" className="rounded bg-black px-4 py-2 text-sm text-white">
                    Gonder
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
