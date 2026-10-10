\set ON_ERROR_STOP on
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'instagram_conversations'
      AND column_name = 'testers_hidden_at'
      AND data_type = 'timestamp with time zone' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'testers_hidden_at ausente ou incompativel';
  END IF;
END $$;
