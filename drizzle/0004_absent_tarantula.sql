ALTER TABLE `brandMentions` MODIFY COLUMN `brandName` varchar(200) NOT NULL;--> statement-breakpoint
ALTER TABLE `brandMentions` MODIFY COLUMN `isSarcastic` boolean;--> statement-breakpoint
ALTER TABLE `brandMentions` ADD `recommendationStrength` enum('strong_positive','positive','neutral','negative','strong_negative');--> statement-breakpoint
ALTER TABLE `brandMentions` ADD `mentionContext` enum('comparison','review','qa','purchase_advice','tutorial','other');--> statement-breakpoint
ALTER TABLE `brandMentions` ADD `llmAnalysis` text;