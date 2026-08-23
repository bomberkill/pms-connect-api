-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'POST_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'POST_REJECTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PostStatus" ADD VALUE 'PENDING';
ALTER TYPE "PostStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "postsRequireApproval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "restrictToVerifiedTitles" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rules" TEXT[] DEFAULT ARRAY[]::TEXT[];
