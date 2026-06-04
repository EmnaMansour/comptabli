-- AlterTable
ALTER TABLE "Document" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Request" ADD COLUMN "dueDate" TIMESTAMP(3);

CREATE INDEX "Document_archived_idx" ON "Document"("archived");
