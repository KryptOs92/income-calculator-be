-- AlterTable
ALTER TABLE `User` ADD COLUMN `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `passwordResetToken` VARCHAR(191) NULL,
    ADD COLUMN `passwordResetTokenExpires` DATETIME(3) NULL,
    ADD COLUMN `verificationToken` VARCHAR(191) NULL,
    ADD COLUMN `verificationTokenExpires` DATETIME(3) NULL;
