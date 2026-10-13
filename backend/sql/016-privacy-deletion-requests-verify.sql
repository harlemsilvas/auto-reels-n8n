\set ON_ERROR_STOP on
DO $$
BEGIN
  IF to_regclass('public.socialbot_deletion_requests') IS NULL OR
     to_regclass('public.socialbot_deletion_tasks') IS NULL THEN
    RAISE EXCEPTION 'Migration 016 ausente';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public'
    AND table_name='socialbot_deletion_requests' AND column_name IN
    ('id','conversation_id','account_id','instagram_user_id','state','created_by_user_id',
      'verified_by_user_id','verification_method','verification_reference','created_at','verified_at')) <> 11 THEN
    RAISE EXCEPTION 'Schema de pedidos incompleto';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public'
    AND table_name='socialbot_deletion_tasks' AND column_name IN
    ('request_id','kind','state','details','updated_at')) <> 5 THEN
    RAISE EXCEPTION 'Schema de tarefas incompleto';
  END IF;
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name IN ('socialbot_deletion_requests','socialbot_deletion_tasks') AND
    ((column_name IN ('id','conversation_id','account_id','created_by_user_id','verified_by_user_id','request_id') AND data_type <> 'uuid')
    OR (column_name IN ('created_at','verified_at','updated_at') AND data_type <> 'timestamp with time zone')
    OR (column_name IN ('instagram_user_id','state','verification_method','verification_reference','kind') AND data_type <> 'text')
    OR (column_name='details' AND data_type <> 'jsonb'))) THEN
    RAISE EXCEPTION 'Tipos de pedidos/tarefas invalidos';
  END IF;
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND ((table_name='socialbot_deletion_requests' AND column_name IN
      ('id','conversation_id','account_id','instagram_user_id','state','created_by_user_id','created_at'))
    OR (table_name='socialbot_deletion_tasks' AND column_name IN ('request_id','kind','state','details','updated_at')))
    AND is_nullable <> 'NO') THEN
    RAISE EXCEPTION 'Nulabilidade de pedidos/tarefas invalida';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid=to_regclass('public.socialbot_deletion_requests')
    AND contype='f' AND confrelid=to_regclass('public.socialbot_users') AND confdeltype='a') <> 2 THEN
    RAISE EXCEPTION 'FK de operadores invalida';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.socialbot_deletion_tasks')
    AND contype='f' AND confrelid=to_regclass('public.socialbot_deletion_requests') AND confdeltype='a') THEN
    RAISE EXCEPTION 'FK de tarefas invalida';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_attribute a
    ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0] JOIN pg_attribute b
    ON b.attrelid=i.indrelid AND b.attnum=i.indkey[1]
    WHERE i.indexrelid=to_regclass('public.idx_socialbot_deletion_requests_open_scope')
      AND i.indisunique AND i.indisvalid AND i.indnkeyatts=2 AND i.indpred IS NOT NULL
      AND a.attname='account_id' AND b.attname='instagram_user_id') THEN
    RAISE EXCEPTION 'Indice de escopo invalido';
  END IF;
END $$;
