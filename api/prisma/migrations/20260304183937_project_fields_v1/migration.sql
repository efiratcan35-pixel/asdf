/*
  Warnings:

  - You are about to drop the column `type` on the `Project` table. All the data in the column will be lost.
  - Added the required column `baySpacingM` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `buildingType` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hallCount` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hallWidthM` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "name" TEXT,
    "buildingType" TEXT NOT NULL,
    "lengthM" REAL NOT NULL,
    "widthM" REAL NOT NULL,
    "heightM" REAL NOT NULL,
    "hasCraneBeam" BOOLEAN NOT NULL DEFAULT false,
    "hasLoadingRamp" BOOLEAN NOT NULL DEFAULT false,
    "rampCount" INTEGER NOT NULL DEFAULT 0,
    "doorCount" INTEGER NOT NULL DEFAULT 1,
    "baySpacingM" REAL NOT NULL,
    "hallCount" INTEGER NOT NULL,
    "hallWidthM" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("createdAt", "heightM", "id", "lengthM", "name", "updatedAt", "userId", "widthM") SELECT "createdAt", "heightM", "id", "lengthM", "name", "updatedAt", "userId", "widthM" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
