import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsPublicController } from './projects-public.controller';
import { ProjectsService } from './projects.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectsController, ProjectsPublicController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
