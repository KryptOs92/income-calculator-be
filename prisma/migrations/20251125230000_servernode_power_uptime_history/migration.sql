-- Create history tables for server node power and uptime
CREATE TABLE `ServerNodePower` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `serverNodeId` INTEGER NOT NULL,
    `Wh` DOUBLE NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ServerNodeUptime` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `serverNodeId` INTEGER NOT NULL,
    `dailyUptimeSeconds` INTEGER NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Migrate existing data into history tables
INSERT INTO `ServerNodePower` (`serverNodeId`, `Wh`, `effectiveFrom`, `effectiveTo`, `createdAt`)
SELECT `id`, `Wh`, `createdAt`, NULL, `createdAt` FROM `ServerNode`;

INSERT INTO `ServerNodeUptime` (`serverNodeId`, `dailyUptimeSeconds`, `effectiveFrom`, `effectiveTo`, `createdAt`)
SELECT `id`, `dailyUptimeSeconds`, `createdAt`, NULL, `createdAt` FROM `ServerNode`;

-- Remove columns now managed via history tables
ALTER TABLE `ServerNode` DROP COLUMN `Wh`,
    DROP COLUMN `dailyUptimeSeconds`;

-- Foreign keys and indexes
ALTER TABLE `ServerNodePower` ADD CONSTRAINT `ServerNodePower_serverNodeId_fkey` FOREIGN KEY (`serverNodeId`) REFERENCES `ServerNode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ServerNodeUptime` ADD CONSTRAINT `ServerNodeUptime_serverNodeId_fkey` FOREIGN KEY (`serverNodeId`) REFERENCES `ServerNode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX `ServerNodePower_serverNodeId_effectiveFrom_idx` ON `ServerNodePower`(`serverNodeId`, `effectiveFrom`);
CREATE INDEX `ServerNodeUptime_serverNodeId_effectiveFrom_idx` ON `ServerNodeUptime`(`serverNodeId`, `effectiveFrom`);
