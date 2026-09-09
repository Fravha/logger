/*
  Warnings:

  - A unique constraint covering the columns `[user_id]` on the table `user_roles` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_key" ON "user_roles"("user_id");
