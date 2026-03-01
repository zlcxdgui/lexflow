-- Remove legado de papel ADMIN em nível de escritório.
-- ADMIN passa a ser somente admin de plataforma (User.isPlatformAdmin).
UPDATE "TenantMember"
SET "role" = 'OWNER'
WHERE upper("role") = 'ADMIN';

UPDATE "TenantInvite"
SET "role" = 'OWNER'
WHERE upper("role") = 'ADMIN';
