/*
  Warnings:

  - You are about to drop the column `title` on the `CalendarEvent` table. All the data in the column will be lost.
  - You are about to drop the column `message` on the `SlackMessage` table. All the data in the column will be lost.
  - Added the required column `summary` to the `CalendarEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `text` to the `SlackMessage` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "VSCodeActivity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspace" TEXT NOT NULL,
    "file" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ScreenOCR" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CalendarEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "summary" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_CalendarEvent" ("endTime", "id", "startTime", "timestamp") SELECT "endTime", "id", "startTime", "timestamp" FROM "CalendarEvent";
DROP TABLE "CalendarEvent";
ALTER TABLE "new_CalendarEvent" RENAME TO "CalendarEvent";
CREATE TABLE "new_SlackMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "channel" TEXT NOT NULL,
    "user" TEXT,
    "text" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SlackMessage" ("channel", "id", "timestamp") SELECT "channel", "id", "timestamp" FROM "SlackMessage";
DROP TABLE "SlackMessage";
ALTER TABLE "new_SlackMessage" RENAME TO "SlackMessage";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
