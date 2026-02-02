import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AdminUserDocument } from '../../admins/admin-user.schema';

export const CurrentUser = createParamDecorator(
  // Renamed to CurrentUser for consistency, or keep as CurrentAdminUser
  (data: unknown, context: ExecutionContext): AdminUserDocument => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user; // 'user' is populated by Passport
  },
);
