import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent } from '@nestjs/graphql';
import { AdminsService } from './admins.service';
import { AdminUser, AdminRoleGQL } from './admin-user.model';
import { CreateAdminUserInput } from './dto/create-admin-user.input';
import { UpdateAdminUserInput } from './dto/update-admin-user.input';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard'; // Import the guard
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminUserDocument } from './admin-user.schema';
import { CurrentUser as CurrentAdminUser } from '../admin-auth/decorators/current-admin-user.decorator';

@Resolver(() => AdminUser)
export class AdminsResolver {
  constructor(private readonly adminUsersService: AdminsService) {}

  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRoleGQL.SUPER_ADMIN)
  @Mutation(() => AdminUser, { name: 'createAdminUser' })
  async createAdminUser(
    @Args('createAdminUserInput') createAdminUserInput: CreateAdminUserInput,
  ): Promise<AdminUserDocument> {
    return this.adminUsersService.create(createAdminUserInput);
  }

  @UseGuards(AdminAuthGuard)
  @Query(() => [AdminUser], { name: 'allAdminUsers' })
  async getAllAdminUsers(): Promise<AdminUserDocument[]> {
    return this.adminUsersService.findAll();
  }

  @UseGuards(AdminAuthGuard)
  @Query(() => AdminUser, { name: 'adminUser', nullable: true })
  async getAdminUserById(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AdminUserDocument | null> {
    const adminDoc = await this.adminUsersService.findById(id);
    if (!adminDoc) {
      return null;
    }
    return adminDoc;
  }

  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRoleGQL.SUPER_ADMIN)
  @Mutation(() => AdminUser, { name: 'updateAdminUser' })
  async updateAdminUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('updateAdminUserInput') updateAdminUserInput: UpdateAdminUserInput,
  ): Promise<AdminUserDocument> {
    return this.adminUsersService.update(id, updateAdminUserInput);
  }

  // Soft-delete: flips `isActive` to false, which admin-jwt.strategy.ts
  // already checks on every request — existing sessions are invalidated
  // immediately, no separate token revocation needed.
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRoleGQL.SUPER_ADMIN)
  @Mutation(() => Boolean, { name: 'removeAdminUser' })
  async removeAdminUser(
    @Args('id', { type: () => ID }) id: string,
    @CurrentAdminUser() currentAdmin: AdminUserDocument,
  ): Promise<boolean> {
    if (id === currentAdmin.id) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }
    await this.adminUsersService.remove(id);
    return true;
  }

  // AdminUserGQL._id predates the migration (most other GQL models use
  // `id`); kept as an alias here rather than renaming the GraphQL field, to
  // avoid an admin-panel-breaking schema change. Prisma's AdminUserModel
  // only has `.id`.
  @ResolveField('_id', () => ID)
  resolveAdminId(@Parent() admin: AdminUserDocument): string {
    return admin.id;
  }
}
