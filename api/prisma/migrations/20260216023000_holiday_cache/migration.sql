-- CreateTable
CREATE TABLE "HolidayCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'BR',
    "uf" TEXT,
    "city" TEXT,
    "payloadJson" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HolidayCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HolidayCache_cacheKey_key" ON "HolidayCache"("cacheKey");

-- CreateIndex
CREATE INDEX "HolidayCache_year_uf_city_idx" ON "HolidayCache"("year", "uf", "city");
