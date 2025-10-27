-- CreateTable
CREATE TABLE `Crypto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `symbol` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Crypto_symbol_key`(`symbol`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserCryptoAddress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `cryptoId` INTEGER NOT NULL,
    `label` VARCHAR(191) NULL,
    `address` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserCryptoAddress_address_key`(`address`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CryptoInflow` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `addressId` INTEGER NOT NULL,
    `txHash` VARCHAR(191) NULL,
    `amount` DECIMAL(65, 30) NOT NULL,
    `detectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fiatValue` DECIMAL(65, 30) NULL,
    `fiatCurrency` VARCHAR(191) NULL DEFAULT 'USD',
    `priceSource` VARCHAR(191) NULL,
    `priceTimestamp` DATETIME(3) NULL,

    UNIQUE INDEX `CryptoInflow_txHash_key`(`txHash`),
    INDEX `CryptoInflow_addressId_detectedAt_idx`(`addressId`, `detectedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServerNode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `powerKw` DOUBLE NOT NULL,
    `dailyUptimeSeconds` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EnergyRate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `serverNodeId` INTEGER NOT NULL,
    `costPerKwh` DECIMAL(10, 4) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'EUR',
    `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `effectiveTo` DATETIME(3) NULL,

    INDEX `EnergyRate_serverNodeId_effectiveFrom_idx`(`serverNodeId`, `effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserCryptoAddress` ADD CONSTRAINT `UserCryptoAddress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserCryptoAddress` ADD CONSTRAINT `UserCryptoAddress_cryptoId_fkey` FOREIGN KEY (`cryptoId`) REFERENCES `Crypto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CryptoInflow` ADD CONSTRAINT `CryptoInflow_addressId_fkey` FOREIGN KEY (`addressId`) REFERENCES `UserCryptoAddress`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServerNode` ADD CONSTRAINT `ServerNode_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnergyRate` ADD CONSTRAINT `EnergyRate_serverNodeId_fkey` FOREIGN KEY (`serverNodeId`) REFERENCES `ServerNode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
