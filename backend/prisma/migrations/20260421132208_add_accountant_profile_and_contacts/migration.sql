/*
  Warnings:

  - You are about to drop the column `assignedTo` on the `Task` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Review` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Status" ADD VALUE 'NEEDS_REVIEW';
ALTER TYPE "Status" ADD VALUE 'DONE';
ALTER TYPE "Status" ADD VALUE 'REJECTED';
ALTER TYPE "Status" ADD VALUE 'VALIDATED';

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_assignedTo_fkey";

-- DropIndex
DROP INDEX "Task_assignedTo_idx";

-- AlterTable
ALTER TABLE "Conversation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "color" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "guests" TEXT,
ADD COLUMN     "locationDetail" TEXT,
ADD COLUMN     "pvUrl" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "subject" TEXT;

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "creatorId" TEXT;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "assignedTo",
ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "clientDeadline" TIMESTAMP(3),
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "taskNumber" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activitySector" TEXT,
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "cinUrl" TEXT,
ADD COLUMN     "diplomaUrl" TEXT,
ADD COLUMN     "experienceLevel" TEXT,
ADD COLUMN     "headquarters" TEXT,
ADD COLUMN     "hireDate" TIMESTAMP(3),
ADD COLUMN     "legalType" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "mapsLink" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "rcNumber" TEXT,
ADD COLUMN     "whatsapp" TEXT;

-- CreateTable
CREATE TABLE "MeetingAvailability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "meetingDuration" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountantLeave" (
    "id" TEXT NOT NULL,
    "accountantId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountantLeave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountantProfile" (
    "id" TEXT NOT NULL,
    "accountantId" TEXT NOT NULL,
    "companyName" TEXT,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phone" TEXT,
    "email" TEXT,
    "location" TEXT,
    "mapsLink" TEXT,
    "bio" TEXT,
    "yearsExperience" INTEGER,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "isListed" BOOLEAN NOT NULL DEFAULT true,
    "profileImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountantProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountantContact" (
    "id" TEXT NOT NULL,
    "accountantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNREAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountantContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailDailySummary" BOOLEAN NOT NULL DEFAULT true,
    "emailMeetingReminders" BOOLEAN NOT NULL DEFAULT true,
    "emailTaskUpdates" BOOLEAN NOT NULL DEFAULT true,
    "emailNewDocuments" BOOLEAN NOT NULL DEFAULT true,
    "inAppNotifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TaskAssignees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskAssignees_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "MeetingAvailability_userId_idx" ON "MeetingAvailability"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAvailability_userId_dayOfWeek_startTime_key" ON "MeetingAvailability"("userId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "AccountantLeave_accountantId_idx" ON "AccountantLeave"("accountantId");

-- CreateIndex
CREATE INDEX "AccountantLeave_startDate_idx" ON "AccountantLeave"("startDate");

-- CreateIndex
CREATE UNIQUE INDEX "AccountantProfile_accountantId_key" ON "AccountantProfile"("accountantId");

-- CreateIndex
CREATE INDEX "AccountantProfile_accountantId_idx" ON "AccountantProfile"("accountantId");

-- CreateIndex
CREATE INDEX "AccountantProfile_isListed_idx" ON "AccountantProfile"("isListed");

-- CreateIndex
CREATE INDEX "AccountantProfile_createdAt_idx" ON "AccountantProfile"("createdAt");

-- CreateIndex
CREATE INDEX "AccountantContact_accountantId_idx" ON "AccountantContact"("accountantId");

-- CreateIndex
CREATE INDEX "AccountantContact_clientId_idx" ON "AccountantContact"("clientId");

-- CreateIndex
CREATE INDEX "AccountantContact_status_idx" ON "AccountantContact"("status");

-- CreateIndex
CREATE INDEX "AccountantContact_createdAt_idx" ON "AccountantContact"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "_TaskAssignees_B_index" ON "_TaskAssignees"("B");

-- CreateIndex
CREATE INDEX "Folder_archived_idx" ON "Folder"("archived");

-- CreateIndex
CREATE INDEX "Request_creatorId_idx" ON "Request"("creatorId");

-- CreateIndex
CREATE INDEX "Task_archived_idx" ON "Task"("archived");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountantLeave" ADD CONSTRAINT "AccountantLeave_accountantId_fkey" FOREIGN KEY ("accountantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountantProfile" ADD CONSTRAINT "AccountantProfile_accountantId_fkey" FOREIGN KEY ("accountantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountantContact" ADD CONSTRAINT "AccountantContact_accountantId_fkey" FOREIGN KEY ("accountantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountantContact" ADD CONSTRAINT "AccountantContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskAssignees" ADD CONSTRAINT "_TaskAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskAssignees" ADD CONSTRAINT "_TaskAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
