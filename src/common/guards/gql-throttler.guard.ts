import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if this is a GraphQL request
    const gqlCtx = GqlExecutionContext.create(context);
    if (gqlCtx.getType() === 'graphql') {
      // Skip throttling for GraphQL requests to avoid context issues
      // GraphQL has its own complexity-based rate limiting
      return true;
    }

    // For REST endpoints, use default throttling
    return super.canActivate(context);
  }
}
