import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('materials')
export class MaterialsController {
  constructor(private materialsService: MaterialsService) {}

  // ✅ login olan herkes görebilir
  @UseGuards(JwtAuthGuard)
  @Get()
  getAll() {
    return this.materialsService.findAll();
  }

  // ✅ sadece admin ekler/günceller
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  upsert(@Body() body: any) {
    return this.materialsService.upsert({
      name: body.name,
      unit: body.unit,
      unitPrice: Number(body.unitPrice),
      currency: body.currency,
          });
  }
}