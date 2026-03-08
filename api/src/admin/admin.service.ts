import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ✅ pending investor listesi
  pendingInvestors() {
    return this.prisma.user.findMany({
      where: { role: 'investor', status: 'PENDING' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        investorProfile: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ✅ approve
  async approveInvestor(userId: number) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new BadRequestException('User bulunamadı');
    if (u.role !== 'investor') throw new BadRequestException('Bu kullanıcı investor değil');

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.APPROVED },
      select: { id: true, email: true, role: true, status: true },
    });
  }

  // ✅ reject
  async rejectInvestor(userId: number) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new BadRequestException('User bulunamadı');
    if (u.role !== 'investor') throw new BadRequestException('Bu kullanıcı investor değil');

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.REJECTED },
      select: { id: true, email: true, role: true, status: true },
    });
  }
}