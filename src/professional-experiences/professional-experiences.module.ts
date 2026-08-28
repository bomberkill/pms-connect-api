import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfessionalExperiencesResolver } from './professional-experiences.resolver';
import { ProfessionalExperiencesService } from './professional-experiences.service';

@Module({
  imports: [PrismaModule],
  providers: [ProfessionalExperiencesResolver, ProfessionalExperiencesService],
  exports: [ProfessionalExperiencesService],
})
export class ProfessionalExperiencesModule {}
