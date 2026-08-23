import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserDocument } from '../../users/schemas/users.schema';
import { AdminUserDocument } from '../../admins/admin-user.schema';

// export const CurrentUser = createParamDecorator(
//   (data: unknown, context: ExecutionContext): UserDocument => {
//     const ctx = GqlExecutionContext.create(context);
//     return ctx.getContext().req.user;
//   },
// );
// Under BetterAuthGuard-only routes, req.user is always one of these two
// shapes — never an AdminUserDocument (admin tokens don't verify as Better
// Auth JWTs, so BetterAuthGuard itself rejects them before a resolver runs).
export type AppUserType = UserDocument | { authUserId: string };

// Under CombinedAuthGuard, req.user may also be an AdminUserDocument (admin
// panel JWT).
export type CurrentUserType = AppUserType | AdminUserDocument;

export function isAdminUser(
  user: CurrentUserType | null | undefined,
): user is AdminUserDocument {
  return !!user && 'roles' in user;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext): CurrentUserType => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user;
  },
);
