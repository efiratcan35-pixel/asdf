import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MaterialsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.material.findMany({
      orderBy: { name: 'asc' },
    });
  }

  upsert(data: { name: string; unit: string; unitPrice: number; currency?: string }) {
    return this.prisma.material.upsert({
      where: { name: data.name },
      update: {
        unit: data.unit,
        unitPrice: data.unitPrice,
        currency: data.currency ?? 'TRY',
      },
      create: {
        name: data.name,
        unit: data.unit,
        unitPrice: data.unitPrice,
        currency: data.currency ?? 'TRY',
      },
    });
  }
}