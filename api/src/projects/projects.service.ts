import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { isUserHidden } from '../common/account-flags';

type BuildingType = 'STEEL_FULL' | 'RC_COL_STEEL_ROOF' | 'RC_FULL_PRECAST';

type ProjectPhotoMeta = {
  id: number;
  url: string;
  caption?: string;
  createdAt: string;
};

type ProjectMeta = {
  investorNote?: string | null;
  locationText?: string | null;
  budgetTry?: number | null;
  photos: ProjectPhotoMeta[];
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

type MetaStore = Record<string, ProjectMeta>;

const dataDir = join(process.cwd(), 'data');
const metaFile = join(dataDir, 'project-meta.json');
const offersFile = join(dataDir, 'project-offers.json');
const offerSeenFile = join(dataDir, 'offer-notification-seen.json');

function ensureMetaFile() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(metaFile)) writeFileSync(metaFile, '{}', 'utf-8');
  if (!existsSync(offersFile)) writeFileSync(offersFile, '{}', 'utf-8');
  if (!existsSync(offerSeenFile)) writeFileSync(offerSeenFile, '{}', 'utf-8');
}

function readMetaStore(): MetaStore {
  ensureMetaFile();
  try {
    return JSON.parse(readFileSync(metaFile, 'utf-8')) as MetaStore;
  } catch {
    return {};
  }
}

function writeMetaStore(store: MetaStore) {
  ensureMetaFile();
  writeFileSync(metaFile, JSON.stringify(store, null, 2), 'utf-8');
}

function readOfferStore(): Record<string, ProjectOffer[]> {
  ensureMetaFile();
  try {
    const raw = JSON.parse(readFileSync(offersFile, 'utf-8')) as Record<string, any[]>;
    const normalized: Record<string, ProjectOffer[]> = {};
    Object.keys(raw ?? {}).forEach((key) => {
      const list = Array.isArray(raw[key]) ? raw[key] : [];
      normalized[key] = list.map((item) => ({
        id: Number(item?.id ?? Date.now()),
        projectId: Number(item?.projectId ?? Number(key)),
        contractorUserId: Number(item?.contractorUserId ?? 0),
        contractorEmail: String(item?.contractorEmail ?? ''),
        workItem: String(item?.workItem ?? ''),
        priceText: String(
          typeof item?.priceText !== 'undefined' ? item.priceText : item?.priceTry ?? '',
        ),
        createdAt: String(item?.createdAt ?? new Date().toISOString()),
      }));
    });
    return normalized;
  } catch {
    return {};
  }
}

function writeOfferStore(store: Record<string, ProjectOffer[]>) {
  ensureMetaFile();
  writeFileSync(offersFile, JSON.stringify(store, null, 2), 'utf-8');
}

