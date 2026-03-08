import { BadRequestException, Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { getUserLastLogin } from '../common/account-flags';

type StoredMessage = {
  id: number;
  projectId: number | null;
  fromUserId: number;
  toUserId: number;
  text: string;
  createdAt: string;
  readBy?: number[];
};

const dataDir = join(process.cwd(), 'data');
const messagesFile = join(dataDir, 'messages.json');

function ensureMessagesFile() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(messagesFile)) writeFileSync(messagesFile, '[]', 'utf-8');
}

function readMessages(): StoredMessage[] {
  ensureMessagesFile();
  try {
    const rows = JSON.parse(readFileSync(messagesFile, 'utf-8')) as StoredMessage[];
    return rows.map((m) => ({
      ...m,
      readBy: Array.isArray(m.readBy) ? m.readBy : [m.fromUserId],
    }));
  } catch {
    return [];
  }
}

function writeMessages(items: StoredMessage[]) {
  ensureMessagesFile();
  writeFileSync(messagesFile, JSON.stringify(items, null, 2), 'utf-8');
}

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async send(fromUserId: number, body: any) {
    const rawProjectId = body.projectId;
    const projectId =
      rawProjectId === null || typeof rawProjectId === 'undefined' || rawProjectId === ''
        ? null
        : Number(rawProjectId);
    const toUserId = Number(body.toUserId);
    const text = String(body.text ?? '').trim();

    if (projectId !== null && (!Number.isInteger(projectId) || projectId < 1)) {
      throw new BadRequestException('projectId gecersiz');
    }
    if (!Number.isInteger(toUserId) || toUserId < 1) {
      throw new BadRequestException('toUserId gecersiz');
    }
    if (!text) {
      throw new BadRequestException('Mesaj bos olamaz');
    }
    if (fromUserId === toUserId) {
      throw new BadRequestException('Kendinize mesaj gonderemezsiniz');
    }

    const sender = await this.prisma.user.findFirst({
      where: { id: fromUserId },
      select: { id: true, role: true },
    });
    const receiver = await this.prisma.user.findFirst({
      where: { id: toUserId },
      select: { id: true, role: true },
    });
    if (!sender || !receiver) throw new BadRequestException('Kullanici bulunamadi');

    let isAllowed = false;
    if (projectId !== null) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId },
        include: { user: { select: { id: true, role: true } } },
      });
      if (!project) throw new BadRequestException('Proje bulunamadi');
      const investorId = project.userId;
      isAllowed =
        (sender.role === 'contractor' && receiver.id === investorId) ||
        (sender.id === investorId && receiver.role === 'contractor');
    } else {
      isAllowed =
        (sender.role === 'investor' && receiver.role === 'contractor') ||
        (sender.role === 'contractor' && receiver.role === 'investor');
    }

    if (!isAllowed) {
      throw new BadRequestException('Sadece investor-contractor mesajlasmasi acik');
    }

    const items = readMessages();
    const msg: StoredMessage = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      projectId,
      fromUserId,
      toUserId,
      text,
      createdAt: new Date().toISOString(),
      readBy: [fromUserId],
    };
    items.push(msg);
    writeMessages(items);
    return msg;
  }

  async forProject(userId: number, projectId: number, otherUserId: number) {
    const items = readMessages();
    const list = items
      .filter((m) => m.projectId === projectId)
      .filter(
        (m) =>
          (m.fromUserId === userId && m.toUserId === otherUserId) ||
          (m.fromUserId === otherUserId && m.toUserId === userId),
      )
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    return list;
  }

  async direct(userId: number, otherUserId: number) {
    const items = readMessages();
    const list = items
      .filter((m) => m.projectId === null)
      .filter(
        (m) =>
          (m.fromUserId === userId && m.toUserId === otherUserId) ||
          (m.fromUserId === otherUserId && m.toUserId === userId),
      )
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    return list;
  }

  async mine(userId: number) {
    const items = readMessages().filter((m) => m.fromUserId === userId || m.toUserId === userId);
    const latestByKey = new Map<string, StoredMessage>();
    const unreadByKey = new Map<string, number>();

    for (const m of items) {
      const otherUserId = m.fromUserId === userId ? m.toUserId : m.fromUserId;
      const key = `${m.projectId ?? 'direct'}-${otherUserId}`;
      const prev = latestByKey.get(key);
      if (!prev || +new Date(prev.createdAt) < +new Date(m.createdAt)) {
        latestByKey.set(key, m);
      }
      if (m.toUserId === userId && !(m.readBy ?? []).includes(userId)) {
        unreadByKey.set(key, (unreadByKey.get(key) ?? 0) + 1);
      }
    }

    const latest = Array.from(latestByKey.values()).sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    );

    const userIds = Array.from(
      new Set(
        latest.flatMap((m) => [m.fromUserId, m.toUserId]).filter((id) => id !== userId),
      ),
    );
    const projectIds = Array.from(
      new Set(latest.map((m) => m.projectId).filter((id): id is number => id !== null)),
    );

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, role: true },
    });
    const usersById = new Map(users.map((u) => [u.id, u]));

    const projects = await this.prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true },
    });
    const projectsById = new Map(projects.map((p) => [p.id, p]));

    return latest.map((m) => {
      const otherUserId = m.fromUserId === userId ? m.toUserId : m.fromUserId;
      return {
        projectId: m.projectId,
        otherUserId,
        otherUser: usersById.get(otherUserId) ?? null,
        otherUserLastLoginAt: getUserLastLogin(otherUserId),
        project: m.projectId === null ? null : projectsById.get(m.projectId) ?? null,
        lastMessage: m.text,
        lastMessageAt: m.createdAt,
        unreadCount: unreadByKey.get(`${m.projectId ?? 'direct'}-${otherUserId}`) ?? 0,
      };
    });
  }

  async userMeta(otherUserId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id: otherUserId },
      select: { id: true, email: true, role: true },
    });
    if (!user) throw new BadRequestException('Kullanici bulunamadi');
    return {
      ...user,
      lastLoginAt: getUserLastLogin(otherUserId),
    };
  }

  async unreadCount(userId: number) {
    const count = readMessages().filter(
      (m) => m.toUserId === userId && !(m.readBy ?? []).includes(userId),
    ).length;
    return { unreadCount: count };
  }

  async markReadAll(userId: number) {
    const items = readMessages();
    const next = items.map((m) => {
      if (m.toUserId !== userId) return m;
      if ((m.readBy ?? []).includes(userId)) return m;
      return { ...m, readBy: [...(m.readBy ?? []), userId] };
    });
    writeMessages(next);
    return { ok: true };
  }

  async markReadConversation(
    userId: number,
    body: { projectId?: number | null; otherUserId?: number },
  ) {
    const otherUserId = Number(body.otherUserId);
    if (!Number.isInteger(otherUserId) || otherUserId < 1) {
      throw new BadRequestException('otherUserId gecersiz');
    }
    const projectId =
      typeof body.projectId === 'undefined' || body.projectId === null || body.projectId === ('' as any)
        ? null
        : Number(body.projectId);
    if (projectId !== null && (!Number.isInteger(projectId) || projectId < 1)) {
      throw new BadRequestException('projectId gecersiz');
    }

    const items = readMessages();
    const next = items.map((m) => {
      const sameConversation =
        m.projectId === projectId &&
        ((m.fromUserId === userId && m.toUserId === otherUserId) ||
          (m.fromUserId === otherUserId && m.toUserId === userId));
      if (!sameConversation) return m;
      if (m.toUserId !== userId) return m;
      if ((m.readBy ?? []).includes(userId)) return m;
      return { ...m, readBy: [...(m.readBy ?? []), userId] };
    });
    writeMessages(next);
    return { ok: true };
  }
}
