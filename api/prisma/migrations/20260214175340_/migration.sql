DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'AgendaView'
  ) THEN
    ALTER TABLE "AgendaView" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;
