-- Exclusive-arc integrity for polymorphic relations (Like, Bookmark, Media,
-- Notification): Prisma's schema DSL can express the nullable FKs but not
-- "exactly one of these is set" or partial unique indexes, so both are
-- added here by hand.

-- Like: exactly one of postId/commentId must be set, and a user may like a
-- given post/comment at most once. A plain @@unique([userId, postId,
-- commentId]) would NOT catch duplicates, since Postgres treats NULL as
-- distinct from NULL — hence the two partial indexes below instead.
ALTER TABLE "Like" ADD CONSTRAINT "Like_exactly_one_target" CHECK (
  (("postId" IS NOT NULL)::int + ("commentId" IS NOT NULL)::int) = 1
);
CREATE UNIQUE INDEX "Like_userId_postId_key" ON "Like" ("userId", "postId") WHERE "commentId" IS NULL;
CREATE UNIQUE INDEX "Like_userId_commentId_key" ON "Like" ("userId", "commentId") WHERE "postId" IS NULL;

-- Bookmark: same pattern as Like.
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_exactly_one_target" CHECK (
  (("postId" IS NOT NULL)::int + ("commentId" IS NOT NULL)::int) = 1
);
CREATE UNIQUE INDEX "Bookmark_userId_postId_key" ON "Bookmark" ("userId", "postId") WHERE "commentId" IS NULL;
CREATE UNIQUE INDEX "Bookmark_userId_commentId_key" ON "Bookmark" ("userId", "commentId") WHERE "postId" IS NULL;

-- Media: exactly one of postId/commentId (no uniqueness needed — a post or
-- comment can have many media items).
ALTER TABLE "Media" ADD CONSTRAINT "Media_exactly_one_owner" CHECK (
  (("postId" IS NOT NULL)::int + ("commentId" IS NOT NULL)::int) = 1
);

-- Notification: at most one of postId/commentId/groupId/targetUserId is the
-- subject of the notification (separate from senderId/recipientId, which
-- are always set). Unlike Like/Bookmark/Media, a notification can have NO
-- entity target at all (e.g. CONNECTION_REQUEST just says "someone sent you
-- a request" — there's no post/comment/group/user-profile to link to beyond
-- the sender already carried in senderId).
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_at_most_one_target" CHECK (
  (("postId" IS NOT NULL)::int + ("commentId" IS NOT NULL)::int + ("groupId" IS NOT NULL)::int + ("targetUserId" IS NOT NULL)::int) <= 1
);
