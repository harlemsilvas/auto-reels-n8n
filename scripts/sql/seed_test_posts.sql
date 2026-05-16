BEGIN;

DO $$
DECLARE
  v_workspace_id uuid;
  v_account_id uuid;
BEGIN
  SELECT ia.workspace_id, ia.id
    INTO v_workspace_id, v_account_id
  FROM instagram_accounts ia
  WHERE ia.deleted_at IS NULL
    AND ia.ativo = true
  ORDER BY ia.created_at ASC
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma conta ativa encontrada em instagram_accounts.';
  END IF;

  -- Cria 5 uploads + 5 posts de teste para analise do fluxo.
  WITH seed_data AS (
    SELECT *
    FROM (VALUES
      (1, 'pippit_20260513_potenza_yamaha_dd0d9052.mp4', 'Lote teste 01 - video real ja existente no pending', 'pending'::post_status, NOW() - INTERVAL '40 minutes'),
      (2, 'video_teste_c90e7f8d.mp4', 'Lote teste 02 - video real ja existente no pending', 'pending'::post_status, NOW() - INTERVAL '35 minutes'),
      (3, 'seed_test_03.mp4', 'Lote teste 03 - pendente para monitoramento', 'pending'::post_status, NOW() - INTERVAL '30 minutes'),
      (4, 'seed_test_04.mp4', 'Lote teste 04 - pendente para monitoramento', 'pending'::post_status, NOW() - INTERVAL '25 minutes'),
      (5, 'seed_test_05.mp4', 'Lote teste 05 - pendente para monitoramento', 'pending'::post_status, NOW() - INTERVAL '20 minutes')
    ) AS t(idx, stored_filename, caption, status, created_at)
  ),
  ins_uploads AS (
    INSERT INTO uploads (
      id,
      original_filename,
      stored_filename,
      mime_type,
      file_size,
      storage_path,
      storage_status,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      sd.stored_filename,
      sd.stored_filename,
      'video/mp4',
      1048576,
      '/home/socialbot/media/reels/pending/' || sd.stored_filename,
      'local'::storage_status,
      sd.created_at,
      sd.created_at
    FROM seed_data sd
    RETURNING id, stored_filename, created_at
  ),
  ins_posts AS (
    INSERT INTO posts (
      id,
      workspace_id,
      account_id,
      upload_id,
      caption,
      source_path,
      status,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      v_workspace_id,
      v_account_id,
      u.id,
      sd.caption,
      '/home/socialbot/media/reels/pending/' || sd.stored_filename,
      sd.status,
      sd.created_at,
      sd.created_at
    FROM ins_uploads u
    JOIN seed_data sd ON sd.stored_filename = u.stored_filename
    RETURNING id, status, created_at
  )
  INSERT INTO post_events (post_id, event_type, details, created_at)
  SELECT
    p.id,
    'seed_inserted',
    jsonb_build_object(
      'source', 'seed_test_posts.sql',
      'note', 'post criado para testes de analise',
      'status', p.status
    ),
    p.created_at
  FROM ins_posts p;
END $$;

COMMIT;

-- Conferencia rapida do lote gerado
SELECT
  p.id,
  p.status,
  u.stored_filename,
  p.caption,
  p.created_at
FROM posts p
LEFT JOIN uploads u ON u.id = p.upload_id
WHERE p.created_at >= NOW() - INTERVAL '2 hours'
ORDER BY p.created_at DESC
LIMIT 10;
