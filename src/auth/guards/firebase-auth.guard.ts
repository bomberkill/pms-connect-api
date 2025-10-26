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
  // getRequest(context: ExecutionContext) {
  //   const gqlCtx = GqlExecutionContext.create(context);
  //   const ctx = gqlCtx.getContext();
  //   if(ctx.req) {
  //     return ctx.req;
  //   }
  //   if(ctx.connectionParams) {
  //     return {
  //       headers: {
  //         authorization: ctx.connectionParams?.authorization || '',
  //       },
  //     };
  //   }

  //   if (ctx.user) {
  //     // Si l'utilisateur a déjà été injecté par onConnect, Passport peut l'ignorer
  //     return { user: ctx.user };
  //   }

  //   throw new UnauthorizedException('Invalid request context');
  // }

  // You can also override handleRequest for custom error handling if needed
  // handleRequest(err, user, info, context, status) {
  //   return super.handleRequest(err, user, info, context, status);
  // }
}