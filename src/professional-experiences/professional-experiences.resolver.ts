import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BetterAuthGuard } from '../auth/guards/better-auth.guard';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/users.schema';
import { CreateProfessionalExperienceInput } from './dto/create-professional-experience.input';
import { UpdateProfessionalExperienceInput } from './dto/update-professional-experience.input';
import { ProfessionalExperienceGQL } from './models/professional-experience.model';
import { ProfessionalExperiencesService } from './professional-experiences.service';

@Resolver(() => ProfessionalExperienceGQL)
export class ProfessionalExperiencesResolver {
  constructor(
    private readonly professionalExperiencesService: ProfessionalExperiencesService,
  ) {}

  @UseGuards(CombinedAuthGuard)
  @Query(() => [ProfessionalExperienceGQL], {
    name: 'getProfessionalExperiences',
  })
  getProfessionalExperiences(
    @Args('userId', { type: () => ID }) userId: string,
  ) {
    return this.professionalExperiencesService.findByUserId(userId);
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => ProfessionalExperienceGQL, {
    name: 'addProfessionalExperience',
  })
  addProfessionalExperience(
    @Args('input') input: CreateProfessionalExperienceInput,
    @CurrentUser() currentUser: UserDocument,
  ) {
    return this.professionalExperiencesService.create(currentUser.id, input);
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => ProfessionalExperienceGQL, {
    name: 'updateProfessionalExperience',
  })
  updateProfessionalExperience(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateProfessionalExperienceInput,
    @CurrentUser() currentUser: UserDocument,
  ) {
    return this.professionalExperiencesService.update(currentUser.id, id, input);
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, {
    name: 'removeProfessionalExperience',
  })
  async removeProfessionalExperience(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() currentUser: UserDocument,
  ): Promise<boolean> {
    await this.professionalExperiencesService.remove(currentUser.id, id);
    return true;
  }
}
