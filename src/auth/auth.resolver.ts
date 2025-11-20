import { Args, Query, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { CheckUserExistsResponse } from './auth.model';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Query(() => CheckUserExistsResponse, { name: 'checkUserExistsByEmail' })
  async checkUserExistsByEmail(
    @Args('email', { type: () => String }) email: string,
  ): Promise<{exists: boolean, hasPassword: boolean, providers: string[]}> {
    return this.authService.checkUserExistsByEmail(email);
  }

  @Query(() => CheckUserExistsResponse, { name: 'checkUserExistsByPhoneNumber' })
  async checkUserExistsByPhoneNumber(
    @Args('phoneNumber', { type: () => String }) phoneNumber: string,
  ): Promise<CheckUserExistsResponse> {
    return this.authService.checkUserExistsByPhoneNumber(phoneNumber);
  }
}
