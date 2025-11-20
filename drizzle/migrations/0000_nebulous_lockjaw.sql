CREATE TABLE `actionItems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sessionId` integer NOT NULL,
	`actionType` text NOT NULL,
	`priority` text NOT NULL,
	`title` text(255) NOT NULL,
	`description` text NOT NULL,
	`tactic` text,
	`referenceSource` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `analysisSessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`projectId` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`startedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`completedAt` integer,
	`errorMessage` text
);
--> statement-breakpoint
CREATE TABLE `apiKeys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`provider` text NOT NULL,
	`apiKey` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `brandMentions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`responseId` integer NOT NULL,
	`brandName` text(200) NOT NULL,
	`sentimentScore` integer NOT NULL,
	`rankPosition` integer,
	`isSarcastic` integer DEFAULT false,
	`context` text,
	`recommendationStrength` text,
	`mentionContext` text,
	`llmAnalysis` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `citationSources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`responseId` integer NOT NULL,
	`url` text NOT NULL,
	`domain` text(255) NOT NULL,
	`sourceType` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `derivativeQueries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seedKeywordId` integer NOT NULL,
	`queryText` text NOT NULL,
	`generationType` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `domainCategories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`domain` text(255) NOT NULL,
	`category` text NOT NULL,
	`market` text DEFAULT 'BOTH' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domainCategories_domain_unique` ON `domainCategories` (`domain`);--> statement-breakpoint
CREATE TABLE `engineResponses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sessionId` integer NOT NULL,
	`queryId` integer NOT NULL,
	`engineId` integer NOT NULL,
	`rawContent` text NOT NULL,
	`citations` text,
	`hallucinationScore` integer,
	`hallucinationConfidence` text,
	`hallucinationIssues` text,
	`hallucinationSummary` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `executionLogs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sessionId` integer NOT NULL,
	`level` text NOT NULL,
	`message` text NOT NULL,
	`details` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`projectName` text(255) NOT NULL,
	`targetMarket` text NOT NULL,
	`brandName` text(255) NOT NULL,
	`competitors` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sarcasmCorpus` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`market` text NOT NULL,
	`platform` text(50) NOT NULL,
	`text` text NOT NULL,
	`explanation` text,
	`category` text NOT NULL,
	`createdBy` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `seedKeywords` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`projectId` integer NOT NULL,
	`keyword` text(255) NOT NULL,
	`searchVolume` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `targetEngines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`engineName` text(100) NOT NULL,
	`modelVersion` text(100),
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text(64) NOT NULL,
	`name` text,
	`email` text(320),
	`loginMethod` text(64),
	`role` text DEFAULT 'user' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`lastSignedIn` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);