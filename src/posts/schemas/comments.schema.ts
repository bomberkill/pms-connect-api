// Thin compatibility shim — see users/schemas/users.schema.ts for rationale.
export type { CommentModel as CommentDocument } from '../../../generated/prisma/models';
export { CommentStatus } from '../../../generated/prisma/enums';
