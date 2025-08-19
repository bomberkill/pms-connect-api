import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { AdminsService } from './admins.service';
import { AdminUser } from './admin-user.model';
import { CreateAdminUserInput } from './dto/create-admin-user.input';
import { UpdateAdminUserInput } from './dto/update-admin-user.input';
import { UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard'; // Import the guard
// import { Roles } from '../auth/decorators/roles.decorator';
// import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminRoleGQL } from './admin-user.model';

@Resolver(() => AdminUser)
export class AdminsResolver {
    constructor(private readonly adminUsersService: AdminsService) {}

  // IMPORTANT: All admin resolvers should be protected by authentication and authorization guards.
  // The @UseGuards and @Roles decorators are examples and assume you'll create these.

  // @UseGuards(AdminAuthGuard, RolesGuard)
  // @Roles(AdminRoleGQL.SUPER_ADMIN) // Example: Only SUPER_ADMIN can create admins
  @Mutation(() => AdminUser, { name: 'createAdminUser' })
  async createAdminUser(
    @Args('createAdminUserInput') createAdminUserInput: CreateAdminUserInput,
  ): Promise<AdminUser> {
    const adminDoc = await this.adminUsersService.create(createAdminUserInput);
    return adminDoc as unknown as AdminUser;
  }

//   @UseGuards(AdminAuthGuard)
  @Query(() => [AdminUser], { name: 'allAdminUsers' })
  async getAllAdminUsers(): Promise<AdminUser[]> {
    const adminDocs = await this.adminUsersService.findAll();
    return adminDocs.map((doc) => doc as unknown as AdminUser);
  }

  @UseGuards(AdminAuthGuard)
  @Query(() => AdminUser, { name: 'adminUser', nullable: true })
  async getAdminUserById(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AdminUser | null> {
    const adminDoc = await this.adminUsersService.findById(id);
    if (!adminDoc) {
      return null;
    }
    return adminDoc as unknown as AdminUser;
  }

  // @UseGuards(AdminAuthGuard, RolesGuard)
  // @Roles(AdminRoleGQL.SUPER_ADMIN) // Example: Only SUPER_ADMIN can update admins
  @Mutation(() => AdminUser, { name: 'updateAdminUser' })
  async updateAdminUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('updateAdminUserInput') updateAdminUserInput: UpdateAdminUserInput,
  ): Promise<AdminUser> {
    const adminDoc = await this.adminUsersService.update(id, updateAdminUserInput);
    return adminDoc as unknown as AdminUser;
  }

  // Add deleteAdminUser mutation (soft or hard delete)
}
