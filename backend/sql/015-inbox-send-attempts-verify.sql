\set ON_ERROR_STOP on
DO $$
BEGIN
  IF to_regclass('public.instagram_send_attempts') IS NULL THEN
    RAISE EXCEPTION 'Migration 015 ausente';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='instagram_send_attempts' AND
      ((column_name IN ('id','conversation_id','message_id') AND data_type <> 'uuid')
       OR (column_name IN ('content_hash','message_text','recipient_id','sender_id','state','meta_message_id') AND data_type <> 'text')
       OR (column_name='response' AND data_type <> 'jsonb')
       OR (column_name IN ('created_at','updated_at','sent_at') AND data_type <> 'timestamp with time zone')
       OR (column_name IN ('id','conversation_id','content_hash','message_text','recipient_id','state','created_at','updated_at')
           AND is_nullable <> 'NO'))) THEN
    RAISE EXCEPTION 'Tipos/nulabilidade de tentativas invalidos';
  END IF;
  IF (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'instagram_send_attempts' AND column_name IN
      ('id', 'conversation_id', 'content_hash', 'message_text', 'recipient_id', 'sender_id',
       'state', 'meta_message_id', 'response', 'message_id', 'created_at', 'updated_at', 'sent_at')) <> 13 THEN
    RAISE EXCEPTION 'Schema de tentativas incompleto';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.instagram_send_attempts')
      AND contype='f' AND confrelid=to_regclass('public.instagram_conversations'))
      OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.instagram_send_attempts')
      AND contype='f' AND confrelid=to_regclass('public.instagram_messages')) THEN
    RAISE EXCEPTION 'Referencias de tentativas invalidas';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_attribute a
      ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
      WHERE i.indexrelid = to_regclass('public.idx_instagram_send_attempts_active')
      AND i.indisunique AND i.indisvalid AND i.indpred IS NOT NULL
      AND i.indnkeyatts=1 AND a.attname='conversation_id') THEN
    RAISE EXCEPTION 'Indice de tentativa ativa ausente/invalido';
  END IF;
END $$;
