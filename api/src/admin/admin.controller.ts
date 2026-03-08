import { Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('investors/pending')
  pendingInvestors() {
    return this.adminService.pendingInvestors();
  }

  @Post('investors/:userId/approve')
  approve(@Param('userId', ParseIntPipe) userId: number) {
    return this.adminService.approveInvestor(userId);
  }

  @Post('investors/:userId/reject')
  reject(@Param('userId', ParseIntPipe) userId: number) {
    return this.adminService.rejectInvestor(userId);
  }
}