import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AdminRoleGQL } from '../../admins/admin-user.model';

/**
 * Runs after AdminAuthGuard (order matters: `@UseGuards(AdminAuthGuard,
 * RolesGuard)`) and checks the authenticated admin's roles against the
 * roles required by `@Roles(...)` on the handler. No `@Roles` decorator
 * means the route only requires "some valid admin", same as before this
 * guard existed.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRoleGQL[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const ctx = GqlExecutionContext.create(context);
    const admin = ctx.getContext().req.user;
    if (!admin || !Array.isArray(admin.roles)) {
      throw new ForbiddenException('Insufficient permissions for this action.');
    }

    const hasRequiredRole = requiredRoles.some((role) =>
      admin.roles.includes(role),
    );
    if (!hasRequiredRole) {
      throw new ForbiddenException('Insufficient permissions for this action.');
    }

    return true;
  }
}
