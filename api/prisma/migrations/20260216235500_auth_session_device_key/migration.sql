-- Add device key to allow per-device session reuse
ALTER TABLE "AuthSession"
ADD COLUMN "deviceKey" TEXT;

CREATE INDEX "AuthSession_userId_deviceKey_revokedAt_idx"
ON "AuthSession"("userId", "deviceKey", "revokedAt");
