import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';

const uploadsDir = join(process.cwd(), 'uploads', 'projects');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.projectsService.create(req.user.sub, body);
  }

  @Get()
  mine(@Req() req: any) {
    return this.projectsService.findMine(req.user.sub);
  }

  @Get('market')
  market() {
    return this.projectsService.findMarket();
  }

  @Get('market/:id')
  marketById(@Param('id') id: string) {
    return this.projectsService.findMarketById(Number(id));
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.projectsService.update(req.user.sub, Number(id), body);
  }

  @Post(':id/photos')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadsDir,
        filename: (_, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 30 * 1024 * 1024 },
    }),
  )
  addPhoto(
    @Req() req: any,
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body('caption') caption?: string,
  ) {
    if (!file) throw new BadRequestException('Dosya gerekli');
    return this.projectsService.addPhoto(req.user.sub, Number(id), `/uploads/projects/${file.filename}`, caption);
  }

  @Delete('photos/:photoId')
  removePhoto(@Req() req: any, @Param('photoId') photoId: string) {
    return this.projectsService.removePhoto(req.user.sub, Number(photoId));
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.remove(req.user.sub, Number(id));
  }

  @Post(':id/offers')
  createOffer(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { workItem?: string; priceText?: string; priceTry?: string | number },
  ) {
    return this.projectsService.createOffer(req.user.sub, Number(id), body);
  }

  @Get('offers/my')
  myOffers(@Req() req: any) {
    return this.projectsService.listMyOffers(req.user.sub);
  }

  @Get('offers/notifications/summary')
  offerNotificationSummary(@Req() req: any) {
    return this.projectsService.getOfferNotificationSummary(req.user.sub);
  }

  @Post('offers/notifications/mark-read')
  markOfferNotificationsRead(@Req() req: any) {
    return this.projectsService.markOfferNotificationsRead(req.user.sub);
  }

  @Get(':id/offers')
  offersForProject(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.listOffersForProject(req.user.sub, Number(id));
  }
}
