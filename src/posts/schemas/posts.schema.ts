// Thin compatibility shim — see users/schemas/users.schema.ts for rationale.
// Note the field rename: Mongoose had `author: string` (a de-refed ObjectId
// ref); Prisma's real column is `authorId` (its FK-naming convention) — call
// sites were updated to match rather than aliasing it back to `author`.
export type { PostModel as PostDocument } from '../../../generated/prisma/models';
export { PostStatus, MediaType } from '../../../generated/prisma/enums';

// MediaItem is now its own Prisma table (Media), not an embedded subdoc —
// this GraphQL-facing shape is kept only for the input DTOs that still
// accept { url, type } pairs.
export class MediaItem {
  url: string;
  type: string;
}
