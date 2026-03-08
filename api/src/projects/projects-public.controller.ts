import { Controller, Get, Query } from '@nestjs/common';
import { ProjectsService } from './projects.service';

@Controller('public/projects')
export class ProjectsPublicController {
  constructor(private projectsService: ProjectsService) {}

  @Get('market-preview')
  marketPreview(@Query('limit') limit?: string) {
    return this.projectsService.findMarketPreview(Number(limit ?? 3));
  }
}
