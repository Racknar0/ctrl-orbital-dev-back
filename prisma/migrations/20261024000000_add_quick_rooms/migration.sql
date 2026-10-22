-- CreateEnum
CREATE TYPE "QuickRoomStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "QuickRoomRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "QuickRoomSettlementStatus" AS ENUM ('REPORTED', 'CONFIRMED');

-- CreateTable
CREATE TABLE "QuickRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "invitationCode" TEXT NOT NULL,
    "status" "QuickRoomStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickRoomParticipant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "QuickRoomRole" NOT NULL DEFAULT 'MEMBER',
    "guestTokenHash" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "paymentHolder" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuickRoomParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickRoomExpense" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "paidByParticipantId" TEXT NOT NULL,
    "createdByParticipantId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickRoomExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickRoomExpenseShare" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "QuickRoomExpenseShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickRoomSettlement" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "fromParticipantId" TEXT NOT NULL,
    "toParticipantId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "QuickRoomSettlementStatus" NOT NULL DEFAULT 'REPORTED',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuickRoomSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuickRoom_invitationCode_key" ON "QuickRoom"("invitationCode");

-- CreateIndex
CREATE UNIQUE INDEX "QuickRoomParticipant_guestTokenHash_key" ON "QuickRoomParticipant"("guestTokenHash");

-- CreateIndex
CREATE INDEX "QuickRoomParticipant_roomId_idx" ON "QuickRoomParticipant"("roomId");

-- CreateIndex
CREATE INDEX "QuickRoomExpense_roomId_idx" ON "QuickRoomExpense"("roomId");

-- CreateIndex
CREATE INDEX "QuickRoomExpenseShare_participantId_idx" ON "QuickRoomExpenseShare"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "QuickRoomExpenseShare_expenseId_participantId_key" ON "QuickRoomExpenseShare"("expenseId", "participantId");

-- CreateIndex
CREATE INDEX "QuickRoomSettlement_roomId_idx" ON "QuickRoomSettlement"("roomId");

-- AddForeignKey
ALTER TABLE "QuickRoomParticipant" ADD CONSTRAINT "QuickRoomParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "QuickRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickRoomExpense" ADD CONSTRAINT "QuickRoomExpense_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "QuickRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickRoomExpense" ADD CONSTRAINT "QuickRoomExpense_paidByParticipantId_fkey" FOREIGN KEY ("paidByParticipantId") REFERENCES "QuickRoomParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickRoomExpense" ADD CONSTRAINT "QuickRoomExpense_createdByParticipantId_fkey" FOREIGN KEY ("createdByParticipantId") REFERENCES "QuickRoomParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickRoomExpenseShare" ADD CONSTRAINT "QuickRoomExpenseShare_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "QuickRoomExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickRoomExpenseShare" ADD CONSTRAINT "QuickRoomExpenseShare_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "QuickRoomParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickRoomSettlement" ADD CONSTRAINT "QuickRoomSettlement_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "QuickRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickRoomSettlement" ADD CONSTRAINT "QuickRoomSettlement_fromParticipantId_fkey" FOREIGN KEY ("fromParticipantId") REFERENCES "QuickRoomParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickRoomSettlement" ADD CONSTRAINT "QuickRoomSettlement_toParticipantId_fkey" FOREIGN KEY ("toParticipantId") REFERENCES "QuickRoomParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve basic monetary invariants independently of HTTP validation.
ALTER TABLE "QuickRoomExpense" ADD CONSTRAINT "QuickRoomExpense_positive_amount" CHECK ("amount" > 0);
ALTER TABLE "QuickRoomExpenseShare" ADD CONSTRAINT "QuickRoomExpenseShare_nonnegative_amount" CHECK ("amount" >= 0);
ALTER TABLE "QuickRoomSettlement" ADD CONSTRAINT "QuickRoomSettlement_valid_payment" CHECK ("amount" > 0 AND "fromParticipantId" <> "toParticipantId");
