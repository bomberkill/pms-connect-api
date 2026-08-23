// Thin compatibility shim — see users/schemas/users.schema.ts for rationale.
// Prisma's Bookmark model doesn't need a stored `itemType` discriminator —
// it uses the same "exclusive arc" (postId/commentId) as Like — but
// BookmarkableType stays as a plain enum since it's still a real part of
// the GraphQL-facing API (addBookmark/removeBookmark take an itemType arg).
export type { BookmarkModel as BookmarkDocument } from '../../../generated/prisma/models';

export enum BookmarkableType {
  POST = 'Post',
  COMMENT = 'Comment',
}
