-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MENTION';

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notifyReplies" BOOLEAN NOT NULL DEFAULT true,
    "notifyMentions" BOOLEAN NOT NULL DEFAULT true,
    "notifyConnectionRequests" BOOLEAN NOT NULL DEFAULT true,
    "notifyReactions" BOOLEAN NOT NULL DEFAULT false,
    "notifyGroupActivity" BOOLEAN NOT NULL DEFAULT true,
    "notifyEstablishmentAnnouncements" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "weeklyEmailDigest" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
