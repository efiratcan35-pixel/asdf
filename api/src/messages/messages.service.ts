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
  deletedFor?: number[];
  updatedAt?: string;
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
      deletedFor: Array.isArray(m.deletedFor) ? m.deletedFor : [],
    }));
  } catch {
    return [];
  }
}

function writeMessages(items: StoredMessage[]) {
  ensureMessagesFile();
  writeFileSync(messagesFile, JSON.stringify(items, null, 2), 'utf-8');
}

function isVisibleToUser(message: StoredMessage, userId: number) {
  return !(message.deletedFor ?? []).includes(userId);
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
      select: { id: true, role: true, isDualMember: true },
    });
    const receiver = await this.prisma.user.findFirst({
      where: { id: toUserId },
      select: { id: true, role: true, isDualMember: true },
    });
    if (!sender || !receiver) throw new BadRequestException('Kullanici bulunamadi');

    const senderActsAsInvestor = sender.role === 'investor' || sender.isDualMember;
    const senderActsAsContractor = sender.role === 'contractor';
    const receiverActsAsInvestor = receiver.role === 'investor' || receiver.isDualMember;
    const receiverActsAsContractor = receiver.role === 'contractor';

    let isAllowed = false;
    if (projectId !== null) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId },
        include: { user: { select: { id: true, role: true } } },
      });
      if (!project) throw new BadRequestException('Proje bulunamadi');
      const investorId = project.userId;
      isAllowed =
        (senderActsAsContractor && receiver.id === investorId) ||
        (sender.id === investorId && receiverActsAsContractor);
    } else {
      isAllowed =
        (senderActsAsInvestor && receiverActsAsContractor) ||
        (senderActsAsContractor && receiverActsAsInvestor);
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
      deletedFor: [],
      updatedAt: undefined,
    };
    items.push(msg);
    writeMessages(items);
    return msg;
  }

  async forProject(userId: number, projectId: number, otherUserId: number) {
    const items = readMessages();
    const list = items
      .filter((m) => isVisibleToUser(m, userId))
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
      .filter((m) => isVisibleToUser(m, userId))
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
    const items = readMessages().filter(
      (m) => (m.fromUserId === userId || m.toUserId === userId) && isVisibleToUser(m, userId),
    );
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
      (m) =>
        m.toUserId === userId &&
        isVisibleToUser(m, userId) &&
        !(m.readBy ?? []).includes(userId),
    ).length;
    return { unreadCount: count };
  }

  async markReadAll(userId: number) {
    const items = readMessages();
    const next = items.map((m) => {
      if (!isVisibleToUser(m, userId)) return m;
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
      if (!isVisibleToUser(m, userId)) return m;
      if (m.toUserId !== userId) return m;
      if ((m.readBy ?? []).includes(userId)) return m;
      return { ...m, readBy: [...(m.readBy ?? []), userId] };
    });
    writeMessages(next);
    return { ok: true };
  }

  async deleteConversation(
    userId: number,
    body: { projectId?: number | null; otherUserId?: number; deleteForBoth?: boolean },
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
    const deleteForBoth = Boolean(body.deleteForBoth);
    let deletedCount = 0;
    const next = items
      .map((m) => {
        const sameConversation =
          m.projectId === projectId &&
          ((m.fromUserId === userId && m.toUserId === otherUserId) ||
            (m.fromUserId === otherUserId && m.toUserId === userId));
        if (!sameConversation) return m;
        if (!isVisibleToUser(m, userId)) return m;
        deletedCount += 1;
        if (deleteForBoth) return null;
        if ((m.deletedFor ?? []).includes(userId)) return m;
        return { ...m, deletedFor: [...(m.deletedFor ?? []), userId] };
      })
      .filter((m): m is StoredMessage => m !== null);
    writeMessages(next);
    return { ok: true, deletedCount, deleteForBoth };
  }

  async updateMessage(userId: number, messageId: number, body: { text?: string }) {
    if (!Number.isInteger(messageId) || messageId < 1) {
      throw new BadRequestException('messageId gecersiz');
    }
    const text = String(body?.text ?? '').trim();
    if (!text) {
      throw new BadRequestException('Mesaj bos olamaz');
    }

    const items = readMessages();
    const index = items.findIndex((m) => m.id === messageId);
    if (index < 0) {
      throw new BadRequestException('Mesaj bulunamadi');
    }
    if (items[index].fromUserId !== userId) {
      throw new BadRequestException('Sadece gonderdiginiz mesaji duzenleyebilirsiniz');
    }

    items[index] = {
      ...items[index],
      text,
      updatedAt: new Date().toISOString(),
    };
    writeMessages(items);
    return items[index];
  }

  async deleteMessage(userId: number, messageId: number) {
    if (!Number.isInteger(messageId) || messageId < 1) {
      throw new BadRequestException('messageId gecersiz');
    }

    const items = readMessages();
    const message = items.find((m) => m.id === messageId);
    if (!message) {
      throw new BadRequestException('Mesaj bulunamadi');
    }
    if (message.fromUserId !== userId) {
      throw new BadRequestException('Sadece gonderdiginiz mesaji silebilirsiniz');
    }

    const next = items.filter((m) => m.id !== messageId);
    writeMessages(next);
    return { ok: true };
  }
}
