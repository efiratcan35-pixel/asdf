-- CreateTable
CREATE TABLE "ModelRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "engineVersion" TEXT NOT NULL DEFAULT 'v1',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModelElement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "modelRunId" INTEGER NOT NULL,
    "elementType" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "geomType" TEXT NOT NULL,
    "geom" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelElement_modelRunId_fkey" FOREIGN KEY ("modelRunId") REFERENCES "ModelRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
