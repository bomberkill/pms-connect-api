import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class FirebaseAuthGuard extends AuthGuard('firebase') {
  // Override getRequest() to work with GraphQL
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }

  // You can also override handleRequest for custom error handling if needed
  // handleRequest(err, user, info, context, status) {
  //   return super.handleRequest(err, user, info, context, status);
  // }
}