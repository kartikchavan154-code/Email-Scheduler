-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SCHEDULED', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "googleId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sender" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "hourlyLimit" INTEGER NOT NULL DEFAULT 200,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "delayBetweenEmails" INTEGER NOT NULL DEFAULT 2,
    "hourlyLimit" INTEGER NOT NULL DEFAULT 200,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "batchId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "EmailStatus" NOT NULL DEFAULT 'SCHEDULED',
    "bullmqJobId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "etherealPreviewUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slackWorkspaceId" TEXT NOT NULL,
    "slackWorkspaceName" TEXT,
    "channelId" TEXT,
    "encryptedOAuthToken" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_googleId_idx" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "Sender_userId_idx" ON "Sender"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Sender_userId_email_key" ON "Sender"("userId", "email");

-- CreateIndex
CREATE INDEX "EmailBatch_userId_idx" ON "EmailBatch"("userId");

-- CreateIndex
CREATE INDEX "EmailBatch_createdAt_idx" ON "EmailBatch"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Email_idempotencyKey_key" ON "Email"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Email_userId_status_idx" ON "Email"("userId", "status");

-- CreateIndex
CREATE INDEX "Email_userId_scheduledAt_idx" ON "Email"("userId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Email_userId_sentAt_idx" ON "Email"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "Email_senderId_scheduledAt_idx" ON "Email"("senderId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Email_bullmqJobId_idx" ON "Email"("bullmqJobId");

-- CreateIndex
CREATE INDEX "Email_status_scheduledAt_idx" ON "Email"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlackConnection_userId_key" ON "SlackConnection"("userId");

-- CreateIndex
CREATE INDEX "SlackConnection_userId_idx" ON "SlackConnection"("userId");

-- AddForeignKey
ALTER TABLE "Sender" ADD CONSTRAINT "Sender_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailBatch" ADD CONSTRAINT "EmailBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Sender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "EmailBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlackConnection" ADD CONSTRAINT "SlackConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

