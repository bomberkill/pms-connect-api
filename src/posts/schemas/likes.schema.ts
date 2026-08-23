// Thin compatibility shim — see users/schemas/users.schema.ts for rationale.
// The old Mongoose shape was polymorphic (`likeableId` + `likeableType`
// discriminator, no real FK). Prisma models this as an "exclusive arc"
// instead (nullable `postId`/`commentId`, exactly one set — enforced by a
// CHECK constraint, see prisma/migrations). LikesService's public method
// signatures still take `(likeableId, likeableType)` for minimal resolver
// disruption; only its internals map to postId/commentId.
export type { LikeModel as LikeDocument } from '../../../generated/prisma/models';
