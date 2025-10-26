import { Resolver, Mutation, Args, Context, Query } from '@nestjs/graphql';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginInput, AdminLoginResponse } from '../admins/dto/admin-login.input';
import { UseGuards } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';
import { AdminLocalAuthGuard } from './guards/admin-local-auth.guard'; // Import the new custom guard
import { AdminUserDocument } from '../admins/admin-user.schema';
// This decorator is for accessing the user object attached by Passport's LocalStrategy
import { CurrentUser as CurrentAdminUser } from './decorators/current-admin-user.decorator'; // We'll create this
import { RequestAdminPasswordResetInput, ResetAdminPasswordInput } from '../admins/dto/admin-password-reset.input';
import { AdminAuthGuard } from './guards/admin-auth.guard'; // Ensure this is imported
import { VerifyAdminTokenInput } from '../admin-auth/dto/VerifyAdminTokenInput'; // <-- Import new DTO
import { AdminUser } from '../admins/admin-user.model'; // For return type

@Resolver()
export class AdminAuthResolver {
    constructor(private adminAuthService: AdminAuthService) {}

    // @UseGuards(AuthGuard('admin-local')) // Use the 'admin-local' strategy for this mutation
    @UseGuards(AdminLocalAuthGuard) // Use the new custom AdminLocalAuthGuard
    @Mutation(() => AdminLoginResponse, { name: 'adminLogin' })
    async adminLogin(
      @Args('adminLoginInput') adminLoginInput: AdminLoginInput, // DTO is used by LocalStrategy implicitly
      @CurrentAdminUser() admin: AdminUserDocument, // Get the admin user validated by LocalStrategy
    ): Promise<AdminLoginResponse> {
      // If LocalStrategy succeeded, 'admin' will be populated.
      // The adminAuthService.login method will generate the JWT.
      return this.adminAuthService.login(admin);
    }

    @Mutation(() => Boolean, { name: 'requestAdminPasswordReset', description: 'Initiates the password reset process for an admin.' })
    async requestAdminPasswordReset(
      @Args('requestAdminPasswordResetInput')
      requestAdminPasswordResetInput: RequestAdminPasswordResetInput,
    ): Promise<boolean> {
      await this.adminAuthService.requestPasswordReset(requestAdminPasswordResetInput.email);
      return true; // Always return true to prevent email enumeration
    }

    @Mutation(() => AdminUser, { name: 'resetAdminPassword', description: 'Resets the admin password using a token.' })
    async resetAdminPassword(
      @Args('resetAdminPasswordInput')
      resetAdminPasswordInput: ResetAdminPasswordInput,
    ): Promise<AdminUserDocument> {
      return this.adminAuthService.performPasswordResetAndNotify(
        resetAdminPasswordInput.token,
        resetAdminPasswordInput.newPassword,
      );

    }

    @Mutation(() => Boolean, { name: 'verifyAdminToken', description: 'Checks if an admin JWT is valid.' })
    async verifyAdminToken(
      @Args('verifyAdminTokenInput') verifyAdminTokenInput: VerifyAdminTokenInput,
    ): Promise<boolean> {
      return this.adminAuthService.verifyAdminToken(verifyAdminTokenInput.token);
    }

    @UseGuards(AdminAuthGuard) // Protect this query with JWT authentication
    @Query(() => AdminUser, { name: 'adminMe', description: 'Gets the currently authenticated admin user.' })
    async adminMe(
      @CurrentAdminUser() admin: AdminUserDocument, // Inject the authenticated admin user
    ): Promise<AdminUserDocument> {
      // The AdminUserDocument from the guard might contain sensitive fields.
      // Ensure your AdminUser GraphQL model only exposes necessary fields.
      return admin;
    }


}
