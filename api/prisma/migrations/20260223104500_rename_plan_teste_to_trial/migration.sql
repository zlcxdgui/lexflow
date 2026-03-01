-- Rename technical key of trial plan
UPDATE "Plan"
SET "key" = 'TRIAL',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'TESTE';
