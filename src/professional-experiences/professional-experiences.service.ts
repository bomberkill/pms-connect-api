import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfessionalExperienceInput } from './dto/create-professional-experience.input';
import { UpdateProfessionalExperienceInput } from './dto/update-professional-experience.input';

@Injectable()
export class ProfessionalExperiencesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string) {
    return this.prisma.professionalExperience.findMany({
      where: { userId },
      orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, input: CreateProfessionalExperienceInput) {
    this.assertDateRange(input.startDate, input.endDate, input.isCurrent);

    return this.prisma.professionalExperience.create({
      data: {
        userId,
        title: input.title.trim(),
        organizationName: input.organizationName.trim(),
        employmentType: input.employmentType?.trim() || null,
        location: input.location?.trim() || null,
        startDate: input.startDate,
        endDate: input.isCurrent ? null : input.endDate,
        isCurrent: input.isCurrent,
        description: input.description?.trim() || null,
      },
    });
  }

  async update(
    userId: string,
    experienceId: string,
    input: UpdateProfessionalExperienceInput,
  ) {
    const existing = await this.findOwnedExperience(userId, experienceId);
    const nextStartDate = input.startDate ?? existing.startDate;
    const nextIsCurrent = input.isCurrent ?? existing.isCurrent;
    const nextEndDate = nextIsCurrent ? null : input.endDate ?? existing.endDate;

    this.assertDateRange(nextStartDate, nextEndDate, nextIsCurrent);

    return this.prisma.professionalExperience.update({
      where: { id: experienceId },
      data: {
        ...(input.title !== undefined && { title: input.title.trim() }),
        ...(input.organizationName !== undefined && {
          organizationName: input.organizationName.trim(),
        }),
        ...(input.employmentType !== undefined && {
          employmentType: input.employmentType?.trim() || null,
        }),
        ...(input.location !== undefined && {
          location: input.location?.trim() || null,
        }),
        ...(input.startDate !== undefined && { startDate: input.startDate }),
        ...(input.isCurrent !== undefined && { isCurrent: input.isCurrent }),
        ...((input.endDate !== undefined || input.isCurrent !== undefined) && {
          endDate: nextEndDate,
        }),
        ...(input.description !== undefined && {
          description: input.description?.trim() || null,
        }),
      },
    });
  }

  async remove(userId: string, experienceId: string): Promise<void> {
    await this.findOwnedExperience(userId, experienceId);
    await this.prisma.professionalExperience.delete({
      where: { id: experienceId },
    });
  }

  private async findOwnedExperience(userId: string, experienceId: string) {
    const experience = await this.prisma.professionalExperience.findUnique({
      where: { id: experienceId },
    });

    if (!experience) {
      throw new NotFoundException('Professional experience not found.');
    }

    if (experience.userId !== userId) {
      throw new ForbiddenException('You can only manage your own experiences.');
    }

    return experience;
  }

  private assertDateRange(startDate: Date, endDate?: Date | null, isCurrent = false) {
    if (!isCurrent && endDate && endDate < startDate) {
      throw new BadRequestException('endDate must be after startDate.');
    }
  }
}
