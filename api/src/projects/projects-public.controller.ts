import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProjectsService } from './projects.service';

@Controller('public/projects')
export class ProjectsPublicController {
  constructor(private projectsService: ProjectsService) {}

  @Get('market-preview')
  marketPreview(@Query('limit') limit?: string) {
    return this.projectsService.findMarketPreview(Number(limit ?? 3));
  }

  @Get('market/:id')
  marketById(@Param('id') id: string) {
    return this.projectsService.findMarketById(Number(id));
  }
}
