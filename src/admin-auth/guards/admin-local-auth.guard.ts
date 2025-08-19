import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, tap } from 'rxjs';

@Injectable()
export class AdminLocalAuthGuard extends AuthGuard('admin-local') {
    private readonly logger = new Logger(AdminLocalAuthGuard.name); // Optionnel
  constructor() {
    super({
      session: false, // Explicitly disable session for this guard instance
    });
    console.log('AdminLocalAuthGuard: CONSTRUCTOR CALLED');
    this.logger.log('AdminLocalAuthGuard: CONSTRUCTOR CALLED (using Nest Logger)'); // Optionnel
  }

  canActivate(context: ExecutionContext) {
    console.log('AdminLocalAuthGuard: CANACTIVATE CALLED');
    this.logger.log('AdminLocalAuthGuard: CANACTIVATE CALLED (using Nest Logger)'); // Optionnel
    return super.canActivate(context);
  }
//   canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
//     console.log('AdminLocalAuthGuard: CANACTIVATE CALLED');
//     this.logger.log('AdminLocalAuthGuard: CANACTIVATE CALLED (using Nest Logger)'); // Optionnel
//     // return super.canActivate(context);
//     const result = super.canActivate(context);

//     if (result instanceof Observable) {
//       return result.pipe(
//         tap(val => console.log('AdminLocalAuthGuard: super.canActivate Observable result:', val)),
//         tap({ error: err => console.error('AdminLocalAuthGuard: super.canActivate Observable error:', err) })
//       );
//     }
//     console.log('AdminLocalAuthGuard: super.canActivate sync/promise result:', result);
//     return result;
//   }

  getRequest(context: ExecutionContext) {
    console.log('AdminLocalAuthGuard: GETREQUEST CALLED');
    this.logger.log('AdminLocalAuthGuard: GETREQUEST CALLED (using Nest Logger)'); // Optionnel
    // const ctx = GqlExecutionContext.create(context);
    // return ctx.getContext().req;
    const gqlExecutionContext = GqlExecutionContext.create(context);
    const gqlContext = gqlExecutionContext.getContext();
    const gqlArgs = gqlExecutionContext.getArgs();

    // Merge GraphQL arguments into req.body so passport-local can find them
    // The 'adminLoginInput' key comes from your @Args('adminLoginInput') decorator
    // in AdminAuthResolver. The local strategy expects 'email' and 'password' at the top level of req.body.
    // So, we spread the contents of gqlArgs.adminLoginInput into req.body.
    gqlContext.req.body = { ...gqlContext.req.body, ...gqlArgs.adminLoginInput };
    return gqlContext.req;
  }

  // You can override handleRequest for custom error handling if needed,
  // for example, to throw a specific GraphQL error.
}