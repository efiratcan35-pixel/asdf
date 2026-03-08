import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { $Enums, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import {
  isUserHidden,
  setUserHidden,
  setUserLastLogin,
} from '../common/account-flags';

type RegisterBody = {
  email?: string;
  phone?: string;
  password: string;

  role: $Enums.UserRole;

  investorCompanyName?: string;
  contactName?: string;
  investorPhone?: string;
  officialCompanyEmail?: string;
  investmentSummary?: string;

  contractorType?: $Enums.ContractorType;
  contractorCompanyName?: string;
  ownerName?: string;
  ownerPhotoUrl?: string;
};

type RefInput = {
  personName: string;
  companyName?: string;
  title?: string;
  phone?: string;
  email?: string;
};

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async register(body: RegisterBody) {
    try {
      const prismaUser = (this.prisma as any).user;
      const email = String(body.email ?? '').trim().toLowerCase();
      const phone = this.normalizePhone(body.phone);

      if (!email && !phone) {
        throw new BadRequestException('Email veya telefon gerekli');
      }

      if (email) {
        const emailExists = await prismaUser.findUnique({ where: { email } });
        if (emailExists) throw new BadRequestException('Bu email zaten kayitli');
      }

      if (phone) {
        const phoneExists = await prismaUser.findUnique({ where: { phone } });
        if (phoneExists) throw new BadRequestException('Bu telefon zaten kayitli');
      }

      const accountEmail = email || `phone_${phone}@phone.local`;

      const hashed = await bcrypt.hash(body.password, 10);
      const status: $Enums.UserStatus = 'APPROVED';

      const user = await prismaUser.create({
        data: {
          email: accountEmail,
          phone: phone || null,
          password: hashed,
          role: body.role,
          status,
        },
        select: { id: true, email: true, phone: true, role: true, status: true, createdAt: true },
      });

      if (body.role === 'investor') {
        await this.prisma.investorProfile.create({
          data: {
            userId: user.id,
            companyName: body.investorCompanyName ?? null,
            contactName: body.contactName ?? null,
            phone: body.investorPhone ?? null,
            officialCompanyEmail: body.officialCompanyEmail ?? null,
            investmentSummary: body.investmentSummary ?? null,
          },
        });
      }

      if (body.role === 'contractor') {
        await this.prisma.contractorProfile.create({
          data: {
            userId: user.id,
            contractorType: body.contractorType ?? 'UNTAXED',
            companyName: body.contractorCompanyName ?? null,
            ownerName: body.ownerName ?? null,
            ownerPhotoUrl: body.ownerPhotoUrl ?? null,
          },
        });
      }

      return {
        message: 'User created.',
        user,
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        (e.code === 'P2022' || e.code === 'P2021')
      ) {
        throw new BadRequestException(
          'Veritabani semasi guncel degil. Lutfen api klasorunde `npx prisma db push` calistirin.',
        );
      }
      throw e;
    }
  }

  async login(identifier: string, password: string, method: 'email' | 'phone' = 'email') {
    const prismaUser = (this.prisma as any).user;
    const raw = String(identifier ?? '').trim();
    const e = raw.toLowerCase();
    const p = this.normalizePhone(raw);

    const user: any =
      method === 'phone'
        ? await prismaUser.findUnique({ where: { phone: p } })
        : await prismaUser.findUnique({ where: { email: e } });

    if (!user) throw new UnauthorizedException('Giris bilgileri hatali');

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Giris bilgileri hatali');

    let contractorType: $Enums.ContractorType | undefined;
    if (user.role === 'contractor') {
      const profile = await this.prisma.contractorProfile.findUnique({
        where: { userId: user.id },
        select: { contractorType: true },
      });
      contractorType = profile?.contractorType;
    }

    const payload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      contractorType,
    };
    setUserLastLogin(user.id, new Date().toISOString());
    const access_token = await this.jwt.signAsync(payload);

    return { access_token };
  }

  async verifyEmail(token: string) {
    const plainToken = String(token ?? '').trim();
    if (!plainToken) throw new BadRequestException('Token gerekli');

    const tokenHash = this.hashVerificationToken(plainToken);
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record) throw new BadRequestException('Gecersiz dogrulama linki');
    if (record.usedAt) throw new BadRequestException('Bu link zaten kullanildi');
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Dogrulama linkinin suresi dolmus');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { status: 'APPROVED' },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { ok: true };
  }

  async resendVerificationEmail(email: string) {
    const normalized = String(email ?? '').trim().toLowerCase();
    if (!normalized) throw new BadRequestException('Email gerekli');

    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, email: true, status: true },
    });
    if (!user) throw new BadRequestException('Kullanici bulunamadi');
    if (user.status === 'APPROVED') return { ok: true, alreadyVerified: true };

    const { token, verificationUrl } = await this.createEmailVerificationToken(user.id);
    await this.sendVerificationEmail(user.email, verificationUrl, token);

    return {
      ok: true,
      sent: true,
      verificationUrl: process.env.NODE_ENV === 'production' ? undefined : verificationUrl,
    };
  }

  async getContractorProfile(userId: number) {
    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId },
      include: { references: true, media: true },
    });

    if (!profile) throw new BadRequestException('Contractor profile bulunamadi');

    const references = profile.references.map((r) => {
      const [companyName, title] = (r.companyName ?? '').split('|||');
      return {
        id: r.id,
        personName: r.personName,
        companyName: companyName || '',
        title: title || '',
        phone: r.phone ?? '',
        email: r.email ?? '',
      };
    });

    return {
      ...profile,
      references,
    };
  }

  async updateContractorProfile(
    userId: number,
    body: {
      about?: string;
      servicesText?: string;
      ownerPhotoUrl?: string;
      references?: RefInput[];
    },
  ) {
    const profile = await this.prisma.contractorProfile.findUnique({ where: { userId } });
    if (!profile) throw new BadRequestException('Contractor profile bulunamadi');

    await this.prisma.contractorProfile.update({
      where: { userId },
      data: {
        about: body.about ?? null,
        servicesText: body.servicesText ?? null,
        ownerPhotoUrl: body.ownerPhotoUrl ?? profile.ownerPhotoUrl,
      },
    });

    if (Array.isArray(body.references)) {
      await this.prisma.reference.deleteMany({ where: { contractorProfileId: profile.id } });
      if (body.references.length > 0) {
        await this.prisma.reference.createMany({
          data: body.references
            .filter((r) => r.personName?.trim())
            .map((r) => ({
              contractorProfileId: profile.id,
              personName: r.personName.trim(),
              companyName: `${(r.companyName ?? '').trim()}|||${(r.title ?? '').trim()}`,
              phone: (r.phone ?? '').trim() || null,
              email: (r.email ?? '').trim() || null,
            })),
        });
      }
    }

    return this.getContractorProfile(userId);
  }

  async createContractorMedia(userId: number, input: { url: string; type: 'photo' | 'video'; caption?: string }) {
    const profile = await this.prisma.contractorProfile.findUnique({ where: { userId } });
    if (!profile) throw new BadRequestException('Contractor profile bulunamadi');

    return this.prisma.media.create({
      data: {
        contractorProfileId: profile.id,
        url: input.url,
        type: input.type,
        caption: input.caption ?? null,
      },
    });
  }

  async deleteContractorMedia(userId: number, mediaId: number) {
    const profile = await this.prisma.contractorProfile.findUnique({ where: { userId } });
    if (!profile) throw new BadRequestException('Contractor profile bulunamadi');

    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, contractorProfileId: profile.id },
    });
    if (!media) throw new BadRequestException('Medya bulunamadi');

    await this.prisma.media.delete({ where: { id: mediaId } });
    return { ok: true };
  }

  async listMarketContractors(requesterUserId: number) {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterUserId },
      select: { role: true },
    });
    if (!requester || requester.role !== 'investor') {
      throw new BadRequestException('Bu listeye sadece investor erisebilir');
    }

    const profiles = await this.prisma.contractorProfile.findMany({
      include: {
        user: { select: { id: true, email: true } },
        references: true,
        media: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return profiles
      .filter((p) => !isUserHidden(p.userId))
      .map((p) => {
      const galleryMedia = p.media.filter((m) => (m.caption ?? '') !== 'Profil fotografi');
      return {
      userId: p.userId,
      email: p.user.email,
      contractorType: p.contractorType,
      companyName: p.companyName ?? '',
      ownerName: p.ownerName ?? '',
      ownerPhotoUrl: p.ownerPhotoUrl ?? '',
      about: p.about ?? '',
      servicesText: p.servicesText ?? '',
      referenceCount: p.references.length,
      latestMedia: galleryMedia[0] ?? null,
      };
      });
  }

  async getMarketContractorDetail(requesterUserId: number, contractorUserId: number) {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterUserId },
      select: { role: true },
    });
    if (!requester || requester.role !== 'investor') {
      throw new BadRequestException('Bu sayfaya sadece investor erisebilir');
    }

    const profile = await this.prisma.contractorProfile.findUnique({
      where: { userId: contractorUserId },
      include: {
        user: { select: { id: true, email: true } },
        references: { orderBy: { createdAt: 'desc' } },
        media: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!profile) throw new BadRequestException('Firma bulunamadi');
    if (isUserHidden(profile.userId)) throw new BadRequestException('Firma bulunamadi');

    const galleryMedia = profile.media.filter((m) => (m.caption ?? '') !== 'Profil fotografi');
    const seenUrls = new Set<string>();
    const dedupedGallery = galleryMedia.filter((m) => {
      if (seenUrls.has(m.url)) return false;
      seenUrls.add(m.url);
      return true;
    });

    return {
      userId: profile.userId,
      email: profile.user.email,
      contractorType: profile.contractorType,
      companyName: profile.companyName ?? '',
      ownerName: profile.ownerName ?? '',
      ownerPhotoUrl: profile.ownerPhotoUrl ?? '',
      about: profile.about ?? '',
      servicesText: profile.servicesText ?? '',
      references: profile.references.map((r) => {
        const [companyName, title] = (r.companyName ?? '').split('|||');
        return {
          id: r.id,
          personName: r.personName,
          companyName: companyName || '',
          title: title || '',
          phone: r.phone ?? '',
          email: r.email ?? '',
        };
      }),
      media: dedupedGallery.map((m) => ({
        id: m.id,
        type: m.type,
        url: m.url,
        caption: m.caption ?? '',
        createdAt: m.createdAt,
      })),
    };
  }

  async updatePassword(
    userId: number,
    body: { currentPassword?: string; newPassword?: string },
  ) {
    const currentPassword = String(body.currentPassword ?? '');
    const newPassword = String(body.newPassword ?? '');
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('currentPassword ve newPassword gerekli');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Kullanici bulunamadi');

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) throw new BadRequestException('Mevcut parola hatali');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    return { ok: true };
  }

  async getAccountProfile(userId: number) {
    const user: any = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, phone: true },
    });
    if (!user) throw new BadRequestException('Kullanici bulunamadi');
    return {
      email: user.email,
      phone: user.phone ?? '',
    };
  }

  async updateEmail(userId: number, body: { email?: string }) {
    const nextEmail = String(body.email ?? '').trim().toLowerCase();
    if (!nextEmail) throw new BadRequestException('email gerekli');

    const exists = await this.prisma.user.findUnique({ where: { email: nextEmail } });
    if (exists && exists.id !== userId) throw new BadRequestException('Bu email zaten kayitli');

    await this.prisma.user.update({
      where: { id: userId },
      data: { email: nextEmail },
    });
    return { ok: true, email: nextEmail };
  }

  async updatePhone(userId: number, body: { phone?: string }) {
    const prismaUser = (this.prisma as any).user;
    const phone = this.normalizePhone(body.phone);
    if (!phone) {
      await prismaUser.update({
        where: { id: userId },
        data: { phone: null },
      });
      return { ok: true, phone: '' };
    }

    const exists = await prismaUser.findUnique({ where: { phone } });
    if (exists && exists.id !== userId) throw new BadRequestException('Bu telefon zaten kayitli');

    await prismaUser.update({
      where: { id: userId },
      data: { phone },
    });
    return { ok: true, phone };
  }

  async getInvestorProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true },
    });
    if (!user || user.role !== 'investor') {
      throw new BadRequestException('Bu sayfa sadece investor icin');
    }

    const profile = await this.prisma.investorProfile.findUnique({
      where: { userId },
    });

    return {
      email: user.email,
      companyName: profile?.companyName ?? '',
      contactName: profile?.contactName ?? '',
      phone: profile?.phone ?? '',
      officialCompanyEmail: profile?.officialCompanyEmail ?? '',
      investmentSummary: profile?.investmentSummary ?? '',
    };
  }

  async updateInvestorProfile(
    userId: number,
    body: {
      companyName?: string;
      contactName?: string;
      phone?: string;
      officialCompanyEmail?: string;
      investmentSummary?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user || user.role !== 'investor') {
      throw new BadRequestException('Bu sayfa sadece investor icin');
    }

    const data = {
      companyName: String(body.companyName ?? '').trim() || null,
      contactName: String(body.contactName ?? '').trim() || null,
      phone: String(body.phone ?? '').trim() || null,
      officialCompanyEmail: String(body.officialCompanyEmail ?? '').trim() || null,
      investmentSummary: String(body.investmentSummary ?? '').trim() || null,
    };

    const existing = await this.prisma.investorProfile.findUnique({ where: { userId } });
    if (existing) {
      await this.prisma.investorProfile.update({
        where: { userId },
        data,
      });
    } else {
      await this.prisma.investorProfile.create({
        data: { userId, ...data },
      });
    }

    return this.getInvestorProfile(userId);
  }

  async setAccountHidden(userId: number, hidden: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Kullanici bulunamadi');
    setUserHidden(userId, hidden);
    return { ok: true, hidden };
  }

  async getAccountHidden(userId: number) {
    return { hidden: isUserHidden(userId) };
  }

  async deleteAccount(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Kullanici bulunamadi');

    const randomPass = `${Date.now()}-${Math.random()}`;
    const hashed = await bcrypt.hash(randomPass, 10);
    const deletedEmail = `deleted_${user.id}_${Date.now()}@deleted.local`;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: deletedEmail,
        password: hashed,
        status: 'REJECTED',
      },
    });
    setUserHidden(userId, true);
    return { ok: true };
  }

  private hashVerificationToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async createEmailVerificationToken(userId: number) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashVerificationToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    const frontendBase = process.env.FRONTEND_BASE_URL ?? 'http://localhost:3000';
    const verificationUrl = `${frontendBase}/verify-email?token=${encodeURIComponent(token)}`;
    return { token, verificationUrl };
  }

  private async sendVerificationEmail(email: string, verificationUrl: string, tokenForDevLog: string) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM ?? 'no-reply@efc-portal.local';

    if (!host || !user || !pass) {
      // SMTP yoksa gelistirme icin linki logla.
      // eslint-disable-next-line no-console
      console.log(`[Email Verification] ${email} -> ${verificationUrl}`);
      // eslint-disable-next-line no-console
      console.log(`[Email Verification Token] ${tokenForDevLog}`);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: email,
      subject: 'EFC Portal - Email Dogrulama',
      text: `Hesabinizi aktiflestirmek icin linke tiklayin: ${verificationUrl}`,
      html: `<p>Hesabinizi aktiflestirmek icin asagidaki linke tiklayin:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p>`,
    });
  }

  private normalizePhone(input?: string) {
    return String(input ?? '').replace(/[^\d+]/g, '').trim();
  }
}
