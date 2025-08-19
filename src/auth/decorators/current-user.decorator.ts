import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserDocument } from '../../users/users.schema';

// export const CurrentUser = createParamDecorator(
//   (data: unknown, context: ExecutionContext): UserDocument => {
//     const ctx = GqlExecutionContext.create(context);
//     return ctx.getContext().req.user;
//   },
// );
export type CurrentUserType = UserDocument | { firebaseUid: string };

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext): CurrentUserType => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user;
  },
);