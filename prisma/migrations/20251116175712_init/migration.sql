/*
  Warnings:

  - You are about to drop the column `logoUrl` on the `Crypto` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Crypto` DROP COLUMN `logoUrl`,
    ADD COLUMN `isReady` BOOLEAN NOT NULL DEFAULT false AFTER `symbol`;
