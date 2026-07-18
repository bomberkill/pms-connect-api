import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent } from '@nestjs/graphql';
import { AdminsService } from './admins.service';
import { AdminUser } from './admin-user.model';
import { CreateAdminUserInput } from './dto/create-admin-user.input';
import { UpdateAdminUserInput } from './dto/update-admin-user.input';
import { UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard'; // Import the guard
// import { Roles } from '../auth/decorators/roles.decorator';
import { AdminUserDocument } from './admin-user.schema';
// import { RolesGuard } from '../auth/guards/roles.guard';

@Resolver(() => AdminUser)
export class AdminsResolver {
  constructor(private readonly adminUsersService: AdminsService) {}

  // IMPORTANT: All admin resolvers should be protected by authentication and authorization guards.
  // The @UseGuards and @Roles decorators are examples and assume you'll create these.

  @UseGuards(AdminAuthGuard)
  // @Roles(AdminRoleGQL.SUPER_ADMIN) // TODO: Implement Role-based access control
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

  @UseGuards(AdminAuthGuard)
  // @Roles(AdminRoleGQL.SUPER_ADMIN) // TODO: Implement Role-based access control
  @Mutation(() => AdminUser, { name: 'updateAdminUser' })
  async updateAdminUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('updateAdminUserInput') updateAdminUserInput: UpdateAdminUserInput,
  ): Promise<AdminUserDocument> {
    return this.adminUsersService.update(id, updateAdminUserInput);
  }

  // Add deleteAdminUser mutation (soft or hard delete)

  // AdminUserGQL._id predates the migration (most other GQL models use
  // `id`); kept as an alias here rather than renaming the GraphQL field, to
  // avoid an admin-panel-breaking schema change. Prisma's AdminUserModel
  // only has `.id`.
  @ResolveField('_id', () => ID)
  resolveAdminId(@Parent() admin: AdminUserDocument): string {
    return admin.id;
  }
}