function readOfferSeenStore(): Record<string, string> {
  ensureMetaFile();
  try {
    return JSON.parse(readFileSync(offerSeenFile, 'utf-8')) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeOfferSeenStore(store: Record<string, string>) {
  ensureMetaFile();
  writeFileSync(offerSeenFile, JSON.stringify(store, null, 2), 'utf-8');
}

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  private getMeta(projectId: number): ProjectMeta {
    const store = readMetaStore();
    return store[String(projectId)] ?? { photos: [] };
  }

  private setMeta(projectId: number, updater: (prev: ProjectMeta) => ProjectMeta) {
    const store = readMetaStore();
    const key = String(projectId);
    const next = updater(store[key] ?? { photos: [] });
    store[key] = next;
    writeMetaStore(store);
    return next;
  }

  private enrichProject(project: any) {
    const meta = this.getMeta(project.id);
    const offers = readOfferStore();
    const offerCount = Array.isArray(offers[String(project.id)]) ? offers[String(project.id)].length : 0;
    return {
      ...project,
      investorNote: meta.investorNote ?? null,
      locationText: meta.locationText ?? null,
      budgetTry: typeof meta.budgetTry === 'number' ? meta.budgetTry : null,
      photos: meta.photos ?? [],
      offerCount,
    };
  }

  private getProjectOffers(projectId: number) {
    const store = readOfferStore();
    return store[String(projectId)] ?? [];
  }

  private setProjectOffers(projectId: number, offers: ProjectOffer[]) {
    const store = readOfferStore();
    store[String(projectId)] = offers;
    writeOfferStore(store);
  }

  async create(userId: number, body: any) {
    const lengthM = Number(body.lengthM);
    const widthM = Number(body.widthM);
    const heightM = Number(body.heightM);

    const buildingType = body.buildingType as BuildingType;

    const hasCraneBeam = Boolean(body.hasCraneBeam);
    const hasLoadingRamp = Boolean(body.hasLoadingRamp);
    const rampCount = Number(body.rampCount ?? 0);
    const doorCount = Number(body.doorCount ?? 1);
    const baySpacingM = Number(body.baySpacingM);
    const hallCount = Number(body.hallCount);

    if (lengthM <= 0 || widthM <= 0 || heightM <= 0) {
      throw new BadRequestException('lengthM/widthM/heightM pozitif olmali');
    }

    const allowedTypes: BuildingType[] = ['STEEL_FULL', 'RC_COL_STEEL_ROOF', 'RC_FULL_PRECAST'];
    if (!allowedTypes.includes(buildingType)) {
      throw new BadRequestException('buildingType gecersiz');
    }

    if (!Number.isFinite(baySpacingM) || baySpacingM < 4 || baySpacingM > 10) {
      throw new BadRequestException('baySpacingM 4 ile 10 arasinda olmali');
    }

    if (!Number.isInteger(hallCount) || hallCount < 1) {
      throw new BadRequestException('hallCount en az 1 ve tam sayi olmali');
    }

    if (!Number.isInteger(doorCount) || doorCount < 1) {
      throw new BadRequestException('doorCount en az 1 olmali');
    }

    if (!hasLoadingRamp && rampCount !== 0) {
      throw new BadRequestException('hasLoadingRamp=false ise rampCount 0 olmali');
    }
    if (hasLoadingRamp && (!Number.isInteger(rampCount) || rampCount < 1)) {
      throw new BadRequestException('hasLoadingRamp=true ise rampCount en az 1 olmali');
    }

    const hallWidthM = widthM / hallCount;
    if (hallWidthM < 10 || hallWidthM > 50) {
      throw new BadRequestException(`Hol genisligi 10-50 m olmali. Su an: ${hallWidthM.toFixed(2)} m`);
    }

    const project = await this.prisma.project.create({
      data: {
        userId,
        name: body.name ?? null,
        buildingType,
        lengthM,
        widthM,
        heightM,
        hasCraneBeam,
        hasLoadingRamp,
        rampCount: hasLoadingRamp ? rampCount : 0,
        doorCount,
        baySpacingM,
        hallCount,
        hallWidthM,
      },
    });

    this.setMeta(project.id, (prev) => ({
      ...prev,
      investorNote: body.investorNote ?? null,
      locationText: body.locationText ?? null,
      budgetTry: body.budgetTry ? Number(body.budgetTry) : null,
      photos: prev.photos ?? [],
    }));

    return this.enrichProject(project);
  }

  async findMine(userId: number) {
    const projects = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return projects.map((p) => this.enrichProject(p));
  }

  async findMarket() {
    const projects = await this.prisma.project.findMany({
      where: {
        user: { role: 'investor' },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });

    return projects
      .filter((p) => !isUserHidden(p.userId))
      .map((p) => {
        const enriched = this.enrichProject(p);
        return {
          ...enriched,
          investor: p.user ? { id: p.user.id, email: p.user.email } : null,
        };
      });
  }

  async findMarketById(projectId: number) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        user: { role: 'investor' },
      },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });
    if (!project) throw new BadRequestException('Project bulunamadi');
    if (isUserHidden(project.userId)) throw new BadRequestException('Project bulunamadi');

    const enriched = this.enrichProject(project);
    return {
      ...enriched,
      investor: project.user ? { id: project.user.id, email: project.user.email } : null,
    };
  }

  async update(userId: number, projectId: number, body: any) {
    const existing = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!existing) throw new BadRequestException('Project bulunamadi');

    const lengthM = typeof body.lengthM !== 'undefined' ? Number(body.lengthM) : existing.lengthM;
    const widthM = typeof body.widthM !== 'undefined' ? Number(body.widthM) : existing.widthM;
    const heightM = typeof body.heightM !== 'undefined' ? Number(body.heightM) : existing.heightM;
    const buildingType =
      typeof body.buildingType !== 'undefined' ? (body.buildingType as BuildingType) : (existing.buildingType as BuildingType);
    const hallCount = typeof body.hallCount !== 'undefined' ? Number(body.hallCount) : existing.hallCount;
    const baySpacingM = typeof body.baySpacingM !== 'undefined' ? Number(body.baySpacingM) : existing.baySpacingM;
    const doorCount = typeof body.doorCount !== 'undefined' ? Number(body.doorCount) : existing.doorCount;
    const hasCraneBeam =
      typeof body.hasCraneBeam !== 'undefined' ? Boolean(body.hasCraneBeam) : existing.hasCraneBeam;
    const hasLoadingRamp =
      typeof body.hasLoadingRamp !== 'undefined' ? Boolean(body.hasLoadingRamp) : existing.hasLoadingRamp;
    const rampCount =
      typeof body.rampCount !== 'undefined' ? Number(body.rampCount) : existing.rampCount;

    if (lengthM <= 0 || widthM <= 0 || heightM <= 0) {
      throw new BadRequestException('lengthM/widthM/heightM pozitif olmali');
    }

    const allowedTypes: BuildingType[] = ['STEEL_FULL', 'RC_COL_STEEL_ROOF', 'RC_FULL_PRECAST'];
    if (!allowedTypes.includes(buildingType)) {
      throw new BadRequestException('buildingType gecersiz');
    }

    if (!Number.isFinite(baySpacingM) || baySpacingM < 4 || baySpacingM > 10) {
      throw new BadRequestException('baySpacingM 4 ile 10 arasinda olmali');
    }

    if (!Number.isInteger(hallCount) || hallCount < 1) {
      throw new BadRequestException('hallCount en az 1 ve tam sayi olmali');
    }

    if (!Number.isInteger(doorCount) || doorCount < 1) {
      throw new BadRequestException('doorCount en az 1 olmali');
    }

    if (!hasLoadingRamp && rampCount !== 0) {
      throw new BadRequestException('hasLoadingRamp=false ise rampCount 0 olmali');
    }
    if (hasLoadingRamp && (!Number.isInteger(rampCount) || rampCount < 1)) {
      throw new BadRequestException('hasLoadingRamp=true ise rampCount en az 1 olmali');
    }

    const hallWidthM = widthM / hallCount;
    if (hallWidthM < 10 || hallWidthM > 50) {
      throw new BadRequestException(`Hol genisligi 10-50 m olmali. Su an: ${hallWidthM.toFixed(2)} m`);
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: typeof body.name !== 'undefined' ? body.name || null : existing.name,
        buildingType,
        lengthM,
        widthM,
        heightM,
        hasCraneBeam,
        hasLoadingRamp,
        rampCount: hasLoadingRamp ? rampCount : 0,
        doorCount,
        baySpacingM,
        hallCount,
        hallWidthM,
      },
    });

    this.setMeta(projectId, (prev) => ({
      ...prev,
      investorNote: typeof body.investorNote !== 'undefined' ? body.investorNote || null : prev.investorNote,
      locationText: typeof body.locationText !== 'undefined' ? body.locationText || null : prev.locationText,
      budgetTry:
        typeof body.budgetTry !== 'undefined'
          ? body.budgetTry === '' || body.budgetTry === null
            ? null
            : Number(body.budgetTry)
          : prev.budgetTry,
      photos: prev.photos ?? [],
    }));

    return this.enrichProject(updated);
  }

  async addPhoto(userId: number, projectId: number, url: string, caption?: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) throw new BadRequestException('Project bulunamadi');
    if (!url) throw new BadRequestException('Dosya gerekli');

    const photo: ProjectPhotoMeta = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      url,
      caption: caption ?? undefined,
      createdAt: new Date().toISOString(),
    };

    this.setMeta(projectId, (prev) => ({
      ...prev,
      photos: [photo, ...(prev.photos ?? [])],
    }));

    return photo;
  }

  async removePhoto(userId: number, photoId: number) {
    const projects = await this.prisma.project.findMany({ where: { userId }, select: { id: true } });
    const projectIds = new Set(projects.map((p) => p.id));

    const store = readMetaStore();
    let found = false;

    Object.keys(store).forEach((key) => {
      const pid = Number(key);
      if (!projectIds.has(pid)) return;
      const prev = store[key] ?? { photos: [] };
      const nextPhotos = (prev.photos ?? []).filter((ph) => ph.id !== photoId);
      if (nextPhotos.length !== (prev.photos ?? []).length) {
        found = true;
        store[key] = { ...prev, photos: nextPhotos };
      }
    });

    if (!found) throw new BadRequestException('Foto bulunamadi');
    writeMetaStore(store);

    return { ok: true };
  }

  async remove(userId: number, projectId: number) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    });
    if (!project) throw new BadRequestException('Project bulunamadi');

    await this.prisma.project.delete({ where: { id: projectId } });

    const store = readMetaStore();
    delete store[String(projectId)];
    writeMetaStore(store);

    const offerStore = readOfferStore();
    delete offerStore[String(projectId)];
    writeOfferStore(offerStore);

    return { ok: true };
  }

  async createOffer(
    userId: number,
    projectId: number,
    body: { workItem?: string; priceText?: string; priceTry?: string | number },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!user || user.role !== 'contractor') {
      throw new BadRequestException('Sadece taseron/yuklenici teklif verebilir');
    }

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, user: { role: 'investor' } },
      select: { id: true },
    });
    if (!project) throw new BadRequestException('Project bulunamadi');

    const workItem = String(body.workItem ?? '').trim();
    const priceText = String(
      typeof body.priceText !== 'undefined' ? body.priceText : body.priceTry ?? '',
    ).trim();
    if (!workItem) throw new BadRequestException('Teklif edilen uygulama gerekli');
    if (!priceText) throw new BadRequestException('Fiyat gerekli');

    const next: ProjectOffer = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      projectId,
      contractorUserId: user.id,
      contractorEmail: user.email,
      workItem,
      priceText,
      createdAt: new Date().toISOString(),
    };

    const prev = this.getProjectOffers(projectId);
    this.setProjectOffers(projectId, [next, ...prev]);
    return next;
  }

  async listOffersForProject(userId: number, projectId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw new BadRequestException('Kullanici bulunamadi');

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true },
    });
    if (!project) throw new BadRequestException('Project bulunamadi');

    const isOwnerInvestor = user.role === 'investor' && project.userId === userId;
    const isContractor = user.role === 'contractor';
    if (!isOwnerInvestor && !isContractor) {
      throw new BadRequestException('Bu teklifleri goremezsiniz');
    }

    const offers = this.getProjectOffers(projectId);
    if (isContractor && !isOwnerInvestor) {
      return offers.filter((o) => o.contractorUserId === userId);
    }
    return offers;
  }

  async listMyOffers(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user || user.role !== 'contractor') {
      throw new BadRequestException('Sadece taseron/yuklenici gorebilir');
    }

    const store = readOfferStore();
    const all = Object.values(store).flat();
    const mine = all
      .filter((o) => o.contractorUserId === userId)
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

    const projectIds = Array.from(new Set(mine.map((o) => o.projectId)));
    const projects = await this.prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true, userId: true },
    });
    const projectById: Record<number, { name: string | null; userId: number }> = {};
    projects.forEach((p) => {
      projectById[p.id] = { name: p.name ?? null, userId: p.userId };
    });

    return mine.map((o) => ({
      ...o,
      projectName: projectById[o.projectId]?.name ?? null,
      investorId: projectById[o.projectId]?.userId ?? null,
    }));
  }

  async getOfferNotificationSummary(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user || user.role !== 'investor') {
      return { unreadCount: 0 };
    }

    const projects = await this.prisma.project.findMany({
      where: { userId },
      select: { id: true },
    });
    const myProjectIds = new Set(projects.map((p) => p.id));
    if (myProjectIds.size === 0) return { unreadCount: 0 };

    const seenStore = readOfferSeenStore();
    const lastSeenAt = seenStore[String(userId)] ? new Date(seenStore[String(userId)]) : null;

    const allOffers = Object.values(readOfferStore()).flat();
    const unreadCount = allOffers.filter((offer) => {
      if (!myProjectIds.has(offer.projectId)) return false;
      if (!lastSeenAt) return true;
      return new Date(offer.createdAt).getTime() > lastSeenAt.getTime();
    }).length;

    return { unreadCount };
  }

  async markOfferNotificationsRead(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user || user.role !== 'investor') return { ok: true };

    const store = readOfferSeenStore();
    store[String(userId)] = new Date().toISOString();
    writeOfferSeenStore(store);
    return { ok: true };
  }

  async generateModel(userId: number, projectId: number) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) throw new BadRequestException('Project bulunamadi');

    const last = await this.prisma.modelRun.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
    const version = (last?.version ?? 0) + 1;

    const areaM2 = project.lengthM * project.widthM;

    const concreteM3 = 2 * (project.lengthM + project.widthM) * 0.6 * 0.5;
    const steelTon = areaM2 * 0.035;

    const elements = [
      {
        elementType: 'FOUNDATION',
        material: 'beton',
        qty: concreteM3,
        unit: 'm3',
        geomType: 'box',
        geom: { lengthM: project.lengthM, widthM: project.widthM, heightM: 0.5 },
      },
      {
        elementType: 'STEEL_FRAME',
        material: 'celik',
        qty: steelTon,
        unit: 'ton',
        geomType: 'box',
        geom: { lengthM: project.lengthM, widthM: project.widthM, heightM: project.heightM },
      },
    ] as const;

    return this.prisma.modelRun.create({
      data: {
        projectId,
        version,
        engineVersion: 'v1',
        elements: { create: elements as any },
      },
      include: { elements: true },
    });
  }

  async getLatestModel(userId: number, projectId: number) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) throw new BadRequestException('Project bulunamadi');

    return this.prisma.modelRun.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      include: { elements: true },
    });
  }
}
