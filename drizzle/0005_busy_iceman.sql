CREATE TABLE `sarcasmCorpus` (
	`id` int AUTO_INCREMENT NOT NULL,
	`market` enum('taiwan','japan') NOT NULL,
	`platform` varchar(50) NOT NULL,
	`text` text NOT NULL,
	`explanation` text,
	`category` enum('irony','sarcasm','understatement','exaggeration','other') NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sarcasmCorpus_id` PRIMARY KEY(`id`)
);
