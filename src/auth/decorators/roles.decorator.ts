import { SetMetadata } from '@nestjs/common';
import { AdminRoleGQL } from '../../admins/admin-user.model';

export const ROLES_KEY = 'roles';

/**
 * Restricts an AdminAuthGuard-protected resolver to admins holding at
 * least one of the given roles. Must be combined with AdminAuthGuard (which
 * populates req.user) — RolesGuard alone does not authenticate.
 */
export const Roles = (...roles: AdminRoleGQL[]) => SetMetadata(ROLES_KEY, roles);
