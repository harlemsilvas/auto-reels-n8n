\set ON_ERROR_STOP on
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'instagram_messages'
      AND column_name = 'inbox_unread' AND data_type = 'boolean'
      AND is_nullable = 'NO' AND column_default = 'false'
  ) THEN RAISE EXCEPTION 'inbox_unread ausente ou incompativel'; END IF;
END $$;
