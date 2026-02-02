import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class GqlWsAuthGuard {
  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context).getContext();

    if (!ctx.user) {
      throw new UnauthorizedException('Unauthorized subscription');
    }

    return true;
  }
}
